import { createHash, randomBytes } from "node:crypto";
import { db } from "./db.ts";

/** API keys are random and only their SHA-256 is stored. Balances are micro-USD. */
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function createAccount(label: string, balanceMicros = 0) {
  const key = "tnt_" + randomBytes(24).toString("base64url");
  const id = "acct_" + randomBytes(8).toString("hex");
  const q = await db();
  await q("insert into accounts (id, key_hash, label, balance_micros) values ($1, $2, $3, $4)", [id, hashKey(key), label, balanceMicros]);
  return { id, key };
}

export async function accountForKey(key: string) {
  const q = await db();
  const [a] = await q<{ id: string; balance_micros: string }>("select id, balance_micros from accounts where key_hash = $1", [hashKey(key)]);
  return a ? { id: a.id, balanceMicros: Number(a.balance_micros) } : null;
}

export async function credit(accountId: string, micros: number) {
  const q = await db();
  await q("update accounts set balance_micros = balance_micros + $2 where id = $1", [accountId, micros]);
}

/** Charge after a response; the balance may dip slightly below zero on the last request, never further. */
export async function charge(accountId: string, listing: string, usage: { input: number; output: number }, costMicros: number, receiptId: string) {
  const q = await db();
  await q("update accounts set balance_micros = balance_micros - $2 where id = $1", [accountId, costMicros]);
  await q("insert into usage (account_id, listing, input_tokens, output_tokens, cost_micros, receipt_id) values ($1, $2, $3, $4, $5, $6)", [accountId, listing, usage.input, usage.output, costMicros, receiptId]);
}
