import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, storedKey } from "../api";
import { newKey, newNote, noteInTree, noteMemo, noteString, parseNote, proveNote, type Note } from "../zk";
import { Button, H, Mono, Pane } from "../ui";

function Buy({ denoms, to, mint }: { denoms: number[]; to: string | null; mint: string | null }) {
  const [denom, setDenom] = useState(denoms[0] ?? 10);
  const [note, setNote] = useState<Note | null>(null);
  const [saved, setSaved] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [seen, setSeen] = useState(false);
  const url = note && to && mint ? `solana:${to}?amount=${note.denomUsd}&spl-token=${mint}&memo=${encodeURIComponent(noteMemo(note))}&label=Tinted` : null;

  useEffect(() => {
    if (url && saved) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#07090b", light: "#e8ece9" } }).then(setQr);
  }, [url, saved]);
  useEffect(() => {
    if (!note || !saved || seen) return;
    const t = setInterval(() => void noteInTree(note).then((ok) => ok && setSeen(true), () => undefined), 15_000);
    return () => clearInterval(t);
  }, [note, saved, seen]);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([noteString(note!) + "\n"], { type: "text/plain" }));
    a.download = `tinted-note-${note!.denomUsd}usd.txt`;
    a.click();
  };

  if (!to) return <div className="text-sm text-ink-3">Note deposits aren't open yet.</div>;
  if (!note)
    return (
      <div>
        <p className="text-sm text-ink-2">Pick a size. Everyone buys the same few sizes, so your note looks like every other one.</p>
        <div className="mt-4 flex gap-2">
          {denoms.map((d) => (
            <button key={d} onClick={() => setDenom(d)} className={`flex-1 rounded-md border px-3 py-3 font-display text-2xl ${d === denom ? "glow border-proof/60 text-proof" : "border-edge text-ink-2"}`}>
              ${d}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Button onClick={() => setNote(newNote(denom))}>Create a ${denom} note</Button>
        </div>
      </div>
    );
  if (!saved)
    return (
      <div className="space-y-4">
        <p className="text-sm text-claim">This note is the money. It was made in your browser and exists nowhere else. Lose it and the credit is gone; anyone who has it can spend it.</p>
        <Pane className="p-3">
          <Mono className="text-ink">{noteString(note)}</Mono>
        </Pane>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}>Download note</Button>
          <Button kind="ghost" onClick={() => void navigator.clipboard.writeText(noteString(note))}>
            Copy
          </Button>
          <Button kind="ghost" onClick={() => setSaved(true)}>
            I saved it, continue →
          </Button>
        </div>
      </div>
    );
  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
      <div>{qr && <img src={qr} alt="Solana Pay QR code" className="size-[220px] rounded-md" />}</div>
      <div className="space-y-3 text-sm">
        <p className="text-ink-2">
          Pay exactly <b className="text-ink">{note.denomUsd} USDC</b>. Scan with Phantom, Solflare or Backpack, or open the link. The memo is your note's commitment: it
          says nothing about you or the note's secrets.
        </p>
        <a href={url!} className="inline-block rounded-md bg-proof px-4 py-2 font-medium text-night">
          Pay {note.denomUsd} USDC in wallet
        </a>
        <div className="font-mono text-[11px] text-ink-3">memo {noteMemo(note).slice(0, 30)}…</div>
        <div className={`font-mono text-[12px] ${seen ? "text-proof" : "text-ink-3"}`}>{seen ? "✓ Your note is in the tree. Redeem it whenever you like." : "Waiting for the payment to land…"}</div>
        <p className="text-xs text-ink-3">Any other amount can't become a note. Paying from a wallet that also redeems is fine: the proof doesn't reveal which deposit is yours.</p>
      </div>
    </div>
  );
}

