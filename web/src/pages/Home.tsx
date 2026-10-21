import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, CLAIMS, GATEWAY, type MarketRow } from "../api";
import { BrandIcon, brandOf, CLAIM_LABEL } from "../ui";
import { go, Mark } from "../App";

/* ---------- shared ---------- */

const W = "mx-auto max-w-[1344px] px-6";
const LOG_KEY = "Dpv6Pp6QceJEroUywrfSDSQDrZKc7W2V3SSfyYw7sNSw";
const usd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const ago = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};

function useMarket() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  useEffect(() => {
    const load = () => api.market().then((m) => setRows(m.listings), () => undefined);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  return rows;
}
function useTick(ms: number) {
  const [n, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (el.classList.add("in"), io.disconnect()), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Split({ title, children, link }: { title: ReactNode; children: ReactNode; link?: [string, () => void] }) {
  return (
    <Reveal className="grid gap-6 lg:grid-cols-2">
      <h2 className="h-display text-4xl leading-[1.04] sm:text-5xl">{title}</h2>
      <div>
        <p className="max-w-xl text-xl leading-snug text-ink-2 sm:text-[22px]">{children}</p>
        {link && (
          <button onClick={link[1]} className="mt-8 text-ink-2 transition hover:text-ink">
            {link[0]} <span className="ml-1">→</span>
          </button>
        )}
      </div>
    </Reveal>
  );
}

const Check = ({ className = "text-proof" }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={`size-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="8" cy="8" r="6.5" opacity=".35" />
    <path d="M5.2 8.2l1.9 1.9 3.8-4" />
  </svg>
);

/* ---------- hero: the product, doing its job ---------- */

const DEMO: { q: string; a: string }[] = [
  { q: "Here are my lab results from Tuesday. What should I ask my doctor?", a: "Your ferritin is low and your TSH is slightly high. Ask whether the two are related, whether you should be tested for thyroid antibodies, and if iron supplements make sense before a recheck in six weeks." },
  { q: "Help me write my resignation. My manager doesn't know yet.", a: "Keep it short and warm: thank them for the chance to grow, give your last day, and offer to document your projects before you go. Here's a draft you can send as-is…" },
  { q: "Go through our Q3 numbers before the board sees them.", a: "Revenue is up 18% but gross margin fell four points, almost all from the hardware line. The board will ask about it first: lead with the fix, then the growth." },
];
const STEPS: [string, string, string][] = [
  ["CPU enclave", "Intel TDX · quote up to date", "38 ms"],
  ["GPU enclave", "NVIDIA H100 · confidential mode", "51 ms"],
  ["Code", "Sigstore release, measured", "12 ms"],
  ["Weights", "google/gemma-4-31B-it @842da37", "9 ms"],
  ["Keys", "bound to the attestation", "4 ms"],
];

function SideIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d={d} />
    </svg>
  );
}

function AppMock({ rows }: { rows: MarketRow[] | null }) {
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const d = DEMO[i];
  // A small timeline per prompt: type the question, run the five checks, stream the answer, print the receipt, next.
  useEffect(() => {
    const total = d.q.length + 6 * 5 + d.a.length / 2 + 90;
    const h = setTimeout(() => {
      if (t < total) setT(t + 1);
      else {
        setT(0);
        setI((i + 1) % DEMO.length);
      }
    }, 28);
    return () => clearTimeout(h);
  }, [t, i, d]);
  const typed = d.q.slice(0, t);
  const after = Math.max(0, t - d.q.length);
  const checks = Math.min(5, Math.floor(after / 6));
  const answer = checks === 5 ? d.a.slice(0, Math.max(0, (after - 30) * 2)) : "";
  const done = answer.length >= d.a.length;
  const live = rows?.filter((r) => r.routable).length;

  return (
    <div className="overflow-hidden rounded-[14px] border border-edge bg-[#08090b] shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]">
      <div className="grid md:grid-cols-[232px_1fr]">
        <aside className="hidden border-r border-edge p-4 md:block">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Mark className="size-4" /> Tinted <span className="text-ink-3">⌄</span>
            </span>
            <span className="grid size-7 place-items-center rounded-full border border-edge">
              <SideIcon d="M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM10.5 10.5 14 14" />
            </span>
          </div>
          <div className="mt-6 grid gap-0.5 text-sm">
            {[
              ["Private chat", "M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z", true],
              ["Market", "M2.5 13.5h11M4.5 11V7M8 11V4M11.5 11V8.5", false],
              ["Receipts", "M4 2.5h8v11l-2-1-2 1-2-1-2 1ZM6 6h4M6 8.5h4", false],
              ["API keys", "M6 9.5a3 3 0 1 1 2.1-.9L13.5 14M11 11.5l1.5-1.5", false],
              ["Anonymous", "M2.5 5.5h11v5h-11ZM6 5.5v5", false],
            ].map(([l, p, on]) => (
              <div key={l as string} className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${on ? "bg-pane-2 text-ink" : "text-ink-2"}`}>
                <SideIcon d={p as string} />
                {l as string}
              </div>
            ))}
          </div>
        </aside>
        <div className="min-h-[470px]">
          <div className="flex items-center justify-between border-b border-edge px-5 py-3.5 text-sm">
            <span className="font-medium">Private chat</span>
            <span className="flex items-center gap-2 rounded-full border border-edge px-2.5 py-1 text-xs text-ink-2">
              Gemma 4 31B <span className="size-1.5 rounded-full bg-proof" /> {checks}/5 proved
            </span>
          </div>
          <div className="space-y-5 p-5 sm:p-8">
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-pane-2 px-4 py-3 text-[15px] leading-relaxed">
              {typed || " "}
              {t < d.q.length && <span className="caret ml-px">▍</span>}
            </div>
            {after > 0 && (
              <div className="rise max-w-xl rounded-xl border border-edge">
                <div className="flex justify-between border-b border-edge px-4 py-2.5 text-xs text-ink-3">
                  <span>Inspection before sending</span>
                  <span>{checks === 5 ? "passed · sent sealed" : "checking…"}</span>
                </div>
                {STEPS.map(([k, v, ms], n) => (
                  <div key={k} className={`flex items-center gap-3 px-4 py-2 text-[13px] transition ${n < checks ? "opacity-100" : "opacity-30"}`}>
                    <Check className={n < checks ? "text-proof" : "text-ink-3"} />
                    <span className="w-24 shrink-0">{k}</span>
                    <span className="truncate text-ink-3">{v}</span>
                    <span className="ml-auto font-mono text-[11px] text-ink-3">{n < checks ? ms : ""}</span>
                  </div>
                ))}
              </div>
            )}
            {answer && <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{answer}</p>}
            {done && (
              <div className="rise max-w-2xl divide-y divide-edge border-t border-edge text-[13px]">
                <div className="flex items-center gap-3 py-2.5">
                  <SideIcon d="M4 2.5h8v11l-2-1-2 1-2-1-2 1ZM6 6h4M6 8.5h4" />
                  <span>Receipt</span>
                  <span className="text-ink-3">signed in the enclave</span>
                  <span className="ml-auto font-mono text-[12px] text-ink-2">rcpt_38ff…4ddf</span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <SideIcon d="M2.5 8h11M8 2.5v11" />
                  <span>Anchored</span>
                  <span className="text-ink-3">Solana · hourly Merkle root</span>
                  <span className="ml-auto font-mono text-[12px] text-proof">{live ? `${live} models live` : "✓"}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ rows }: { rows: MarketRow[] | null }) {
  return (
    <section className="relative">
      <div className={`${W} grid gap-10 pt-28 pb-16 sm:pt-40 lg:grid-cols-2 lg:items-end`}>
        <h1 className="h-display text-[44px] leading-[1.02] sm:text-[64px]">
          The Private
          <br />
          Inference Market.
        </h1>
        <div className="lg:text-right">
          <p className="text-lg text-ink-2 lg:ml-auto lg:max-w-sm">Private by hardware, proven every call, paid with zero-knowledge. Every model runs in a sealed enclave, and Tinted inspects the proof before your prompt leaves.</p>
          <button onClick={() => go("credits")} className="mt-6 inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/[0.06] px-4 py-2 text-[15px] text-ink transition hover:border-signal/60">
            <Mark className="size-4" tone="#6fd6c4" /> Introducing anonymous credits <span className="text-ink-2">→</span>
          </button>
        </div>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-3 top-1/3 bottom-0 rounded-b-[20px] bg-[radial-gradient(ellipse_70%_90%_at_50%_100%,rgba(70,170,180,.38),rgba(40,70,120,.18)_45%,transparent_75%)]" />
        <div className={`${W} relative pb-12`}>
          <AppMock rows={rows} />
        </div>
      </div>
    </section>
  );
}

/* ---------- names ---------- */

const NAMES = ["Gemma", "Llama", "DeepSeek", "Qwen", "GPT-OSS", "GLM", "Kimi", "Mistral", "Tinfoil", "Phala", "NEAR AI", "Privatemode", "Chutes"];

function Names() {
  const line = [...NAMES, ...NAMES];
  return (
    <div className="border-b border-edge">
      <div className={`${W} flex items-center gap-8 py-14`}>
        <span className="hidden shrink-0 rounded-md border border-edge px-3 py-1.5 text-sm text-ink-2 sm:block">Private models from every enclave provider</span>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <div className="marquee flex w-max gap-14 text-xl font-semibold tracking-[-0.02em] text-ink/85 whitespace-nowrap">
            {line.map((n, k) => (
              <span key={k} className="flex items-center gap-2.5">
                <BrandIcon name={n} className="size-5" /> {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- market panel ---------- */

function MarketPanel({ rows }: { rows: MarketRow[] | null }) {
  const ok = useMemo(() => (rows ?? []).filter((r) => r.routable).sort((a, b) => a.outputPerM - b.outputPerM), [rows]);
  const [sel, setSel] = useState<string | null>(null);
  const [budget, setBudget] = useState(10);
  const cur = ok.find((r) => r.id === sel) ?? ok.find((r) => r.id.includes("gemma")) ?? ok[0];
  const max = Math.max(...ok.map((r) => r.outputPerM), 1);
  const last = rows?.map((r) => r.checkedAt).filter(Boolean).sort().at(-1);
  // A typical message: ~1,500 tokens in (with history), ~400 out.
  const perMsg = cur ? (1500 * cur.inputPerM + 400 * cur.outputPerM) / 1e6 : 0;

  return (
    <div className="overflow-hidden rounded-[14px] border border-edge bg-pane">
      <div className="flex items-center justify-between border-b border-edge px-5 py-3.5 text-sm">
        <span className="font-medium">Market</span>
        <span className="text-ink-3">Inspected {ago(last)}</span>
      </div>
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        <div className="border-edge md:border-r">
          <div className="flex justify-between px-5 pt-4 pb-2 text-xs text-ink-3">
            <span>Output price · per 1M tokens</span>
            <span>Proofs</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-2 pb-3">
            {ok.map((r) => {
              const on = cur?.id === r.id;
              const n = CLAIMS.filter((c) => r.claims?.[c] === "verified").length;
              return (
                <button key={r.id} onClick={() => setSel(r.id)} className={`grid w-full grid-cols-[64px_1fr_44px] items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${on ? "bg-pane-2 shadow-[inset_2px_0_0_#6fd6c4]" : "hover:bg-pane-2/50"}`}>
                  <span className={`font-mono text-[13px] ${on ? "text-ink" : "text-ink-2"}`}>{usd(r.outputPerM)}</span>
                  <span className="min-w-0">
                    <span className={`flex items-center gap-2 truncate ${on ? "text-ink" : "text-ink-2"}`}>
                      <BrandIcon name={r.name + " " + r.model} className="size-3.5 opacity-80" />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="mt-1 block h-1 rounded-full bg-edge">
                      <span className={`block h-full rounded-full ${on ? "bg-signal shadow-[0_0_10px_rgba(111,214,196,.7)]" : "bg-ink-3/50"}`} style={{ width: `${Math.max(4, (r.outputPerM / max) * 100)}%` }} />
                    </span>
                  </span>
                  <span className={`text-right font-mono text-[12px] ${n === 5 ? "text-proof" : "text-ink-3"}`}>{n}/5</span>
                </button>
              );
            })}
            {!rows && <div className="px-3 py-6 text-sm text-ink-3">Reading the market…</div>}
          </div>
        </div>
        {cur && (
          <div className="flex flex-col p-6">
            <div className="text-sm text-ink-3">Selected</div>
            <div className="mt-1 flex items-center gap-2.5 text-lg font-medium">
              <BrandIcon name={cur.name + " " + cur.model} className="size-5" />
              {cur.name}
            </div>
            <div className="font-mono text-xs text-ink-3">{cur.id}</div>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="h-display text-4xl">{usd(cur.outputPerM)}</span>
              <span className="text-sm text-ink-3">/ 1M out · {usd(cur.inputPerM)} in</span>
            </div>
            <div className="mt-6 grid gap-2 text-sm">
              {CLAIMS.map((c) => (
                <div key={c} className="flex items-center gap-2.5">
                  <span className={`size-1.5 rounded-full ${cur.claims?.[c] === "verified" ? "bg-proof" : cur.claims?.[c] === "provider" ? "bg-claim" : "bg-ink-3"}`} />
                  <span className="text-ink-2">{CLAIM_LABEL[c]}</span>
                  <span className="ml-auto text-ink-3">{cur.claims?.[c] === "verified" ? "proved" : cur.claims?.[c] === "provider" ? "provider's word" : "—"}</span>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-8">
              <div className="text-xs text-ink-3">You pay</div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 rounded-md border border-edge bg-night px-3 py-2">
                  <span className="text-ink-3">$</span>
                  <input type="number" min={1} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} className="w-16 bg-transparent outline-none" />
                  <span className="text-xs text-ink-3">USDC</span>
                </label>
                <button onClick={() => go("chat", cur.id)} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-night hover:bg-white">
                  Chat with it
                </button>
              </div>
              <div className="mt-3 text-sm text-ink-2">≈ {perMsg ? Math.floor(budget / perMsg).toLocaleString() : "…"} messages</div>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-edge px-5 py-3 text-xs text-ink-3">Only models that passed inspection in the last 10 minutes are listed. Prices include Tinted's fee.</div>
    </div>
  );
}

/* ---------- line drawings ---------- */

function useIso(S: number, ox: number, oy: number) {
  const p = (x: number, y: number, z: number) => [ox + (x - y) * 0.866 * S, oy + (x + y) * 0.5 * S - z * S] as const;
  const poly = (pts: [number, number, number][]) => pts.map((q) => p(...q).join(",")).join(" ");
  const box = (x: number, y: number, z: number, w: number, d: number, h: number, key: string, accent = false) => (
    <g key={key} stroke={accent ? "#c9cdd3" : "#7d828b"} strokeWidth={1.15} strokeLinejoin="round" fill="#040405">
      <polygon points={poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} />
      <polygon points={poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} />
      <polygon points={poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} />
    </g>
  );
  const line = (a: [number, number, number], b: [number, number, number], key: string, dash?: string) => {
    const [x1, y1] = p(...a);
    const [x2, y2] = p(...b);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7d828b" strokeWidth={1.15} strokeDasharray={dash} />;
  };
  return { p, poly, box, line };
}

function DrawEnclave() {
  const { box, line } = useIso(15, 120, 40);
  return (
    <svg viewBox="0 0 240 170" className="h-40 w-full">
      {Array.from({ length: 7 }, (_, k) => line([0.6 + k, 7, 0.25], [0.6 + k, 7.9, -0.1], "a" + k))}
      {Array.from({ length: 7 }, (_, k) => line([7, 0.6 + k, 0.25], [7.9, 0.6 + k, -0.1], "b" + k))}
      {box(0, 0, 0, 7, 7, 0.55, "base")}
      {box(1.6, 1.6, 0.55, 3.8, 3.8, 0.45, "die", true)}
      {box(2.6, 2.6, 1, 1.8, 1.8, 0.9, "lock")}
    </svg>
  );
}
function DrawLedger() {
  const { box, line } = useIso(15, 120, 64);
  return (
    <svg viewBox="0 0 240 170" className="h-40 w-full">
      {line([3, 3, 0.6], [3, 3, 1.4], "l1")}
      {line([3, 3, 2], [3, 3, 2.8], "l2")}
      {box(0.5, 0.5, 0, 5, 5, 0.6, "b1")}
      {box(0.5, 0.5, 1.4, 5, 5, 0.6, "b2")}
      {box(0.5, 0.5, 2.8, 5, 5, 0.6, "b3", true)}
      {line([1.6, 1.6, 3.42], [4.4, 1.6, 3.42], "t1", "3 3")}
      {line([1.6, 2.6, 3.42], [4.4, 2.6, 3.42], "t2", "3 3")}
    </svg>
  );
}
function DrawNote() {
  const { box, line, p } = useIso(15, 110, 58);
  const [cx, cy] = p(6.6, 2, 0.32);
  return (
    <svg viewBox="0 0 240 170" className="h-40 w-full">
      {box(0, 0, 0, 8, 4, 0.3, "card")}
      {line([5.6, 0, 0.3], [5.6, 4, 0.3], "perf", "2 4")}
      <ellipse cx={cx} cy={cy} rx={9} ry={5} fill="none" stroke="#c9cdd3" strokeWidth={1.15} />
      {line([1, 1, 0.3], [4.4, 1, 0.3], "x1")}
      {line([1, 2, 0.3], [3.2, 2, 0.3], "x2")}
      {box(1.4, 5.4, 0, 3, 3, 0.3, "card2")}
    </svg>
  );
}

function Drawings() {
  const items: [string, ReactNode, string, string][] = [
    ["/enclave", <DrawEnclave />, "Sealed in hardware", "Models run inside Intel TDX, AMD SEV-SNP and NVIDIA confidential GPUs."],
    ["/receipts", <DrawLedger />, "Receipts on Solana", "Every response is signed in the enclave and anchored every hour."],
    ["/anonymous", <DrawNote />, "Pay without a trail", "Buy a note with USDC, spend it with a zero-knowledge proof."],
  ];
  return (
    <div className="grid border-y border-edge md:grid-cols-3">
      {items.map(([path, art, t, d], k) => (
        <Reveal key={path} delay={k * 80} className={`px-0 py-10 md:px-8 ${k ? "border-t border-edge md:border-t-0 md:border-l" : "md:pl-0"}`}>
          <div className="font-mono text-[13px] text-ink-3">{path}</div>
          <div className="my-10">{art}</div>
          <div className="font-medium">{t}</div>
          <p className="mt-2 max-w-xs text-ink-2">{d}</p>
        </Reveal>
      ))}
    </div>
  );
}

/* ---------- inspection heatmap ---------- */

function Heatmap({ rows }: { rows: MarketRow[] | null }) {
  const tick = useTick(450);
  const ok = (rows ?? []).filter((r) => r.routable !== false && r.claims).slice(0, 18);
  const col = ok.length ? tick % (ok.length + 6) : -1;
  const last = rows?.map((r) => r.checkedAt).filter(Boolean).sort().at(-1);
  useTick(1000);
  const next = last ? Math.max(0, 600 - Math.round((Date.now() - Date.parse(last)) / 1000)) : null;
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[14px] border border-edge bg-pane/60 lg:w-[74%]">
        <div className="flex items-center gap-3 border-b border-edge px-5 py-3.5 text-sm">
          <span className="font-medium">Inspections</span>
          <span className="rounded-md border border-edge px-2 py-0.5 text-xs text-ink-2">Every model × every proof</span>
        </div>
        <div className="overflow-x-auto p-5">
          <div className="grid w-max gap-[7px]" style={{ gridTemplateColumns: `92px repeat(${Math.max(ok.length, 1)}, 34px)` }}>
            {CLAIMS.map((c) => (
              <div key={c} className="contents">
                <span className="self-center text-xs text-ink-3">{CLAIM_LABEL[c]}</span>
                {ok.map((r, k) => {
                  const s = r.claims![c];
                  const hot = k === col;
                  return (
                    <span
                      key={r.id}
                      title={`${r.name} · ${CLAIM_LABEL[c]}: ${s}`}
                      className={`size-[34px] rounded-[7px] transition-all duration-300 ${s === "verified" ? (hot ? "bg-signal shadow-[0_0_16px_rgba(111,214,196,.8)]" : "bg-signal/45") : s === "provider" ? (hot ? "bg-claim" : "bg-claim/35") : "bg-fail/40"}`}
                      style={s === "verified" && !hot ? { opacity: 0.55 + ((k * 7 + c.length) % 5) * 0.09 } : undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-signal/70" /> proved by Tinted
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-claim/60" /> provider's word
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-[14px] border border-edge bg-pane p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,.9)] lg:absolute lg:top-1/2 lg:right-0 lg:mt-0 lg:w-[340px] lg:-translate-y-1/2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Next inspection</span>
          <span className="rounded-md border border-edge px-2 py-0.5 text-xs text-ink-2">every 10 min</span>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="h-display font-mono text-4xl">{next === null ? "…" : next === 0 ? "now" : `${Math.floor(next / 60)}:${String(next % 60).padStart(2, "0")}`}</span>
          <span className="text-sm text-ink-3">last {ago(last)}</span>
        </div>
        <div className="mt-5 flex h-12 items-end gap-[3px]">
          {ok.map((r, k) => {
            const n = CLAIMS.filter((c) => r.claims?.[c] === "verified").length;
            return <span key={r.id} className={`flex-1 rounded-[2px] ${k === ok.length - 1 ? "bg-signal" : "bg-ink-3/40"}`} style={{ height: `${20 + n * 16}%` }} />;
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => go("verify")} className="rounded-full border border-edge bg-pane-2 px-3 py-1.5 text-sm hover:border-ink-3">
            Verify
          </button>
          <button onClick={() => go("market")} className="rounded-full bg-ink px-3 py-1.5 text-sm font-medium text-night hover:bg-white">
            Market
          </button>
        </div>
      </div>
    </div>
  );
}

const GUARANTEES: [string, string][] = [
  ["Fails closed", "A model whose proof fails is taken off the market. Nothing is sent to it until it passes again."],
  ["Weights pinned", "Where the provider allows it, the exact model weights are pinned by hash in the measured image."],
  ["TLS ends in the enclave", "api.tinted.market's certificate key is derived inside Tinted's enclave, with evidence you can fetch."],
  ["Nothing logged", "Prompts and answers are never stored. Receipts hold hashes, not words."],
];

function Guarantees() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Reveal className="grid gap-6 border-t border-edge py-10 lg:grid-cols-2">
      <span className="text-ink-2">Guarantees</span>
      <div>
        <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {GUARANTEES.map(([t], k) => (
            <button key={t} onClick={() => setOpen(open === k ? null : k)} className="flex items-center gap-2 text-left text-ink hover:text-white">
              {t} <span className={`text-ink-3 transition ${open === k ? "rotate-45" : ""}`}>+</span>
            </button>
          ))}
        </div>
        {open !== null && <p className="rise mt-5 max-w-lg text-ink-2">{GUARANTEES[open][1]}</p>}
      </div>
    </Reveal>
  );
}

/* ---------- one key ---------- */

const MONO: Record<string, string> = { "gpt-oss": "OSS", deepseek: "DS", qwen: "QW", llama: "LL", gemma: "GM", kimi: "KM", glm: "GLM", mistral: "MS", voxtral: "VX", nomic: "NM", hermes: "HM", minimax: "MM" };
const family = (r: MarketRow) => {
  const n = (r.model.split("/").pop() ?? r.model).toLowerCase();
  return n.match(/^(gpt-oss|deepseek|qwen|llama|gemma|kimi|glm|mistral|voxtral|nomic|hermes|minimax)/)?.[1] ?? n.split(/[-.\d]/)[0];
};

function KeyWall({ rows }: { rows: MarketRow[] | null }) {
  const tick = useTick(1600);
  const fams = useMemo(() => {
    const m = new Map<string, MarketRow>();
    for (const r of rows ?? []) {
      const k = brandOf(r.name + " " + r.model) ?? family(r);
      if (r.routable && !m.has(k)) m.set(k, r);
    }
    return [...m.entries()];
  }, [rows]);
  const tiles = Array.from({ length: 18 }, (_, k) => fams[k] ?? null);
  const active = fams.length ? tick % fams.length : -1;
  const cur = active >= 0 ? fams[active][1] : null;
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-edge bg-[radial-gradient(ellipse_at_20%_30%,rgba(111,214,196,.07),transparent_55%)] px-6 py-12 sm:px-16 lg:px-[18%]">
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:w-[86%]">
        {tiles.map((t, k) => (
          <div
            key={k}
            className={`grid aspect-square place-items-center rounded-[14px] border transition duration-500 ${t ? (k === active ? "border-signal/60 bg-[#0b1516] shadow-[0_0_28px_-4px_rgba(111,214,196,.55)]" : "border-edge bg-pane") : "border-edge/50 bg-pane/40"}`}
            style={!t ? { opacity: Math.max(0.15, 0.6 - (k - fams.length) * 0.06) } : undefined}
          >
            {t &&
              (brandOf(t[1].name + " " + t[1].model) ? (
                <BrandIcon name={t[1].name + " " + t[1].model} className={`size-8 transition ${k === active ? "text-ink" : "text-ink-3"}`} />
              ) : (
                <span className={`font-mono text-lg ${k === active ? "text-ink" : "text-ink-3"}`}>{MONO[t[0]] ?? t[0].slice(0, 2).toUpperCase()}</span>
              ))}
          </div>
        ))}
      </div>
      <div className="relative mt-8 rounded-[12px] border border-edge bg-pane shadow-[0_20px_60px_-10px_rgba(0,0,0,.9)] lg:absolute lg:top-[38%] lg:right-6 lg:mt-0 lg:w-[460px]">
        <div className="flex items-center justify-between border-b border-edge px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-medium">
            {cur ? <BrandIcon name={cur.name + " " + cur.model} className="size-4" /> : <span className="font-mono text-ink-3">›_</span>} {cur ? cur.name : "Your app"}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-edge px-2 py-0.5 text-xs text-ink-2">
            <span className="size-1.5 rounded-full bg-proof" /> Connected
          </span>
        </div>
        <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.9] text-ink">
          <span className="text-ink-3">export</span> OPENAI_BASE_URL={GATEWAY}/v1{"\n"}
          <span className="text-ink-3">export</span> OPENAI_API_KEY=tnt_••••7Q2{"\n"}
          <span className="text-signal">$</span> python app.py <span className="caret bg-signal text-signal">▍</span>
        </pre>
      </div>
    </div>
  );
}

/* ---------- anonymous credits: the zero-knowledge flow ---------- */

function MiniTree({ hot }: { hot: number }) {
  // 8 leaves under one root. The highlighted leaf wanders: the proof shows one of them is yours, not which.
  const leaves = Array.from({ length: 8 }, (_, k) => 14 + k * 34);
  const l1 = [0, 1, 2, 3].map((k) => (leaves[k * 2] + leaves[k * 2 + 1]) / 2);
  const l2 = [0, 1].map((k) => (l1[k * 2] + l1[k * 2 + 1]) / 2);
  const root = (l2[0] + l2[1]) / 2;
  const edge = (x1: number, y1: number, x2: number, y2: number, k: string) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2a2d33" strokeWidth={1.2} />;
  return (
    <svg viewBox="0 0 280 150" className="w-full">
      {leaves.map((x, k) => edge(x, 118, l1[k >> 1], 80, "a" + k))}
      {l1.map((x, k) => edge(x, 80, l2[k >> 1], 44, "b" + k))}
      {l2.map((x, k) => edge(x, 44, root, 12, "c" + k))}
      <circle cx={root} cy={12} r={6} fill="#6fd6c4" />
      {[...l1.map((x) => [x, 80]), ...l2.map((x) => [x, 44])].map(([x, y], k) => (
        <circle key={k} cx={x} cy={y} r={4} fill="#121317" stroke="#3a3e46" />
      ))}
      {leaves.map((x, k) => (
        <rect key={k} x={x - 10} y={118} width={20} height={20} rx={5} fill={k === hot ? "#6fd6c4" : "#121317"} stroke={k === hot ? "#6fd6c4" : "#2a2d33"} style={{ transition: "all .4s" }} />
      ))}
    </svg>
  );
}

function ZkFlow() {
  const tick = useTick(1400);
  const step = tick % 4;
  const [cfg, setCfg] = useState<{ root: string; size: number } | null>(null);
  useEffect(() => {
    api.credits().then((c) => setCfg({ root: c.root, size: c.size }), () => undefined);
  }, []);
  const card = (n: number, title: string, body: ReactNode) => (
    <div className={`flex flex-col rounded-[12px] border p-5 transition duration-500 ${step === n ? "border-signal/50 bg-[#0b1415] shadow-[0_0_30px_-10px_rgba(111,214,196,.6)]" : "border-edge bg-pane"}`}>
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span>0{n + 1}</span>
        <span className={step === n ? "text-signal" : ""}>{["Pay", "Join", "Prove", "Spend"][n]}</span>
      </div>
      <div className="mt-4 font-medium">{title}</div>
      <div className="mt-4 flex-1 text-sm text-ink-2">{body}</div>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-[14px] border border-edge bg-pane/60">
      <div className="flex items-center gap-3 border-b border-edge px-5 py-3.5 text-sm">
        <span className="font-medium">Anonymous credits</span>
        <span className="rounded-md border border-edge px-2 py-0.5 text-xs text-ink-2">Groth16 · BN254 · Poseidon</span>
        <span className="ml-auto hidden text-ink-3 sm:block">{cfg ? `${cfg.size} note${cfg.size === 1 ? "" : "s"} in the tree · root ${cfg.root.slice(0, 8)}…` : "reading the tree…"}</span>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-4">
        {card(
          0,
          "Your wallet buys a note",
          <div className="space-y-2 font-mono text-[12px]">
            <div className="flex justify-between">
              <span className="text-ink-3">amount</span>
              <span>50 USDC</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-ink-3">memo</span>
              <span className="truncate">tinted:note:1f3a9c…</span>
            </div>
            <p className="pt-2 font-sans text-[13px] text-ink-3">The secrets stay in your browser. Only a commitment goes on-chain.</p>
          </div>,
        )}
        {card(
          1,
          "It joins the note tree",
          <div>
            <MiniTree hot={(tick * 5 + 3) % 8} />
            <p className="mt-2 text-[13px] text-ink-3">The tree's root is posted to Solana by Tinted's enclave key.</p>
          </div>,
        )}
        {card(
          2,
          "You prove, not reveal",
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-edge">
              <div className="h-full rounded-full bg-signal transition-all duration-[1300ms]" style={{ width: step === 2 ? "100%" : step > 2 ? "100%" : "8%" }} />
            </div>
            <div className="mt-3 font-mono text-[12px] text-ink-2">~0.5 s in your browser</div>
            <p className="mt-3 text-[13px] text-ink-3">A zero-knowledge proof that one of the notes is yours. Never which one.</p>
          </div>,
        )}
        {card(
          3,
          "A fresh key gets the credit",
          <div className="space-y-2 font-mono text-[12px]">
            <div className="flex justify-between">
              <span className="text-ink-3">key</span>
              <span>tnt_••••Q7</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-3">credit</span>
              <span className="text-proof">+$50.00</span>
            </div>
            <p className="pt-2 font-sans text-[13px] text-ink-3">No line from the wallet to this key exists anywhere. Not even at Tinted.</p>
          </div>,
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-edge px-5 py-3 text-xs text-ink-3">
        <span>Setup on the PSE Perpetual Powers of Tau, sealed with a Solana blockhash. Circuit and keys are open source.</span>
        <button onClick={() => go("credits")} className="text-ink-2 transition hover:text-ink">
          Buy a note →
        </button>
      </div>
    </div>
  );
}

/* ---------- anchors, read from Solana itself ---------- */

interface AnchorRow {
  sig: string;
  time: number | null;
  count: number;
  root: string;
}

function useAnchors() {
  const [a, setA] = useState<AnchorRow[] | null>(null);
  useEffect(() => {
    api.anchors().then(
      (r) => setA(r.anchors.map((x) => ({ sig: x.tx, time: Date.parse(x.at) / 1000, count: x.count, root: x.root }))),
      () => setA([]),
    );
  }, []);
  return a;
}

function Anchors() {
  const a = useAnchors();
  const shown = (a ?? []).slice(0, 4);
  return (
    <div>
      <div className="relative grid gap-10 md:grid-cols-4">
        <div className="absolute top-[5px] right-0 left-0 hidden h-px bg-edge md:block" />
        {(shown.length ? shown : [null, null, null, null]).map((r, k) => (
          <div key={k} className="relative">
            <span className={`relative block size-[11px] rounded-full border-2 border-night ${k === 0 && r ? "bg-signal shadow-[0_0_10px_rgba(111,214,196,.8)]" : "bg-edge"}`} />
            {r ? (
              <a href={`https://solscan.io/tx/${r.sig}`} target="_blank" rel="noreferrer" className="group mt-12 block">
                <div className="font-medium group-hover:text-white">Batch {(a?.length ?? 0) - k}</div>
                <div className="mt-1.5 text-ink-2">
                  {r.count} receipt{r.count === 1 ? "" : "s"} under root {r.root.slice(0, 8)}…
                </div>
                <div className="mt-4 font-mono text-[13px] text-ink-3 uppercase">{r.time ? new Date(r.time * 1000).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "pending"}</div>
              </a>
            ) : (
              <div className="mt-12 text-ink-3">{a === null ? "Reading Solana…" : k === 0 ? "No batch yet this hour" : ""}</div>
            )}
          </div>
        ))}
      </div>
      <a href={`https://solscan.io/account/${LOG_KEY}`} target="_blank" rel="noreferrer" className="mt-12 inline-block text-ink-2 transition hover:text-ink">
        View the log on Solscan <span className="ml-1">→</span>
      </a>
    </div>
  );
}

/* ---------- cards ---------- */

function Shapes({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 400 400" className="h-full w-auto" aria-hidden>
      <path d="M0 0h190a10 10 0 0 1 10 10v88L0 200Z" fill={tone} />
      <path d="M200 102V190a10 10 0 0 1-10 10H8Z" fill={tone} opacity=".55" />
      <circle cx="310" cy="100" r="90" fill={tone} />
      <path d="M210 210h180v180a0 0 0 0 1 0 0C290 390 210 310 210 210Z" fill={tone} />
      <path d="M0 210c110 0 190 80 190 190H0Z" fill={tone} opacity=".7" />
    </svg>
  );
}

function Cards({ rows }: { rows: MarketRow[] | null }) {
  const [notes, setNotes] = useState<number | null>(null);
  useEffect(() => {
    api.credits().then((c) => setNotes(c.size), () => undefined);
  }, []);
  const live = rows?.filter((r) => r.routable).length;
  return (
    <div>
      <div className="grid gap-2 lg:grid-cols-[2fr_1fr]">
        <Reveal className="relative flex min-h-[460px] flex-col overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,#a6e3d6,#62b7c4)] p-8 text-night">
          <h3 className="relative z-10 max-w-sm text-[32px] leading-[1.12] tracking-[-0.02em]">Every call is sealed in hardware before it's sent.</h3>
          <div className="absolute right-0 bottom-0 h-[80%] opacity-60">
            <Shapes tone="#d3f1ea" />
          </div>
          <div className="relative z-10 mt-auto flex items-center gap-4">
            <Mark className="size-6" tone="#040405" />
            <span className="h-8 w-px bg-night/20" />
            <div className="text-sm">
              <div className="font-medium">{live ?? "…"} private models</div>
              <div className="opacity-70">Passing every proof right now</div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={80} className="relative flex min-h-[460px] flex-col overflow-hidden rounded-[10px] bg-[linear-gradient(160deg,#d4dbff,#8b9cf2)] p-8 text-night">
          <h3 className="relative z-10 text-[32px] leading-[1.12] tracking-[-0.02em]">Notes pay for calls without a trail.</h3>
          <div className="relative z-10 mt-auto flex items-center gap-4">
            <Mark className="size-6" tone="#040405" />
            <span className="h-8 w-px bg-night/20" />
            <div className="text-sm">
              <div className="font-medium">{notes ?? "…"} notes in the tree</div>
              <div className="opacity-70">Zero-knowledge, Groth16</div>
            </div>
          </div>
        </Reveal>
      </div>
      <div className="mt-8 flex justify-between text-ink-2">
        <span>
          Tinted serves <b className="font-medium text-ink">{live ?? "…"}</b> private models, inspected every 10 minutes.
        </span>
        <button onClick={() => go("market")} className="transition hover:text-ink">
          Browse models <span className="ml-1">→</span>
        </button>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export function Home() {
  const rows = useMarket();
  return (
    <div>
      <Hero rows={rows} />
      <Names />

      <section className={`${W} py-32`}>
        <Split title="A market for private inference.">Confidential-computing providers list their models. Tinted inspects each one and routes only to those that pass, cheapest first.</Split>
        <Reveal className="mt-16">
          <MarketPanel rows={rows} />
        </Reveal>
      </section>

      <section className={`${W} pt-16 pb-24`}>
        <Reveal>
          <p className="h-display max-w-5xl text-4xl leading-[1.1] sm:text-[52px]">
            A gateway that can't read what it carries. <span className="text-ink-3">The hardware proves it, every answer is signed, and the receipts live on Solana.</span>
          </p>
        </Reveal>
        <div className="mt-20">
          <Drawings />
        </div>
      </section>

      <section className={`${W} py-24`}>
        <Heatmap rows={rows} />
        <div className="mt-24">
          <Guarantees />
        </div>
      </section>

      <section className={`${W} border-t border-edge py-32`}>
        <Split title="One key. Every private model." link={["Read the quickstart", () => go("docs")]}>
          Point any OpenAI-compatible app at Tinted. Each response comes back with the proofs it passed and a receipt you can check.
        </Split>
        <Reveal className="mt-16">
          <KeyWall rows={rows} />
        </Reveal>
      </section>

      <section className={`${W} border-t border-edge py-32`}>
        <Split title="Anonymous by math." link={["Buy a note", () => go("credits")]}>
          Hardware hides what you say. Zero-knowledge hides who paid. Buy a note from any wallet, redeem it with a proof, and your prompts can't be traced back to you.
        </Split>
        <Reveal className="mt-16">
          <ZkFlow />
        </Reveal>
      </section>

      <section className={`${W} border-t border-edge py-32`}>
        <Reveal>
          <h2 className="h-display mb-16 text-4xl sm:text-5xl">Anchors</h2>
        </Reveal>
        <Anchors />
      </section>

      <section className={`${W} pb-24`}>
        <Cards rows={rows} />
      </section>

      <section className={`${W} py-32 text-center`}>
        <Reveal>
          <h2 className="h-display text-[44px] leading-[1.02] sm:text-[72px]">
            Say anything.
            <br />
            We can't read it.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button onClick={() => go("chat")} className="rounded-full bg-ink px-6 py-3 font-medium text-night hover:bg-white">
              Open a private chat
            </button>
            <button onClick={() => go("account")} className="rounded-full border border-edge bg-pane-2 px-6 py-3 font-medium hover:border-ink-3">
              Get an API key
            </button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
