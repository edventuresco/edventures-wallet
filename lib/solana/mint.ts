import { PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { getConnection } from "./connection";
import { keypairFromEnv } from "./keys";

export function usdcMint(): PublicKey {
  const value = process.env.USDC_MINT;
  if (!value) throw new Error("USDC_MINT is not set (run: npm run mint)");
  return new PublicKey(value);
}

/** Devnet only: mints test dollars to the owner's token account. The fee payer is the mint authority. */
export async function mintDollarsTo(owner: PublicKey, units: bigint): Promise<string> {
  if ((process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") !== "devnet") throw new Error("Minting is devnet only");
  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const ata = await getOrCreateAssociatedTokenAccount(connection, feePayer, usdcMint(), owner, true);
  return mintTo(connection, feePayer, usdcMint(), ata.address, feePayer, units);
}
