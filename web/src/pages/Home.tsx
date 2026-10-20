import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, CLAIMS, GATEWAY, type MarketRow } from "../api";
import { Badge, Button, CLAIM_HINT, CLAIM_LABEL, Pane } from "../ui";
import { go } from "../App";

const PROMPTS = [
  "Summarize this term sheet and flag anything unusual in the liquidation preference.",
  "Here are my lab results from Tuesday. What should I ask my doctor?",
  "Draft a reply to my landlord about the deposit. Keep it firm.",
  "Go through our Q3 numbers before the board sees them. What looks weak?",
  "My therapist suggested journaling. Can you help me make sense of this entry?",
  "Review this contract clause. Can they really terminate without notice?",
  "Here's our unreleased product spec. Write the launch announcement.",
  "Help me write a resignation letter. My manager doesn't know yet.",
  "Explain these symptoms in plain English. I'm not ready to tell anyone.",
  "Find the bug in this private repo before the audit starts.",
  "Rewrite this cover letter for a job at our competitor.",
  "Summarize these customer support tickets. They include names and emails.",
  "What are my options if I can't pay this tax bill on time?",
  "Translate this message to my family. It's personal.",
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

function Section({ n, of, kicker, title, children, aside }: { n: number; of: number; kicker: string; title: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-edge py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-[0.2em] text-ink-3 uppercase">
            <span className="text-proof">{String(n).padStart(2, "0")}</span> / {String(of).padStart(2, "0")} · {kicker}
          </div>
          <h2 className="mt-2 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};

function Stat({ value, label, live }: { value: ReactNode; label: string; live?: boolean }) {
  return (
    <div className="border-l border-edge px-5 py-1 first:border-l-0">
      <div className="flex items-center gap-2 font-display text-4xl">
        {value}
        {live && <span className="size-1.5 animate-pulse rounded-full bg-proof" />}
      </div>
      <div className="mt-1 text-xs text-ink-3">{label}</div>
    </div>
  );
}

const SNIPPETS: Record<string, string> = {
  env: `# any OpenAI-compatible client
OPENAI_BASE_URL=${GATEWAY}/v1
OPENAI_API_KEY=tnt_••••••••`,
  curl: `curl ${GATEWAY}/v1/chat/completions \\
  -H "authorization: Bearer $TINTED_KEY" \\
  -H "content-type: application/json" \\
  -d '{"model":"tinfoil/gemma4-31b",
       "messages":[{"role":"user","content":"hello"}]}' -i`,
  python: `from openai import OpenAI

tinted = OpenAI(base_url="${GATEWAY}/v1", api_key=TINTED_KEY)
r = tinted.chat.completions.with_raw_response.create(
    model="tinfoil/gemma4-31b",
    messages=[{"role": "user", "content": "hello"}],
)
print(r.headers["x-tinted-verified"], r.headers["x-tinted-receipt"])`,
  node: `import OpenAI from "openai";

const tinted = new OpenAI({ baseURL: "${GATEWAY}/v1", apiKey: TINTED_KEY });
const { data, response } = await tinted.chat.completions
  .create({ model: "tinfoil/gemma4-31b", messages: [{ role: "user", content: "hello" }] })
  .withResponse();
console.log(response.headers.get("x-tinted-verified"));`,
};
const RESPONSE = `HTTP/1.1 200 OK
x-tinted-verified: hardware=verified,gpu=verified,software=verified,weights=verified,keys=verified
x-tinted-receipt:  rcpt_a68ab3056e411a44fe37a110`;

function Terminal() {
  const [tab, setTab] = useState("env");
  const [copied, setCopied] = useState(false);
  return (
    <Pane className="overflow-hidden">
      <div className="flex items-center gap-1 border-b border-edge px-3 py-2">
        {Object.keys(SNIPPETS).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded px-2.5 py-1 font-mono text-[11px] ${k === tab ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"}`}>
            {k === "env" ? ".env" : k}
          </button>
        ))}
        <button
          className="ml-auto font-mono text-[11px] text-proof hover:underline"
          onClick={() =>
            void navigator.clipboard.writeText(SNIPPETS[tab]).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            })
          }
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-ink-2">{SNIPPETS[tab]}</pre>
      <pre className="overflow-x-auto border-t border-edge bg-night/60 p-5 font-mono text-[11.5px] leading-relaxed text-proof/90">{RESPONSE}</pre>
    </Pane>
  );
}

const WHO: [string, string, string][] = [
  ["The model provider's staff", "Read your prompt in their logs", "See only ciphertext: the model runs in a sealed enclave"],
  ["The cloud or GPU host", "Can dump memory at any time", "Memory is encrypted by the CPU and GPU, keys never leave the chip"],
  ["Tinted, the operator", "A normal router sees everything it relays", "The gateway runs in its own attested enclave. Check it on /verify"],
  ["Whoever breaches the logs later", "Gets every conversation", "Gets hashes. Receipts never contain your text"],
  ["Your payment trail", "Card, email and name on file", "Anonymous credits: a zero-knowledge proof unlinks the wallet that paid from the key that prompts"],
];

