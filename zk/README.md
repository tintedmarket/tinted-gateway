# Anonymous credits circuit

`credit.circom` (Groth16, BN254, 20-level Poseidon tree, ~11.4k constraints) proves knowledge of the secrets of a note
commitment `Poseidon(nullifierSecret, secret, denom)` in the tree with public `root`, revealing only
`nullifierHash = Poseidon(nullifierSecret)` and binding the proof to `sessionKey` (sha256 of the API key it credits, mod r).

## Setup
- Phase 1: PSE Perpetual Powers of Tau, `ppot_0080_15.ptau` (80 contributions),
  https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_15.ptau
  sha256 `4a8eb5a754ed4710d6ad603c2e1a89c72325a448e4474f8694d2c71c7c272f3d`
- Phase 2: one contribution with discarded random entropy, then a random beacon: the Solana finalized blockhash
  `6FcKTZVLrtTxnRm7zZTzhCuVWMRv1weiHhJrnNZjHxrw` (slot 459308055), 2^10 iterations. See `beacon.txt` and `ceremony.txt`.
- What a broken setup could do: forge proofs, i.e. mint credit without paying (a loss for the operator). It can never
  reveal which deposit a redeemed note came from: unlinkability doesn't depend on the setup.

## Reproduce
```
circom credit.circom --r1cs --wasm -l <path to node_modules containing circomlib> -o build
snarkjs zkey verify build/credit.r1cs ppot_0080_15.ptau ../web/public/zk/credit.zkey   # must print ZKey Ok! and the hashes in ceremony.txt
snarkjs zkey export verificationkey ../web/public/zk/credit.zkey vk.json               # must equal vk.json
```
The gateway verifies with `vk.json`; the website serves `credit.wasm` and `credit.zkey` from `web/public/zk`.
