import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { poseidon2 } from "poseidon-lite";
import * as snarkjs from "snarkjs";
import { db } from "./db.ts";
import { postMemo, solanaKeypair, connection } from "./solana.ts";

/**
 * Anonymous credits. A deposit pays a fixed amount of USDC with a note commitment as its memo
 * ("tinted:note:<hex>"); the commitment Poseidon(nullifierSecret, secret, denom) goes into a 20-level Poseidon Merkle
 * tree. Redeeming proves, in zero knowledge (zk/credit.circom, Groth16), "I know the secrets of some leaf in this tree"
 * and reveals only Poseidon(nullifierSecret), so a note can be spent once and nobody (the operator included) can tell
 * which deposit it came from. The proof is bound to the hash of the API key it credits, which the client generates
 * itself, so the key never travels before it's paid for and nobody in between can redirect the credit.
 */
export const LEVELS = 20;
export const DENOMS = [10_000_000, 50_000_000, 200_000_000]; // USDC base units = micro-USD: $10, $50, $200
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const noteMemo = /^tinted:note:([0-9a-f]{1,64})$/;

const vk = JSON.parse(readFileSync(new URL("../../zk/vk.json", import.meta.url), "utf8"));
export const vkHash = createHash("sha256").update(JSON.stringify(vk)).digest("hex");

const zeros: bigint[] = [0n];
for (let i = 1; i <= LEVELS; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));

/** Incremental tree (Tornado-style): the rightmost filled node per level is enough to append and get the new root. */
let filled: bigint[] = [];
let size = 0;
let root = zeros[LEVELS];
let loaded: Promise<void> | null = null;

function append(leaf: bigint): bigint {
  let cur = leaf;
  let idx = size;
  for (let i = 0; i < LEVELS; i++) {
    if (idx % 2 === 0) {
      filled[i] = cur;
      cur = poseidon2([cur, zeros[i]]);
    } else cur = poseidon2([filled[i], cur]);
    idx >>= 1;
  }
  size++;
  root = cur;
  return cur;
}

const hex = (n: bigint) => n.toString(16).padStart(64, "0");

async function load() {
  const q = await db();
  const rows = await q<{ commitment: string }>("select commitment from notes order by idx");
  filled = [];
  size = 0;
  root = zeros[LEVELS];
  for (const r of rows) append(BigInt("0x" + r.commitment));
  await q("insert into note_roots (root, count) values ($1, $2) on conflict do nothing", [hex(root), size]);
}
const ready = () => (loaded ??= load().catch((e) => {
  loaded = null;
  throw e;
}));

export async function treeState() {
  await ready();
  return { root: hex(root), size, levels: LEVELS };
}

/** Called by the deposit poller for a USDC transfer whose memo is a note. Returns why it wasn't added, if it wasn't. */
export async function addNote(commitmentHex: string, amountMicros: number, signature: string): Promise<string | null> {
  if (!/^[0-9a-f]{1,64}$/.test(commitmentHex)) return "commitment must be hex";
  if (!DENOMS.includes(amountMicros)) return `amount ${amountMicros / 1e6} USDC isn't a note size (${DENOMS.map((d) => d / 1e6).join(", ")})`;
  const c = BigInt("0x" + commitmentHex);
  if (c === 0n || c >= FIELD) return "commitment out of range";
  await ready();
  const q = await db();
  const [dup] = await q("select 1 from notes where commitment = $1", [hex(c)]);
  if (dup) return "duplicate commitment";
  await q("insert into notes (idx, commitment, denom_micros, signature) values ($1, $2, $3, $4)", [size, hex(c), amountMicros, signature]);
  append(c);
  await q("insert into note_roots (root, count) values ($1, $2) on conflict do nothing", [hex(root), size]);
  return null;
}

export async function leaves(from = 0, limit = 10_000) {
  await ready();
  const q = await db();
  const rows = await q<{ commitment: string }>("select commitment from notes where idx >= $1 order by idx limit $2", [from, limit]);
  return { from, leaves: rows.map((r) => r.commitment), size };
}

/** Field element a client binds its proof to: sha256(api key) as an integer, reduced into the field. */
export const sessionKeyOf = (keyHashHex: string) => (BigInt("0x" + keyHashHex) % FIELD).toString();

export async function redeem(input: { proof: unknown; publicSignals: string[]; keyHash: string }): Promise<{ ok: true; denomMicros: number; newAccount: boolean } | { ok: false; error: string }> {
  const { proof, publicSignals: ps, keyHash } = input;
  if (!Array.isArray(ps) || ps.length !== 4 || !/^[0-9a-f]{64}$/.test(keyHash ?? "")) return { ok: false, error: "malformed redeem request" };
  const [rootDec, nullifierHash, denomStr, sessionKey] = ps;
  const denom = Number(denomStr);
  if (!DENOMS.includes(denom)) return { ok: false, error: "unknown note size" };
  if (sessionKey !== sessionKeyOf(keyHash)) return { ok: false, error: "proof isn't bound to this key" };
  await ready();
  const q = await db();
  const [known] = await q("select 1 from note_roots where root = $1", [hex(BigInt(rootDec))]);
  if (!known) return { ok: false, error: "unknown tree root: refresh the tree and prove again" };
  const [spent] = await q("select 1 from nullifiers where hash = $1", [nullifierHash]);
  if (spent) return { ok: false, error: "this note was already redeemed" };
  if (!(await snarkjs.groth16.verify(vk, ps, proof as never))) return { ok: false, error: "invalid proof" };
  // The primary key makes a concurrent double redeem fail here, before any credit.
  try {
    await q("insert into nullifiers (hash, denom_micros) values ($1, $2)", [nullifierHash, denom]);
  } catch {
    return { ok: false, error: "this note was already redeemed" };
  }
  const [acct] = await q<{ id: string }>("select id from accounts where key_hash = $1", [keyHash]);
  if (acct) await q("update accounts set balance_micros = balance_micros + $2 where id = $1", [acct.id, denom]);
  else await q("insert into accounts (id, key_hash, label, balance_micros) values ($1, $2, 'note', $3)", ["acct_" + randomBytes(8).toString("hex"), keyHash, denom]);
  return { ok: true, denomMicros: denom, newAccount: !acct };
}

/** Post the note tree's root to Solana when it changed, so everyone proves against the same public tree. */
export async function anchorNotes(): Promise<{ signature?: string; skipped?: string }> {
  await ready();
  const q = await db();
  const [r] = await q<{ root: string; count: number; anchor_tx: string | null }>("select root, count, anchor_tx from note_roots where root = $1", [hex(root)]);
  if (!r || r.anchor_tx || size === 0) return { skipped: "nothing new" };
  const lamports = await connection().getBalance(solanaKeypair().publicKey).catch(() => 0);
  if (lamports < 10_000) return { skipped: "log key needs SOL" };
  const signature = await postMemo(`tinted:notes:v1:${r.root}:${size}`);
  await q("update note_roots set anchor_tx = $2 where root = $1", [r.root, signature]);
  return { signature };
}
