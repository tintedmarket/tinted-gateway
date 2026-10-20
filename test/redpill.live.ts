// Live check: verify RedPill's environment, send a request, verify the response end to end.
import { readFileSync } from "node:fs";
import { verifyRedpill, fetchSignature, verifyRedpillResponse, REDPILL } from "../src/verify/redpill.ts";
import { meetsPolicy } from "../src/verify/types.ts";
const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const model = "phala/qwen3.8-27b-uncensored";
let t = Date.now();
const v = await verifyRedpill(model);
console.log(`environment verified in ${Date.now() - t} ms`);
for (const [k, c] of Object.entries(v.claims)) console.log(`  ${k.padEnd(8)} ${c.state.padEnd(8)} ${c.detail}`);
console.log("  policy:", JSON.stringify(meetsPolicy(v)));
const body = JSON.stringify({ model, messages: [{ role: "user", content: "Say: tinted works" }], max_tokens: 12 });
const res = await fetch(`${REDPILL}/v1/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${env.REDPILL_API_KEY}`, "content-type": "application/json" }, body });
const text = await res.text();
const id = JSON.parse(text).id;
t = Date.now();
const r = verifyRedpillResponse(await fetchSignature(id, model, env.REDPILL_API_KEY), body, text, v);
console.log(`response verified in ${Date.now() - t} ms:`, JSON.stringify({ ok: r.ok, bodies: r.bodiesOk, signer: r.signerOk, receipt: r.receiptOk, upstream: r.upstreamOk }));
