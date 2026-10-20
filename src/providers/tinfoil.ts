import { TinfoilAI } from "tinfoil";
import { verifyTinfoil, verifyTinfoilRouter } from "../verify/tinfoil.ts";
import type { ChatResult, Listing, Provider } from "./index.ts";

/**
 * Tinfoil through its own client: the request body is encrypted (EHBP/HPKE) to the attested router's key and the
 * client refuses to send unless the router verifies. Per-response proof = that channel.
 */
export function tinfoilProvider(apiKey: string): Provider {
  let client: TinfoilAI | null = null;
  let router: Awaited<ReturnType<typeof verifyTinfoilRouter>> | null = null;
  let routerAt = 0;
  const getRouter = async () => {
    if (!router || Date.now() - routerAt > 10 * 60_000) {
      router = await verifyTinfoilRouter();
      routerAt = Date.now();
    }
    return router;
  };
  return {
    id: "tinfoil",
    async listings(): Promise<Listing[]> {
      const res = await fetch("https://inference.tinfoil.sh/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
      const j = (await res.json()) as { data: { id: string; name: string; endpoints?: string[]; context_window?: number; pricing?: { inputTokenPricePer1M: number; outputTokenPricePer1M: number } }[] };
      return j.data
        // Chat models only (tools like websearch have no weights to pin).
        .filter((m) => m.endpoints?.includes("/v1/chat/completions") && m.pricing && m.pricing.outputTokenPricePer1M > 0)
        .map((m) => ({ id: `tinfoil/${m.id}`, provider: "tinfoil", model: m.id, name: m.name, inputPerM: m.pricing!.inputTokenPricePer1M, outputPerM: m.pricing!.outputTokenPricePer1M, contextWindow: m.context_window }));
    },
    async verify(model) {
      return verifyTinfoil(model, await getRouter());
    },
    async chat(model, body): Promise<ChatResult> {
      client ??= new TinfoilAI({ apiKey });
      await client.ready();
      try {
        const r = await client.chat.completions.create({ ...(body as object), model, stream: false } as Parameters<TinfoilAI["chat"]["completions"]["create"]>[0]);
        const text = JSON.stringify(r);
        const u = (r as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
        return { status: 200, body: text, usage: { input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0 }, proof: { kind: "attested-channel", encryptedTo: "router HPKE key (verified)", tls: "pinned to attested router key" } };
      } catch (e) {
        const status = (e as { status?: number }).status ?? 502;
        return { status, body: JSON.stringify({ error: { message: String((e as Error).message ?? e).slice(0, 300) } }), usage: { input: 0, output: 0 }, proof: {}, proofFailed: `upstream ${status}` };
      }
    },
  };
}
