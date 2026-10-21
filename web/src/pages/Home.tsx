import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, CLAIMS, GATEWAY, type Anchor, type ClaimName, type ClaimState, type MarketRow, type Receipt } from "../api";
import { CLAIM_LABEL } from "../ui";
import { go } from "../App";

const ago = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};
const usd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const short = (s: string, a = 6, b = 6) => (s.length > a + b + 1 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

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

function Section({ n, title, children, aside }: { n: string; title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-ink py-16 sm:py-24">
      <div className="mb-10 grid gap-4 sm:grid-cols-[120px_1fr_auto] sm:items-start">
        <div className="font-mono text-[12px] text-ink-3">§ {n}</div>
        <h2 className="condensed text-4xl leading-[0.92] uppercase sm:text-6xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const PROMPTS = [
  "Here are my lab results from Tuesday. What should I ask my doctor?",
  "Help me write my resignation. My manager doesn't know yet.",
  "Go through our Q3 numbers before the board sees them.",
  "Can they really fire me for this? Here's the email.",
  "Find the bug in our private repo before the audit.",
  "What are my options if I can't pay this tax bill?",
  "Summarize this term sheet. Anything unusual in the liquidation preference?",
];

/* ---------- the hero: a pane of film you drag across your own sentence ---------- */

function Hero({ rows }: { rows: MarketRow[] | null }) {
  const [x, setX] = useState(58);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const ok = rows?.filter((r) => r.routable) ?? [];
  const last = rows?.map((r) => r.checkedAt).filter(Boolean).sort().at(-1);
  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setX(Math.min(94, Math.max(8, ((clientX - r.left) / r.width) * 100)));
  };
  const text = PROMPTS[i];
  const sentence = (cls = "") => <p className={`condensed text-[clamp(46px,8.6vw,150px)] leading-[0.86] tracking-[-0.015em] ${cls}`}>{text}</p>;

  return (
    <section className="-mx-4 border-b border-ink">
      <div className="flex justify-between border-b border-ink px-4 py-2 font-mono text-[11px] text-ink-2 uppercase">
        <span>Nº 01 — The private inference market</span>
        <span className="hidden sm:block">Intel TDX · NVIDIA CC · Solana</span>
      </div>
      <div
        ref={box}
        className="relative h-[min(72vh,680px)] min-h-[480px] touch-none overflow-hidden select-none"
        onPointerMove={(e) => drag.current && move(e.clientX)}
        onPointerUp={() => (drag.current = false)}
        onPointerLeave={() => (drag.current = false)}
      >
        {/* your side: the sentence, in the clear */}
        <div className="absolute inset-x-4 top-10 sm:inset-x-10 sm:top-14">{sentence()}</div>
        <div className="absolute bottom-4 left-4 font-mono text-[11px] uppercase sm:left-10">
          <div className="text-ink-3">Your side</div>
          <div>
            <span className="sm:hidden">VLT 100%</span>
            <span className="hidden sm:inline">Visible light transmission 100%</span>
          </div>
          <button onClick={() => setI((i + 1) % PROMPTS.length)} className="mt-3 border-b border-ink text-ink hover:text-signal">
            Another sentence ↻
          </button>
        </div>

        {/* their side: smoked film; all that comes back is a faint reflection */}
        <div className="film film-solid absolute inset-y-0 right-0" style={{ left: `${x}%` }}>
          <div className="absolute inset-y-0 right-0 overflow-hidden" style={{ left: 0 }}>
            <div className="absolute top-10 opacity-[0.035] blur-[1.5px] sm:top-14" style={{ left: `calc(-${x}vw + 1rem)`, width: "calc(100vw - 2rem)", transform: "scaleX(-1)" }}>
              {sentence("text-white")}
            </div>
          </div>
          <div className="absolute bottom-4 left-5 font-mono text-[11px] uppercase">
            <div className="text-white/45">The operator's side</div>
            <div className="text-white/80">
              <span className="sm:hidden">VLT 0%</span>
              <span className="hidden sm:inline">Visible light transmission 0%</span>
            </div>
          </div>
          {/* the maker's sticker, with live numbers */}
          <div className="absolute top-[46%] right-3 w-[min(270px,80%)] rotate-[-2deg] bg-night text-ink shadow-[0_6px_18px_rgba(0,0,0,.45)] sm:right-10">
            <div className="flex items-center justify-between bg-signal px-3 py-1.5 text-white">
              <span className="condensed text-lg uppercase">Tinted</span>
              <span className="hidden font-mono text-[10px] sm:inline">FILM T-0</span>
            </div>
            <div className="space-y-1 px-3 py-2.5 font-mono text-[11px]">
              <div className="flex">
                <span>VLT</span>
                <span className="leader" />
                <span>0%</span>
              </div>
              <div className="hidden sm:flex">
                <span>Models proved</span>
                <span className="leader" />
                <span>{rows ? ok.length : "…"}</span>
              </div>
              <div className="hidden sm:flex">
                <span>Last inspection</span>
                <span className="leader" />
                <span>{ago(last)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* the edge of the film: drag it */}
        <div
          className="absolute inset-y-0 z-10 flex w-6 -translate-x-1/2 cursor-ew-resize items-center justify-center"
          style={{ left: `${x}%` }}
          onPointerDown={(e) => {
            drag.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => drag.current && move(e.clientX)}
          onPointerUp={() => (drag.current = false)}
        >
          <div className="h-full w-[3px] bg-ink" />
          <div className="absolute top-1/2 flex h-16 w-5 -translate-y-1/2 flex-col items-center justify-center gap-1 border border-ink bg-night">
            {[0, 1, 2].map((k) => (
              <span key={k} className="h-px w-2.5 bg-ink" />
            ))}
          </div>
          <div className="absolute top-3 left-5 font-mono text-[10px] whitespace-nowrap text-ink-3 uppercase">⟷ drag the film</div>
        </div>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="grid gap-8 py-12 lg:grid-cols-[1.1fr_1fr_auto] lg:items-end">
      <h1 className="condensed text-5xl leading-[0.88] uppercase sm:text-7xl">
        Private AI
        <br />
        you can <span className="text-signal">check.</span>
      </h1>
      <p className="max-w-md text-lg leading-snug text-ink-2">
        Every model on Tinted runs inside a hardware enclave. Before your words leave, we inspect the chip, the GPU, the code, the weights and the keys. You read the answer.
        Nobody running the machine can. Not even us.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
        <button onClick={() => go("chat")} className="bg-ink px-6 py-4 text-left font-semibold tracking-wide text-night uppercase hover:bg-signal">
          Open a private chat →
        </button>
        <button onClick={() => go("account")} className="border border-ink px-6 py-4 text-left font-semibold tracking-wide uppercase hover:bg-ink hover:text-night">
          Get an API key
        </button>
      </div>
    </section>
  );
}

/* ---------- a strip of film with sprocket holes, carrying the live market ---------- */

function Filmstrip({ rows }: { rows: MarketRow[] | null }) {
  const ok = (rows ?? []).filter((r) => r.routable);
  if (!ok.length) return null;
  const items = [...ok, ...ok, ...ok, ...ok];
  const holes = <div className="h-2.5 w-full" style={{ backgroundImage: "linear-gradient(90deg, #ebe8e1 0 12px, transparent 12px 26px)", backgroundSize: "26px 100%" }} />;
  return (
    <div className="-mx-4 overflow-hidden bg-glass py-2 text-night">
      {holes}
      <div className="roll flex w-max gap-12 py-3 font-mono text-[13px] whitespace-nowrap uppercase">
        {items.map((r, k) => (
          <span key={k}>
            {r.name} <span className="text-white/40">—</span> {CLAIMS.filter((c) => r.claims?.[c] === "verified").length}/5 proved <span className="text-white/40">—</span> {usd(r.outputPerM)}/M
          </span>
        ))}
      </div>
      {holes}
    </div>
  );
}

/* ---------- swatch book: how much of your sentence each party can see ---------- */

const PARTIES: [string, string, number, number, string?][] = [
  ["You", "the person typing", 100, 100],
  ["The model provider", "their staff, their logs", 88, 0],
  ["The cloud or GPU host", "anyone who can read memory", 72, 0],
  ["The router in between", "a normal API gateway", 100, 0],
  ["A breach, years later", "whatever was logged", 90, 0],
  ["Your payment trail", "who paid for this call", 100, 0, "Card ending 4417 · alex.m@…"],
];

function Swatch({ vlt, text, n }: { vlt: number; text: string; n: string }) {
  const dark = vlt < 50;
  return (
    <div className="relative h-20 overflow-hidden border border-ink bg-[#f4f2ec]">
      <div className="absolute inset-x-3 bottom-2 truncate font-mono text-[13px] text-ink">{text}</div>
      <div className={`film absolute inset-0 ${vlt === 0 ? "film-solid" : ""}`} style={{ opacity: 1 - vlt / 100 }} />
      <div className={`absolute top-1.5 left-3 font-mono text-[10px] ${dark ? "text-white/60" : "text-ink-3"}`}>{n}</div>
      <div className={`absolute top-1.5 right-3 font-mono text-[11px] font-semibold ${dark ? "text-white" : "text-ink"}`}>VLT {vlt}%</div>
    </div>
  );
}

function SwatchBook() {
  const line = "my lab results from Tuesday, what should I ask";
  return (
    <div>
      <div className="mb-3 hidden grid-cols-[1fr_1.2fr_1.2fr] gap-4 font-mono text-[11px] text-ink-3 uppercase md:grid">
        <span>Who is looking</span>
        <span>An ordinary AI API</span>
        <span>Through Tinted</span>
      </div>
      <div className="space-y-3">
        {PARTIES.map(([who, note, plain, tinted, alt], k) => (
          <div key={who} className="grid gap-3 md:grid-cols-[1fr_1.2fr_1.2fr] md:items-center md:gap-4">
            <div>
              <div className="condensed text-2xl uppercase">{who}</div>
              <div className="text-sm text-ink-3">{note}</div>
            </div>
            <Swatch vlt={plain} text={alt ?? line} n={`Nº A-${k + 1}`} />
            <Swatch vlt={tinted} text={alt && tinted < 50 ? "note #4f1… redeemed by zero-knowledge proof" : line} n={`Nº T-${k + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- inspection sheet: the five proofs for one real model, stamped ---------- */

const STAMP: Record<ClaimState, [string, string]> = { verified: ["Pass", "text-proof"], provider: ["Claimed", "text-claim"], failed: ["Fail", "text-fail"], unknown: ["Pending", "text-ink-3"] };

function Inspection({ rows }: { rows: MarketRow[] | null }) {
  const ok = useMemo(() => (rows ?? []).filter((r) => r.routable), [rows]);
  const [id, setId] = useState("");
  const [v, setV] = useState<Awaited<ReturnType<typeof api.verification>> | null>(null);
  useEffect(() => {
    if (!id && ok.length) setId(ok.find((r) => r.id.includes("gemma"))?.id ?? ok[0].id);
  }, [ok, id]);
  useEffect(() => {
    if (!id) return;
    setV(null);
    api.verification(id).then(setV, () => undefined);
  }, [id]);
  const row = ok.find((r) => r.id === id);

  return (
    <div className="border border-ink bg-[#f4f2ec]">
      <div className="grid gap-3 border-b border-ink p-4 font-mono text-[12px] sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <span className="text-ink-3 uppercase">Specimen</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className="border-b border-ink bg-transparent py-1 font-mono text-[13px] outline-none">
          {ok.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} — {r.id}
            </option>
          ))}
        </select>
        <span className="text-ink-3 uppercase">Inspected {ago(v?.checkedAt ?? row?.checkedAt)}</span>
      </div>
      {CLAIMS.map((c: ClaimName, k) => {
        const st = v?.claims[c].state ?? "unknown";
        return (
          <div key={c} className="grid grid-cols-[32px_1fr_auto] items-center gap-x-4 gap-y-2 border-b border-edge px-4 py-5 last:border-b-0 md:grid-cols-[48px_200px_1fr_130px]">
            <span className="font-mono text-[12px] text-ink-3">{String(k + 1).padStart(2, "0")}</span>
            <span className="condensed text-2xl uppercase">{CLAIM_LABEL[c]}</span>
            <span className="order-last col-span-3 font-mono text-[12px] leading-relaxed break-words text-ink-2 md:order-none md:col-span-1">{v ? v.claims[c].detail : "reading the evidence…"}</span>
            <span className={`justify-self-end text-xl ${STAMP[st][1]}`}>
              <span className="stamp">{STAMP[st][0]}</span>
            </span>
          </div>
        );
      })}
      <div className="border-t border-ink px-4 py-3 font-mono text-[11px] text-ink-3 uppercase">
        Checked against Intel, AMD and NVIDIA signing roots · re-inspected every 10 minutes · a failed stamp takes the model off the market
      </div>
    </div>
  );
}

/* ---------- price list ---------- */

function PriceList({ rows }: { rows: MarketRow[] | null }) {
  const ok = (rows ?? []).filter((r) => r.routable).sort((a, b) => a.outputPerM - b.outputPerM);
  return (
    <div className="grid gap-x-16 md:grid-cols-2">
      {ok.map((r) => (
        <button key={r.id} onClick={() => go("chat", r.id)} className="group flex items-baseline gap-3 border-b border-edge py-3 text-left">
          <span className="text-lg font-semibold group-hover:text-signal">{r.name}</span>
          <span className="hidden font-mono text-[11px] text-ink-3 sm:inline">{r.provider}</span>
          <span className="leader" />
          <span className="font-mono text-[13px] text-ink-3">{usd(r.inputPerM)} in</span>
          <span className="font-mono text-[15px] font-semibold">{usd(r.outputPerM)}</span>
        </button>
      ))}
      {!rows && <div className="font-mono text-sm text-ink-3">Reading the market…</div>}
    </div>
  );
}

/* ---------- a real receipt, printed ---------- */

const SAMPLE_RECEIPT = "rcpt_38ff9ae75e6c9cff09f34ddf";

function Barcode({ hex }: { hex: string }) {
  const bars = hex.slice(0, 48).split("").map((h) => parseInt(h, 16));
  let x = 0;
  return (
    <svg viewBox={`0 0 ${bars.reduce((a, b) => a + (b % 3) + 2, 0)} 30`} className="h-10 w-full" preserveAspectRatio="none">
      {bars.map((b, k) => {
        const w = (b % 3) + 1;
        const el = k % 2 === 0 ? <rect key={k} x={x} y={0} width={w} height={30} fill="#121211" /> : null;
        x += w + 1;
        return el;
      })}
    </svg>
  );
}

function ReceiptPaper() {
  const [r, setR] = useState<{ receipt: Receipt; signature: string; anchor: Anchor | null } | null>(null);
  useEffect(() => {
    api.receipt(SAMPLE_RECEIPT).then(setR, () => undefined);
  }, []);
  const line = (a: ReactNode, b: ReactNode) => (
    <div className="flex gap-2">
      <span>{a}</span>
      <span className="leader" />
      <span className="text-right">{b}</span>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-[360px] rotate-[1.5deg] drop-shadow-[0_14px_22px_rgba(0,0,0,.18)]">
      <div className="zigzag rotate-180" />
      <div className="bg-[#f7f5f0] px-6 py-5 font-mono text-[12px] leading-relaxed text-ink">
        <div className="text-center">
          <div className="condensed text-3xl uppercase">Tinted</div>
          <div className="text-[11px] text-ink-3">private inference receipt</div>
        </div>
        <div className="my-3 border-t border-dashed border-ink-3" />
        {r ? (
          <div className="space-y-0.5">
            {line("ID", short(r.receipt.id, 10, 4))}
            {line("Date", new Date(r.receipt.at).toISOString().slice(0, 16).replace("T", " "))}
            {line("Model", r.receipt.listing.split("/")[1])}
            {line("Tokens", `${r.receipt.usage.input} in / ${r.receipt.usage.output} out`)}
            {line("Charged", `$${(r.receipt.costMicros / 1e6).toFixed(6)}`)}
            <div className="my-3 border-t border-dashed border-ink-3" />
            {Object.entries(r.receipt.verified).map(([k, s]) => line(k.toUpperCase(), s === "verified" ? "PASS" : s.toUpperCase()))}
            <div className="my-3 border-t border-dashed border-ink-3" />
            {line("Request", short(r.receipt.requestHash, 6, 4))}
            {line("Response", short(r.receipt.responseHash, 6, 4))}
            <div className="pt-1 text-[10.5px] text-ink-3">hashes only · your words are not on this paper</div>
            <div className="my-3 border-t border-dashed border-ink-3" />
            {line("Signed", "ed25519, enclave key")}
            {r.anchor ? (
              <>
                {line("Anchored", "Solana")}
                {line("Batch", `leaf ${r.anchor.index + 1} of ${r.anchor.count}`)}
                <a href={`https://solscan.io/tx/${r.anchor.tx}`} target="_blank" rel="noreferrer" className="block break-all text-signal underline">
                  tx {short(r.anchor.tx, 10, 8)}
                </a>
              </>
            ) : (
              line("Anchored", "next hour")
            )}
            <div className="mt-4">
              <Barcode hex={r.signature} />
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-ink-3">printing…</div>
        )}
      </div>
      <div className="zigzag" />
    </div>
  );
}

/* ---------- the anonymous note, as a ticket stub ---------- */

function Ticket() {
  return (
    <div className="flex max-w-3xl border border-ink bg-[#f4f2ec]">
      <div className="flex-1 p-6 sm:p-8">
        <div className="flex items-baseline justify-between font-mono text-[11px] text-ink-3 uppercase">
          <span>Anonymous credit note</span>
          <span>Groth16 · BN254</span>
        </div>
        <div className="condensed mt-4 text-[clamp(64px,11vw,128px)] leading-[0.8]">$50</div>
        <div className="mt-4 max-w-sm text-ink-2">Pays for any model on the market. Redeemed with a zero-knowledge proof that it was bought, never which purchase it was.</div>
        <div className="mt-5 font-mono text-[11px] text-ink-3 uppercase">Admit one private key · non-linkable · spend once</div>
      </div>
      <div className="perf bg-transparent" />
      <div className="w-24 shrink-0 border-l border-dashed border-ink p-3 sm:w-36 sm:p-4">
        <div className="font-mono text-[10px] text-ink-3 uppercase">Keep this half</div>
        <div className="mt-3 font-mono text-[10px] leading-snug break-all text-ink-2">tinted-note-v1-50-0c98203866…</div>
        <div className="condensed mt-4 text-3xl text-signal [writing-mode:vertical-rl]">STUB</div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

const FAQ: [string, string][] = [
  ["Can Tinted read my prompts?", "No. Your connection is encrypted straight into our enclave (the certificate key was made in there), and from there only to provider enclaves whose stamps just came back PASS. The code is open source and the hardware proves which build is running."],
  ["What does CLAIMED mean?", "The provider says it, but we couldn't prove it from vendor-signed evidence. It's usually the exact model weights. You can require proved weights on any call."],
  ["What if a proof fails?", "The model leaves the market until it passes again. Nothing is sent to it in the meantime."],
  ["Do I need an account?", "No email, no wallet connect, no KYC. A key is created in one click; pay with USDC on Solana, or anonymously with a note."],
];

export function Home() {
  const rows = useMarket();
  return (
    <div>
      <Hero rows={rows} />
      <Intro />
      <Filmstrip rows={rows} />

      <Section n="02" title={<>Who can read it.</>} aside={<p className="max-w-xs font-mono text-[11px] text-ink-3 uppercase">Film samples · visible light transmission by who's looking</p>}>
        <SwatchBook />
      </Section>

      <Section n="03" title={<>Inspected before every call.</>} aside={<p className="max-w-xs text-ink-2">A real report, read live from the gateway. Pick any model on the market.</p>}>
        <Inspection rows={rows} />
      </Section>

      <Section
        n="04"
        title="Price list."
        aside={
          <button onClick={() => go("market")} className="border-b border-ink font-mono text-[12px] uppercase hover:text-signal">
            Full market →
          </button>
        }
      >
        <PriceList rows={rows} />
        <p className="mt-4 font-mono text-[11px] text-ink-3 uppercase">Per million tokens · output in bold · only models that passed inspection are listed</p>
      </Section>

      <Section n="05" title={<>Every call leaves a receipt.</>}>
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto]">
          <div className="max-w-lg space-y-4 text-lg text-ink-2">
            <p>Signed by a key that only exists inside Tinted's enclave. It records what was proved and what was charged, and hashes of what was said, never the words.</p>
            <p>Every hour the receipts are folded into one Merkle root and written to Solana, so no one can quietly rewrite them later, including us.</p>
            <p className="font-mono text-[12px] text-ink-3 uppercase">This one is real. It was printed from the live gateway just now.</p>
            <button onClick={() => go("verify", SAMPLE_RECEIPT)} className="border-b border-ink font-mono text-[12px] text-ink uppercase hover:text-signal">
              Check its signature in your browser →
            </button>
          </div>
          <ReceiptPaper />
        </div>
      </Section>

      <Section n="06" title={<>Pay without a trail.</>}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <Ticket />
          <div className="max-w-xs space-y-4 text-ink-2">
            <p>Buy a note from any wallet. Redeem it later, from anywhere, with a proof that reveals nothing about which note it was.</p>
            <button onClick={() => go("credits")} className="bg-ink px-5 py-3 font-semibold tracking-wide text-night uppercase hover:bg-signal">
              Buy a note →
            </button>
          </div>
        </div>
      </Section>

      <section className="film -mx-4 px-4 py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <div>
            <div className="font-mono text-[12px] text-white/50">§ 07</div>
            <h2 className="condensed mt-3 text-4xl leading-[0.92] uppercase sm:text-6xl">The whole migration is one line.</h2>
          </div>
          <div className="font-mono text-[clamp(12px,1.5vw,17px)] leading-loose">
            <div className="text-white/35 line-through decoration-signal decoration-2">− base_url = "https://api.openai.com/v1"</div>
            <div>
              + base_url = "<span className="text-signal">{GATEWAY}/v1</span>"
            </div>
            <div className="mt-6 text-[12px] text-white/50">
              # every response comes back with x-tinted-verified and x-tinted-receipt
              <br /># agents: read tinted.market/llms.txt
            </div>
          </div>
        </div>
      </section>

      <Section n="08" title="Fair questions.">
        <div className="grid gap-x-16 gap-y-10 md:grid-cols-2">
          {FAQ.map(([q, a], k) => (
            <div key={q} className="grid grid-cols-[36px_1fr] gap-2">
              <span className="font-mono text-[12px] text-ink-3">Q{k + 1}</span>
              <div>
                <div className="text-xl font-semibold">{q}</div>
                <p className="mt-2 text-ink-2">{a}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
