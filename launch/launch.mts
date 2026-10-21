// Launch $TINTED on pump.fun (ported from the debpf launch that ran on mainnet):
//   1. pins the logo and metadata (name, symbol, description, X, website) to IPFS
//   2. creates the coin with a dev buy of --usd dollars in the same transaction
//   3. burns the entire dev buy and closes the token account
//   4. sets VITE_TOKEN_MINT on the Vercel project and redeploys tinted.market, so the CA shows on the site
//
//   node --env-file=.env launch/launch.mts            dry run: simulates the create + buy, spends nothing
//   node --env-file=.env launch/launch.mts --yes      launches for real
//
// Needs in .env: LAUNCH_WALLET_SECRET (base58), SOLANA_RPC_URL, PINATA_JWT (and optionally PINATA_GATEWAY).
// The wallet needs the dev buy plus ~0.04 SOL for rent and fees.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    image: { type: "string", default: "web/public/logo-512.png" },
    name: { type: "string", default: "Tinted" },
    symbol: { type: "string", default: "TINTED" },
    usd: { type: "string", default: "1" },
    description: {
      type: "string",
      default:
        "The Private Inference Market. AI models run inside hardware enclaves, every call is proven before your prompt leaves, receipts are anchored on Solana, and you can pay anonymously with zero-knowledge credits. tinted.market",
    },
    twitter: { type: "string", default: "https://x.com/tintedmarket" },
    website: { type: "string", default: "https://tinted.market" },
    yes: { type: "boolean", default: false },
  },
});
const fail = (m: string): never => {
  console.error(`\n✖ ${m}`);
  process.exit(1);
};

const { Connection, Keypair, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } = await import("@solana/web3.js");
const { TOKEN_2022_PROGRAM_ID, NATIVE_MINT, createBurnCheckedInstruction, createCloseAccountInstruction, getAssociatedTokenAddressSync } = await import("@solana/spl-token");
const { OnlinePumpSdk, PUMP_SDK, getBuyTokenAmountFromSolAmount } = await import("@pump-fun/pump-sdk");
const BN = (await import("bn.js")).default;
const bs58 = (await import("bs58")).default;

const secret = process.env.LAUNCH_WALLET_SECRET;
if (!secret) fail("LAUNCH_WALLET_SECRET is not set in .env");
const payer = Keypair.fromSecretKey(bs58.decode(secret!));
const connection = new Connection(process.env.SOLANA_RPC_URL ?? fail("SOLANA_RPC_URL is not set"), "confirmed");

// $1 in SOL at today's price.
const price = await fetch("https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112")
  .then((r) => r.json())
  .then((d) => Number(d.So11111111111111111111111111111111111111112?.usdPrice));
if (!price) fail("could not read the SOL price");
const devBuySol = Number(args.usd) / price;
const devBuyLamports = BigInt(Math.round(devBuySol * LAMPORTS_PER_SOL));
const balance = await connection.getBalance(payer.publicKey);
const mint = Keypair.generate();

console.log(`
$${args.symbol} launch ${args.yes ? "" : "(DRY RUN)"}
  name        ${args.name} ($${args.symbol})
  image       ${args.image}
  website     ${args.website}
  x           ${args.twitter}
  description ${args.description}
  dev buy     $${args.usd} = ${devBuySol.toFixed(6)} SOL at $${price.toFixed(2)}, burned right after
  wallet      ${payer.publicKey.toBase58()}  ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL
  mint        ${mint.publicKey.toBase58()}
`);
const needs = Number(devBuyLamports) + 0.04 * LAMPORTS_PER_SOL;
if (balance < needs) (args.yes ? fail : console.log)(`wallet needs about ${(needs / LAMPORTS_PER_SOL).toFixed(3)} SOL`);

