import { createHash } from "node:crypto";
import { db } from "./db.ts";
import { postMemo, solanaKeypair, connection } from "./solana.ts";

/**
 * The receipt log: every hour, the receipts issued since the last anchor become the leaves of a Merkle tree whose root
 * is posted to Solana in a memo signed by the gateway's TEE-held key. Each receipt stores its proof, so anyone can
 * show a receipt existed, unaltered, at that time — without trusting Tinted's database.
 *
 * leaf = sha256("tinted-receipt:" + receipt id + ":" + receipt signature)  (the signature covers the whole receipt)
 * node = sha256(left ‖ right), an odd node is paired with itself
 * memo = "tinted:log:v1:<root hex>:<leaf count>:<first receipt id>:<last receipt id>"
 */
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest();
export const leafOf = (id: string, signature: string) => sha(`tinted-receipt:${id}:${signature}`);

export function merkle(leaves: Buffer[]) {
  const levels: Buffer[][] = [leaves];
  while (levels.at(-1)!.length > 1) {
    const cur = levels.at(-1)!;
    const next: Buffer[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(sha(Buffer.concat([cur[i], cur[i + 1] ?? cur[i]])));
    levels.push(next);
  }
  const proof = (index: number) => {
    const out: { sibling: string; right: boolean }[] = [];
    let i = index;
    for (const level of levels.slice(0, -1)) {
      const sib = i % 2 === 0 ? (level[i + 1] ?? level[i]) : level[i - 1];
      out.push({ sibling: sib.toString("hex"), right: i % 2 === 0 });
      i = Math.floor(i / 2);
    }
    return out;
  };
  return { root: levels.at(-1)![0], proof };
}

export function verifyInclusion(leaf: Buffer, proof: { sibling: string; right: boolean }[], root: string): boolean {
  let h = leaf;
  for (const p of proof) h = sha(p.right ? Buffer.concat([h, Buffer.from(p.sibling, "hex")]) : Buffer.concat([Buffer.from(p.sibling, "hex"), h]));
  return h.toString("hex") === root;
}

let running = false;
/** Anchor everything not yet anchored (up to 20k receipts per memo). Skips quietly when there's nothing or no SOL. */
export async function anchorPending(): Promise<{ anchored: number; signature?: string; skipped?: string }> {
  if (running) return { anchored: 0, skipped: "already running" };
  running = true;
  try {
    const q = await db();
    const rows = await q<{ id: string; signature: string }>("select id, signature from receipts where anchor is null order by created_at, id limit 20000");
    if (!rows.length) return { anchored: 0, skipped: "nothing to anchor" };
    const lamports = await connection().getBalance(solanaKeypair().publicKey).catch(() => 0);
    if (lamports < 10_000) return { anchored: 0, skipped: `log key ${solanaKeypair().publicKey.toBase58()} needs SOL for fees` };
    const tree = merkle(rows.map((r) => leafOf(r.id, r.signature)));
    const root = tree.root.toString("hex");
    const signature = await postMemo(`tinted:log:v1:${root}:${rows.length}:${rows[0].id}:${rows.at(-1)!.id}`);
    const at = new Date().toISOString();
    for (let i = 0; i < rows.length; i++)
      await q("update receipts set anchor = $2 where id = $1", [rows[i].id, JSON.stringify({ chain: "solana", tx: signature, root, index: i, count: rows.length, at, proof: tree.proof(i) })]);
    return { anchored: rows.length, signature };
  } finally {
    running = false;
  }
}
