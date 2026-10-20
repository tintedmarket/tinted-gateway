import { REDPILL, fetchSignature, verifyRedpill, verifyRedpillResponse } from "../verify/redpill.ts";
import type { ChatResult, Listing, Provider } from "./index.ts";

/** Upstreams reached through RedPill. Tinfoil models are served by our own Tinfoil provider (weights verified there). */
const VIA_REDPILL = new Set(["phala", "near-ai", "chutes", "privatemode", "fortanix"]);

export function redpillProvider(apiKey: string): Provider {
  return {
    id: "redpill",
    async listings(): Promise<Listing[]> {
      const res = await fetch(`${REDPILL}/v1/models`);
      const j = (await res.json()) as { data: { id: string; name: string; is_tee?: boolean; providers?: string[]; context_length?: number; pricing: { prompt: string; completion: string } }[] };
      return j.data
        .filter((m) => m.is_tee && (m.providers ?? []).some((p) => VIA_REDPILL.has(p)))
        .map((m) => ({
          id: `redpill/${m.id}`,
          provider: "redpill",
          model: m.id,
          name: m.name,
          inputPerM: +(Number(m.pricing.prompt) * 1e6).toFixed(4),
          outputPerM: +(Number(m.pricing.completion) * 1e6).toFixed(4),
          contextWindow: m.context_length,
        }));
    },
    verify: (model) => verifyRedpill(model),
    async chat(model, body, verification): Promise<ChatResult> {
      const reqBody = JSON.stringify({ ...body, model, stream: false });
      const res = await fetch(`${REDPILL}/v1/chat/completions`, { method: "POST", headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: reqBody });
      const text = await res.text();
      if (!res.ok) return { status: res.status, body: text, usage: { input: 0, output: 0 }, proof: {}, proofFailed: `upstream ${res.status}` };
      const j = JSON.parse(text) as { id: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };
      const usage = { input: j.usage?.prompt_tokens ?? 0, output: j.usage?.completion_tokens ?? 0 };
      try {
        const r = verifyRedpillResponse(await fetchSignature(j.id, model, apiKey), reqBody, text, verification);
        return {
          status: 200,
          body: text,
          usage,
          proof: { kind: "aci-receipt", bodies: r.bodiesOk, signer: r.signerOk, receipt: r.receiptOk, upstreamVerified: r.upstreamOk, receiptId: (r.receipt as { receipt_id?: string }).receipt_id },
          proofFailed: r.ok ? undefined : "response signature or receipt did not verify",
        };
      } catch (e) {
        return { status: 200, body: text, usage, proof: {}, proofFailed: `could not fetch the response signature: ${String(e).slice(0, 120)}` };
      }
    },
  };
}
