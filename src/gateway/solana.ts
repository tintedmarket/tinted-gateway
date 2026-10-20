import { createHash, randomBytes } from "node:crypto";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";

/**
 * Solana for the gateway: a keypair that only exists inside the TEE (derived by dstack KMS, bound into /attestation),
 * used to sign the receipt log; and read access for deposits.
 */
export const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

let keypair: Keypair | null = null;
export function setSolanaKeypair(k: Keypair) {
  keypair = k;
}
export function solanaKeypair(): Keypair {
  if (!keypair) {
    const seed = process.env.TINTED_SOLANA_SEED;
    keypair = seed ? Keypair.fromSeed(createHash("sha256").update(seed).digest()) : Keypair.fromSeed(randomBytes(32));
  }
  return keypair;
}

let conn: Connection | null = null;
export function connection(): Connection {
  conn ??= new Connection(process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com", "confirmed");
  return conn;
}

export function associatedTokenAddress(owner: PublicKey, mint = USDC_MINT): PublicKey {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

/** Post a memo signed by the TEE key. Returns the transaction signature. */
export async function postMemo(text: string): Promise<string> {
  const kp = solanaKeypair();
  const tx = new Transaction().add(new TransactionInstruction({ programId: MEMO_PROGRAM, keys: [{ pubkey: kp.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(text, "utf8") }));
  return sendAndConfirmTransaction(connection(), tx, [kp], { commitment: "confirmed" });
}
