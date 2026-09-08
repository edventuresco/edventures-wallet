/**
 * Jupiter on mainnet: a quote from the aggregator and the route's
 * instructions, which the server wraps in the wallet's Swig role and
 * compiles into a versioned transaction with the route's lookup tables.
 * The wallet address handed to Jupiter is the Swig wallet (the token
 * owner); the device key signs the wrapper. Unverified on mainnet as of
 * 2026-09-07: a deep route may exceed the CPI depth the Swig wrap allows.
 */
import { createJupiterApiClient, type Instruction, type QuoteResponse } from "@jup-ag/api";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { usdcMint } from "@/lib/solana/mint";
import { impliedPrice, SOL_MINT } from "./amounts";
import type { SwapBuild, SwapProvider } from "./provider";

const SLIPPAGE_BPS = 50;

function toInstruction(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
    data: Buffer.from(ix.data, "base64"),
  });
}

export const jupiterProvider: SwapProvider = {
  name: "jupiter",

  async quote({ direction, inputUnits }) {
    const usdc = usdcMint().toBase58();
    const [inputMint, outputMint] = direction === "usdc_to_sol" ? [usdc, SOL_MINT] : [SOL_MINT, usdc];
    const response = await createJupiterApiClient().quoteGet({ inputMint, outputMint, amount: Number(inputUnits), slippageBps: SLIPPAGE_BPS });
    const outputUnits = BigInt(response.outAmount);
    const [usdcUnits, lamports] = direction === "usdc_to_sol" ? [inputUnits, outputUnits] : [outputUnits, inputUnits];
    return { direction, inputUnits, outputUnits, priceUnitsPerSol: impliedPrice(usdcUnits, lamports), provider: "jupiter", raw: response };
  },

  async build({ quote, walletAddress }): Promise<SwapBuild> {
    const quoteResponse = quote.raw as QuoteResponse | undefined;
    if (!quoteResponse) throw new Error("A Jupiter build needs the quote it came from");
    const swap = await createJupiterApiClient().swapInstructionsPost({
      swapRequest: { quoteResponse, userPublicKey: walletAddress.toBase58(), wrapAndUnwrapSol: true },
    });
    const walletInstructions = [...swap.setupInstructions, swap.swapInstruction, ...(swap.cleanupInstruction ? [swap.cleanupInstruction] : [])].map(toInstruction);
    return {
      walletInstructions,
      outerInstructions: swap.computeBudgetInstructions.map(toInstruction),
      lookupTables: swap.addressLookupTableAddresses.map((a) => new PublicKey(a)),
    };
  },
};
