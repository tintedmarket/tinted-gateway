import { secp256k1 } from "@noble/curves/secp256k1";
import { ed25519 } from "@noble/curves/ed25519";
import { keccak_256 } from "@noble/hashes/sha3";
import { verifyTdxQuote, replayRtmr3, sha256Hex } from "./tdx.ts";
import { verifyGpu } from "./nvidia.ts";
import { claim, type Verification } from "./types.ts";

/**
 * RedPill (Phala's confidential AI gateway, ACI v1). The attestation report is public; we verify every link ourselves:
 * Intel quote (Intel PCS) → report_data binds the response-signing address + the NVIDIA nonce → NVIDIA NRAS for the
 * GPUs → event-log replay equals RTMR3 and the compose hash equals sha256(app_compose).
 */
export const REDPILL = "https://api.redpill.ai";

interface AciAttestation {
  signing_address: string;
  intel_quote: string;
  nvidia_payload: string | { nonce: string; evidence_list: unknown[]; arch: string };
  workload_keyset_digest: string;
  attestation: {
    workload_keyset: { receipt_signing_keys: { key_id: string; public_key: string }[]; e2ee_public_keys: { key_id: string; public_key: string }[] };
    evidence: { event_log: string; app_compose: string; vm_config: string };
    source_provenance?: { repo_url?: string; repo_commit?: string };
  };
  service_capabilities?: { serving?: string };
}

export async function fetchReport(model: string): Promise<AciAttestation> {
  const res = await fetch(`${REDPILL}/v1/attestation/report?model=${encodeURIComponent(model)}`);
  if (!res.ok) throw new Error(`RedPill report ${res.status}`);
  const j = (await res.json()) as AciAttestation & { all_attestations?: AciAttestation[] };
  return (j.all_attestations ?? [j])[0];
}

export async function verifyRedpill(model: string): Promise<Verification> {
  const a = await fetchReport(model);
  const nv = typeof a.nvidia_payload === "string" ? JSON.parse(a.nvidia_payload) : a.nvidia_payload;
  const [tdx, gpu] = await Promise.all([verifyTdxQuote(a.intel_quote), verifyGpu(nv).catch((e) => ({ ok: false, gpus: [], nonce: nv.nonce, why: String(e) }))]);

  const rd = tdx.reportData.toLowerCase();
  const addrBound = rd.slice(0, 40) === a.signing_address.toLowerCase().replace(/^0x/, "");
  const gpuBound = rd.slice(64, 128) === String(nv.nonce).toLowerCase();
  const log = JSON.parse(a.attestation.evidence.event_log);
  const replay = replayRtmr3(log);
  const composeHash = sha256Hex(a.attestation.evidence.app_compose);
  const rtmrOk = replay.rtmr3 === tdx.rtmr[3].toLowerCase();
  const composeOk = replay.events["compose-hash"] === composeHash && tdx.mrConfigId.toLowerCase().startsWith("01" + composeHash);
  const hwOk = tdx.status === "UpToDate" && !tdx.debug;
  const receiptKey = a.attestation.workload_keyset.receipt_signing_keys[0]?.public_key;

  return {
    provider: "redpill",
    model,
    checkedAt: new Date().toISOString(),
    claims: {
      hardware: hwOk ? claim("verified", `Intel TDX quote valid against Intel PCS, TCB ${tdx.status}, debug off`) : claim("failed", `TDX TCB ${tdx.status}${tdx.debug ? ", DEBUG ON" : ""}`),
      gpu:
        gpu.ok && gpuBound
          ? claim("verified", `${gpu.gpus.length}× ${gpu.gpus[0]?.model} attested by NVIDIA NRAS (secure boot, debug off, measurements match); nonce bound in the TDX quote`)
          : claim(gpu.gpus.length ? "failed" : "unknown", gpu.why ?? (!gpuBound ? "GPU nonce not bound in the TDX quote" : "no GPU evidence in this report")),
      software:
        rtmrOk && composeOk
          ? claim("verified", `published compose ${composeHash.slice(0, 12)}… measured into RTMR3 and mr_config_id${a.attestation.source_provenance?.repo_url ? ` (${a.attestation.source_provenance.repo_url.replace("https://github.com/", "")}@${a.attestation.source_provenance.repo_commit?.slice(0, 7)})` : ""}`)
          : claim("failed", !rtmrOk ? "event log does not replay to RTMR3" : "compose hash mismatch"),
      weights: claim("provider", "model weights are not measured in this provider's attestation (Phala's own docs: operator-asserted)"),
      keys: addrBound ? claim("verified", `response-signing address ${a.signing_address} bound in the TDX report data`) : claim("failed", "signing address not bound in the quote"),
    },
    boundKeys: { signingAddress: a.signing_address.toLowerCase(), receiptKey },
    evidence: { composeHash, osImageHash: replay.events["os-image-hash"], keysetDigest: a.workload_keyset_digest, serving: a.service_capabilities?.serving, gpus: gpu.gpus },
  };
}

interface SignaturePayload {
  text: string;
  signature: string;
  signing_address: string;
  receipt: { signature: string; key_id: string; workload_keyset_digest: string; event_log: { type: string; body_hash?: string; result?: string; required?: boolean }[]; [k: string]: unknown };
}

export async function fetchSignature(chatId: string, model: string, apiKey: string): Promise<SignaturePayload> {
  const res = await fetch(`${REDPILL}/v1/signature/${encodeURIComponent(chatId)}?model=${encodeURIComponent(model)}&signing_algo=ecdsa`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`RedPill signature ${res.status}`);
  return (await res.json()) as SignaturePayload;
}

const canon = (o: unknown): string =>
  Array.isArray(o) ? `[${o.map(canon).join(",")}]` : o && typeof o === "object" ? `{${Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canon((o as Record<string, unknown>)[k])).join(",")}}` : JSON.stringify(o);

/**
 * Check one response: the signed hashes equal our exact request/response bytes, the ECDSA signer is the attested
 * address, the receipt is signed by the attested receipt key, and the upstream model node was verified by the gateway.
 */
export function verifyRedpillResponse(sig: SignaturePayload, requestBody: string | Buffer, responseBody: string | Buffer, v: Verification) {
  const [reqH, resH] = sig.text.split(":");
  const bodiesOk = sha256Hex(requestBody) === reqH && sha256Hex(responseBody) === resH;
  const msg = Buffer.from(sig.text);
  const digest = keccak_256(Buffer.concat([Buffer.from(`\x19Ethereum Signed Message:\n${msg.length}`), msg]));
  const s = Buffer.from(sig.signature.replace(/^0x/, ""), "hex");
  const pub = secp256k1.Signature.fromCompact(s.subarray(0, 64)).addRecoveryBit(s[64] >= 27 ? s[64] - 27 : s[64]).recoverPublicKey(digest).toRawBytes(false);
  const signer = "0x" + Buffer.from(keccak_256(pub.subarray(1))).subarray(12).toString("hex");
  const signerOk = signer === v.boundKeys.signingAddress;
  const { signature, ...body } = sig.receipt;
  const receiptOk = !!v.boundKeys.receiptKey && ed25519.verify(Buffer.from(signature, "hex"), Buffer.from(canon(body)), Buffer.from(v.boundKeys.receiptKey, "hex"));
  const upstream = sig.receipt.event_log.find((e) => e.type === "upstream.verified");
  const upstreamOk = upstream?.result === "verified";
  return { ok: bodiesOk && signerOk && receiptOk && upstreamOk, bodiesOk, signerOk, receiptOk, upstreamOk, receipt: sig.receipt };
}
