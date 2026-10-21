import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, CLAIMS, GATEWAY, type MarketRow } from "../api";
import { Badge, CLAIM_HINT, CLAIM_LABEL } from "../ui";
import { Scene } from "../Scene";
import { go } from "../App";

/* ---------- small pieces ---------- */

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (el.classList.add("in"), io.disconnect()), { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <div className="font-mono text-[11px] tracking-[0.22em] text-proof uppercase">{children}</div>;
}

function Head({ kicker, title, sub, center }: { kicker: string; title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Kicker>{kicker}</Kicker>
      <h2 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl">{title}</h2>
      {sub && <p className="mt-4 text-lg text-ink-2">{sub}</p>}
    </Reveal>
  );
}

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};
const family = (r: MarketRow) => {
  const n = (r.model.split("/").pop() ?? r.model).toLowerCase();
  const m = n.match(/^(gpt-oss|deepseek|qwen|llama|gemma|kimi|glm|mistral|nomic|phi|hermes|gemini|minimax|nemotron)/);
  return m ? m[1] : n.split(/[-.\d]/)[0];
};
const MONO: Record<string, string> = { "gpt-oss": "OSS", deepseek: "DS", qwen: "QW", llama: "LL", gemma: "GM", kimi: "KM", glm: "GLM", mistral: "MS", nomic: "NM", phi: "PHI", hermes: "HM", minimax: "MM", nemotron: "NT" };

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
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/* ---------- hero ---------- */

function Hero({ rows }: { rows: MarketRow[] | null }) {
  const routable = rows?.filter((r) => r.routable).length;
  return (
    <section className="relative -mx-4 -mt-10 overflow-hidden px-4 pt-16 pb-10 sm:pt-24">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div className="halo pointer-events-none absolute top-10 right-0 h-[520px] w-[720px]" />
      <span className="cross top-6 left-2" />
      <span className="cross top-6 right-2" />
      <div className="pointer-events-none absolute top-6 left-8 hidden font-mono text-[11px] text-ink-3 lg:block">[ 200 OK ]</div>
      <div className="pointer-events-none absolute top-6 right-8 hidden font-mono text-[11px] text-ink-3 lg:block">[ /V1 ]</div>

      <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <a href="#/verify" className="inline-flex items-center gap-2 rounded-full border border-edge bg-pane/80 py-1 pr-3 pl-1 font-mono text-[11px] text-ink-2 hover:border-proof/40">
            <span className="rounded-full bg-proof/15 px-2 py-0.5 text-proof">TEE</span>
            PRIVATE INFERENCE MARKET · SOLANA
            <span className="text-proof">→</span>
          </a>
          <h1 className="mt-6 text-[44px] leading-[0.98] font-semibold tracking-[-0.045em] sm:text-6xl xl:text-[68px]">
            Private AI.
            <br />
            <span className="whitespace-nowrap">
              <span className="font-display font-normal tracking-[-0.02em] text-proof italic">Proven</span> on every call.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            Every model runs inside a hardware enclave. Tinted checks the chip, the GPU, the code, the weights and the keys before your prompt leaves, so nobody running the
            machine can read it. Not even us.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => go("chat")} className="rounded-lg bg-proof px-5 py-3 font-medium text-night shadow-[0_8px_30px_-8px_rgba(127,209,185,.6)] transition hover:brightness-110">
              Start a private chat →
            </button>
            <button onClick={() => go("account")} className="rounded-lg border border-edge bg-pane px-5 py-3 font-medium text-ink transition hover:border-ink-3">
              Get an API key
            </button>
          </div>
          <div className="mt-8 max-w-xl rounded-2xl border border-edge bg-pane/80 p-4 backdrop-blur">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-2 text-ink-2">
                <span className="size-1.5 animate-pulse rounded-full bg-proof" /> GATEWAY · INTEL TDX
              </span>
              <span className="rounded-full border border-proof/40 px-2 py-0.5 text-proof">LIVE · ATTESTED</span>
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {routable !== undefined ? (
                <>
                  <b className="text-ink">{routable} private models</b> passing every proof right now. TLS ends inside the enclave; receipts are anchored on Solana.
                </>
              ) : (
                "Reading the market…"
              )}{" "}
              <a href="#/verify" className="text-proof underline-offset-2 hover:underline">
                Verify it yourself
              </a>
            </p>
          </div>
        </div>
        <Scene className="w-full" />
      </div>
    </section>
  );
}

