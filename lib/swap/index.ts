import { devnetProvider } from "./devnet";
import { jupiterProvider } from "./jupiter";
import type { SwapProvider } from "./provider";

/** Jupiter on mainnet; the fixed-price devnet stand-in everywhere else. */
export function swapProvider(): SwapProvider {
  return (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") === "mainnet-beta" ? jupiterProvider : devnetProvider;
}
