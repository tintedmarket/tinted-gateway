import type { ReactNode } from "react";
import type { ClaimName, ClaimState } from "./api";

export const CLAIM_LABEL: Record<ClaimName, string> = { hardware: "CPU enclave", gpu: "GPU enclave", software: "Code", weights: "Weights", keys: "Keys" };
export const CLAIM_HINT: Record<ClaimName, string> = {
  hardware: "Intel TDX / AMD SEV-SNP quote checked against the vendor's root of trust, debug off.",
  gpu: "NVIDIA confidential-computing attestation checked with NVIDIA's service.",
  software: "The running code is a specific published release, matched to its measurement.",
  weights: "The loaded model weights are a pinned, hash-verified artifact.",
  keys: "The keys that encrypt or sign your traffic were created inside the verified enclave.",
};
const STATE_DOT: Record<ClaimState, string> = { verified: "bg-proof", provider: "bg-claim", failed: "bg-fail", unknown: "bg-ink-3" };
const STATE_WORD: Record<ClaimState, string> = { verified: "proved", provider: "claimed", failed: "failed", unknown: "unchecked" };

export function Badge({ name, state, compact }: { name: ClaimName; state: ClaimState; compact?: boolean }) {
  return (
    <span title={`${CLAIM_LABEL[name]}: ${STATE_WORD[state]}. ${CLAIM_HINT[name]}`} className={`inline-flex items-center gap-1.5 rounded-full border border-edge bg-pane-2/60 px-2 py-[3px] text-[11px] leading-none whitespace-nowrap ${state === "verified" ? "text-ink-2" : state === "unknown" ? "text-ink-3" : state === "provider" ? "text-claim" : "text-fail"}`}>
      <span className={`size-1.5 rounded-full ${STATE_DOT[state]}`} />
      {compact ? CLAIM_LABEL[name].split(" ")[0] : `${CLAIM_LABEL[name]} · ${STATE_WORD[state]}`}
    </span>
  );
}

export function Pane({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pane ${className}`}>{children}</div>;
}

export function H({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-12 grid gap-6 lg:grid-cols-2 lg:items-end">
      <div>
        <div className="text-sm text-ink-3">{kicker}</div>
        <h1 className="h-display mt-2 text-4xl leading-[1.05] sm:text-[56px]">{title}</h1>
      </div>
      {children && <p className="max-w-xl text-lg leading-relaxed text-ink-2">{children}</p>}
    </header>
  );
}

export function Button({ children, onClick, disabled, kind = "solid", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "solid" | "ghost"; type?: "button" | "submit" }) {
  const k = kind === "solid" ? "bg-ink text-night hover:bg-white" : "border border-edge bg-pane-2 text-ink hover:border-ink-3";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${k}`}>
      {children}
    </button>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <code className={`font-mono text-[12px] break-all text-ink-2 ${className}`}>{children}</code>;
}

export const short = (s: string, n = 6) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);

/**
 * Model makers' marks (monochrome, from the MIT-licensed lobehub icon set in /public/logos), drawn as masks so they
 * take the text colour. Names without an open logo get none rather than a stand-in.
 */
const BRANDS: [RegExp, string][] = [
  [/gpt-oss|openai/, "openai"],
  [/llama|meta/, "meta"],
  [/gemma/, "gemma"],
  [/qwen/, "qwen"],
  [/deepseek/, "deepseek"],
  [/glm|zhipu|z\.ai/, "zhipu"],
  [/kimi|moonshot/, "kimi"],
  [/mistral|voxtral|ministral/, "mistral"],
  [/nemotron|nvidia/, "nvidia"],
  [/minimax/, "minimax"],
  [/phala/, "phala"],
  [/chutes/, "chutes"],
];
export const brandOf = (name: string) => BRANDS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? null;

export function BrandIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  const b = brandOf(name);
  if (!b) return null;
  const url = `url(/logos/${b}.svg)`;
  return <span aria-hidden className={`inline-block shrink-0 bg-current ${className}`} style={{ maskImage: url, WebkitMaskImage: url, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center" }} />;
}
