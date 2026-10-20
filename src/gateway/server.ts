import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { timingSafeEqual } from "node:crypto";
import { accountForKey, charge, createAccount, credit } from "./accounts.ts";
import { db } from "./db.ts";
import { cachedVerification, costMicros, findListing, listings, MARGIN, verificationFor } from "./market.ts";
import { checkReceipt, makeReceipt, receiptKey, type Receipt } from "./receipts.ts";
import { meetsPolicy } from "../verify/types.ts";
import { attestation, initTee } from "./tee.ts";
import { cors } from "hono/cors";
import { depositCode, depositMemo, pollDeposits, treasury } from "./deposits.ts";
import { anchorPending } from "./anchor.ts";
import { USDC_MINT } from "./solana.ts";

/**
 * Tinted gateway: an OpenAI-compatible API over confidential inference providers. Every request is routed only to an
 * environment that passes verification (hardware, GPU, software, keys; weights when asked), every response is checked
 * per request where the provider allows it, and every answer gets a Tinted receipt. Prompts and responses are never
 * stored or logged.
 */
const app = new Hono();
// The website calls the gateway straight from the browser, so prompts never pass through the web host.
app.use("*", cors({ origin: (o) => (/^https:\/\/([a-z0-9-]+\.)*tinted\.market$/.test(o) || /^http:\/\/localhost(:\d+)?$/.test(o) ? o : null), allowHeaders: ["authorization", "content-type", "x-tinted-require-weights"], exposeHeaders: ["x-tinted-receipt", "x-tinted-verified"] }));
const err = (status: number, message: string, type = "invalid_request_error") => new Response(JSON.stringify({ error: { message, type } }), { status, headers: { "content-type": "application/json" } });

async function auth(header: string | undefined) {
  const key = header?.replace(/^Bearer\s+/i, "").trim();
  return key ? accountForKey(key) : null;
}

app.get("/health", (c) => c.json({ ok: true, receiptKey: receiptKey().publicKey }));

/** Verify Tinted itself: a fresh TDX quote binding the receipt key, plus the measured app config. */
app.get("/attestation", async (c) => c.json(await attestation()));

/** OpenAI-style model list, plus our price and the verification state we last saw. */
app.get("/v1/models", async (c) => {
  const ls = await listings();
  return c.json({
    object: "list",
    data: ls.map((l) => {
      const v = cachedVerification(l.id);
      return {
        id: l.id,
        object: "model",
        owned_by: l.provider,
        name: l.name,
        context_window: l.contextWindow,
        pricing: { input_per_1m: +(l.inputPerM * (1 + MARGIN())).toFixed(4), output_per_1m: +(l.outputPerM * (1 + MARGIN())).toFixed(4) },
        verification: v ? "checked" : "not yet checked",
      };
    }),
  });
});

/** Full verification of one listing: every claim with what was checked. Checks now if not cached. */
app.get("/v1/verification/:provider/:model{.+}", async (c) => {
  const found = await findListing(`${c.req.param("provider")}/${c.req.param("model")}`);
  if (!found) return err(404, "unknown model");
  try {
    const v = await verificationFor(found.listing, found.provider);
    return c.json({ ...v, policy: meetsPolicy(v), policyWithWeights: meetsPolicy(v, { requireWeights: true }) });
  } catch (e) {
    return err(502, `verification failed: ${String(e).slice(0, 200)}`, "verification_error");
  }
});

app.post("/v1/chat/completions", async (c) => {
  const account = await auth(c.req.header("authorization"));
  if (!account) return err(401, "invalid API key", "authentication_error");
  if (account.balanceMicros <= 0) return err(402, "balance is empty: add credits", "insufficient_balance");
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.model !== "string") return err(400, "model is required");
  if (body.stream) return err(400, "streaming isn't supported yet: send stream=false");
  const found = await findListing(body.model);
  if (!found) return err(404, `unknown model ${body.model}: see /v1/models`);
  // Strict by default. A client can also require verified weights (x-tinted-require-weights: 1).
  const requireWeights = c.req.header("x-tinted-require-weights") === "1";
  let verification;
  try {
    verification = await verificationFor(found.listing, found.provider);
  } catch (e) {
    return err(503, `could not verify ${found.listing.id}: ${String(e).slice(0, 160)}`, "verification_error");
  }
  const policy = meetsPolicy(verification, { requireWeights });
  if (!policy.ok) return err(503, `refused: ${found.listing.id} failed verification (${policy.why.join("; ")})`, "verification_failed");

  const request = JSON.stringify({ ...body, model: found.listing.model });
  const result = await found.provider.chat(found.listing.model, { ...body, model: found.listing.model }, verification);
  if (result.status !== 200) return new Response(result.body, { status: result.status, headers: { "content-type": "application/json" } });
  if (result.proofFailed) return err(502, `response did not verify: ${result.proofFailed}`, "verification_failed");

  const cost = costMicros(found.listing, result.usage);
  const receipt = makeReceipt({ listing: found.listing.id, request, response: result.body, usage: result.usage, costMicros: cost, verification, providerProof: result.proof });
  const q = await db();
  await q("insert into receipts (id, account_id, body, signature) values ($1, $2, $3, $4)", [receipt.body.id, account.id, JSON.stringify(receipt.body), receipt.signature]);
  await charge(account.id, found.listing.id, result.usage, cost, receipt.body.id);

  // The provider's response, with the model id we were called with and our receipt id.
  const out = JSON.parse(result.body) as Record<string, unknown>;
  out.model = found.listing.id;
  return c.json(out, 200, { "x-tinted-receipt": receipt.body.id, "x-tinted-verified": Object.entries(receipt.body.verified).map(([k, s]) => `${k}=${s}`).join(",") });
});

