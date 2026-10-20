import type { ReactNode } from "react";
import { GATEWAY } from "../api";
import { H, Pane } from "../ui";

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md border border-edge bg-night p-4 font-mono text-[12px] leading-relaxed text-ink-2">{children}</pre>;
}
function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Pane className="space-y-3 p-6 text-sm text-ink-2">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {children}
    </Pane>
  );
}

export function Docs() {
  return (
    <div>
      <H kicker="Docs" title="OpenAI-compatible, with proofs attached.">
        Point any OpenAI client at Tinted. Each request is routed only to a model whose enclave proofs passed in the last ten minutes.
      </H>
      <div className="space-y-4">
        <Sec title="Quickstart">
          <p>
            Get a key on the <a className="text-proof underline" href="#/account">Account</a> page and top up with USDC. Then:
          </p>
          <Code>{`curl ${GATEWAY}/v1/chat/completions \\
  -H "authorization: Bearer $TINTED_KEY" \\
  -H "content-type: application/json" \\
  -d '{"model":"tinfoil/gemma4-31b","messages":[{"role":"user","content":"hello"}]}' -i`}</Code>
          <Code>{`import OpenAI from "openai";
const tinted = new OpenAI({ baseURL: "${GATEWAY}/v1", apiKey: process.env.TINTED_KEY });
const r = await tinted.chat.completions.create({ model: "tinfoil/gemma4-31b", messages: [{ role: "user", content: "hello" }] });`}</Code>
          <p>Streaming isn't supported yet: send stream=false (the default).</p>
        </Sec>
        <Sec title="What comes back">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <code className="font-mono text-ink">x-tinted-verified</code>: the state of each proof for this call, e.g. <code className="font-mono">hardware=verified,gpu=verified,…</code>
            </li>
            <li>
              <code className="font-mono text-ink">x-tinted-receipt</code>: a receipt id. <code className="font-mono">GET /v1/receipts/:id</code> returns the signed receipt and,
              once anchored, its Merkle proof and Solana transaction.
            </li>
          </ul>
          <p>
            Send <code className="font-mono text-ink">x-tinted-require-weights: 1</code> to refuse the call unless the exact model weights are proved, not just stated by the
            provider.
          </p>
        </Sec>
        <Sec title="The five proofs">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b className="text-ink">CPU enclave</b>: Intel TDX or AMD SEV-SNP quote checked against Intel's / AMD's root certificates and current revocation data.
            </li>
            <li>
              <b className="text-ink">GPU enclave</b>: NVIDIA confidential-computing attestation, verified with NVIDIA's signing keys.
            </li>
            <li>
              <b className="text-ink">Code</b>: the measured software matches a published release (Sigstore-signed build or an audited compose file).
            </li>
            <li>
              <b className="text-ink">Weights</b>: the model files are pinned to a repository revision and a dm-verity root hash in the measured image.
            </li>
            <li>
              <b className="text-ink">Keys</b>: the key that encrypts your request or signs the response is bound to that attestation.
            </li>
          </ul>
          <p>
            "Claimed" means the provider states it and we couldn't prove it independently. A listing that fails hardware, GPU, code or keys is never routed.
          </p>
        </Sec>
        <Sec title="Endpoints">
          <Code>{`GET  /v1/models                     OpenAI model list, with prices
GET  /v1/market                     every listing, prices, proof states, why not routed
GET  /v1/verification/:provider/:model  full evidence for one listing
POST /v1/chat/completions           (Bearer key)
GET  /v1/receipts/:id               signed receipt + Solana anchor
POST /v1/accounts                   new anonymous key
GET  /v1/balance  /v1/deposit       (Bearer key)
GET  /v1/credits                     anonymous credits: tree root, sizes, circuit
GET  /v1/credits/leaves?from=N      every note commitment, in tree order
POST /v1/credits/redeem             { proof, publicSignals, keyHash }
GET  /attestation                   Tinted's own TDX quote and bound keys`}</Code>
        </Sec>
        <Sec title="Anonymous credits">
          <p>
            A note is two random secrets made in your browser. Its commitment, Poseidon(nullifierSecret, secret, amount), goes in the USDC memo when you pay $10, $50 or
            $200 (<code className="font-mono">tinted:note:&lt;hex&gt;</code>) and joins a public 20-level Merkle tree whose root Tinted's enclave posts to Solana.
          </p>
          <p>
            To redeem, your browser downloads the whole tree, finds the note locally and makes a Groth16 proof that it knows the secrets of some leaf, revealing only
            Poseidon(nullifierSecret) so it can't be spent twice. The proof is bound to sha256 of the API key it credits, which your browser generates, so nobody can redirect
            it. Proving takes about half a second.
          </p>
          <p>
            Setup: phase 1 is the PSE Perpetual Powers of Tau (80 contributions); phase 2 had a fresh contribution sealed with a Solana blockhash as a public random beacon. The
            circuit, transcript and verifying key are in <a className="text-proof underline" href="https://github.com/tintedmarket/tinted-gateway/tree/main/zk">/zk</a>.
          </p>
        </Sec>
        <Sec title="Paying">
          <p>
            Credits are prepaid in USDC on Solana. Each key gets a deposit memo; send USDC to the treasury with that memo and the gateway credits the key once the transfer is
            confirmed. Prices are the provider's price plus a 15% market fee, shown per million tokens.
          </p>
        </Sec>
      </div>
    </div>
  );
}