function Ticker({ rows }: { rows: MarketRow[] | null }) {
  useTick(10_000);
  const items = (rows ?? []).filter((r) => r.checkedAt && r.routable);
  if (!items.length) return null;
  const line = [...items, ...items];
  return (
    <div className="relative -mx-4 overflow-hidden border-y border-edge bg-pane/40 py-3 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="marquee flex w-max gap-10 font-mono text-[12px] whitespace-nowrap">
        {line.map((r, i) => {
          const n = CLAIMS.filter((c) => r.claims?.[c] === "verified").length;
          return (
            <span key={i} className="flex items-center gap-2 text-ink-3">
              <span className="text-proof">✓</span>
              <span className="text-ink-2">{r.name}</span>
              <span>{n}/5 proved</span>
              <span>· {ago(r.checkedAt)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- demo: one prompt, both sides of the glass ---------- */

const PROMPTS = [
  "Summarize this term sheet and flag anything unusual in the liquidation preference.",
  "Here are my lab results from Tuesday. What should I ask my doctor?",
  "Draft a reply to my landlord about the deposit. Keep it firm.",
  "Go through our Q3 numbers before the board sees them. What looks weak?",
  "Help me write a resignation letter. My manager doesn't know yet.",
  "Find the bug in this private repo before the audit starts.",
  "Summarize these customer support tickets. They include names and emails.",
  "What are my options if I can't pay this tax bill on time?",
  "Translate this message to my family. It's personal.",
  "Review this contract clause. Can they really terminate without notice?",
];
const CHIPS: [string, number][] = [
  ["Medical", 1],
  ["Legal", 9],
  ["Finance", 3],
  ["Code", 5],
  ["Personal", 4],
];

function Demo() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const text = PROMPTS[i];
  useEffect(() => {
    const t = setTimeout(
      () => {
        if (n < text.length) setN(n + 1);
        else {
          setN(0);
          setI((i + 1) % PROMPTS.length);
        }
      },
      n < text.length ? 26 : 2800,
    );
    return () => clearTimeout(t);
  }, [n, i, text.length]);
  const typed = text.slice(0, n);
  const lit = n >= text.length ? 5 : Math.floor((n / text.length) * 5);
  const cipher = typed.replace(/[^ ]/g, "▮");

  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-pane">
      <div className="flex flex-wrap items-center gap-2 border-b border-edge px-4 py-3">
        <span className="mr-1 font-mono text-[11px] text-ink-3">TRY</span>
        {CHIPS.map(([c, idx]) => (
          <button
            key={c}
            onClick={() => {
              setI(idx);
              setN(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs transition ${i === idx ? "border-proof/50 bg-proof/10 text-proof" : "border-edge text-ink-2 hover:text-ink"}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid md:grid-cols-[1fr_auto_1fr]">
        <div className="p-6 sm:p-8">
          <div className="font-mono text-[11px] text-ink-3">YOUR SIDE</div>
          <p className="mt-3 min-h-28 text-xl leading-relaxed sm:text-2xl">
            {typed}
            <span className="ml-0.5 inline-block h-6 w-[2px] translate-y-1 animate-pulse bg-proof" />
          </p>
          <div className="mt-5 space-y-1.5 font-mono text-[12px]">
            {CLAIMS.map((c, k) => (
              <div key={c} className={`flex items-center gap-2 transition ${k < lit ? "text-proof" : "text-ink-3/60"}`}>
                <span>{k < lit ? "✓" : "○"}</span>
                <span className="w-24">{CLAIM_LABEL[c]}</span>
                <span className="text-ink-3">{k < lit ? "proved" : "checking"}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative hidden w-12 md:block">
          <div className="absolute inset-0 bg-gradient-to-r from-proof/25 via-proof/5 to-transparent" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-proof/60" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 font-mono text-[10px] tracking-[0.3em] whitespace-nowrap text-proof">ONE-WAY GLASS</div>
        </div>
        <div className="border-t border-edge bg-[#050708] p-6 sm:p-8 md:border-t-0">
          <div className="font-mono text-[11px] text-ink-3">WHAT THE OPERATOR SEES</div>
          <p aria-hidden className="mt-3 min-h-28 font-mono text-lg leading-relaxed break-all text-edge sm:text-xl">
            {cipher}
          </p>
          <div className="mt-5 font-mono text-[12px] text-ink-3">
            <div>tls → enclave · end to end</div>
            <div>memory · encrypted by the CPU and GPU</div>
            <div>logs · {lit === 5 ? <span className="text-proof">nothing to log</span> : "…"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- live numbers ---------- */

function Stats({ rows }: { rows: MarketRow[] | null }) {
  useTick(1000);
  const r = rows ?? [];
  const ok = r.filter((x) => x.routable);
  const last = r.map((x) => x.checkedAt).filter(Boolean).sort().at(-1) ?? null;
  const next = last ? Math.max(0, 600 - Math.round((Date.now() - Date.parse(last)) / 1000)) : null;
  const cheapest = [...ok].sort((a, b) => a.outputPerM - b.outputPerM).slice(0, 6);
  const maxP = Math.max(...cheapest.map((x) => x.outputPerM), 0.01);
  const proofsChecked = r.filter((x) => x.claims).length * 5;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Reveal className="rounded-2xl border border-edge bg-pane p-6">
        <div className="font-mono text-[11px] tracking-[0.18em] text-ink-3">ON THE MARKET · LIVE</div>
        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-6xl font-semibold tracking-[-0.04em]">{rows ? ok.length : "…"}</span>
          <span className="text-ink-3">private models</span>
        </div>
        <div className="mt-6 flex h-12 items-end gap-[3px]">
          {ok.map((x) => {
            const n = CLAIMS.filter((c) => x.claims?.[c] === "verified").length;
            return <div key={x.id} title={`${x.name}: ${n}/5 proved`} className="flex-1 rounded-sm bg-proof" style={{ height: `${n * 20}%`, opacity: 0.45 + n * 0.11 }} />;
          })}
        </div>
        <div className="mt-3 font-mono text-[10.5px] text-ink-3">{proofsChecked} proofs checked in the last cycle · bar height = proofs passed</div>
      </Reveal>
      <Reveal className="rounded-2xl border border-edge bg-pane p-6" delay={80}>
        <div className="font-mono text-[11px] tracking-[0.18em] text-ink-3">CHEAPEST PRIVATE MODELS · $/1M OUT</div>
        <div className="mt-5 space-y-2.5">
          {cheapest.map((x) => (
            <div key={x.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
              <div className="min-w-0">
                <div className="truncate text-ink-2">{x.name}</div>
                <div className="mt-1 h-1.5 rounded-full bg-night">
                  <div className="h-full rounded-full bg-gradient-to-r from-proof/40 to-proof" style={{ width: `${Math.max(6, (x.outputPerM / maxP) * 100)}%` }} />
                </div>
              </div>
              <span className="font-mono text-[12px]">${x.outputPerM.toFixed(2)}</span>
            </div>
          ))}
          {!rows && <div className="text-sm text-ink-3">Loading…</div>}
        </div>
      </Reveal>
      <Reveal className="rounded-2xl border border-edge bg-pane p-6" delay={160}>
        <div className="font-mono text-[11px] tracking-[0.18em] text-ink-3">NEXT RE-VERIFICATION</div>
        <div className="mt-4 flex items-center gap-6">
          <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#151b1f" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="#7fd1b9" strokeWidth="6" strokeLinecap="round" strokeDasharray={276.5} strokeDashoffset={next === null ? 276.5 : 276.5 * (next / 600)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div>
            <div className="font-mono text-4xl">{next === null ? "…" : next === 0 ? <span className="animate-pulse text-proof">now</span> : `${Math.floor(next / 60)}:${String(next % 60).padStart(2, "0")}`}</div>
            <div className="mt-1 text-sm text-ink-3">last check {ago(last)}</div>
          </div>
        </div>
        <p className="mt-5 text-sm text-ink-2">Every listing is re-proved every 10 minutes. A failed proof takes it off the market until it passes again.</p>
      </Reveal>
    </div>
  );
}

/* ---------- model wall ---------- */

function Wall({ rows }: { rows: MarketRow[] | null }) {
  const fams = useMemo(() => {
    const m = new Map<string, MarketRow[]>();
    for (const r of rows ?? []) if (r.routable) m.set(family(r), [...(m.get(family(r)) ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  const [hot, setHot] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHot((h) => h + 1), 1800);
    return () => clearInterval(t);
  }, []);
  // Each family once, then empty tiles fading out: room for the providers that pass next.
  const tiles: ([string, MarketRow[]] | null)[] = [...fams, ...Array.from({ length: Math.max(0, 18 - fams.length) }, () => null)];
  const active = fams.length ? hot % fams.length : -1;
  const cur = active >= 0 ? fams[active] : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-edge bg-pane/60 p-6 sm:p-10">
      <div className="halo pointer-events-none absolute -top-20 -left-20 size-[480px]" />
      <div className="relative grid grid-cols-4 gap-3 sm:grid-cols-6 lg:w-[62%]">
        {tiles.map((t, k) =>
          t ? (
            <div key={k} className={`flex aspect-square flex-col items-center justify-center rounded-xl border bg-night/70 transition duration-500 ${k === active ? "border-proof/70 shadow-[0_0_30px_-6px_rgba(127,209,185,.6)]" : "border-edge"}`}>
              <span className={`font-mono text-lg font-medium ${k === active ? "text-proof" : "text-ink-2"}`}>{MONO[t[0]] ?? t[0].slice(0, 2).toUpperCase()}</span>
              <span className="mt-1 hidden font-mono text-[9px] text-ink-3 sm:block">
                {t[1].length} model{t[1].length > 1 ? "s" : ""}
              </span>
            </div>
          ) : (
            <div key={k} className="aspect-square rounded-xl border border-dashed border-edge/70" style={{ opacity: Math.max(0.12, 0.7 - (k - fams.length) * 0.07) }} />
          ),
        )}
      </div>
      <div className="relative mt-6 rounded-xl border border-edge bg-night/90 p-4 shadow-2xl backdrop-blur lg:absolute lg:top-1/2 lg:right-8 lg:mt-0 lg:w-[38%] lg:-translate-y-1/2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate font-medium">{cur ? cur[1][0].name : "Your client"}</span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-proof/30 px-2 py-0.5 text-[11px] text-proof">
            <span className="size-1.5 rounded-full bg-proof" /> Connected
          </span>
        </div>
        <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-ink-2">
          <span className="text-ink-3">export</span> OPENAI_BASE_URL={GATEWAY}/v1{"\n"}
          <span className="text-ink-3">model</span> = "{cur ? cur[1][0].id : "tinfoil/gemma4-31b"}"
        </pre>
      </div>
    </div>
  );
}

/* ---------- code window ---------- */

const SNIPPETS: Record<string, { file: string; code: string }> = {
  Python: {
    file: "quickstart.py",
    code: `from openai import OpenAI

tinted = OpenAI(base_url="${GATEWAY}/v1", api_key=TINTED_KEY)
r = tinted.chat.completions.with_raw_response.create(
    model="tinfoil/gemma4-31b",
    messages=[{"role": "user", "content": "hello"}],
)
print(r.headers["x-tinted-verified"])  # hardware=verified,gpu=verified,…
print(r.headers["x-tinted-receipt"])   # rcpt_… check it on Solana`,
  },
  TypeScript: {
    file: "quickstart.ts",
    code: `import OpenAI from "openai";

const tinted = new OpenAI({ baseURL: "${GATEWAY}/v1", apiKey: TINTED_KEY });
const { data, response } = await tinted.chat.completions
  .create({ model: "tinfoil/gemma4-31b", messages: [{ role: "user", content: "hello" }] })
  .withResponse();
console.log(response.headers.get("x-tinted-verified"));`,
  },
  cURL: {
    file: "terminal",
    code: `curl ${GATEWAY}/v1/chat/completions \\
  -H "authorization: Bearer $TINTED_KEY" \\
  -H "content-type: application/json" \\
  -d '{"model":"tinfoil/gemma4-31b",
       "messages":[{"role":"user","content":"hello"}]}' -i`,
  },
  ".env": {
    file: ".env",
    code: `# any OpenAI-compatible client
OPENAI_BASE_URL=${GATEWAY}/v1
OPENAI_API_KEY=tnt_••••••••`,
  },
};

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, set] = useState(false);
  return (
    <button
      onClick={() =>
        void navigator.clipboard.writeText(text).then(() => {
          set(true);
          setTimeout(() => set(false), 1400);
        })
      }
      className="font-mono text-[11px] text-ink-3 hover:text-proof"
    >
      {ok ? "copied ✓" : label}
    </button>
  );
}

function CodeWindow() {
  const [tab, setTab] = useState("Python");
  const s = SNIPPETS[tab];
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-[#0b0e10] shadow-2xl">
      <div className="flex gap-1 overflow-x-auto border-b border-edge p-2">
        {Object.keys(SNIPPETS).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-xs whitespace-nowrap ${k === tab ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"}`}>
            {k}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-b border-edge px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#e5706a]" />
        <span className="size-2.5 rounded-full bg-[#d6b56b]" />
        <span className="size-2.5 rounded-full bg-proof" />
        <span className="ml-3 font-mono text-[11px] text-ink-3">{s.file}</span>
        <span className="ml-auto">
          <CopyBtn text={s.code} />
        </span>
      </div>
      <pre className="overflow-x-auto py-4 font-mono text-[12.5px] leading-[1.75]">
        {s.code.split("\n").map((l, k) => (
          <div key={k} className="flex">
            <span className="w-10 shrink-0 pr-4 text-right text-ink-3/50 select-none">{k + 1}</span>
            <span className={l.trim().startsWith("#") ? "text-ink-3" : "text-ink-2"}>{l || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

/* ---------- how a call works ---------- */

const STEPS: [string, string][] = [
  ["Seal", "Your browser opens TLS straight into Tinted's enclave. The certificate key was born in there; the network in between carries ciphertext."],
  ["Prove", "Before anything moves, Tinted checks each provider's CPU, GPU, code, weights and key proofs against Intel, AMD and NVIDIA's own roots."],
  ["Route", "Only listings that passed every proof in the last 10 minutes can receive your request. Anything else is held back."],
  ["Answer", "The model runs inside its own enclave. The answer comes back the same way: sealed end to end, never logged."],
  ["Receipt", "You get a receipt signed by an enclave-born key. Every hour, a Merkle root of all receipts is posted to Solana."],
];

function Steps() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), 5200);
    return () => clearTimeout(t);
  }, [step, paused]);
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
      <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {STEPS.map(([t, d], k) => (
          <button key={t} onClick={() => setStep(k)} className="relative block w-full border-t border-edge py-4 text-left last:border-b">
            <div className="flex items-baseline gap-5">
              <span className={`font-mono text-[11px] ${k === step ? "text-proof" : "text-ink-3"}`}>{String(k + 1).padStart(2, "0")}</span>
              <span className={`text-2xl font-semibold tracking-[-0.02em] transition sm:text-3xl ${k === step ? "text-ink" : "text-ink-3/70 hover:text-ink-2"}`}>{t}</span>
            </div>
            {k === step && <p className="mt-2 pl-10 text-ink-2">{d}</p>}
            {k === step && <span key={step + String(paused)} className={`absolute -bottom-px left-0 h-px bg-proof ${paused ? "w-full" : "progress"}`} style={{ animationDuration: "5.2s" }} />}
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="halo pointer-events-none absolute inset-0" />
        <Scene focus={step} className="relative w-full" />
      </div>
    </div>
  );
}

/* ---------- who can read it ---------- */

const WHO: [string, string, string][] = [
  ["The model provider's staff", "Read prompts in their logs", "Ciphertext only: the model runs sealed in an enclave"],
  ["The cloud or GPU host", "Can dump memory at any time", "Memory is encrypted by the CPU and GPU"],
  ["Tinted, the operator", "A normal router sees all it relays", "Runs in its own attested enclave, TLS ends inside it"],
  ["Whoever breaches the logs", "Gets every conversation", "Gets hashes. Receipts never contain text"],
  ["Your payment trail", "Card, email, name on file", "ZK credits unlink the wallet from the key"],
];

function Compare() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Reveal className="rounded-2xl border border-edge bg-pane/60 p-6">
        <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]">
          <span className="text-ink-3">A NORMAL AI API</span>
          <span className="rounded-full border border-fail/40 px-2 py-0.5 text-fail">EXPOSED</span>
        </div>
        <div className="mt-5 space-y-3">
          {WHO.map(([who, plain]) => (
            <div key={who} className="flex gap-3 border-t border-edge pt-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-fail" />
              <div>
                <div className="text-ink-2">{who}</div>
                <div className="text-ink-3">{plain}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal className="glow rounded-2xl border border-proof/30 bg-gradient-to-b from-proof/[0.06] to-pane/60 p-6" delay={100}>
        <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.18em]">
          <span className="text-proof">THROUGH TINTED</span>
          <span className="rounded-full border border-proof/40 px-2 py-0.5 text-proof">SEALED</span>
        </div>
        <div className="mt-5 space-y-3">
          {WHO.map(([who, , tinted]) => (
            <div key={who} className="flex gap-3 border-t border-proof/15 pt-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-proof" />
              <div>
                <div className="text-ink">{who}</div>
                <div className="text-ink-2">{tinted}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---------- features ---------- */

function IconChip() {
  return (
    <svg viewBox="0 0 120 80" className="h-24 w-36" fill="none" stroke="#7a8784">
      <path d="M20 44 L60 24 L100 44 L60 64 Z" />
      <path d="M20 44 L20 50 L60 70 L100 50 L100 44" />
      <path d="M40 44 L60 34 L80 44 L60 54 Z" stroke="#7fd1b9" />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M${44 + k * 6} ${56 - k * 3} l0 6`} />
      ))}
    </svg>
  );
}
function IconMask() {
  return (
    <svg viewBox="0 0 120 80" className="h-24 w-36" fill="none" stroke="#7a8784">
      <path d="M30 30 L60 15 L90 30 L90 50 L60 65 L30 50 Z" />
      <path d="M30 30 L60 45 L90 30 M60 45 L60 65" />
      <circle cx="60" cy="38" r="5" stroke="#7fd1b9" />
      <path d="M60 43 l0 8" stroke="#7fd1b9" />
    </svg>
  );
}
function IconChain() {
  return (
    <svg viewBox="0 0 120 80" className="h-24 w-36" fill="none" stroke="#7a8784">
      {[0, 1, 2].map((k) => (
        <g key={k} transform={`translate(${k * 22} ${-k * 11})`}>
          <path d="M18 52 L40 41 L62 52 L40 63 Z" stroke={k === 2 ? "#7fd1b9" : "#7a8784"} />
          <path d="M18 52 L18 57 L40 68 L62 57 L62 52" />
        </g>
      ))}
    </svg>
  );
}

function Features() {
  const items: { path: string; title: string; body: string; icon: ReactNode; to: Parameters<typeof go>[0] }[] = [
    { path: "/verify", title: "Check it yourself", body: "Fresh hardware quotes, bound keys and receipts you can verify in your browser.", icon: <IconChip />, to: "verify" },
    { path: "/anonymous", title: "Pay without a trail", body: "Buy a note with USDC, redeem it with a zero-knowledge proof. No link left.", icon: <IconMask />, to: "credits" },
    { path: "/receipts", title: "Every call, on-chain", body: "Signed receipts, batched into Merkle roots posted to Solana every hour.", icon: <IconChain />, to: "verify" },
  ];
  return (
    <div className="grid border-y border-edge md:grid-cols-3">
      {items.map((it, k) => (
        <Reveal key={it.path} delay={k * 90} className={`group cursor-pointer transition hover:bg-pane/50 ${k ? "border-t border-edge md:border-t-0 md:border-l" : ""}`}>
          <div onClick={() => go(it.to)} className="p-6 sm:p-8">
            <div className="font-mono text-[11px] text-ink-3">{it.path}</div>
            <div className="my-8 flex justify-center transition group-hover:scale-105">{it.icon}</div>
            <div className="font-medium">{it.title}</div>
            <p className="mt-1.5 text-sm text-ink-2">{it.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ---------- FAQ ---------- */

const FAQ: [string, string][] = [
  ["Can Tinted read my prompts?", "No. Your client opens TLS straight into a gateway running inside an Intel TDX enclave: api.tinted.market's certificate key exists only in there. Its code is open source and pinned by image digest, and the hardware quote proves which build is running. It forwards only to provider enclaves whose proofs just passed."],
  ['What does "claimed" mean?', "The provider states it, but we couldn't prove it from vendor-signed evidence. Most often that's the exact model weights. You can require proved weights per request and the call is refused otherwise."],
  ["What happens when a proof fails?", "The listing is taken off the market and no request is sent to it until it passes again. Re-checks run every 10 minutes."],
  ["Am I getting the real model?", "For listings with proved weights, yes: the weights are pinned to a repository revision and a hash in the measured image. For the others the provider's statement is shown as exactly that."],
  ["Is it anonymous?", "Keys need no email or wallet connect. For full unlinkability use anonymous credits: buy a note from your wallet, then redeem it with a zero-knowledge proof that shows it was paid for without revealing which payment was yours."],
  ["Why Solana?", "USDC settles in seconds for fractions of a cent, and the receipt log and the anonymous-credit tree need a public, cheap, permanent home."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-edge border-y border-edge">
      {FAQ.map(([q, a], k) => (
        <div key={q}>
          <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg hover:text-proof">
            <span>{q}</span>
            <span className={`grid size-7 shrink-0 place-items-center rounded-full border border-edge font-mono text-proof transition ${open === k ? "rotate-45" : ""}`}>+</span>
          </button>
          <div className={`grid transition-all duration-300 ${open === k ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"}`}>
            <p className="overflow-hidden text-ink-2">{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export function Home() {
  const rows = useMarket();
  return (
    <div>
      <Hero rows={rows} />
      <Ticker rows={rows} />

      <section className="py-24">
        <Head kicker="// See through it" title="One prompt. Two sides of the glass." sub="You read your words. The machine that runs the model, and everyone who operates it, gets ciphertext." />
        <Reveal className="mt-10">
          <Demo />
        </Reveal>
      </section>

      <section className="py-12">
        <Head kicker="// Live market" title="Proved, priced, re-checked." />
        <div className="mt-10">
          <Stats rows={rows} />
        </div>
      </section>

      <section className="py-24">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
          <Head kicker="// Models" title="One key. Every private model." />
          <Reveal>
            <p className="text-lg text-ink-2">Open models from the confidential-computing providers that pass the proofs, behind one OpenAI-compatible endpoint.</p>
            <button onClick={() => go("market")} className="mt-3 text-proof hover:underline">
              Browse the market →
            </button>
          </Reveal>
        </div>
        <Reveal className="mt-10">
          <Wall rows={rows} />
        </Reveal>
      </section>

      <section className="py-12">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Head kicker="// Two-minute setup" title="Change the base URL. Keep your code." />
            <Reveal className="mt-6 space-y-3 text-ink-2">
              <p>Two extra response headers tell you which proofs passed for that exact call and where its receipt lives.</p>
              <div className="mt-6 inline-flex max-w-full flex-col rounded-xl border border-edge bg-pane">
                <div className="border-b border-edge px-4 py-2 font-mono text-[11px] text-ink-3">GIVE TO YOUR AGENT</div>
                <div className="flex items-center gap-3 px-4 py-3 font-mono text-[12.5px]">
                  <span className="text-proof">›</span>
                  <span className="truncate">Add Tinted to my app: tinted.market/llms.txt</span>
                  <CopyBtn text="Add Tinted to my app: https://tinted.market/llms.txt" label="⧉" />
                </div>
              </div>
            </Reveal>
          </div>
          <Reveal delay={100}>
            <CodeWindow />
          </Reveal>
        </div>
      </section>

      <section className="py-24">
        <Head kicker="// How a call works" title="Five steps. Nothing in the clear." />
        <Reveal className="mt-12">
          <Steps />
        </Reveal>
      </section>

      <section className="py-12">
        <Head kicker="// Privacy" title="Who can read your prompt?" />
        <div className="mt-10">
          <Compare />
        </div>
      </section>

      <section className="py-24">
        <Features />
      </section>

      <section className="py-12">
        <Head kicker="// The proofs" title="Checked against the chipmakers, not the provider's word." />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CLAIMS.map((c, k) => (
            <Reveal key={c} delay={k * 60} className="rounded-2xl border border-edge bg-pane p-5 transition hover:border-proof/40">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-3">{String(k + 1).padStart(2, "0")}</span>
                <Badge name={c} state="verified" compact />
              </div>
              <div className="mt-8 text-xl font-semibold tracking-[-0.02em]">{CLAIM_LABEL[c]}</div>
              <p className="mt-2 text-sm text-ink-2">{CLAIM_HINT[c]}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <Head kicker="// FAQ" title="Questions worth asking." />
          <Reveal>
            <Faq />
          </Reveal>
        </div>
      </section>

      <section className="relative -mx-4 overflow-hidden border-t border-edge px-4 py-28 text-center">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="halo pointer-events-none absolute inset-x-0 top-0 mx-auto h-full max-w-3xl" />
        <Reveal className="relative">
          <h2 className="text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">
            Say it <span className="font-display font-normal tracking-normal text-proof italic">privately.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink-2">A key takes one click. Top up a few dollars of USDC, or buy an anonymous note, and every call comes with its proof.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button onClick={() => go("chat")} className="rounded-lg bg-proof px-5 py-3 font-medium text-night hover:brightness-110">
              Start a private chat →
            </button>
            <button onClick={() => go("credits")} className="rounded-lg border border-edge bg-pane px-5 py-3 font-medium hover:border-ink-3">
              Buy an anonymous note
            </button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
