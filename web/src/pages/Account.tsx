import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, storedKey } from "../api";
import { Button, H, Mono, Pane } from "../ui";

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="font-mono text-[11px] text-proof hover:underline"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "copied" : label}
    </button>
  );
}

function Deposit({ k }: { k: string }) {
  const [d, setD] = useState<Awaited<ReturnType<typeof api.deposit>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState(5);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    api.deposit(k).then(setD, (e) => setErr(String(e.message ?? e)));
  }, [k]);
  // Solana Pay transfer request: wallets send USDC to the treasury's token account and attach the memo.
  const url = d ? `solana:${d.to}?amount=${amount}&spl-token=${d.mint}&memo=${encodeURIComponent(d.memo)}&label=Tinted&message=${encodeURIComponent("Tinted credits")}` : null;
  useEffect(() => {
    if (url) QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#07090b", light: "#e8ece9" } }).then(setQr);
  }, [url]);

  if (err) return <div className="text-sm text-ink-3">{err}</div>;
  if (!d) return <div className="text-sm text-ink-3">Loading deposit details…</div>;
  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
      <div>
        {qr && <img src={qr} alt="Solana Pay QR code" className="size-[220px] rounded-md" />}
        <div className="mt-2 flex gap-1">
          {[5, 20, 50].map((a) => (
            <button key={a} onClick={() => setAmount(a)} className={`flex-1 rounded border px-2 py-1 font-mono text-xs ${a === amount ? "border-proof/60 text-proof" : "border-edge text-ink-3"}`}>
              ${a}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 text-sm">
        <p className="text-ink-2">Scan with Phantom, Solflare or Backpack, or open the link on this device. Credits arrive within about a minute.</p>
        <a href={url!} className="inline-block rounded-md bg-proof px-4 py-2 font-medium text-night">
          Pay {amount} USDC in wallet
        </a>
        <div>
          <div className="text-xs text-ink-3">Or send USDC manually to</div>
          <Mono>{d.to}</Mono> <Copy text={d.to} />
        </div>
        <div>
          <div className="text-xs text-ink-3">with this memo (required: it's how the deposit finds your key)</div>
          <Mono className="text-claim">{d.memo}</Mono> <Copy text={d.memo} />
        </div>
        <p className="text-xs text-ink-3">USDC (SPL) on Solana mainnet only. 1 USDC = $1 of credit. Funds go to the operator's treasury; the gateway itself never holds them.</p>
      </div>
    </div>
  );
}

export function Account() {
  const [key, setKey] = useState(storedKey.get);
  const [fresh, setFresh] = useState(false);
  const [paste, setPaste] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!key) return;
    const load = () => api.balance(key).then((b) => setBalance(b.balance_usd), (e) => setErr(String(e.message ?? e)));
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [key]);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const a = await api.signup();
      storedKey.set(a.key);
      setKey(a.key);
      setFresh(true);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!key)
    return (
      <div>
        <H kicker="Account" title="An API key, and nothing else.">
          No email, no wallet connect, no name. The key is your account: keep it somewhere safe. It works in the chat here and with any OpenAI-compatible client.
        </H>
        <div className="grid gap-4 md:grid-cols-2">
          <Pane className="p-6">
            <h2 className="font-display text-2xl">New key</h2>
            <p className="mt-1 mb-4 text-sm text-ink-3">Created by the gateway inside its enclave. Starts at $0.</p>
            <Button onClick={create} disabled={busy}>
              {busy ? "Creating…" : "Create a key"}
            </Button>
          </Pane>
          <Pane className="p-6">
            <h2 className="font-display text-2xl">I have one</h2>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!paste.trim().startsWith("tnt_")) return setErr("Tinted keys start with tnt_");
                storedKey.set(paste.trim());
                setKey(paste.trim());
              }}
            >
              <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="tnt_…" className="flex-1 rounded-md border border-edge bg-night px-3 py-2 font-mono text-sm" />
              <Button type="submit" kind="ghost">
                Use
              </Button>
            </form>
          </Pane>
        </div>
        {err && <div className="mt-3 text-sm text-fail">{err}</div>}
      </div>
    );

  return (
    <div>
      <H kicker="Account" title={balance === null ? "Your balance" : <>${balance.toFixed(4)} <span className="text-ink-3">of credit</span></>} />
      {fresh && (
        <Pane className="glow mb-4 p-5">
          <div className="font-medium text-proof">Save this key now. It's shown once and can't be recovered.</div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Mono className="text-ink">{key}</Mono> <Copy text={key} />
          </div>
        </Pane>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Pane className="p-6">
          <h2 className="mb-4 font-display text-2xl">Top up with USDC</h2>
          <Deposit k={key} />
        </Pane>
        <Pane className="p-6">
          <h2 className="font-display text-2xl">Key</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Mono>{key.slice(0, 10)}…</Mono> <Copy text={key} label="Copy full key" />
          </div>
          <p className="mt-3 text-sm text-ink-3">Stored only in this browser. Use it anywhere with the base URL from the docs.</p>
          <div className="mt-5 flex gap-2">
            <a href="#/chat" className="rounded-md bg-proof px-4 py-2 text-sm font-medium text-night">
              Open chat
            </a>
            <Button
              kind="ghost"
              onClick={() => {
                if (!confirm("Forget this key in this browser? Make sure you've saved it.")) return;
                storedKey.clear();
                setKey(null);
                setBalance(null);
                setFresh(false);
              }}
            >
              Sign out
            </Button>
          </div>
          {err && <div className="mt-3 text-sm text-fail">{err}</div>}
        </Pane>
      </div>
    </div>
  );
}
