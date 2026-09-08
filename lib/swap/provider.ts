/**
 * The swap seam. Jupiter serves mainnet only and this app runs on devnet
 * with a test USDC mint, so a provider answers two questions (what would I
 * get, and what instructions do it) and the server actions do the rest:
 * the Swig wrap, the fee payer, the prepared-token seam, the event.
 */
import type { PublicKey, TransactionInstruction } from "@solana/web3.js";
import type { SwapDirection } from "./amounts";

export type SwapQuote = {
  direction: SwapDirection;
  /** What leaves the wallet, in that side's base units. */
  inputUnits: bigint;
  /** What arrives, in that side's base units. */
  outputUnits: bigint;
  /** USDC base units per SOL, for the rate line. */
  priceUnitsPerSol: bigint;
  provider: "jupiter" | "devnet";
  /** Opaque, provider-specific; handed back to buildSwap. */
  raw?: unknown;
};

export type SwapBuild = {
  /** Instructions the wallet must sign (they get wrapped by the Swig role). */
  walletInstructions: TransactionInstruction[];
  /** Instructions that need no wallet signature (compute budget, the counterparty's leg); the fee payer signs those it must. */
  outerInstructions: TransactionInstruction[];
  /** Address lookup tables the transaction needs; empty for a legacy transaction. */
  lookupTables: PublicKey[];
};

export interface SwapProvider {
  readonly name: "jupiter" | "devnet";
  quote(input: { direction: SwapDirection; inputUnits: bigint }): Promise<SwapQuote>;
  build(input: { quote: SwapQuote; walletAddress: PublicKey; feePayer: PublicKey }): Promise<SwapBuild>;
}
