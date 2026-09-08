"use server";

// Swapping between the family's dollar and SOL from the grown-up's wallet.
// Quote → prepare (the device signs in the browser) → submit (the fee
// payer co-signs the exact message it prepared, sends, records the event).
// The provider (lib/swap) decides the price and the route; this file owns
// the money rules: the balance check, the sponsor cap, the Swig wrap.

import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AddressLookupTableAccount, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { fetchSwig, getSignInstructions } from "@swig-wallet/classic";
import { requireUser } from "@/lib/auth/session";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { dollarsToUnits, toView, unitsToDisplay, type MoneyView } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { countSponsoredToday, SPONSORED_PER_DAY } from "@/lib/sponsor/policy";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { createClient } from "@/lib/supabase/server";
import { swapProvider } from "@/lib/swap";
import { lamportsToDisplay, rateLabel, sideLabels, solToLamports, type SwapDirection } from "@/lib/swap/amounts";
import type { SwapQuote } from "@/lib/swap/provider";
import { roleIdFor } from "@/lib/swig/wallet";

export type SwapState = {
  /** Null until this account has a wallet. */
  wallet: { address: string } | null;
  usdc: MoneyView;
  solDisplay: string;
  solLamports: string;
  provider: "jupiter" | "devnet";
};

export type SwapQuoteView = {
  ok: true;
  direction: SwapDirection;
  inputDisplay: string;
  outputDisplay: string;
  rate: string;
  /** Base units of the input side as a decimal string; handed back to prepare so the numbers cannot drift. */
  inputUnits: string;
};

type Failure = { ok: false; error: string };

const NO_WALLET: Failure = { ok: false, error: "Create your wallet first." };
/** Keep this much SOL behind so the wallet can still be rent-exempt. */
const SOL_RESERVE = 5_000_000n;

async function walletOf(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("wallets").select("id,swig_address,wallet_address").eq("user_id", userId).maybeSingle();
  return { supabase, wallet: data };
}

async function balances(walletAddress: string): Promise<{ usdc: bigint; lamports: bigint }> {
  const connection = getConnection();
  const owner = new PublicKey(walletAddress);
  const [usdc, lamports] = await Promise.all([
    getAccount(connection, getAssociatedTokenAddressSync(usdcMint(), owner, true))
      .then((a) => a.amount)
      .catch(() => 0n),
    connection.getBalance(owner).then(BigInt),
  ]);
  return { usdc, lamports };
}

export async function getSwapState(): Promise<SwapState> {
  const user = await requireUser();
  const { wallet } = await walletOf(user.id);
  const { usdc, lamports } = wallet ? await balances(wallet.wallet_address) : { usdc: 0n, lamports: 0n };
  return { wallet: wallet ? { address: wallet.wallet_address } : null, usdc: toView(usdc), solDisplay: lamportsToDisplay(lamports), solLamports: lamports.toString(), provider: swapProvider().name };
}

function parseInput(direction: SwapDirection, amount: string): bigint | Failure {
  try {
    const units = direction === "usdc_to_sol" ? dollarsToUnits(amount) : solToLamports(amount);
    return units > 0n ? units : { ok: false, error: "Enter an amount above zero." };
  } catch {
    return { ok: false, error: `Enter an amount in ${sideLabels(direction).from}, like ${direction === "usdc_to_sol" ? "2.50" : "0.05"}.` };
  }
}

function display(direction: SwapDirection, side: "input" | "output", units: bigint): string {
  const isUsdc = (direction === "usdc_to_sol") === (side === "input");
  return isUsdc ? unitsToDisplay(units) : lamportsToDisplay(units);
}

async function quoteFor(direction: SwapDirection, inputUnits: bigint, walletAddress: string): Promise<SwapQuote | Failure> {
  const { usdc, lamports } = await balances(walletAddress);
  const available = direction === "usdc_to_sol" ? usdc : lamports > SOL_RESERVE ? lamports - SOL_RESERVE : 0n;
  if (inputUnits > available) {
    return { ok: false, error: `You have ${display(direction, "input", available)} to swap.` };
  }
  try {
    const quote = await swapProvider().quote({ direction, inputUnits });
    if (quote.outputUnits <= 0n) return { ok: false, error: "That's too small to swap. Try a bigger amount." };
    return quote;
  } catch {
    return { ok: false, error: "Couldn't get a price just now. Try again in a moment." };
  }
}

function toQuoteView(quote: SwapQuote): SwapQuoteView {
  return {
    ok: true,
    direction: quote.direction,
    inputDisplay: display(quote.direction, "input", quote.inputUnits),
    outputDisplay: display(quote.direction, "output", quote.outputUnits),
    rate: rateLabel(quote.priceUnitsPerSol),
    inputUnits: quote.inputUnits.toString(),
  };
}

/** What the swap would give right now. */
export async function quoteSwap(input: { direction: SwapDirection; amount: string }): Promise<SwapQuoteView | Failure> {
  const user = await requireUser();
  const { wallet } = await walletOf(user.id);
  if (!wallet) return NO_WALLET;
  const units = parseInput(input.direction, input.amount);
  if (typeof units !== "bigint") return units;
  const quote = await quoteFor(input.direction, units, wallet.wallet_address);
  return "ok" in quote ? quote : toQuoteView(quote);
}

/** A fresh quote and the transaction for it; the device signs it next. */
export async function prepareSwap(input: { devicePubkey: string; direction: SwapDirection; inputUnits: string }): Promise<
  { ok: true; token: string; txBase64: string; summary: string; quote: SwapQuoteView } | Failure
