import { readFileSync } from "node:fs";
import { verifyTdxQuote } from "../src/verify/tdx.ts";
import { fetchReport } from "../src/verify/redpill.ts";
const saved = JSON.parse(readFileSync("research/redpill_report.json", "utf8"));
for (const [label, quote] of [["saved", ((saved.all_attestations ?? [saved])[0]).intel_quote], ["fresh", (await fetchReport("phala/qwen3.8-27b-uncensored")).intel_quote]] as const) {
  try { console.log(label, (await verifyTdxQuote(quote)).status); } catch (e) { console.log(label, "FAIL", String(e).slice(0, 200)); }
  console.log("  quote prefix", quote.slice(0, 40), "len", quote.length);
}
