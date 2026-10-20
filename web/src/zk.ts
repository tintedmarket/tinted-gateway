import { poseidon1 } from "poseidon-lite/poseidon1";
import { poseidon2 } from "poseidon-lite/poseidon2";
import { poseidon3 } from "poseidon-lite/poseidon3";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { api } from "./api";

/**
 * Anonymous credit notes, entirely in the browser: the note's secrets never leave this page. Redeeming downloads the
 * whole public tree and finds the note locally, so the gateway never learns which leaf is being spent.
 */
export const LEVELS = 20;
const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const hex = (n: bigint) => n.toString(16).padStart(64, "0");
const rand31 = () => BigInt("0x" + bytesToHex(crypto.getRandomValues(new Uint8Array(31))));

export interface Note {
  denomUsd: number;
  ns: bigint;
  s: bigint;
}
export const denomMicros = (n: Note) => BigInt(Math.round(n.denomUsd * 1e6));
export const commitment = (n: Note) => poseidon3([n.ns, n.s, denomMicros(n)]);
export const newNote = (denomUsd: number): Note => ({ denomUsd, ns: rand31(), s: rand31() });
export const noteString = (n: Note) => `tinted-note-v1-${n.denomUsd}-${hex(n.ns)}-${hex(n.s)}`;
export const noteMemo = (n: Note) => `tinted:note:${hex(commitment(n))}`;
export function parseNote(text: string): Note | null {
  const m = text.trim().match(/^tinted-note-v1-(\d+)-([0-9a-f]{64})-([0-9a-f]{64})$/);
  return m ? { denomUsd: Number(m[1]), ns: BigInt("0x" + m[2]), s: BigInt("0x" + m[3]) } : null;
}

export const newKey = () => "tnt_" + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const keyHash = (key: string) => bytesToHex(sha256(utf8ToBytes(key)));

export async function allLeaves(): Promise<bigint[]> {
  const out: bigint[] = [];
  for (;;) {
    const page = await api.leaves(out.length);
    out.push(...page.leaves.map((l) => BigInt("0x" + l)));
    if (!page.leaves.length || out.length >= page.size) return out;
  }
}

export async function noteInTree(n: Note): Promise<boolean> {
  const c = commitment(n);
  return (await allLeaves()).some((l) => l === c);
}

/** Build the Merkle path locally and prove ownership, bound to the hash of the key that will receive the credit. */
export async function proveNote(n: Note, key: string, onStep: (s: string) => void) {
  onStep("Downloading the public note tree…");
  const leaves = await allLeaves();
  let idx = leaves.findIndex((l) => l === commitment(n));
  if (idx < 0) throw new Error("This note isn't in the tree yet. If you just paid, wait a minute and try again.");
  onStep(`Found your note among ${leaves.length}. Building the path locally…`);
  const zeros = [0n];
  for (let i = 1; i <= LEVELS; i++) zeros.push(poseidon2([zeros[i - 1], zeros[i - 1]]));
  let level = leaves;
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  for (let i = 0; i < LEVELS; i++) {
    pathElements.push(String(level[idx ^ 1] ?? zeros[i]));
    pathIndices.push(idx & 1);
    const next: bigint[] = [];
    for (let j = 0; j < level.length; j += 2) next.push(poseidon2([level[j], level[j + 1] ?? zeros[i]]));
    level = next.length ? next : [zeros[i + 1]];
    idx >>= 1;
  }
  const kh = keyHash(key);
  const input = {
    root: String(level[0]),
    nullifierHash: String(poseidon1([n.ns])),
    denom: String(denomMicros(n)),
    sessionKey: String(BigInt("0x" + kh) % FIELD),
    nullifierSecret: String(n.ns),
    secret: String(n.s),
    pathElements,
    pathIndices,
  };
  onStep("Generating the zero-knowledge proof in your browser…");
  const snarkjs = await import("snarkjs");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, "/zk/credit.wasm", "/zk/credit.zkey");
  return { proof, publicSignals: publicSignals as string[], keyHash: kh };
}
