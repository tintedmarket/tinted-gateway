import { createHash, randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519";
import type { Verification } from "../verify/types.ts";

/**
 * Tinted's own receipt for every response: what was asked of whom (hashes only), what was verified, what was charged,
 * signed by the gateway's key. In production the key is derived inside the gateway's TEE (dstack KMS) and bound to its
 * attestation; in development it comes from TINTED_RECEIPT_SEED (or a throwaway key).
 */
let seed: Uint8Array | null = null;
export function receiptKey() {
  if (!seed) {
    const hex = process.env.TINTED_RECEIPT_SEED;
    seed = hex ? Uint8Array.from(Buffer.from(hex, "hex")) : randomBytes(32);
  }
  return { seed, publicKey: Buffer.from(ed25519.getPublicKey(seed)).toString("hex") };
}
/** Set the signing seed (e.g. derived from dstack KMS at boot). */
export function setReceiptSeed(s: Uint8Array) {
  seed = s;
}

const sha256 = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
const canon = (o: unknown): string =>
  Array.isArray(o) ? `[${o.map(canon).join(",")}]` : o && typeof o === "object" ? `{${Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon((o as Record<string, unknown>)[k])).join(",")}}` : JSON.stringify(o);

export interface Receipt {
  v: 1;
  id: string;
  at: string;
  listing: string;
  requestHash: string;
  responseHash: string;
  usage: { input: number; output: number };
  costMicros: number;
  verified: Record<string, string>;
  verificationHash: string;
  providerProof: Record<string, unknown>;
  gatewayKey: string;
}

export function makeReceipt(input: { listing: string; request: string; response: string; usage: { input: number; output: number }; costMicros: number; verification: Verification; providerProof: Record<string, unknown> }) {
  const { seed, publicKey } = receiptKey();
  const body: Receipt = {
    v: 1,
    id: "rcpt_" + randomBytes(12).toString("hex"),
    at: new Date().toISOString(),
    listing: input.listing,
    requestHash: sha256(input.request),
    responseHash: sha256(input.response),
    usage: input.usage,
    costMicros: input.costMicros,
    verified: Object.fromEntries(Object.entries(input.verification.claims).map(([k, c]) => [k, c.state])),
    verificationHash: sha256(canon(input.verification.claims)),
    providerProof: input.providerProof,
    gatewayKey: publicKey,
  };
  const signature = Buffer.from(ed25519.sign(Buffer.from(canon(body)), seed)).toString("hex");
  return { body, signature };
}

export function checkReceipt(body: Receipt, signature: string): boolean {
  return ed25519.verify(Buffer.from(signature, "hex"), Buffer.from(canon(body)), Buffer.from(body.gatewayKey, "hex"));
}
