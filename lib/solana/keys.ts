import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function keypairFromBase58(secret: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secret.trim()));
}

export function keypairToBase58(kp: Keypair): string {
  return bs58.encode(kp.secretKey);
}

/** Server-held key from .env.local, e.g. FEE_PAYER_SECRET_KEY. */
export function keypairFromEnv(name: string): Keypair {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in .env.local (run: npm run keys)`);
  }
  return keypairFromBase58(value);
}