/** A receipt: public (hashes and verification results only, no account), with its signature checkable by anyone. */
app.get("/v1/receipts/:id", async (c) => {
  const q = await db();
  const [r] = await q<{ body: Receipt | string; signature: string; anchor: unknown }>("select body, signature, anchor from receipts where id = $1", [c.req.param("id")]);
  if (!r) return err(404, "unknown receipt");
  const body = typeof r.body === "string" ? (JSON.parse(r.body) as Receipt) : r.body;
  return c.json({ receipt: body, signature: r.signature, signatureValid: checkReceipt(body, r.signature), anchor: r.anchor ?? null });
});

/** Operator endpoints (TINTED_ADMIN_TOKEN, a sealed env var): create accounts and add credit until Solana deposits ship. */
function isAdmin(header: string | undefined) {
  const want = process.env.TINTED_ADMIN_TOKEN;
  const got = header?.replace(/^Bearer\s+/i, "") ?? "";
  return !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
app.post("/admin/accounts", async (c) => {
  if (!isAdmin(c.req.header("authorization"))) return err(401, "not allowed", "authentication_error");
  const b = (await c.req.json().catch(() => ({}))) as { label?: string; usd?: number };
  return c.json(await createAccount(String(b.label ?? "account").slice(0, 60), Math.round(Number(b.usd ?? 0) * 1e6)));
});
app.post("/admin/credit", async (c) => {
  if (!isAdmin(c.req.header("authorization"))) return err(401, "not allowed", "authentication_error");
  const b = (await c.req.json().catch(() => ({}))) as { account?: string; usd?: number };
  if (!b.account) return err(400, "account is required");
  await credit(b.account, Math.round(Number(b.usd ?? 0) * 1e6));
  return c.json({ ok: true });
});

/** Open signup: an API key with an empty balance. Rate-limited per IP. */
const signups = new Map<string, number[]>();
app.post("/v1/accounts", async (c) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const recent = (signups.get(ip) ?? []).filter((t) => Date.now() - t < 3600_000);
  if (recent.length >= 5) return err(429, "too many new keys from this address: try again later", "rate_limited");
  signups.set(ip, [...recent, Date.now()]);
  return c.json(await createAccount("signup", 0));
});

/** How to add credit: send USDC on Solana to the treasury with this memo. */
app.get("/v1/deposit", async (c) => {
  const account = await auth(c.req.header("authorization"));
  if (!account) return err(401, "invalid API key", "authentication_error");
  const t = treasury();
  if (!t) return err(503, "deposits aren't open yet");
  const code = await depositCode(account.id);
  return c.json({ chain: "solana", mint: USDC_MINT.toBase58(), to: t.owner.toBase58(), tokenAccount: t.usdcAccount.toBase58(), memo: depositMemo(code), note: "Send USDC with this memo; it's credited within about a minute. Without the memo it can't be matched." });
});

app.get("/v1/balance", async (c) => {
  const account = await auth(c.req.header("authorization"));
  if (!account) return err(401, "invalid API key", "authentication_error");
  return c.json({ balance_usd: account.balanceMicros / 1e6 });
});

const tee = await initTee();
// Background jobs: credit deposits every 30 s, anchor receipts on Solana every TINTED_ANCHOR_MINUTES (default 60).
setInterval(() => void pollDeposits().catch((e) => console.error("deposits", String(e).slice(0, 200))), 30_000);
setInterval(() => void anchorPending().then((r) => r.anchored && console.log("anchored", r)).catch((e) => console.error("anchor", String(e).slice(0, 200))), Number(process.env.TINTED_ANCHOR_MINUTES ?? 60) * 60_000);
const port = Number(process.env.PORT ?? 8787);
// overrideGlobalObjects off: the Intel quote verifier (wasm) checks `instanceof Response` on its own fetches.
serve({ fetch: app.fetch, port, overrideGlobalObjects: false });
console.log(`tinted gateway on :${port}, ${tee.tee ? "in TEE" : "dev (no TEE)"}, receipt key ${receiptKey().publicKey.slice(0, 16)}…`);
