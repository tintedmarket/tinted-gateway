/** The gateway is called straight from the browser: prompts never pass through the website's host. */
export const GATEWAY = (import.meta.env.VITE_GATEWAY as string | undefined) ?? "https://api.tinted.market";

export type ClaimState = "verified" | "provider" | "failed" | "unknown";
export const CLAIMS = ["hardware", "gpu", "software", "weights", "keys"] as const;
export type ClaimName = (typeof CLAIMS)[number];

export interface MarketRow {
  id: string;
  provider: string;
  model: string;
  name: string;
  contextWindow?: number;
  inputPerM: number;
  outputPerM: number;
  checkedAt: string | null;
  claims: Record<ClaimName, ClaimState> | null;
  routable: boolean | null;
  whyNot?: string[];
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(GATEWAY + path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
  return body as T;
}
const authed = (key: string, init: RequestInit = {}): RequestInit => ({ ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${key}`, "content-type": "application/json" } });

export const api = {
  market: () => j<{ listings: MarketRow[]; margin: number }>("/v1/market"),
  verification: (id: string) => j<{ claims: Record<ClaimName, { state: ClaimState; detail: string }>; checkedAt: string; evidence: Record<string, unknown> }>(`/v1/verification/${id}`),
  attestation: () => j<{ tee: boolean; receiptKey: string; solanaKey?: string; boundKeys?: string; quote?: string; appCompose?: string }>("/attestation"),
  signup: () => j<{ id: string; key: string }>("/v1/accounts", { method: "POST" }),
  balance: (key: string) => j<{ balance_usd: number }>("/v1/balance", authed(key)),
  deposit: (key: string) => j<{ mint: string; to: string; tokenAccount: string; memo: string; note: string }>("/v1/deposit", authed(key)),
  receipt: (id: string) => j<{ receipt: Receipt; signature: string; signatureValid: boolean; anchor: Anchor | null }>(`/v1/receipts/${encodeURIComponent(id)}`),
  credits: () => j<{ root: string; size: number; levels: number; denominations_usd: number[]; deposit: { chain: string; mint: string; to: string; memo: string } | null; circuit: { wasm: string; zkey: string; vkSha256: string } }>("/v1/credits"),
  leaves: (from: number) => j<{ from: number; leaves: string[]; size: number }>(`/v1/credits/leaves?from=${from}`),
  redeem: (body: { proof: unknown; publicSignals: string[]; keyHash: string }) => j<{ ok: true; credited_usd: number; new_key: boolean }>("/v1/credits/redeem", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  async chat(key: string, model: string, messages: { role: string; content: string }[], requireWeights: boolean) {
    const res = await fetch(GATEWAY + "/v1/chat/completions", authed(key, { method: "POST", body: JSON.stringify({ model, messages, max_tokens: 1200 }), headers: requireWeights ? { "x-tinted-require-weights": "1" } : {} }));
    const body = (await res.json().catch(() => ({}))) as { choices?: { message: { content: string | null; reasoning_content?: string } }[]; error?: { message: string }; usage?: { prompt_tokens: number; completion_tokens: number } };
    if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
    return { text: body.choices?.[0]?.message.content ?? "", receipt: res.headers.get("x-tinted-receipt"), verified: res.headers.get("x-tinted-verified"), usage: body.usage };
  },
};

export interface Receipt {
  v: 1;
  id: string;
  at: string;
  listing: string;
  requestHash: string;
  responseHash: string;
  usage: { input: number; output: number };
  costMicros: number;
  verified: Record<string, string>;
  verificationHash: string;
  providerProof: Record<string, unknown>;
  gatewayKey: string;
}
export interface Anchor {
  chain: "solana";
  tx: string;
  root: string;
  index: number;
  count: number;
  at: string;
  proof: { sibling: string; right: boolean }[];
}

const KEY = "tinted.key";
export const storedKey = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (k: string) => {
    try {
      localStorage.setItem(KEY, k);
    } catch {
      /* private mode */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
  },
};