> {
  const user = await requireUser();
  const { supabase, wallet } = await walletOf(user.id);
  if (!wallet) return NO_WALLET;
  let units: bigint;
  try {
    units = BigInt(input.inputUnits);
  } catch {
    return { ok: false, error: "Get a quote first." };
  }
  if (units <= 0n) return { ok: false, error: "Get a quote first." };
  if ((await countSponsoredToday(supabase, user.id)) >= SPONSORED_PER_DAY) return { ok: false, error: "You've done a lot today. More tomorrow." };
  const quote = await quoteFor(input.direction, units, wallet.wallet_address);
  if ("ok" in quote) return quote;

  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const walletAddress = new PublicKey(wallet.wallet_address);
  let txBase64: string;
  let hash: string;
  try {
    const swig = await fetchSwig(connection, new PublicKey(wallet.swig_address));
    const roleId = roleIdFor(swig, new PublicKey(input.devicePubkey));
    const built = await swapProvider().build({ quote, walletAddress, feePayer: feePayer.publicKey });
    const wrapped = await getSignInstructions(swig, roleId, built.walletInstructions, false, { payer: feePayer.publicKey });
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    if (built.lookupTables.length === 0) {
      const tx = new Transaction();
      tx.add(...built.outerInstructions, ...wrapped);
      tx.feePayer = feePayer.publicKey;
      tx.recentBlockhash = blockhash;
      hash = messageHashOf(tx);
      txBase64 = bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false })));
    } else {
      const tables = (await Promise.all(built.lookupTables.map((key) => connection.getAddressLookupTable(key)))).map((r) => r.value).filter((t): t is AddressLookupTableAccount => t !== null);
      const message = new TransactionMessage({ payerKey: feePayer.publicKey, recentBlockhash: blockhash, instructions: [...built.outerInstructions, ...wrapped] }).compileToV0Message(tables);
      const tx = new VersionedTransaction(message);
      hash = messageHashOf(tx);
      txBase64 = bytesToBase64(tx.serialize());
    }
  } catch (error) {
    if (error instanceof Error && /No role for authority/.test(error.message)) return { ok: false, error: "This device isn't a key on your wallet. Set it up in Settings first." };
    return { ok: false, error: "Couldn't build the swap just now. Try again in a moment." };
  }

  const token = await issuePreparedToken({ userId: user.id, messageHash: hash, purpose: "swap" });
  const view = toQuoteView(quote);
  return { ok: true, token, txBase64, summary: `Swap ${view.inputDisplay} for ${view.outputDisplay}`, quote: view };
}

/** Co-sign and send the device-signed swap, then write it to the feed. */
export async function submitSwap(input: { token: string; signedTxBase64: string; direction: SwapDirection; inputUnits: string; outputUnits?: string }): Promise<
  { ok: true; signature: string; explorerUrl: string } | Failure
> {
  const user = await requireUser();
  const { supabase, wallet } = await walletOf(user.id);
  if (!wallet) return NO_WALLET;
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== user.id || claims.purpose !== "swap") return { ok: false, error: "That took too long. Get a fresh quote." };
  if ((await countSponsoredToday(supabase, user.id)) >= SPONSORED_PER_DAY) return { ok: false, error: "You've done a lot today. More tomorrow." };

  const bytes = base64ToBytes(input.signedTxBase64);
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const connection = getConnection();
  let signature: string;
  try {
    const versioned = VersionedTransaction.deserialize(bytes);
    let wire: Uint8Array;
    if (versioned.version !== "legacy") {
      // The fee payer co-signs only the exact message it prepared.
      if (messageHashOf(versioned) !== claims.messageHash) return { ok: false, error: "This isn't the swap we prepared." };
      versioned.sign([feePayer]);
      wire = versioned.serialize();
    } else {
      const tx = Transaction.from(bytes);
      if (messageHashOf(tx) !== claims.messageHash) return { ok: false, error: "This isn't the swap we prepared." };
      tx.partialSign(feePayer);
      wire = new Uint8Array(tx.serialize());
    }
    signature = await connection.sendRawTransaction(wire, { skipPreflight: false });
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  } catch {
    return { ok: false, error: "The swap didn't go through. Nothing moved. Get a fresh quote and try again." };
  }

  const units = BigInt(input.inputUnits);
  const { to } = sideLabels(input.direction);
  const got = input.outputUnits ? display(input.direction, "output", BigInt(input.outputUnits)) : to;
  const summary = `You swapped ${display(input.direction, "input", units)} for ${got}`;
  const usdcUnits = input.direction === "usdc_to_sol" ? units : input.outputUnits ? BigInt(input.outputUnits) : 0n;
  const { data: guardian } = await supabase.from("guardians").select("family_id").eq("user_id", user.id).maybeSingle();
  const base = { user_id: user.id, wallet_id: wallet.id, ...(guardian ? { family_id: guardian.family_id } : {}), amount_units: Number(usdcUnits), signature, summary };
  const { error } = await supabase.from("events").insert({ ...base, kind: "swapped" });
  // Until the "swapped" kind migration is applied the check constraint refuses it; the feed still gets a line.
  if (error?.code === "23514") await supabase.from("events").insert({ ...base, kind: input.direction === "usdc_to_sol" ? "sent" : "received" });
  return { ok: true, signature, explorerUrl: explorerUrl(signature, "tx") };
}
