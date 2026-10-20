import { useEffect, useMemo, useState } from "react";
import { api, CLAIMS, type ClaimName, type ClaimState, type MarketRow } from "../api";
import { Badge, Button, CLAIM_HINT, CLAIM_LABEL, H, Pane } from "../ui";
import { go } from "../App";

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
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <H kicker="Market" title="Every listing, with its proof.">
            {rows ? `${counts.all} listings · ${counts.routable} pass every proof · ${counts.weights} with verified weights. Re-checked every 10 minutes.` : "Loading listings…"}
          </H>
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
