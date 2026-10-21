import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, hexToBytes, utf8ToBytes, concatBytes } from "@noble/hashes/utils";
import { api, type Anchor, type Receipt } from "./api";

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

/** Read the anchor memo from Solana (through the gateway's RPC; public RPCs refuse browsers) and check root and signer. */
export async function checkAnchorOnChain(a: Anchor, solanaKey?: string): Promise<{ memo: string | null; rootMatches: boolean; signer: string | null; signerMatches: boolean | null }> {
  const tx = await api.solanaTx(a.tx);
  return { memo: tx.memo, rootMatches: !!tx.memo?.includes(a.root), signer: tx.signer, signerMatches: solanaKey && tx.signer ? tx.signer === solanaKey : null };
}
