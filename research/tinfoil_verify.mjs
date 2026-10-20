import { Verifier } from "@tinfoilsh/verifier";
import { fetchAttestationBundle } from "tinfoil";
const t = Date.now();
const bundle = await fetchAttestationBundle();
console.log("bundle keys:", Object.keys(bundle), "domain:", bundle.domain, `(${Date.now() - t} ms)`);
const v = new Verifier({ configRepo: "tinfoilsh/confidential-model-router" });
try {
  await v.verifyBundle(bundle);
} catch (e) { console.log("verify error:", String(e).slice(0, 300)); }
const d = v.getVerificationDocument();
console.log("securityVerified:", d?.securityVerified, "| host:", d?.enclaveHost, "| release:", d?.releaseTag);
console.log("steps:", JSON.stringify(d?.steps));
console.log("code:", JSON.stringify(d?.codeMeasurement).slice(0, 250));
console.log("hardware:", JSON.stringify(d?.hardwareMeasurement).slice(0, 250));
console.log("hpke:", d?.hpkePublicKey?.slice(0, 24), "| tls:", d?.tlsPublicKey?.slice(0, 24));
