"use server";

import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchSwig, getSignInstructions } from "@swig-wallet/classic";
import { requireUser } from "@/lib/auth/session";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { TEST_DOLLARS } from "@/lib/money/test-dollars";
import { dollarsToUnits, toView, unitsToDisplay, type MoneyView } from "@/lib/money/usdc";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { mintDollarsTo, usdcMint } from "@/lib/solana/mint";
import { TxError } from "@/lib/solana/tx";
import { countSponsoredToday, SPONSORED_PER_DAY } from "@/lib/sponsor/policy";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { reasonFor } from "@/lib/sponsor/reasons";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createWallet as createSwigWallet, roleIdFor } from "@/lib/swig/wallet";

export type WalletState = {
  device: { id: string; pubkey: string } | null;
  wallet: { id: string; swigAddress: string; walletAddress: string; explorerUrl: string } | null;
  balance: MoneyView;
  events: Array<{ id: string; summary: string; createdAt: string; explorerUrl: string | null }>;
};

type Result = { ok: true } | { ok: false; error: string };

async function readBalance(walletAddress: string): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(usdcMint(), new PublicKey(walletAddress), true);
  return getAccount(getConnection(), ata)
    .then((a) => a.amount)
    .catch(() => 0n);
}

export async function getWalletState(devicePubkey: string | null): Promise<WalletState> {
  const user = await requireUser();
  const supabase = await createClient();
  const device = devicePubkey ? (await supabase.from("devices").select("id,pubkey").eq("pubkey", devicePubkey).maybeSingle()).data : null;
  const wallet = (await supabase.from("wallets").select("id,swig_address,wallet_address").eq("user_id", user.id).maybeSingle()).data;
  const balance = wallet ? await readBalance(wallet.wallet_address) : 0n;
  const { data: events } = await supabase.from("events").select("id,summary,signature,created_at").order("created_at", { ascending: false }).limit(10);
  return {
    device: device ? { id: device.id, pubkey: device.pubkey } : null,
    wallet: wallet
      ? { id: wallet.id, swigAddress: wallet.swig_address, walletAddress: wallet.wallet_address, explorerUrl: explorerUrl(wallet.wallet_address, "address") }
      : null,
    balance: toView(balance),
    events: (events ?? []).map((e) => ({ id: e.id, summary: e.summary, createdAt: e.created_at, explorerUrl: e.signature ? explorerUrl(e.signature, "tx") : null })),
  };
}

type OwnerEvent = { wallet_id: string; kind: string; summary: string; amount_units?: number; counterparty?: string; signature?: string; reason?: string };

/**
 * Writes one of the grown-up's own events. When they are a guardian the row
 * carries `family_id`, so the family's activity feed lists it alongside the
 * kids' moves; Home lists it either way (by `user_id`, no kid).
 */
async function recordOwnerEvent(supabase: SupabaseClient, userId: string, event: OwnerEvent): Promise<void> {
  const { data: guardian } = await supabase.from("guardians").select("family_id").eq("user_id", userId).maybeSingle();
  await supabase.from("events").insert({ user_id: userId, ...(guardian ? { family_id: guardian.family_id } : {}), ...event });
}

export async function createWallet(deviceId: string): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: device } = await supabase.from("devices").select("id,pubkey").eq("id", deviceId).single();
  if (!device) return { ok: false, error: "Set up this device first." };
  const { data: existing } = await supabase.from("wallets").select("id").eq("user_id", user.id).maybeSingle();
  if (existing) return { ok: true };

  const created = await createSwigWallet({ connection: getConnection(), payer: keypairFromEnv("FEE_PAYER_SECRET_KEY"), root: new PublicKey(device.pubkey) });
  const { data: wallet, error } = await supabase
    .from("wallets")
    .insert({ user_id: user.id, swig_address: created.swigAddress.toBase58(), wallet_address: created.walletAddress.toBase58(), root_device_id: device.id })
    .select("id")
    .single();
  // A second concurrent create loses the unique(user_id) race; the first one's wallet is the wallet.
  if (error?.code === "23505") return { ok: true };
  if (error || !wallet) return { ok: false, error: "The wallet was created on Solana but couldn't be saved. Refresh and try again." };
  await recordOwnerEvent(supabase, user.id, { wallet_id: wallet.id, kind: "wallet_created", signature: created.signature, summary: "Your wallet was created on Solana" });
  return { ok: true };
}

export async function fundWallet(): Promise<Result> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: wallet } = await supabase.from("wallets").select("id,wallet_address").eq("user_id", user.id).single();
  if (!wallet) return { ok: false, error: "Create your wallet first." };
  if ((await countSponsoredToday(supabase, user.id)) >= SPONSORED_PER_DAY) return { ok: false, error: "You've done a lot today. More tomorrow." };
  const units = dollarsToUnits(TEST_DOLLARS);
  let signature: string;
  try {
    signature = await mintDollarsTo(new PublicKey(wallet.wallet_address), units);
  } catch (err) {
    console.error("fundWallet: mint failed", err);
    return { ok: false, error: "The test dollars didn't arrive. Try again in a minute." };
  }
  await recordOwnerEvent(supabase, user.id, { wallet_id: wallet.id, kind: "funded", amount_units: Number(units), signature, summary: `You got ${unitsToDisplay(units)} of test dollars` });
  return { ok: true };
}

