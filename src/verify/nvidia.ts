import { createPublicKey, createVerify } from "node:crypto";

/**
 * NVIDIA GPU attestation through NVIDIA's own Remote Attestation Service (NRAS). NRAS checks the GPU's evidence
 * against NVIDIA's reference measurements and returns signed EAT tokens; we verify NRAS's signature with its JWKS.
 */
const NRAS = "https://nras.attestation.nvidia.com/v3/attest/gpu";
const JWKS = "https://nras.attestation.nvidia.com/.well-known/jwks.json";

export interface GpuResult {
  ok: boolean;
  gpus: { id: string; model: string; secureBoot: boolean; debug: boolean; measurements: string; driver?: string }[];
  nonce: string;
  why?: string;
}

let jwksCache: { keys: (JsonWebKey & { kid: string })[] } | null = null;
async function jwks() {
  jwksCache ??= (await (await fetch(JWKS)).json()) as { keys: (JsonWebKey & { kid: string })[] };
  return jwksCache;
}

/** Check an ES384 JWT from NRAS and return its claims. */
async function verifiedClaims(jwt: string): Promise<Record<string, unknown>> {
  const [h, p, s] = jwt.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const key = (await jwks()).keys.find((k) => k.kid === header.kid);
  if (!key) throw new Error(`NRAS key ${header.kid} not in JWKS`);
  const ok = createVerify("SHA384").update(`${h}.${p}`).verify({ key: createPublicKey({ key, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  if (!ok) throw new Error("NRAS token signature invalid");
  return JSON.parse(Buffer.from(p, "base64url").toString());
}

export async function verifyGpu(payload: { nonce: string; evidence_list: unknown[]; arch: string }): Promise<GpuResult> {
  if (!payload.evidence_list?.length) return { ok: false, gpus: [], nonce: payload.nonce, why: "no GPU evidence supplied" };
  const res = await fetch(NRAS, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  if (!res.ok) return { ok: false, gpus: [], nonce: payload.nonce, why: `NRAS ${res.status}` };
  const body = (await res.json()) as [[string, string], Record<string, string>];
  const overall = await verifiedClaims(body[0][1]);
  const gpus = [];
  for (const [id, tok] of Object.entries(body[1] ?? {})) {
    const c = await verifiedClaims(tok);
    gpus.push({
      id,
      model: String(c.hwmodel ?? "?"),
      secureBoot: c.secboot === true,
      debug: c.dbgstat !== "disabled",
      measurements: String(c.measres ?? "?"),
      driver: c["x-nvidia-gpu-driver-version"] as string | undefined,
    });
  }
  const nonceOk = overall.eat_nonce === payload.nonce;
  const ok = overall["x-nvidia-overall-att-result"] === true && nonceOk && gpus.length > 0 && gpus.every((g) => g.secureBoot && !g.debug && g.measurements === "success");
  return { ok, gpus, nonce: payload.nonce, why: ok ? undefined : !nonceOk ? "nonce mismatch" : "a GPU failed its checks" };
}
