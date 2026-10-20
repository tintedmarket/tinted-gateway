import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils";
import type { Anchor, Receipt } from "./api";

/** In-browser receipt checks: nothing here trusts the gateway's own "signatureValid". */
const canon = (o: unknown): string =>
  Array.isArray(o) ? `[${o.map(canon).join(",")}]` : o && typeof o === "object" ? `{${Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon((o as Record<string, unknown>)[k])).join(",")}}` : JSON.stringify(o);

export function checkSignature(r: Receipt, signature: string): boolean {
  try {
    return ed25519.verify(hexToBytes(signature), utf8ToBytes(canon(r)), hexToBytes(r.gatewayKey));
  } catch {
    return false;
  }
}

export function checkInclusion(id: string, signature: string, a: Anchor): boolean {
  let h = sha256(utf8ToBytes(`tinted-receipt:${id}:${signature}`));
  for (const p of a.proof) h = sha256(p.right ? concatBytes(h, hexToBytes(p.sibling)) : concatBytes(hexToBytes(p.sibling), h));
  return bytesToHex(h) === a.root;
}

/** Read the anchor memo from Solana itself and check it names this root and was signed by the expected key. */
export async function checkAnchorOnChain(a: Anchor, solanaKey?: string): Promise<{ memo: string | null; rootMatches: boolean; signer: string | null; signerMatches: boolean | null }> {
  const res = await fetch("https://api.mainnet-beta.solana.com", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [a.tx, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }),
  });
  const tx = (await res.json()).result as { transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: { parsed?: unknown; program?: string }[] } } } | null;
  const memo = (tx?.transaction.message.instructions.find((i) => i.program === "spl-memo")?.parsed as string | undefined) ?? null;
  const signer = tx?.transaction.message.accountKeys.find((k) => k.signer)?.pubkey ?? null;
  return { memo, rootMatches: !!memo?.includes(a.root), signer, signerMatches: solanaKey && signer ? signer === solanaKey : null };
}
