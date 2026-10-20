import { useEffect, useRef, useState } from "react";
import { api, CLAIMS, storedKey, type ClaimName, type ClaimState, type MarketRow } from "../api";
import { Badge, Button, H, Pane } from "../ui";
import { go } from "../App";

interface Turn {
  role: "user" | "assistant";
  content: string;
  receipt?: string | null;
  verified?: Partial<Record<ClaimName, ClaimState>>;
  cost?: string;
}

const parseVerified = (h: string | null) => Object.fromEntries((h ?? "").split(",").filter(Boolean).map((kv) => kv.split("="))) as Partial<Record<ClaimName, ClaimState>>;

/** The conversation lives only in this tab's memory: nothing is saved, and the website never sees it. */
export function Chat({ initialModel }: { initialModel: string }) {
  const [key] = useState(storedKey.get);
  const [models, setModels] = useState<MarketRow[]>([]);
  const [model, setModel] = useState(initialModel);
  const [requireWeights, setRequireWeights] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.market().then((m) => {
      const ok = m.listings.filter((r) => r.routable);
      setModels(ok);
      setModel((cur) => (ok.some((r) => r.id === cur) ? cur : (ok.find((r) => r.claims?.weights === "verified") ?? ok[0])?.id ?? ""));
    }, (e) => setErr(String(e.message ?? e)));
  }, []);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns, busy]);

  const current = models.find((m) => m.id === model);
  const weightsOk = current?.claims?.weights === "verified";

  async function send() {
    if (!key || !draft.trim() || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: draft.trim() }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setErr(null);
    try {
      const r = await api.chat(key, model, next.map(({ role, content }) => ({ role, content })), requireWeights);
      const cost = current && r.usage ? ((r.usage.prompt_tokens * current.inputPerM + r.usage.completion_tokens * current.outputPerM) / 1e6).toFixed(5) : undefined;
      setTurns([...next, { role: "assistant", content: r.text, receipt: r.receipt, verified: parseVerified(r.verified), cost }]);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
      setTurns(turns);
      setDraft(next[next.length - 1].content);
    } finally {
      setBusy(false);
    }
  }

  if (!key)
    return (
      <div>
        <H kicker="Private chat" title="You need a key first.">
          Keys are free and anonymous: no email, no wallet connect. Top up with USDC on Solana when you want to use it.
        </H>
        <Button onClick={() => go("account")}>Get a key</Button>
      </div>
    );

  return (
    <div>
      <H kicker="Private chat" title="Talk through the glass.">
        Your browser sends this straight to the Tinted gateway inside its enclave, which only forwards it to a model whose proofs just passed. Nothing is stored here: close the tab
        and the conversation is gone.
      </H>
      <Pane className="mb-4 flex flex-wrap items-center gap-4 p-4">
        <select value={model} onChange={(e) => setModel(e.target.value)} className="min-w-64 flex-1 rounded-md border border-edge bg-night px-3 py-2 text-sm">
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ${m.outputPerM.toFixed(2)}/1M out{m.claims?.weights === "verified" ? " · weights proved" : ""}
            </option>
          ))}
        </select>
        <label className={`flex items-center gap-2 text-sm ${weightsOk ? "text-ink-2" : "text-ink-3"}`} title="Refuse the call unless the exact model weights are proved, not just stated">
          <input type="checkbox" disabled={!weightsOk} checked={requireWeights && weightsOk} onChange={(e) => setRequireWeights(e.target.checked)} className="accent-[#7fd1b9]" />
          Require proved weights
        </label>
        {current && (
          <div className="flex flex-wrap gap-1">
            {CLAIMS.map((c) => (
              <Badge key={c} name={c} state={current.claims?.[c] ?? "unknown"} compact />
            ))}
          </div>
        )}
      </Pane>

      <Pane className="min-h-[50vh] p-4 sm:p-6">
        {turns.length === 0 && <div className="py-16 text-center text-ink-3">Ask anything you wouldn't paste into a normal chatbot.</div>}
        <div className="space-y-5">
          {turns.map((t, k) =>
            t.role === "user" ? (
              <div key={k} className="ml-auto max-w-[85%] rounded-lg bg-pane-2 px-4 py-3 whitespace-pre-wrap">
                {t.content}
              </div>
            ) : (
              <div key={k} className="max-w-[92%]">
                <div className="leading-relaxed whitespace-pre-wrap text-ink">{t.content}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {CLAIMS.map((c) => (t.verified?.[c] ? <Badge key={c} name={c} state={t.verified[c]!} compact /> : null))}
                  {t.receipt && (
                    <a href={`#/verify/${encodeURIComponent(t.receipt)}`} className="ml-1 font-mono text-[11px] text-proof underline-offset-2 hover:underline">
                      receipt ↗
                    </a>
                  )}
                  {t.cost && <span className="font-mono text-[11px] text-ink-3">${t.cost}</span>}
                </div>
              </div>
            ),
          )}
          {busy && <div className="font-mono text-xs text-ink-3">checking proofs · sending through the glass…</div>}
          <div ref={end} />
        </div>
      </Pane>
      {err && (
        <div className="mt-3 text-sm text-fail">
          {err}
          {/balance/i.test(err) && (
            <>
              {" "}
              <a className="underline" href="#/account">
                Top up
              </a>
            </>
          )}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Write a message…"
          className="flex-1 resize-none rounded-md border border-edge bg-pane px-3 py-2 outline-none focus:border-proof/60"
        />
        <Button type="submit" disabled={busy || !draft.trim() || !model}>
          Send
        </Button>
      </form>
    </div>
  );
}
