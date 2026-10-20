import dcap from "@phala/dcap-qvl-node";
import { readFileSync } from "node:fs";
const a = JSON.parse(readFileSync("research/redpill_report.json", "utf8"));
const q = Buffer.from(((a.all_attestations ?? [a])[0]).intel_quote, "hex");
for (const src of ["https://api.trustedservices.intel.com/tdx/certification/v4", "https://pccs.phala.network/tdx/certification/v4"]) {
  const t = Date.now();
  try { const c = await dcap.js_get_collateral(src, q); console.log("ok", src, Date.now() - t, "ms", dcap.js_verify(q, c, BigInt(Math.floor(Date.now() / 1000))).status); } catch (e) { console.log("FAIL", src, String(e).slice(0, 150)); }
}
