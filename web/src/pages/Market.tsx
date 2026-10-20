import { useEffect, useMemo, useState } from "react";
import { api, CLAIMS, type ClaimName, type ClaimState, type MarketRow } from "../api";
import { Badge, Button, CLAIM_HINT, CLAIM_LABEL, Pane } from "../ui";
import { go } from "../App";

const PROMPTS = [
  "Summarize this term sheet and flag anything unusual in the liquidation preference.",
  "Here are my lab results from Tuesday. What should I ask my doctor?",
  "Review this wallet's private strategy notes before we deploy on Monday.",
  "Draft a reply to my landlord about the deposit. Keep it firm.",
];

/** The mechanic as the hero: the same prompt, seen from your side of the glass and from the operator's. */
function Glass() {
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
      n < text.length ? 28 : 2600,
    );
    return () => clearTimeout(t);
  }, [n, i, text.length]);
  const typed = text.slice(0, n);
  const lit = n >= text.length ? 5 : Math.floor((n / text.length) * 5);

  return (
    <div className="grid overflow-hidden rounded-xl border border-edge md:grid-cols-[1fr_auto_1fr]">
      <div className="bg-pane-2/60 p-6 sm:p-8">
        <div className="font-mono text-[11px] tracking-[0.2em] text-ink-3 uppercase">Your side</div>
        <p className="mt-4 min-h-24 text-lg leading-relaxed text-ink">
          {typed}
          <span className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse bg-proof" />
        </p>
        <div className="mt-6 flex flex-wrap gap-1.5">
          {CLAIMS.map((c, k) => (
            <Badge key={c} name={c} state={k < lit ? "verified" : "unknown"} />
          ))}
        </div>
      </div>
      <div className="relative hidden w-10 md:block">
        <div className="absolute inset-0 bg-gradient-to-r from-proof/20 via-proof/5 to-night" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-proof/50" />
      </div>
      <div className="relative bg-[#040506] p-6 sm:p-8">
        <div className="font-mono text-[11px] tracking-[0.2em] text-ink-3 uppercase">The operator's side</div>
        <p aria-hidden className="mt-4 min-h-24 text-lg leading-relaxed break-all text-transparent select-none">
          {typed.split("").map((ch, k) =>
            ch === " " ? (
              " "
            ) : (
              <span key={k} className="rounded-[1px] bg-edge/80">
                {ch}
              </span>
            ),
          )}
        </p>
        <div className="mt-6 font-mono text-[11px] text-ink-3">
          ciphertext in · ciphertext out · {lit === 5 ? <span className="text-proof">5/5 proofs passed</span> : `${lit}/5 proofs`}
        </div>
      </div>
    </div>
  );
}

function Evidence({ id }: { id: string }) {
  const [v, setV] = useState<Awaited<ReturnType<typeof api.verification>> | null>(null);
  const [e, setE] = useState<string | null>(null);
  useEffect(() => {
    api.verification(id).then(setV, (x) => setE(String(x.message ?? x)));
  }, [id]);
  if (e) return <div className="text-sm text-fail">{e}</div>;
  if (!v) return <div className="text-sm text-ink-3">Checking the evidence…</div>;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {CLAIMS.map((c) => (
        <div key={c} className="rounded-md border border-edge bg-night/50 p-3">
          <Badge name={c} state={v.claims[c].state} />
          <p className="mt-2 font-mono text-[11.5px] leading-relaxed break-words text-ink-2">{v.claims[c].detail}</p>
        </div>
      ))}
      <div className="self-end font-mono text-[11px] text-ink-3">checked {new Date(v.checkedAt).toLocaleString()}</div>
    </div>
  );
}

