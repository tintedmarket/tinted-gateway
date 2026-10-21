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
const STATE_STYLE: Record<ClaimState, string> = {
  verified: "border-proof text-proof",
  provider: "border-claim text-claim border-dashed",
  failed: "border-fail text-fail",
  unknown: "border-edge text-ink-3",
};
const STATE_WORD: Record<ClaimState, string> = { verified: "proved", provider: "claimed", failed: "failed", unknown: "unchecked" };

export function Badge({ name, state, compact }: { name: ClaimName; state: ClaimState; compact?: boolean }) {
  return (
    <span title={`${CLAIM_LABEL[name]}: ${STATE_WORD[state]}. ${CLAIM_HINT[name]}`} className={`inline-flex items-center gap-1 border px-1.5 py-[3px] font-mono text-[10px] leading-none font-medium tracking-wide whitespace-nowrap uppercase ${STATE_STYLE[state]}`}>
      <span>{state === "verified" ? "✓" : state === "provider" ? "~" : state === "failed" ? "✕" : "·"}</span>
      {compact ? CLAIM_LABEL[name].split(" ")[0] : `${CLAIM_LABEL[name]} · ${STATE_WORD[state]}`}
    </span>
  );
}

export function Pane({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pane ${className}`}>{children}</div>;
}

export function H({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-10 border-b border-ink pb-6">
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-ink-2 uppercase">
        <span className="inline-block size-2.5 bg-signal" />
        {kicker}
      </div>
      <h1 className="condensed mt-3 text-5xl leading-[0.9] uppercase sm:text-7xl">{title}</h1>
      {children && <p className="mt-4 max-w-2xl text-lg text-ink-2">{children}</p>}
    </header>
  );
}

export function Button({ children, onClick, disabled, kind = "solid", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "solid" | "ghost"; type?: "button" | "submit" }) {
  const k = kind === "solid" ? "bg-ink text-night border border-ink hover:bg-signal hover:border-signal" : "border border-ink text-ink hover:bg-ink hover:text-night";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`px-4 py-2 text-sm font-semibold tracking-wide uppercase transition disabled:opacity-40 ${k}`}>
      {children}
    </button>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <code className={`font-mono text-[12px] break-all text-ink-2 ${className}`}>{children}</code>;
}

export const short = (s: string, n = 6) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
