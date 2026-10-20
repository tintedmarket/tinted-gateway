# Tinted — the Private Inference Market

Confidential AI inference you can prove. Tinted routes OpenAI-compatible requests only to confidential-computing
providers whose environment it verifies itself (hardware, GPU, software, keys, and model weights where the provider
measures them), checks each response where the provider signs it, and returns a signed Tinted receipt for every answer.
Prompts and responses are never stored.

- `src/verify/` — independent verification: Intel TDX (dcap-qvl, Intel PCS), NVIDIA GPUs (NRAS, JWKS-checked),
  dstack event-log/compose replay, RedPill ACI receipts, Tinfoil (Sigstore + SEV-SNP/TDX, dm-verity-pinned weights).
- `src/providers/` — market listings and chat per provider (RedPill/Phala, Tinfoil).
- `src/gateway/` — the API: `/v1/models`, `/v1/chat/completions`, `/v1/verification/:provider/:model`, `/v1/receipts/:id`.

Dev: `npm run dev` (needs `.env` with REDPILL_API_KEY, TINFOIL_API_KEY), `npx tsx --env-file=.env scripts/new-account.ts <label> <usd>`.
