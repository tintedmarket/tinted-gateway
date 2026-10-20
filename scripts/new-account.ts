// Create an API account with a starting balance (USD). Usage: npx tsx --env-file=.env scripts/new-account.ts <label> <usd>
import { createAccount } from "../src/gateway/accounts.ts";
const [label = "dev", usd = "1"] = process.argv.slice(2);
const a = await createAccount(label, Math.round(Number(usd) * 1e6));
console.log(JSON.stringify(a));
process.exit(0);
