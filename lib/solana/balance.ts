import { getAccount } from "@solana/spl-token";
import { ataFor } from "@/lib/family/onchain";
import { getConnection } from "./connection";

/** The USDC balance of a wallet in base units; 0 when the token account does not exist yet. */
export async function usdcBalanceOf(walletAddress: string | null | undefined): Promise<bigint> {
  if (!walletAddress) return 0n;
  return getAccount(getConnection(), ataFor(walletAddress))
    .then((a) => a.amount)
    .catch(() => 0n);
}
