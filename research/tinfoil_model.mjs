import { Verifier } from "@tinfoilsh/verifier";
import { fetchAttestationBundle } from "tinfoil";
const proxy = (await (await fetch("https://inference.tinfoil.sh/.well-known/tinfoil-proxy")).json()).models;
console.log("models:", Object.keys(proxy).join(", "));
const name = Object.keys(proxy).find((k) => k.includes("gemma")) ?? Object.keys(proxy)[0];
const m = proxy[name];
const host = Object.keys(m.enclaves)[0];
console.log(`\n${name}: repo ${m.repo} tag ${m.tag}, enclave ${host}`);
const t = Date.now();
const bundle = await fetchAttestationBundle({ enclaveURL: `https://${host}`, configRepo: m.repo });
const v = new Verifier({ configRepo: m.repo });
try { await v.verifyBundle(bundle); } catch (e) { console.log("verify error:", String(e).slice(0, 300)); }
const d = v.getVerificationDocument();
console.log("securityVerified:", d?.securityVerified, "release:", d?.releaseTag, `(${Date.now() - t} ms)`, "steps:", JSON.stringify(d?.steps));
console.log("enclave predicate:", d?.enclaveMeasurement?.measurement?.type ?? JSON.stringify(d?.enclaveMeasurement).slice(0, 150));
console.log("hardwareMeasurement:", JSON.stringify(d?.hardwareMeasurement ?? null).slice(0, 300));
const cfg = await (await fetch(`https://raw.githubusercontent.com/${m.repo}/${encodeURIComponent(d?.releaseTag ?? m.tag)}/tinfoil-config.yml`)).text();
console.log("config at release:", cfg.split("\n").filter((l) => /repo:|mpk:|gpus:|cvm-version/.test(l)).map((l) => l.trim()).join(" | ").slice(0, 400));
