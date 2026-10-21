import { useEffect, useMemo, useState } from "react";
import { api, CLAIMS, type ClaimName, type MarketRow } from "../api";
import { Badge, CLAIM_HINT, CLAIM_LABEL } from "../ui";
import { go } from "../App";

function Evidence({ id }: { id: string }) {
  const [v, setV] = useState<Awaited<ReturnType<typeof api.verification>> | null>(null);
  const [e, setE] = useState<string | null>(null);
  useEffect(() => {
    api.verification(id).then(setV, (x) => setE(String(x.message ?? x)));
  }, [id]);
  if (e) return <div className="text-sm text-fail">{e}</div>;
  if (!v) return <div className="font-mono text-xs text-ink-3">Fetching the evidence…</div>;
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {CLAIMS.map((c) => (
        <div key={c} className="rounded-xl border border-edge bg-night/60 p-3">
          <Badge name={c} state={v.claims[c].state} />
          <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-ink-2">{v.claims[c].detail}</p>
        </div>
      ))}
      <div className="self-end font-mono text-[11px] text-ink-3">checked {new Date(v.checkedAt).toLocaleString()}</div>
    </div>
  );
}

type Sort = "proofs" | "price";
const usd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;

export function Market() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("proofs");
  const [weightsOnly, setWeightsOnly] = useState(false);
  useEffect(() => {
    const load = () => api.market().then((m) => setRows(m.listings), (e) => setErr(String(e.message ?? e)));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // Listings that failed a proof are off the market: they aren't shown at all.
  const live = useMemo(() => (rows ?? []).filter((r) => r.routable !== false), [rows]);
  const shown = useMemo(() => {
    const proofs = (r: MarketRow) => (r.claims ? CLAIMS.filter((c) => r.claims![c] === "verified").length : 0) + (r.routable ? 10 : 0);
    return live
      .filter((r) => !q || (r.name + r.id).toLowerCase().includes(q.toLowerCase()))
      .filter((r) => !weightsOnly || r.claims?.weights === "verified")
      .sort((a, b) => (sort === "price" ? a.outputPerM - b.outputPerM : proofs(b) - proofs(a) || a.outputPerM - b.outputPerM));
  }, [live, q, sort, weightsOnly]);
  const providers = useMemo(() => new Set(live.filter((r) => r.routable).map((r) => r.provider)).size, [live]);

  return (
    <div>
      <header className="mb-10 grid gap-6 border-b border-ink pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-ink-2 uppercase">
            <span className="inline-block size-2.5 bg-signal" />
            Market
          </div>
          <h1 className="condensed mt-3 text-5xl leading-[0.9] uppercase sm:text-7xl">Every model, inspected.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-2">Only models that passed inspection in the last 10 minutes are listed. Prices are per million tokens, including Tinted's fee.</p>
        </div>
        <div className="flex gap-8 font-mono">
          {[
            [rows ? live.filter((r) => r.routable).length : "…", "models live"],
            [rows ? providers : "…", providers === 1 ? "provider" : "providers"],
            [rows ? live.filter((r) => r.claims?.weights === "verified").length : "…", "weights proved"],
          ].map(([v, l]) => (
            <div key={l as string}>
              <div className="condensed text-5xl">{v}</div>
              <div className="text-[11px] text-ink-3 uppercase">{l}</div>
            </div>
          ))}
        </div>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search models…" className="min-w-56 flex-1 rounded-xl border border-edge bg-pane px-4 py-2.5 text-sm outline-none focus:border-proof/50" />
        <div className="flex rounded-xl border border-edge bg-pane p-1 text-xs">
          {(["proofs", "price"] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded-lg px-3 py-1.5 ${sort === s ? "bg-pane-2 text-ink" : "text-ink-3"}`}>
              {s === "proofs" ? "Most proved" : "Cheapest"}
            </button>
          ))}
        </div>
        <button onClick={() => setWeightsOnly(!weightsOnly)} className={`rounded-xl border px-3 py-2.5 text-xs ${weightsOnly ? "border-proof/50 bg-proof/10 text-proof" : "border-edge bg-pane text-ink-3"}`}>
          Weights proved
        </button>
      </div>

      {err && <div className="rounded-xl border border-fail/40 p-4 text-sm text-fail">Couldn't reach the gateway: {err}</div>}

      <div className="overflow-hidden rounded-2xl border border-edge bg-pane/50">
        <div className="hidden grid-cols-[1.6fr_1.4fr_0.9fr_auto] gap-4 border-b border-edge px-5 py-3 font-mono text-[11px] text-ink-3 md:grid">
          <span>model</span>
          <span>proofs</span>
          <span className="text-right">in / out · per 1M</span>
          <span className="w-40" />
        </div>
        {!rows && !err && <div className="p-6 font-mono text-xs text-ink-3">Loading the market…</div>}
        {shown.map((r) => (
          <div key={r.id} className="border-b border-edge last:border-b-0">
            <div className="grid items-center gap-x-4 gap-y-3 px-5 py-4 transition hover:bg-pane md:grid-cols-[1.6fr_1.4fr_0.9fr_auto]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.claims?.weights === "verified" && <span className="border border-proof px-1.5 font-mono text-[10px] text-proof">5/5</span>}
                </div>
                <div className="truncate font-mono text-[11px] text-ink-3">{r.id}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {CLAIMS.map((c) => (
                  <Badge key={c} name={c as ClaimName} state={r.claims?.[c] ?? "unknown"} compact />
                ))}
              </div>
              <div className="font-mono text-[13px] md:text-right">
                <span className="text-ink-3">{usd(r.inputPerM)}</span> <span className="text-ink-3">/</span> <span className="text-ink">{usd(r.outputPerM)}</span>
              </div>
              <div className="flex w-40 justify-end gap-2">
                <button onClick={() => setOpen(open === r.id ? null : r.id)} className="rounded-lg border border-edge px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
                  {open === r.id ? "Close" : "Evidence"}
                </button>
                <button disabled={!r.routable} onClick={() => go("chat", r.id)} className="bg-ink px-3 py-1.5 text-xs font-semibold text-night uppercase hover:bg-signal disabled:opacity-30">
                  {r.routable ? "Chat →" : "Checking"}
                </button>
              </div>
            </div>
            {open === r.id && (
              <div className="border-t border-edge bg-night/40 p-5">
                <Evidence id={r.id} />
              </div>
            )}
          </div>
        ))}
        {rows && !shown.length && <div className="p-6 text-sm text-ink-3">No models match.</div>}
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {CLAIMS.map((c) => (
          <div key={c} className="rounded-xl border border-edge p-4 text-xs text-ink-3">
            <div className="mb-1 text-sm text-ink-2">{CLAIM_LABEL[c]}</div>
            {CLAIM_HINT[c]}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Badge name="keys" state="verified" compact /> proved by Tinted against vendor roots
        </span>
        <span className="flex items-center gap-1.5">
          <Badge name="keys" state="provider" compact /> stated by the provider, not proved
        </span>
      </div>
    </div>
  );
}
