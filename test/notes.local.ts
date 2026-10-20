// Anonymous credits end to end, locally: three note deposits, a client-side proof for one, redeem, and the attacks.
// Run from an empty directory (it creates ./.data): node <repo>/test/notes.local.ts
import { createHash, randomBytes } from "node:crypto";
import { poseidon1, poseidon2, poseidon3 } from "poseidon-lite";
import * as snarkjs from "snarkjs";
import { addNote, leaves, LEVELS, redeem, sessionKeyOf, treeState } from "../src/gateway/notes.ts";
import { db } from "../src/gateway/db.ts";

const rnd = () => BigInt("0x" + randomBytes(31).toString("hex"));
const hex = (n: bigint) => n.toString(16).padStart(64, "0");
const DENOM = 10_000_000n;
const wasm = new URL("../zk/build/credit_js/credit.wasm", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const zkey = new URL("../zk/build/credit.zkey", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");

const notes = [0, 1, 2].map(() => ({ ns: rnd(), s: rnd() }));
for (const [i, n] of notes.entries()) console.log(`deposit ${i}:`, (await addNote(hex(poseidon3([n.ns, n.s, DENOM])), Number(DENOM), "sig" + i)) ?? "added");
console.log("wrong amount rejected:", await addNote(hex(poseidon3([rnd(), rnd(), DENOM])), 7_000_000, "sigX"));

// Client side: download every leaf, rebuild the tree locally, never ask the server about our own leaf.
async function prove(note: { ns: bigint; s: bigint }, key: string) {
  const all = (await leaves(0)).leaves.map((l) => BigInt("0x" + l));
  const mine = poseidon3([note.ns, note.s, DENOM]);
  let idx = all.findIndex((l) => l === mine);
  const zeros = [0n];
  for (let i = 1; i <= LEVELS; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  let level = all;
  const pathElements: string[] = [], pathIndices: number[] = [];
  for (let i = 0; i < LEVELS; i++) {
    pathElements.push(String(level[idx ^ 1] ?? zeros[i]));
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let j = 0; j < level.length; j += 2) next.push(poseidon2([level[j], level[j + 1] ?? zeros[i]]));
    level = next.length ? next : [zeros[i + 1]];
    idx >>= 1;
  }
  const keyHash = createHash("sha256").update(key).digest("hex");
  const input = { root: String(level[0]), nullifierHash: String(poseidon1([note.ns])), denom: String(DENOM), sessionKey: sessionKeyOf(keyHash), nullifierSecret: String(note.ns), secret: String(note.s), pathElements, pathIndices };
  const t = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
  console.log(`proof in ${Date.now() - t} ms; local root matches server: ${hex(level[0]) === (await treeState()).root}`);
  return { proof, publicSignals, keyHash };
}

const key = "tnt_" + randomBytes(24).toString("base64url");
const p = await prove(notes[1], key);
console.log("redeem:", await redeem(p));
console.log("double spend (must fail):", await redeem(p));
const p2 = await prove(notes[2], key);
console.log("steal: same proof, attacker's key (must fail):", await redeem({ ...p2, keyHash: createHash("sha256").update("tnt_attacker").digest("hex") }));
const atk = createHash("sha256").update("tnt_attacker").digest("hex");
const swapped = { ...p2, keyHash: atk, publicSignals: [...p2.publicSignals] };
swapped.publicSignals[3] = sessionKeyOf(atk);
console.log("steal: rewrite the session key too (must fail):", await redeem(swapped));
const forged = { ...p2, publicSignals: [...p2.publicSignals] };
forged.publicSignals[2] = "200000000";
console.log("inflate: claim $200 on a $10 note (must fail):", await redeem(forged));
console.log("second note, same key:", await redeem(p2));
const q = await db();
console.log("balance:", (await q<{ balance_micros: string }>("select balance_micros from accounts where key_hash = $1", [p.keyHash]))[0].balance_micros, "micros (expect 20000000)");
process.exit(0);
