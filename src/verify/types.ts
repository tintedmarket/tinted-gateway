/**
 * What a verification established, claim by claim. Each claim is "verified" (checked by us against hardware vendors'
 * roots and published measurements), "provider" (stated by the provider, not independently checked) or "failed".
 * The UI shows these as badges; the gateway refuses a response when a required claim isn't "verified".
 */
export type ClaimState = "verified" | "provider" | "failed" | "unknown";

export interface Claim {
  state: ClaimState;
  /** One line a person can read: what was checked, against what. */
  detail: string;
}

export interface Verification {
  provider: string;
  model: string;
  checkedAt: string;
  claims: {
    /** CPU TEE quote genuine and up to date (Intel TDX / AMD SEV-SNP), debug off. */
    hardware: Claim;
    /** GPU in confidential mode, genuine, measured driver/firmware (NVIDIA). */
    gpu: Claim;
    /** The software that runs is a specific, published release. */
    software: Claim;
    /** The model weights loaded are a specific, reproducible artifact. */
    weights: Claim;
    /** The keys that sign/encrypt this response live inside the verified environment. */
    keys: Claim;
  };
  /** Keys bound to the verified environment, for checking responses. */
  boundKeys: { signingAddress?: string; receiptKey?: string; tlsKeyFp?: string; hpkeKey?: string };
  evidence: Record<string, unknown>;
}

export const claim = (state: ClaimState, detail: string): Claim => ({ state, detail });

/** Strict policy: everything we claim must be verified. Weights may be "provider" only when the request allows it. */
export function meetsPolicy(v: Verification, opts: { requireWeights?: boolean } = {}): { ok: boolean; why: string[] } {
  const why: string[] = [];
  for (const k of ["hardware", "gpu", "software", "keys"] as const) if (v.claims[k].state !== "verified") why.push(`${k}: ${v.claims[k].state} (${v.claims[k].detail})`);
  if (opts.requireWeights && v.claims.weights.state !== "verified") why.push(`weights: ${v.claims.weights.state}`);
  return { ok: why.length === 0, why };
}