async function pin(blob: Blob, filename: string) {
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("network", "public");
  const res = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { authorization: `Bearer ${process.env.PINATA_JWT}` }, body: form });
  if (!res.ok) fail(`Pinata upload failed: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  return `${process.env.PINATA_GATEWAY ?? "https://gateway.pinata.cloud"}/ipfs/${data.cid}`;
}

/** cu = 0 leaves out the compute-budget instructions (the create + buy transaction has no bytes to spare). */
async function compile(ixs: import("@solana/web3.js").TransactionInstruction[], cu: number) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const budget = cu ? [ComputeBudgetProgram.setComputeUnitLimit({ units: cu }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 400_000 })] : [];
  const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: [...budget, ...ixs] }).compileToV0Message();
  return { tx: new VersionedTransaction(msg), lastValidBlockHeight };
}

/** Rebroadcast every 2s until confirmed or the blockhash expires. */
async function land(tx: import("@solana/web3.js").VersionedTransaction, lastValidBlockHeight: number) {
  const raw = tx.serialize();
  const sig = bs58.encode(tx.signatures[0]);
  for (;;) {
    await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    const st = (await connection.getSignatureStatuses([sig])).value[0];
    if (st?.err) fail(`transaction failed: ${JSON.stringify(st.err)} (${sig})`);
    if (st?.confirmationStatus === "confirmed" || st?.confirmationStatus === "finalized") return sig;
    if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) fail(`expired before landing (${sig})`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const sdk = new OnlinePumpSdk(connection);
const [global, feeConfig] = await Promise.all([sdk.fetchGlobal(), sdk.fetchFeeConfig()]);
const solAmount = new BN(devBuyLamports.toString());
const amount = getBuyTokenAmountFromSolAmount({ global, feeConfig, mintSupply: null, bondingCurve: null, amount: solAmount, quoteMint: NATIVE_MINT });

let uri = `https://gateway.pinata.cloud/ipfs/${"b".repeat(59)}`;
if (args.yes) {
  const bytes = readFileSync(args.image);
  const image = await pin(new Blob([bytes], { type: args.image.endsWith(".png") ? "image/png" : "image/jpeg" }), args.image.split(/[\\/]/).pop()!);
  const meta = { name: args.name, symbol: args.symbol, description: args.description, image, showName: true, createdOn: "https://pump.fun", twitter: args.twitter, website: args.website };
  uri = await pin(new Blob([JSON.stringify(meta)], { type: "application/json" }), "metadata.json");
  console.log(`metadata    ${uri}`);
} else readFileSync(args.image); // the dry run still checks the logo file exists

const createIxs = await PUMP_SDK.createV2AndBuyInstructions({ global, mint: mint.publicKey, name: args.name, symbol: args.symbol, uri, creator: payer.publicKey, user: payer.publicKey, amount, solAmount, mayhemMode: false });
const { tx: create, lastValidBlockHeight } = await compile(createIxs, 0);
create.sign([payer, mint]);

if (!args.yes) {
  const sim = await connection.simulateTransaction(create, { sigVerify: false, replaceRecentBlockhash: true });
  if (sim.value.err) {
    console.log((sim.value.logs ?? []).slice(-10).join("\n"));
    fail(`create simulation failed: ${JSON.stringify(sim.value.err)}`);
  }
  console.log(`Create + $${args.usd} buy simulation OK (${sim.value.unitsConsumed} CU, ${create.serialize().length} bytes). Re-run with --yes to launch.`);
  process.exit(0);
}

const launchSig = await land(create, lastValidBlockHeight);
console.log(`Launched: https://solscan.io/tx/${launchSig}`);

// Burn every token the dev buy bought, then close the account.
const ata = getAssociatedTokenAddressSync(mint.publicKey, payer.publicKey, false, TOKEN_2022_PROGRAM_ID);
const held = BigInt((await connection.getTokenAccountBalance(ata, "confirmed")).value.amount);
const burn = await compile([createBurnCheckedInstruction(ata, mint.publicKey, payer.publicKey, held, 6, [], TOKEN_2022_PROGRAM_ID), createCloseAccountInstruction(ata, payer.publicKey, payer.publicKey, [], TOKEN_2022_PROGRAM_ID)], 100_000);
burn.tx.sign([payer]);
const burnSig = await land(burn.tx, burn.lastValidBlockHeight);
console.log(`Burned the dev buy (${(Number(held) / 1e6).toLocaleString()} $${args.symbol}): https://solscan.io/tx/${burnSig}`);

const ca = mint.publicKey.toBase58();
console.log(`\nCA ${ca}\nhttps://pump.fun/coin/${ca}`);
// Put the CA on tinted.market: a build-time env var on the Vercel project, then a production deploy.
execSync(`npx -y vercel env add VITE_TOKEN_MINT production --type config --value ${ca} --yes`, { cwd: "web", stdio: "inherit" });
execSync(`npx -y vercel deploy --prod --yes`, { cwd: "web", stdio: "inherit" });
console.log("CA is on tinted.market.");
