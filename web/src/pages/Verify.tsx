import { useEffect, useState } from "react";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { api, CLAIMS, type Anchor, type ClaimName, type ClaimState, type Receipt } from "../api";
import { checkAnchorOnChain, checkInclusion, checkSignature } from "../verify";
import { Badge, Button, H, Mono, Pane, short } from "../ui";

type Check = { label: string; ok: boolean | null; detail: string };

function Row({ c }: { c: Check }) {
  const tone = c.ok === null ? "text-ink-3" : c.ok ? "text-proof" : "text-fail";
  return (
    <div className="flex gap-3 border-t border-edge py-2.5 first:border-t-0">
      <span className={`w-5 font-mono ${tone}`}>{c.ok === null ? "·" : c.ok ? "✓" : "✗"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{c.label}</div>
        <div className="font-mono text-[11px] break-all text-ink-3">{c.detail}</div>
      </div>
    </div>
  );
}

type Attestation = Awaited<ReturnType<typeof api.attestation>>;

/** The TDX quote's report_data (bytes 568..632 of a v4 quote) must equal sha256(boundKeys) followed by 32 zero bytes. */
function reportDataBinds(a: Attestation): boolean | null {
  if (!a.quote || !a.boundKeys) return null;
  const rd = a.quote.slice(568 * 2, 632 * 2).toLowerCase();
  return rd === bytesToHex(sha256(utf8ToBytes(a.boundKeys))) + "0".repeat(64);
}

function Gateway({ a }: { a: Attestation | null }) {
  if (!a) return <div className="text-sm text-ink-3">Fetching a fresh attestation…</div>;
  const checks: Check[] = [
    { label: "Running in a TEE", ok: a.tee, detail: a.tee ? "Intel TDX confidential VM (dstack)" : "development gateway" },
    { label: "Hardware quote names these keys", ok: reportDataBinds(a), detail: a.boundKeys ?? "—" },
    { label: "Receipt key", ok: a.boundKeys ? a.boundKeys.includes(a.receiptKey) : null, detail: a.receiptKey },
    { label: "Solana log key", ok: a.solanaKey && a.boundKeys ? a.boundKeys.includes(a.solanaKey) : null, detail: a.solanaKey ?? "—" },
  ];
  return (
    <div>
      {checks.map((c) => (
        <Row key={c.label} c={c} />
      ))}
      <Row
        c={{
          label: "TLS ends inside the enclave",
          ok: null,
          detail: "api.tinted.market's certificate key is derived inside the VM; the certificate, ACME account and a TDX quote over both are at api.tinted.market/evidences/",
        }}
      />
      <a className="mt-1 ml-8 inline-block font-mono text-[11px] text-proof underline" href="https://api.tinted.market/evidences/" target="_blank" rel="noreferrer">
        open the TLS evidence ↗
      </a>
      <p className="mt-4 text-xs text-ink-3">
        Your browser checked that the quote commits to these keys. Checking the quote's Intel signature chain and the measured code needs a few MB of collateral, so it runs as a
        script: <Mono>node test/self.live.ts</Mono> in the{" "}
        <a className="underline" href="https://github.com/tintedmarket/tinted-gateway">
          open-source gateway
        </a>{" "}
        replays the boot log and matches the running image to its public build.
      </p>
    </div>
  );
}

export function Verify({ initialId }: { initialId: string }) {
  const [id, setId] = useState(initialId);
  const [att, setAtt] = useState<Attestation | null>(null);
  const [res, setRes] = useState<{ receipt: Receipt; signature: string; anchor: Anchor | null } | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.attestation().then(setAtt, (e) => setErr(String(e.message ?? e)));
  }, []);

  async function run(rid: string) {
    if (!rid.trim()) return;
    setBusy(true);
    setErr(null);
    setRes(null);
    setChecks([]);
    try {
      const r = await api.receipt(rid.trim());
      setRes(r);
      const a = att ?? (await api.attestation());
      const out: Check[] = [
        { label: "Signature is valid (checked in your browser)", ok: checkSignature(r.receipt, r.signature), detail: `ed25519 over the canonical receipt · ${short(r.signature, 10)}` },
        { label: "Signed by the attested gateway key", ok: r.receipt.gatewayKey === a.receiptKey, detail: r.receipt.gatewayKey },
      ];
      if (!r.anchor) out.push({ label: "Anchored on Solana", ok: null, detail: "not yet: receipts are batched into a Merkle root and posted every hour" });
      else {
        out.push({ label: "Included in the anchored batch", ok: checkInclusion(r.receipt.id, r.signature, r.anchor), detail: `leaf ${r.anchor.index + 1} of ${r.anchor.count} · root ${short(r.anchor.root, 10)}` });
        setChecks([...out]);
        const chain = await checkAnchorOnChain(r.anchor, a.solanaKey).catch(() => null);
        out.push({ label: "Root is on Solana", ok: chain ? chain.rootMatches : null, detail: chain?.memo ?? "couldn't reach a Solana RPC from this browser" });
        out.push({ label: "Posted by the attested Solana key", ok: chain?.signerMatches ?? null, detail: chain?.signer ?? "—" });
      }
      setChecks(out);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initialId) void run(initialId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  return (
    <div>
      <H kicker="Verify" title="Don't trust us. Check.">
        Every response comes with a receipt signed by a key that only exists inside Tinted's enclave. Receipts are batched hourly into a Merkle root posted to Solana by a second
        enclave-held key. All of it can be checked from here, without asking us.
      </H>
      <div className="grid gap-4 lg:grid-cols-2">
        <Pane className="p-6">
          <h2 className="mb-3 font-display text-2xl">A receipt</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(id);
            }}
          >
            <input value={id} onChange={(e) => setId(e.target.value)} placeholder="rcpt_…" className="flex-1 rounded-md border border-edge bg-night px-3 py-2 font-mono text-sm" />
            <Button type="submit" disabled={busy}>
              {busy ? "Checking…" : "Check"}
            </Button>
          </form>
          {err && <div className="mt-3 text-sm text-fail">{err}</div>}
          {checks.length > 0 && (
            <div className="mt-4">
              {checks.map((c) => (
                <Row key={c.label} c={c} />
              ))}
            </div>
          )}
          {res && (
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex flex-wrap gap-1">
                {CLAIMS.map((c) => (
                  <Badge key={c} name={c as ClaimName} state={(res.receipt.verified[c] as ClaimState) ?? "unknown"} />
                ))}
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11.5px]">
                <span className="text-ink-3">model</span>
                <span>{res.receipt.listing}</span>
                <span className="text-ink-3">at</span>
                <span>{new Date(res.receipt.at).toLocaleString()}</span>
                <span className="text-ink-3">tokens</span>
                <span>
                  {res.receipt.usage.input} in · {res.receipt.usage.output} out
                </span>
                <span className="text-ink-3">charged</span>
                <span>${(res.receipt.costMicros / 1e6).toFixed(6)}</span>
                <span className="text-ink-3">request</span>
                <span className="break-all">{short(res.receipt.requestHash, 12)}</span>
                <span className="text-ink-3">response</span>
                <span className="break-all">{short(res.receipt.responseHash, 12)}</span>
                {res.anchor && (
                  <>
                    <span className="text-ink-3">solana tx</span>
                    <a className="break-all text-proof underline" href={`https://solscan.io/tx/${res.anchor.tx}`} target="_blank" rel="noreferrer">
                      {short(res.anchor.tx, 10)}
                    </a>
                  </>
                )}
              </div>
              <p className="text-xs text-ink-3">The receipt holds hashes of your request and response, never the text. Keep the text and you can prove exactly what was said.</p>
            </div>
          )}
        </Pane>
        <Pane className="p-6">
          <h2 className="mb-3 font-display text-2xl">The gateway itself</h2>
          <Gateway a={att} />
        </Pane>
      </div>
    </div>
  );
}