export function Market() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyRoutable, setOnlyRoutable] = useState(true);
  useEffect(() => {
    const load = () => api.market().then((m) => setRows(m.listings), (e) => setErr(String(e.message ?? e)));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const sorted = useMemo(() => {
    const score = (r: MarketRow) => (r.routable ? 100 : r.routable === null ? 50 : 0) + (r.claims ? CLAIMS.filter((c) => r.claims![c] === "verified").length : 0);
    return (rows ?? []).filter((r) => !onlyRoutable || r.routable !== false).sort((a, b) => score(b) - score(a) || a.outputPerM - b.outputPerM);
  }, [rows, onlyRoutable]);
  const counts = useMemo(() => ({ all: rows?.length ?? 0, routable: rows?.filter((r) => r.routable).length ?? 0, weights: rows?.filter((r) => r.claims?.weights === "verified").length ?? 0 }), [rows]);

  return (
    <div>
      <section className="mb-14">
        <div className="font-mono text-[11px] tracking-[0.2em] text-proof uppercase">The Private Inference Market</div>
        <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[1.05] sm:text-7xl">
          Inference behind <em className="text-proof">one-way glass.</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">
          Every model here runs inside a hardware enclave. Before your prompt is sent, Tinted checks the proof: the chip, the GPU, the code, the weights, the keys. You see the
          answer. Nobody running the machine does. Pay in USDC on Solana; every call leaves a signed receipt anchored on-chain.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => go("chat")}>Start a private chat</Button>
          <Button kind="ghost" onClick={() => go("docs")}>
            Use the API
          </Button>
        </div>
        <div className="mt-10">
          <Glass />
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl">The market</h2>
            <p className="text-sm text-ink-3">
              {rows ? `${counts.all} listings · ${counts.routable} pass every proof · ${counts.weights} with verified weights` : "Loading listings…"}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={onlyRoutable} onChange={(e) => setOnlyRoutable(e.target.checked)} className="accent-[#7fd1b9]" />
            Hide listings that failed a proof
          </label>
        </div>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
          {(["verified", "provider", "failed"] as ClaimState[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <Badge name="keys" state={s} compact /> {s === "verified" ? "proved by Tinted against vendor roots" : s === "provider" ? "stated by the provider, not proved" : "proof failed: never routed"}
            </span>
          ))}
        </div>
        {err && <Pane className="p-4 text-sm text-fail">Couldn't reach the gateway: {err}</Pane>}
        <div className="space-y-2">
          {sorted.map((r) => (
            <Pane key={r.id} className={r.routable ? "" : "opacity-70"}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <div className="min-w-56 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="font-mono text-[11px] text-ink-3">{r.id}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {CLAIMS.map((c) => (
                    <Badge key={c} name={c as ClaimName} state={r.claims?.[c] ?? "unknown"} compact />
                  ))}
                </div>
                <div className="w-36 text-right font-mono text-[12px] text-ink-2">
                  ${r.inputPerM.toFixed(2)} / ${r.outputPerM.toFixed(2)}
                  <div className="text-[10px] text-ink-3">per 1M in / out</div>
                </div>
                <div className="flex gap-2">
                  <Button kind="ghost" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? "Hide" : "Evidence"}
                  </Button>
                  <Button disabled={!r.routable} onClick={() => go("chat", r.id)}>
                    Chat
                  </Button>
                </div>
              </div>
              {r.routable === false && r.whyNot && <div className="border-t border-edge px-4 py-2 font-mono text-[11px] text-fail/90">Not routed: {r.whyNot.join(" · ")}</div>}
              {r.routable === null && <div className="border-t border-edge px-4 py-2 font-mono text-[11px] text-ink-3">Not checked yet: the gateway verifies every listing every 10 minutes.</div>}
              {open === r.id && (
                <div className="border-t border-edge p-4">
                  <Evidence id={r.id} />
                </div>
              )}
            </Pane>
          ))}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-5">
          {CLAIMS.map((c) => (
            <div key={c} className="text-xs text-ink-3">
              <div className="mb-1 text-ink-2">{CLAIM_LABEL[c]}</div>
              {CLAIM_HINT[c]}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
