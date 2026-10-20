import { verifyTinfoil, verifyTinfoilRouter } from "../src/verify/tinfoil.ts";
import { meetsPolicy } from "../src/verify/types.ts";
const t = Date.now();
const router = await verifyTinfoilRouter();
for (const model of ["gemma4-31b", "deepseek-v4-1-flash", "llama3-3-70b"]) {
  const v = await verifyTinfoil(model, router);
  console.log(`\n${model}:`);
  for (const [k, c] of Object.entries(v.claims)) console.log(`  ${k.padEnd(8)} ${c.state.padEnd(8)} ${c.detail.slice(0, 170)}`);
  console.log("  policy (require weights):", JSON.stringify(meetsPolicy(v, { requireWeights: true })));
}
console.log(`\n${Date.now() - t} ms`);
