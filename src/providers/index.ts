import type { Verification } from "../verify/types.ts";

/** One listing in the market: a model served by a provider, with its price and how much of it we can verify. */
export interface Listing {
  /** Our id: "<provider>/<provider model id>". */
  id: string;
  provider: string;
  model: string;
  name: string;
  /** USD per 1M tokens, the provider's price (our margin is added at billing). */
  inputPerM: number;
  outputPerM: number;
  contextWindow?: number;
}

export interface ChatResult {
  status: number;
  /** The exact response bytes from the provider. */
  body: string;
  usage: { input: number; output: number };
  /** Per-response proof beyond the environment verification (e.g. signed receipt check). */
  proof: Record<string, unknown>;
  /** The response failed a per-response check: don't return it as verified. */
  proofFailed?: string;
}

export interface Provider {
  id: string;
  listings(): Promise<Listing[]>;
  verify(model: string): Promise<Verification>;
  /** body = the OpenAI request with `model` already set to the provider's model id. */
  chat(model: string, body: Record<string, unknown>, verification: Verification): Promise<ChatResult>;
}
