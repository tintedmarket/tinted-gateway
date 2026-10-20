// Devnet test of the receipt log: make receipts, anchor them via a memo, verify inclusion against the on-chain memo.
import { readFileSync } from "node:fs";
process.env.SOLANA_RPC_URL = process.env.DEVNET_RPC ?? "https://api.devnet.solana.com";
process.env.TINTED_SOLANA_SEED = "tinted-devnet-test";
process.env.DATABASE_URL = "";
const { solanaKeypair, connection } = await import("../src/gateway/solana.ts");
const { anchorPending, leafOf, verifyInclusion } = await import("../src/gateway/anchor.ts");
const { makeReceipt } = await import("../src/gateway/receipts.ts");
const { db } = await import("../src/gateway/db.ts");
const kp = solanaKeypair();
console.log("log key:", kp.publicKey.toBase58());
const bal = await connection().getBalance(kp.publicKey);
if (bal < 10_000) {
  try { const sig = await connection().requestAirdrop(kp.publicKey, 50_000_000); await connection().confirmTransaction(sig, "confirmed"); console.log("airdropped 0.05 SOL"); }
  catch (e) { console.log("airdrop failed:", String(e).slice(0, 120)); }
}
const q = await db();
const fakeV = { provider: "t", model: "m", checkedAt: "", claims: { hardware: { state: "verified", detail: "" }, gpu: { state: "verified", detail: "" }, software: { state: "verified", detail: "" }, weights: { state: "provider", detail: "" }, keys: { state: "verified", detail: "" } }, boundKeys: {}, evidence: {} } as never;
for (let i = 0; i < 5; i++) {
  const r = makeReceipt({ listing: "test/m", request: `req${i}`, response: `res${i}`, usage: { input: 1, output: 1 }, costMicros: 1, verification: fakeV, providerProof: {} });
  await q("insert into receipts (id, account_id, body, signature) values ($1, $2, $3, $4)", [r.body.id, "test", JSON.stringify(r.body), r.signature]);
}
const res = await anchorPending();
console.log("anchor:", JSON.stringify(res));
const [row] = await q<{ id: string; signature: string; anchor: { tx: string; root: string; proof: { sibling: string; right: boolean }[] } }>("select id, signature, anchor from receipts where anchor is not null order by created_at desc limit 1");
if (row) {
  const tx = await connection().getParsedTransaction(row.anchor.tx, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  const memo = (tx?.transaction.message.instructions.find((i) => "parsed" in i && typeof i.parsed === "string") as { parsed: string } | undefined)?.parsed;
  console.log("on-chain memo:", memo);
  console.log("memo signed by log key:", tx?.transaction.message.accountKeys.some((k) => k.signer && k.pubkey.equals(kp.publicKey)));
  console.log("receipt included under on-chain root:", memo?.includes(row.anchor.root) && verifyInclusion(leafOf(row.id, row.signature), row.anchor.proof, row.anchor.root));
}
process.exit(0);
