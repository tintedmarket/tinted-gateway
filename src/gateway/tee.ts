import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { DstackClient } from "@phala/dstack-sdk";
import { toKeypairSecure } from "@phala/dstack-sdk/solana";
import { receiptKey, setReceiptSeed } from "./receipts.ts";
import { setSolanaKeypair, solanaKeypair } from "./solana.ts";

/**
 * Tinted's own attestation. Inside a dstack confidential VM (Phala Cloud), the receipt-signing key is derived by the
 * dstack KMS from the app's identity, so it only exists inside this measured gateway, and /attestation publishes a
 * fresh Intel TDX quote whose report_data binds that key. Anyone can verify Tinted the same way Tinted verifies providers.
 */
const SOCKET = "/var/run/dstack.sock";
let client: DstackClient | null = null;

export function inTee(): boolean {
  return !!process.env.DSTACK_SIMULATOR_ENDPOINT || existsSync(SOCKET);
}

/** At boot: replace the dev receipt key with one derived inside the TEE. */
export async function initTee(): Promise<{ tee: boolean; receiptKey: string }> {
  if (!inTee()) return { tee: false, receiptKey: receiptKey().publicKey };
  client = new DstackClient();
  const k = await client.getKey("tinted/receipt", "v1");
  setReceiptSeed(createHash("sha256").update(k.key).digest());
  setSolanaKeypair(toKeypairSecure(await client.getKey("tinted/solana", "v1")));
  return { tee: true, receiptKey: receiptKey().publicKey };
}

let cached: { at: number; body: unknown } | null = null;
/** The keys this gateway signs with, as bound into report_data. */
export const boundKeysText = () => `tinted-receipt-key:${receiptKey().publicKey}|solana:${solanaKeypair().publicKey.toBase58()}`;

/** report_data = sha256(boundKeysText) ‖ 32 zero bytes. */
export async function attestation() {
  if (!client) return { tee: false, note: "development gateway: not running in a TEE", receiptKey: receiptKey().publicKey, solanaKey: solanaKeypair().publicKey.toBase58() };
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.body;
  const pub = receiptKey().publicKey;
  const reportData = Buffer.concat([createHash("sha256").update(boundKeysText()).digest(), Buffer.alloc(32)]);
  const [quote, info] = await Promise.all([client.getQuote(reportData), client.info()]);
  const body = {
    tee: true,
    receiptKey: pub,
    solanaKey: solanaKeypair().publicKey.toBase58(),
    boundKeys: boundKeysText(),
    reportDataScheme: "sha256(boundKeys) followed by 32 zero bytes",
    quote: quote.quote,
    eventLog: quote.event_log,
    appCompose: (info as { tcb_info?: { app_compose?: string } }).tcb_info?.app_compose,
    info,
  };
  cached = { at: Date.now(), body };
  return body;
}