function Redeem() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"new" | "current">(storedKey.get() ? "current" : "new");
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ usd: number; key: string | null } | null>(null);
  const current = storedKey.get();

  async function go() {
    setErr(null);
    setDone(null);
    const note = parseNote(text);
    if (!note) return setErr("That isn't a Tinted note. It starts with tinted-note-v1-");
    const key = target === "current" && current ? current : newKey();
    try {
      const p = await proveNote(note, key, setStep);
      setStep("Sending the proof…");
      const r = await api.redeem(p);
      if (target === "new") storedKey.set(key);
      setDone({ usd: r.credited_usd, key: target === "new" ? key : null });
      setText("");
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setStep(null);
    }
  }

  return (
    <div className="space-y-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="tinted-note-v1-…" className="w-full resize-none rounded-md border border-edge bg-night px-3 py-2 font-mono text-[12px] outline-none focus:border-proof/60" />
      <div className="flex flex-wrap gap-4 text-sm text-ink-2">
        <label className="flex items-center gap-2">
          <input type="radio" checked={target === "new"} onChange={() => setTarget("new")} className="accent-[#7fd1b9]" /> Into a brand-new key (most private)
        </label>
        <label className={`flex items-center gap-2 ${current ? "" : "opacity-40"}`}>
          <input type="radio" disabled={!current} checked={target === "current"} onChange={() => setTarget("current")} className="accent-[#7fd1b9]" /> Into this browser's key
        </label>
      </div>
      <Button onClick={() => void go()} disabled={!!step || !text.trim()}>
        {step ? "Working…" : "Prove and redeem"}
      </Button>
      {step && <div className="font-mono text-[12px] text-ink-3">{step}</div>}
      {err && <div className="text-sm text-fail">{err}</div>}
      {done && (
        <Pane className="glow p-4 text-sm">
          <div className="text-proof">✓ ${done.usd} credited. The gateway checked the proof, never the note.</div>
          {done.key && (
            <div className="mt-2">
              Your new key (saved in this browser, shown once): <Mono className="text-ink">{done.key}</Mono>
            </div>
          )}
        </Pane>
      )}
    </div>
  );
}

export function Credits() {
  const [cfg, setCfg] = useState<Awaited<ReturnType<typeof api.credits>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.credits().then(setCfg, (e) => setErr(String(e.message ?? e)));
  }, []);

  return (
    <div>
      <H kicker="Anonymous credits" title={<>Pay from your wallet. Spend from <em className="text-signal not-italic">nowhere.</em></>}>
        Buy a note with USDC, then redeem it with a zero-knowledge proof. The proof shows the note was paid for without showing which payment it was, so nobody can connect
        the wallet that paid to the key that prompts. Not even Tinted.
      </H>
      {err && <div className="mb-4 text-sm text-fail">{err}</div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Pane className="p-6">
          <div className="font-mono text-[11px] text-ink-3">01</div>
          <h2 className="mb-4 font-display text-3xl">Buy a note</h2>
          {cfg ? <Buy denoms={cfg.denominations_usd} to={cfg.deposit?.to ?? null} mint={cfg.deposit?.mint ?? null} /> : <div className="text-sm text-ink-3">Loading…</div>}
        </Pane>
        <Pane className="p-6">
          <div className="font-mono text-[11px] text-ink-3">02</div>
          <h2 className="mb-4 font-display text-3xl">Redeem it, later</h2>
          <Redeem />
        </Pane>
      </div>
      <div className="mt-6 grid gap-4 text-sm text-ink-2 md:grid-cols-3">
        <div>
          <div className="mb-1 text-ink">Wait before redeeming</div>
          The more notes paid between your deposit and your redeem, the bigger the crowd you hide in. {cfg ? `${cfg.size} notes in the tree right now.` : ""}
        </div>
        <div>
          <div className="mb-1 text-ink">Redeem from elsewhere</div>
          A different network or device for redeeming keeps your IP address from linking the two steps.
        </div>
        <div>
          <div className="mb-1 text-ink">What's on-chain</div>
          Only commitments and the tree root, posted by Tinted's enclave key. Circuit, setup and verifying key are{" "}
          <a className="text-proof underline" href="https://github.com/tintedmarket/tinted-gateway/tree/main/zk">
            public
          </a>
          .
        </div>
      </div>
    </div>
  );
}
