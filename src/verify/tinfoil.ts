import { Verifier } from "@tinfoilsh/verifier";
import { fetchAttestationBundle } from "tinfoil";
import { claim, type Verification } from "./types.ts";

/**
 * Tinfoil. We verify the public router enclave ourselves (Sigstore-signed release ↔ live AMD SEV-SNP / Intel TDX
 * measurement ↔ TLS key). Model enclaves aren't publicly reachable: the router's measured, open-source code verifies
 * each one against its config repo and pins TLS to it. Each model's measured boot (cvmimage) runs NVIDIA local
 * attestation for every GPU and mounts the weights through dm-verity with the root hash from the attested config.
 */
export const TINFOIL_ROUTER_REPO = "tinfoilsh/confidential-model-router";
const PROXY = "https://inference.tinfoil.sh/.well-known/tinfoil-proxy";

interface ProxyModel {
  repo: string;
  tag: string;
  measurement: { type: string; registers: string[] };
  enclaves: Record<string, { hpke_key: string; predicate: string; tls_key_fp: string }>;
}

export async function verifyTinfoilRouter() {
  const bundle = await fetchAttestationBundle();
  const v = new Verifier({ configRepo: TINFOIL_ROUTER_REPO });
  try {
    await v.verifyBundle(bundle);
  } catch {
    /* the document below records which step failed */
  }
  const d = v.getVerificationDocument();
  return { ok: d?.securityVerified === true, doc: d, host: bundle.domain };
}

export async function tinfoilModels(): Promise<Record<string, ProxyModel>> {
  const j = (await (await fetch(PROXY)).json()) as { models: Record<string, ProxyModel> };
  return j.models;
}

/** Weights pinned by the model's config at the release the router expects: HF repo@revision + dm-verity root hash. */
async function pinnedWeights(repo: string, tag: string) {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${encodeURIComponent(tag)}/tinfoil-config.yml`);
  if (!res.ok) return [];
  const yml = await res.text();
  const out: { hf: string; rootHash: string }[] = [];
  const re = /repo:\s*"?([^"\n]+@[0-9a-f]{40})"?\s*\n\s*mpk:\s*"?([0-9a-f]{64})/g;
  for (let m; (m = re.exec(yml)); ) out.push({ hf: m[1], rootHash: m[2] });
  return out;
}

export async function verifyTinfoil(model: string, router?: Awaited<ReturnType<typeof verifyTinfoilRouter>>): Promise<Verification> {
  const [r, models] = await Promise.all([router ?? verifyTinfoilRouter(), tinfoilModels()]);
  const m = models[model];
  const steps = r.doc?.steps;
  const weights = m ? await pinnedWeights(m.repo, m.tag) : [];
  const hwType = r.doc?.enclaveMeasurement?.measurement?.type ?? "";
  return {
    provider: "tinfoil",
    model,
    checkedAt: new Date().toISOString(),
    claims: {
      hardware: r.ok ? claim("verified", `router enclave attested (${hwType.split("/").slice(-2).join("/") || "SEV-SNP/TDX"}) and matched to its Sigstore-signed release ${r.doc?.releaseTag}; model enclaves verified by the router`) : claim("failed", `router verification failed: ${JSON.stringify(steps)}`),
      gpu: r.ok && m ? claim("verified", `GPUs attested at boot by the measured Tinfoil image (nvattest, local verifier); enclave refuses to serve otherwise`) : claim("unknown", "model not found or router unverified"),
      software: r.ok && m ? claim("verified", `router ${r.doc?.releaseTag} (Sigstore) routes ${model} only to enclaves measuring ${m.repo}@${m.tag}`) : claim("failed", "router or model release not verified"),
      weights:
        r.ok && weights.length
          ? claim("verified", `pinned by ${m!.repo}@${m!.tag}: ${weights.map((w) => `${w.hf} (dm-verity root ${w.rootHash.slice(0, 12)}…)`).join(", ")}`)
          : claim(weights.length ? "failed" : "unknown", "no pinned weights found in the model's config"),
      keys: r.ok && r.doc?.steps.verifyCertificate?.status === "success" ? claim("verified", `TLS and HPKE keys bound to the attested router (${r.host})`) : claim("failed", "router TLS key not bound"),
    },
    boundKeys: { hpkeKey: r.doc?.hpkePublicKey, tlsKeyFp: r.doc?.tlsPublicKey },
    evidence: { routerRelease: r.doc?.releaseTag, modelRepo: m?.repo, modelTag: m?.tag, enclaves: m ? Object.keys(m.enclaves).length : 0, weights },
  };
}