function Compare() {
  return (
    <div className="overflow-x-auto rounded-lg border border-edge">
      <div className="min-w-[680px]">
      <div className="grid grid-cols-[1.1fr_1fr_1.3fr] bg-pane-2 font-mono text-[11px] tracking-wider text-ink-3 uppercase">
        <div className="p-3">Who</div>
        <div className="border-l border-edge p-3">Normal AI API</div>
        <div className="border-l border-proof/30 bg-proof/5 p-3 text-proof">Through Tinted</div>
      </div>
      {WHO.map(([who, plain, tinted]) => (
        <div key={who} className="grid grid-cols-[1.1fr_1fr_1.3fr] border-t border-edge text-sm">
          <div className="p-3 text-ink">{who}</div>
          <div className="border-l border-edge p-3 text-ink-3">
            <span className="mr-1.5 text-fail">●</span>
            {plain}
          </div>
          <div className="border-l border-proof/30 bg-proof/[0.03] p-3 text-ink-2">
            <span className="mr-1.5 text-proof">●</span>
            {tinted}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function ProofLog({ rows }: { rows: MarketRow[] | null }) {
  const recent = useMemo(() => (rows ?? []).filter((r) => r.checkedAt).sort((a, b) => Date.parse(b.checkedAt!) - Date.parse(a.checkedAt!)).slice(0, 8), [rows]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);
  if (!rows) return <div className="text-sm text-ink-3">Reading the proof log…</div>;
  return (
    <Pane className="divide-y divide-edge">
      {recent.map((r) => {
        const passed = CLAIMS.filter((c) => r.claims?.[c] === "verified").length;
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <span className="w-16 font-mono text-[11px] text-ink-3">{ago(r.checkedAt)}</span>
            <span className="min-w-48 flex-1 truncate text-sm">{r.name}</span>
            <div className="flex gap-1">
              {CLAIMS.map((c) => (
                <Badge key={c} name={c} state={r.claims?.[c] ?? "unknown"} compact />
              ))}
            </div>
            <span className={`w-24 text-right font-mono text-[11px] ${r.routable ? "text-proof" : "text-fail"}`}>{r.routable ? `${passed}/5 · routed` : "held back"}</span>
          </div>
        );
      })}
    </Pane>
  );
}

const ROADMAP: [string, string, string][] = [
  ["Live", "Verified routing", "Every call goes only to a model whose CPU, GPU, code and key proofs passed in the last 10 minutes."],
  ["Live", "Signed receipts", "Every response is signed by a key born inside Tinted's own enclave."],
  ["Live", "Receipts on Solana", "Hourly Merkle roots posted by an enclave-held Solana key: nothing can be quietly rewritten."],
  ["Live", "USDC on Solana", "Prepaid credits, no account, no card, no KYC."],
  ["Live", "Anonymous credits", "Zero-knowledge credit notes: pay from any wallet, redeem with a Groth16 proof, and nobody can link the two."],
  ["Live", "TLS that ends in the enclave", "api.tinted.market's certificate key is derived and held inside Tinted's enclave, with an attestation over the certificate."],
  ["Next", "Streaming and more providers", "Token streaming through the glass, and new enclave providers as they pass the proofs."],
];

const FAQ: [string, ReactNode][] = [
  ["Can Tinted read my prompts?", "No. Your browser or client opens TLS straight into a gateway running inside an Intel TDX enclave: api.tinted.market's certificate key exists only in there. Its code is open source, pinned by image digest, and the hardware quote proves which build is running. It forwards to a provider enclave over a channel that terminates inside that enclave. Check it yourself on the Verify page."],
  ["What does \"claimed\" mean?", "The provider states it, but we couldn't prove it from vendor-signed evidence. Most often that's the exact model weights. You can require proved weights per request, and the call is refused otherwise."],
  ["What happens when a proof fails?", "The listing is held back. It stays visible in the market with the reason, and no request is sent to it until it passes again."],
  ["Am I getting the real model?", "For listings with proved weights, yes: the weights are pinned to a repository revision and a hash in the measured image. For others the provider's statement is shown as exactly that."],
  ["Why Solana?", "Payments in USDC settle in seconds for fractions of a cent, and the receipt log and the anonymous-credit tree need a public, cheap, permanent place to live."],
  ["Is it anonymous?", "Keys need no email or wallet connect. For full unlinkability use anonymous credits: you buy a note from your wallet, then redeem it with a zero-knowledge proof that shows the note was paid for without revealing which payment was yours."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-edge rounded-lg border border-edge">
      {FAQ.map(([q, a], k) => (
        <div key={q}>
          <button onClick={() => setOpen(open === k ? null : k)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-pane/60">
            <span>{q}</span>
            <span className={`font-mono text-proof transition ${open === k ? "rotate-45" : ""}`}>+</span>
          </button>
          {open === k && <div className="max-w-3xl px-5 pb-5 text-sm leading-relaxed text-ink-2">{a}</div>}
        </div>
      ))}
    </div>
  );
}

export function Home() {
  const [rows, setRows] = useState<MarketRow[] | null>(null);
  useEffect(() => {
    const load = () => api.market().then((m) => setRows(m.listings), () => undefined);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);
  const s = useMemo(() => {
    const r = rows ?? [];
    const last = r.map((x) => x.checkedAt).filter(Boolean).sort().at(-1) ?? null;
    return { routable: r.filter((x) => x.routable).length, total: r.length, weights: r.filter((x) => x.claims?.weights === "verified").length, providers: new Set(r.filter((x) => x.routable).map((x) => x.model.split("/")[0])).size, last };
  }, [rows]);
  const N = 6;

  return (
    <div>
      <section className="pb-16">
        <a href="#/verify" className="inline-flex items-center gap-2 rounded-full border border-proof/30 bg-proof/5 px-3 py-1 font-mono text-[11px] text-proof hover:bg-proof/10">
          <span className="size-1.5 animate-pulse rounded-full bg-proof" /> Live · gateway attested on Intel TDX · receipts on Solana ↗
        </a>
        <div className="mt-6 font-mono text-[11px] tracking-[0.2em] text-ink-3 uppercase">The Private Inference Market</div>
        <h1 className="mt-3 max-w-4xl font-display text-5xl leading-[1.02] sm:text-7xl">
          Inference behind <em className="text-proof">one-way glass.</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-2">
          Every model here runs inside a hardware enclave. Before your prompt leaves, Tinted checks the proof: the chip, the GPU, the code, the weights, the keys. You see the answer.
          Nobody running the machine does.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => go("chat")}>Start a private chat</Button>
          <Button kind="ghost" onClick={() => go("account")}>
            Get an API key
          </Button>
        </div>
        <div className="mt-10">
          <Glass />
        </div>
        <div className="mt-10 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
          <Stat value={rows ? `${s.routable}/${s.total}` : "…"} label="listings passing every proof" live />
          <Stat value={rows ? s.weights : "…"} label="with proved model weights" />
          <Stat value={rows ? ago(s.last) : "…"} label="last re-verification" live />
          <Stat value="0" label="prompts stored, anywhere" />
        </div>
      </section>

      <Section n={1} of={N} kicker="Developers" title="Two lines to move behind the glass." aside={<Button kind="ghost" onClick={() => go("docs")}>Read the docs →</Button>}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4 text-ink-2">
            <p>OpenAI-compatible. Swap the base URL and the key; your code doesn't change.</p>
            <p>Every response carries two extra headers: which proofs passed for this exact call, and a receipt id you can check on Solana.</p>
            <ul className="space-y-2 font-mono text-[12px] text-ink-3">
              <li>
                <span className="text-proof">→</span> no account, no email, no KYC
              </li>
              <li>
                <span className="text-proof">→</span> prepaid in USDC on Solana, or anonymously with ZK credits
              </li>
              <li>
                <span className="text-proof">→</span> x-tinted-require-weights: 1 for proved weights only
              </li>
            </ul>
          </div>
          <Terminal />
        </div>
      </Section>

      <Section n={2} of={N} kicker="Privacy" title="Who can read your prompt?">
        <Compare />
      </Section>

      <Section n={3} of={N} kicker="Proofs" title="Five proofs, checked before every call.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {CLAIMS.map((c, k) => (
            <Pane key={c} className="p-5">
              <div className="font-mono text-[11px] text-ink-3">{String(k + 1).padStart(2, "0")}</div>
              <div className="mt-6 font-display text-2xl">{CLAIM_LABEL[c]}</div>
              <p className="mt-2 text-sm text-ink-2">{CLAIM_HINT[c]}</p>
            </Pane>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-3">Checked by Tinted against Intel, AMD and NVIDIA's own signing roots, not taken from the provider's word. Anything unproved is labelled "claimed".</p>
      </Section>

      <Section n={4} of={N} kicker="Proof log" title="Re-verified around the clock." aside={<Button kind="ghost" onClick={() => go("market")}>Full market →</Button>}>
        <ProofLog rows={rows} />
      </Section>

      <Section n={5} of={N} kicker="Roadmap" title="What's live, what's next.">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ROADMAP.map(([state, title, body]) => (
            <Pane key={title} className={`p-5 ${state === "Next" ? "opacity-80" : ""}`}>
              <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase ${state === "Live" ? "border-proof/50 text-proof" : "border-claim/40 text-claim"}`}>{state}</span>
              <div className="mt-4 font-display text-2xl">{title}</div>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </Pane>
          ))}
        </div>
      </Section>

      <Section n={6} of={N} kicker="FAQ" title="Questions worth asking.">
        <Faq />
      </Section>

      <section className="border-t border-edge py-20 text-center">
        <h2 className="font-display text-5xl sm:text-6xl">
          Say it <em className="text-proof">privately.</em>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-ink-2">A key takes one click. Top up a few dollars of USDC and every call comes with its proof.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => go("chat")}>Start a private chat</Button>
          <Button kind="ghost" onClick={() => go("verify")}>
            Verify the gateway
          </Button>
        </div>
      </section>
    </div>
  );
}
