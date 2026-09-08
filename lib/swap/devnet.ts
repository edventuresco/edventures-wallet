/**
 * The devnet stand-in for Jupiter: a fixed-price swap between the test USDC
 * mint and devnet SOL, with the fee payer as the other side of the trade.
 * Both legs sit in one transaction, so it is atomic like a real swap:
 * USDC → SOL is the wallet's USDC to the fee payer plus the fee payer's
 * lamports to the wallet; SOL → USDC is the wallet's lamports to the fee
 * payer plus a mint of test USDC (the fee payer is the mint authority).
 * The price comes from DEVNET_SWAP_SOL_PRICE_USD (default $150).
 */
import { createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction, createTransferInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { usdcMint } from "@/lib/solana/mint";
import { lamportsFor, priceFromDollars, usdcFor } from "./amounts";
import type { SwapBuild, SwapProvider } from "./provider";

export const DEFAULT_DEVNET_SOL_PRICE = "150";

export function devnetPrice(): bigint {
  return priceFromDollars(process.env.DEVNET_SWAP_SOL_PRICE_USD ?? DEFAULT_DEVNET_SOL_PRICE);
}

export const devnetProvider: SwapProvider = {
  name: "devnet",

  async quote({ direction, inputUnits }) {
    const price = devnetPrice();
    const outputUnits = direction === "usdc_to_sol" ? lamportsFor(inputUnits, price) : usdcFor(inputUnits, price);
    return { direction, inputUnits, outputUnits, priceUnitsPerSol: price, provider: "devnet" };
  },

  async build({ quote, walletAddress, feePayer }): Promise<SwapBuild> {
    const mint = usdcMint();
    const walletAta = getAssociatedTokenAddressSync(mint, walletAddress, true);
    const feePayerAta = getAssociatedTokenAddressSync(mint, feePayer, true);
    if (quote.direction === "usdc_to_sol") {
      return {
        walletInstructions: [createTransferInstruction(walletAta, feePayerAta, walletAddress, quote.inputUnits, [], TOKEN_PROGRAM_ID)],
        outerInstructions: [
          createAssociatedTokenAccountIdempotentInstruction(feePayer, feePayerAta, feePayer, mint),
          SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: walletAddress, lamports: quote.outputUnits }),
        ],
        lookupTables: [],
      };
    }
    return {
      walletInstructions: [SystemProgram.transfer({ fromPubkey: walletAddress, toPubkey: feePayer, lamports: quote.inputUnits })],
      outerInstructions: [
        createAssociatedTokenAccountIdempotentInstruction(feePayer, walletAta, walletAddress, mint),
        createMintToInstruction(mint, walletAta, feePayer, quote.outputUnits),
      ],
      lookupTables: [],
    };
  },
};
