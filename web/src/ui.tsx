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
  verified: "border-proof/50 text-proof bg-proof/10",
  provider: "border-claim/40 text-claim bg-claim/5",
  failed: "border-fail/50 text-fail bg-fail/10",
  unknown: "border-edge text-ink-3",
};
const STATE_WORD: Record<ClaimState, string> = { verified: "proved", provider: "claimed", failed: "failed", unknown: "unchecked" };

export function Badge({ name, state, compact }: { name: ClaimName; state: ClaimState; compact?: boolean }) {
  return (
    <span title={`${CLAIM_LABEL[name]}: ${STATE_WORD[state]}. ${CLAIM_HINT[name]}`} className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10.5px] leading-none whitespace-nowrap ${STATE_STYLE[state]}`}>
      <span className={`size-1.5 rounded-full ${state === "verified" ? "bg-proof" : state === "provider" ? "bg-claim" : state === "failed" ? "bg-fail" : "bg-ink-3"}`} />
      {compact ? CLAIM_LABEL[name].split(" ")[0] : `${CLAIM_LABEL[name]} · ${STATE_WORD[state]}`}
    </span>
  );
}

export function Pane({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`pane sheen rounded-lg ${className}`}>{children}</div>;
}

export function H({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <div className="font-mono text-[11px] tracking-[0.2em] text-proof uppercase">{kicker}</div>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
      {children && <p className="mt-3 max-w-2xl text-ink-2">{children}</p>}
    </header>
  );
}

export function Button({ children, onClick, disabled, kind = "solid", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "solid" | "ghost"; type?: "button" | "submit" }) {
  const k = kind === "solid" ? "bg-proof text-night hover:brightness-110" : "border border-edge text-ink-2 hover:text-ink hover:border-ink-3";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-40 ${k}`}>
      {children}
    </button>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <code className={`font-mono text-[12px] break-all text-ink-2 ${className}`}>{children}</code>;
}

export const short = (s: string, n = 6) => (s.length > n * 2 + 1 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