export async function prepareTransfer(input: { devicePubkey: string; to: string; dollars: string }): Promise<
  { ok: true; token: string; txBase64: string; summary: string } | { ok: false; error: string }
> {
  const user = await requireUser();
  const supabase = await createClient();
  let to: PublicKey;
  let units: bigint;
  try {
    to = new PublicKey(input.to.trim());
    units = dollarsToUnits(input.dollars);
  } catch {
    return { ok: false, error: "Check the address and the amount." };
  }
  if (units <= 0n) return { ok: false, error: "Enter an amount above zero." };
  if ((await countSponsoredToday(supabase, user.id)) >= SPONSORED_PER_DAY) return { ok: false, error: "You've done a lot today. More tomorrow." };
  const { data: wallet } = await supabase.from("wallets").select("id,swig_address,wallet_address").eq("user_id", user.id).single();
  if (!wallet) return { ok: false, error: "Create your wallet first." };

  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const mint = usdcMint();
  const fromAta = getAssociatedTokenAddressSync(mint, new PublicKey(wallet.wallet_address), true);
  const toAta = getAssociatedTokenAddressSync(mint, to, true);
  // The recipient's token account is created inside the same verified, capped
  // transaction, never as a side effect of preparing one.
  const toAtaExists = await getAccount(connection, toAta).then(() => true).catch(() => false);
  const swig = await fetchSwig(connection, new PublicKey(wallet.swig_address));
  let roleId: number;
  try {
    roleId = roleIdFor(swig, new PublicKey(input.devicePubkey));
  } catch {
    return { ok: false, error: "This device isn't a key on your wallet. Set it up again from a device that is." };
  }
  const transfer = createTransferInstruction(fromAta, toAta, new PublicKey(wallet.wallet_address), units, [], TOKEN_PROGRAM_ID);
  const ixs = await getSignInstructions(swig, roleId, [transfer], false, { payer: feePayer.publicKey });

  const tx = new Transaction();
  if (!toAtaExists) tx.add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, to, mint));
  tx.add(...ixs);
  tx.feePayer = feePayer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  const token = await issuePreparedToken({ userId: user.id, messageHash: messageHashOf(tx), purpose: "transfer" });
  const short = `${to.toBase58().slice(0, 4)}…${to.toBase58().slice(-4)}`;
  return {
    ok: true,
    token,
    txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))),
    summary: `Send ${unitsToDisplay(units)} to ${short}`,
  };
}

export async function submitTransfer(input: { token: string; signedTxBase64: string; to: string; dollars: string }): Promise<
  { ok: true; signature: string; explorerUrl: string } | { ok: false; error: string }
> {
  const user = await requireUser();
  const supabase = await createClient();
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== user.id) return { ok: false, error: "That took too long. Try the send again." };

  const tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  // The fee payer co-signs only the exact message it prepared.
  if (messageHashOf(tx) !== claims.messageHash) return { ok: false, error: "This isn't the transaction we prepared." };

  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const { data: wallet } = await supabase.from("wallets").select("id,wallet_address").eq("user_id", user.id).single();
  if (!wallet) return { ok: false, error: "Create your wallet first." };
  // The cap is enforced where the fee payer actually signs, not only at prepare time.
  if ((await countSponsoredToday(supabase, user.id)) >= SPONSORED_PER_DAY) return { ok: false, error: "You've done a lot today. More tomorrow." };
  const units = dollarsToUnits(input.dollars);
  const connection = getConnection();

  try {
    tx.partialSign(feePayer);
    const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    await recordOwnerEvent(supabase, user.id, { wallet_id: wallet.id, kind: "sent", amount_units: Number(units), counterparty: input.to, signature, summary: `You sent ${unitsToDisplay(units)}` });
    return { ok: true, signature, explorerUrl: explorerUrl(signature, "tx") };
  } catch (error) {
    const balance = await readBalance(wallet.wallet_address);
    const logs = error && typeof error === "object" && "logs" in error ? ((error as { logs?: string[] }).logs ?? []) : [];
    const wrapped = error instanceof TxError ? error : new TxError((error as Error).message, logs);
    const reason = reasonFor(wrapped, balance, units);
    await recordOwnerEvent(supabase, user.id, { wallet_id: wallet.id, kind: "blocked", amount_units: Number(units), counterparty: input.to, reason: reason.code, summary: reason.message });
    return { ok: false, error: reason.message };
  }
}
