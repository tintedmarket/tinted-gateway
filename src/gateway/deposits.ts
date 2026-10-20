import { randomBytes } from "node:crypto";
import { PublicKey, type ParsedTransactionWithMeta } from "@solana/web3.js";
import { db } from "./db.ts";
import { addNote, noteMemo } from "./notes.ts";
import { associatedTokenAddress, connection, MEMO_PROGRAM, USDC_MINT } from "./solana.ts";

/**
 * USDC deposits. Funds go straight to the operator's treasury wallet (TINTED_TREASURY): the gateway never holds them,
 * it only watches the treasury's USDC account and credits the account named in the transfer's memo ("tinted:<code>").
 * 1 USDC (6 decimals) = 1,000,000 base units = 1,000,000 micro-USD of balance. Each transaction is credited once.
 */
export const depositMemo = (code: string) => `tinted:${code}`;

export function treasury(): { owner: PublicKey; usdcAccount: PublicKey } | null {
  const t = process.env.TINTED_TREASURY;
  if (!t) return null;
  const owner = new PublicKey(t);
  return { owner, usdcAccount: associatedTokenAddress(owner) };
}

/** Each account gets a short deposit code the first time it asks. */
export async function depositCode(accountId: string): Promise<string> {
  const q = await db();
  const [a] = await q<{ deposit_code: string | null }>("select deposit_code from accounts where id = $1", [accountId]);
  if (a?.deposit_code) return a.deposit_code;
  const code = randomBytes(5).toString("hex");
  await q("update accounts set deposit_code = $2 where id = $1 and deposit_code is null", [accountId, code]);
  const [b] = await q<{ deposit_code: string }>("select deposit_code from accounts where id = $1", [accountId]);
  return b.deposit_code;
}

/** USDC received by the treasury account in this tx, and the memo text, if any. */
function parse(tx: ParsedTransactionWithMeta, usdcAccount: PublicKey): { amount: number; memo: string | null } {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const idx = keys.indexOf(usdcAccount.toBase58());
  const bal = (list: NonNullable<ParsedTransactionWithMeta["meta"]>["postTokenBalances"]) => Number(list?.find((b) => b.accountIndex === idx && b.mint === USDC_MINT.toBase58())?.uiTokenAmount.amount ?? 0);
  const amount = idx < 0 || !tx.meta ? 0 : bal(tx.meta.postTokenBalances) - bal(tx.meta.preTokenBalances);
  const memoIx = tx.transaction.message.instructions.find((i) => i.programId.equals(MEMO_PROGRAM)) as { parsed?: string } | undefined;
  return { amount, memo: typeof memoIx?.parsed === "string" ? memoIx.parsed : null };
}

let polling = false;
/** Credit new deposits since the last one seen. Safe to call often: credited signatures are recorded. */
export async function pollDeposits(): Promise<{ credited: number; unmatched: number; skipped?: string }> {
  const t = treasury();
  if (!t) return { credited: 0, unmatched: 0, skipped: "TINTED_TREASURY not set" };
  if (polling) return { credited: 0, unmatched: 0, skipped: "already polling" };
  polling = true;
  try {
    const q = await db();
    const [last] = await q<{ signature: string }>("select signature from deposits order by seen_at desc limit 1");
    const sigs = await connection().getSignaturesForAddress(t.usdcAccount, { limit: 100, ...(last ? { until: last.signature } : {}) });
    let credited = 0, unmatched = 0;
    for (const s of sigs.reverse()) {
      if (s.err) continue;
      const [done] = await q("select 1 from deposits where signature = $1", [s.signature]);
      if (done) continue;
      const tx = await connection().getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      if (!tx) continue;
      const { amount, memo } = parse(tx, t.usdcAccount);
      // A note deposit: the memo is a commitment, not an account. It joins the anonymous credit tree, credited to nobody.
      const note = memo?.trim().match(noteMemo)?.[1];
      if (note) {
        const why = amount > 0 ? await addNote(note, amount, s.signature) : "no USDC received";
        await q("insert into deposits (signature, account_id, amount_micros, memo) values ($1, null, $2, $3) on conflict do nothing", [s.signature, amount, why ? `${memo} (not added: ${why})` : memo]);
        if (why) unmatched++;
        else credited++;
        continue;
      }
      const code = memo?.match(/tinted:([0-9a-f]{10})/)?.[1];
      const [acct] = code ? await q<{ id: string }>("select id from accounts where deposit_code = $1", [code]) : [];
      await q("insert into deposits (signature, account_id, amount_micros, memo) values ($1, $2, $3, $4) on conflict do nothing", [s.signature, acct?.id ?? null, amount, memo]);
      if (acct && amount > 0) {
        await q("update accounts set balance_micros = balance_micros + $2 where id = $1", [acct.id, amount]);
        credited++;
      } else if (amount > 0) unmatched++;
    }
    return { credited, unmatched };
  } finally {
    polling = false;
  }
}
