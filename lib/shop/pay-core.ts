// The "pay a shop" flow, server side, for either payer (lib/shop/payer.ts).
// Quote → prepare (the device signs in the browser) → submit (fee payer
// co-signs the exact message it prepared, sends, then hands the payout to
// Sqril) → status (polled until the webhook, or a direct Sqril read, settles
// it). Money is bigint base units here; decimal strings and MoneyView cross
// to the client. The thin server actions in app/kid/pay/actions.ts and
// app/pay/actions.ts resolve the payer and call in here.

import { PublicKey, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { fetchSwig, getSignInstructions } from "@swig-wallet/classic";
import type { SupabaseClient } from "@supabase/supabase-js";
import { base64ToBytes, bytesToBase64 } from "@/lib/device/encoding";
import { defaultLimits, limitRowFromDb, resolvePending, type LimitRowDb } from "@/lib/rules/limits";
import { ensureSqrilCustomer } from "@/lib/shop/customer";
import { executeShopPayment } from "@/lib/shop/execute";
import {
  decideShopPayment,
  isQuoteUsable,
  SHOP_PAYMENT_COLUMNS,
  shopPaySummary,
  shopReasonMessage,
  shopStatusMessage,
  toQuoteView,
  toStatusView,
  webhookOutcome,
  type ShopPaymentRow,
  type ShopPaymentStatusView,
  type ShopQuoteView,
} from "@/lib/shop/flow";
import { payerKidId, payerWalletLabel, type Payer } from "@/lib/shop/payer";
import { quoteShopPayment } from "@/lib/shop/quote";
import { settleShopPayment } from "@/lib/shop/settle";
import { getConnection } from "@/lib/solana/connection";
import { explorerUrl } from "@/lib/solana/explorer";
import { keypairFromEnv } from "@/lib/solana/keys";
import { usdcMint } from "@/lib/solana/mint";
import { TxError } from "@/lib/solana/tx";
import { countSponsoredToday, SPONSORED_PER_DAY, startOfTodayIso } from "@/lib/sponsor/policy";
import { issuePreparedToken, messageHashOf, verifyPreparedToken } from "@/lib/sponsor/prepared";
import { reasonFor } from "@/lib/sponsor/reasons";
import { getSqrilClient } from "@/lib/sqril/config";
import { roleIdFor } from "@/lib/swig/wallet";

/** `retryable` means nothing moved and the same quote can be paid again with one tap. */
export type Failure = { ok: false; message: string; retryable?: boolean };

const QUOTE_GONE: Failure = { ok: false, message: "That quote is gone. Scan the shop's code again." };
const QUOTE_STALE: Failure = { ok: false, message: "That quote is about to time out. Scan the shop's code again." };
const TOOK_TOO_LONG: Failure = { ok: false, message: "That took too long. Tap Pay again.", retryable: true };
const NOT_PREPARED: Failure = { ok: false, message: "This isn't the payment we prepared. Scan the code again." };
const CHAIN_READ_FAILED: Failure = { ok: false, message: "Couldn't read your wallet on Solana just now. Try again in a moment.", retryable: true };
const ALREADY_STARTED: Failure = { ok: false, message: "This payment already started. Check your history before trying again." };

const MAX_QR_LENGTH = 4096;
/** Above this a local amount is a typo, not a purchase; corridor limits reject it anyway. */
const MAX_AMOUNT_LOCAL = 1_000_000_000;

type WalletRow = { swig_address: string; wallet_address: string };
type DeviceRow = { pubkey: string; role_id: number | null };

function walletNotReady(payer: Payer): Failure {
  return payer.kind === "kid"
    ? { ok: false, message: "Your Spend jar isn't ready yet. Ask a parent to finish setting up." }
    : { ok: false, message: "Your family wallet isn't set up yet. Start the family in Settings." };
}

async function loadPayment(supabase: SupabaseClient, txId: string, payer: Payer): Promise<ShopPaymentRow | null> {
  let query = supabase.from("shop_payments").select(SHOP_PAYMENT_COLUMNS).eq("sqril_tx_id", txId).eq("family_id", payer.familyId);
  query = payer.kind === "kid" ? query.eq("kid_id", payer.kidId) : query.is("kid_id", null);
  const { data } = await query.maybeSingle();
  return (data as ShopPaymentRow | null) ?? null;
}

async function spentTodayUnits(supabase: SupabaseClient, kidId: string, sinceIso: string): Promise<bigint> {
  const [{ data: events }, { data: inFlight }] = await Promise.all([
    supabase.from("events").select("amount_units").eq("kid_id", kidId).in("kind", ["sent", "shop_paid"]).gte("created_at", sinceIso),
    supabase.from("shop_payments").select("total_usd_units").eq("kid_id", kidId).in("status", ["paid_onchain", "processing"]).gte("created_at", sinceIso),
  ]);
  let total = 0n;
  for (const e of (events ?? []) as Array<{ amount_units: number | null }>) total += BigInt(e.amount_units ?? 0);
  for (const p of (inFlight ?? []) as Array<{ total_usd_units: number }>) total += BigInt(p.total_usd_units);
  return total;
}

/** The kid's live daily limit: a raise still inside its four hours does not count. */
async function dailyLimitUnits(supabase: SupabaseClient, kidId: string, now: Date): Promise<bigint> {
  const { data } = await supabase.from("limits").select("daily_limit_units,weekly_limit_units,approval_threshold_units,pending_raise").eq("kid_id", kidId).maybeSingle();
  const row = data ? limitRowFromDb(data as LimitRowDb) : defaultLimits("kid");
  return resolvePending(row, now).row.daily_limit_units;
}

/** Shop payments the fee payer has already sponsored today; countSponsoredToday only knows sends and funding. */
async function countShopSponsoredToday(supabase: SupabaseClient, userId: string, sinceIso: string): Promise<number> {
  const { count } = await supabase.from("shop_payments").select("id", { count: "exact", head: true }).eq("user_id", userId).not("signature", "is", null).gte("created_at", sinceIso);
  return count ?? 0;
}

async function familyTimezone(supabase: SupabaseClient, familyId: string): Promise<string> {
  const { data } = await supabase.from("families").select("timezone").eq("id", familyId).maybeSingle();
  return (data as { timezone: string } | null)?.timezone ?? "Asia/Kuching";
}

async function balanceOf(walletAddress: string): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(usdcMint(), new PublicKey(walletAddress), true);
  return getAccount(getConnection(), ata)
    .then((a) => a.amount)
    .catch(() => 0n);
}

/** The off-chain checks, shared by quote (so the payer hears early) and prepare (so nothing signs past them). */
async function checkCanPay(supabase: SupabaseClient, payer: Payer, totalUnits: bigint, walletAddress: string): Promise<Failure | null> {
  const now = new Date();
  const sinceIso = startOfTodayIso(now, await familyTimezone(supabase, payer.familyId));
  const [dailyLimit, spentToday, balance, sponsored, shopSponsored] = await Promise.all([
    payer.kind === "kid" ? dailyLimitUnits(supabase, payer.kidId, now) : Promise.resolve<bigint | null>(null),
    payer.kind === "kid" ? spentTodayUnits(supabase, payer.kidId, sinceIso) : Promise.resolve(0n),
    balanceOf(walletAddress),
    countSponsoredToday(supabase, payer.userId),
    countShopSponsoredToday(supabase, payer.userId, sinceIso),
  ]);
  const decision = decideShopPayment({
    totalUnits,
    dailyLimitUnits: dailyLimit,
    spentTodayUnits: spentToday,
    balanceUnits: balance,
    sponsoredToday: sponsored + shopSponsored,
    sponsoredPerDay: SPONSORED_PER_DAY,
    walletLabel: payerWalletLabel(payer),
  });
  return decision.ok ? null : { ok: false, message: decision.message };
}

/** The wallet the payer pays from: a kid's Spend jar, or the family wallet. */
async function payingWallet(supabase: SupabaseClient, payer: Payer): Promise<WalletRow | null> {
  const query = supabase.from("wallets").select("swig_address,wallet_address");
  const { data } = payer.kind === "kid" ? await query.eq("kid_id", payer.kidId).eq("kind", "spend").maybeSingle() : await query.eq("family_id", payer.familyId).eq("kind", "family").maybeSingle();
  return (data as WalletRow | null) ?? null;
}

/**
 * Where the money goes on-chain. A kid's payment lands in the family
 * treasury (the family settles with Edventures). A parent pays from that
 * treasury, so theirs goes to the settlement address: SHOP_SETTLEMENT_ADDRESS,
 * or the fee payer's own wallet when that is not set.
 */
async function destinationFor(supabase: SupabaseClient, payer: Payer): Promise<PublicKey | Failure> {
  if (payer.kind === "kid") {
    const { data: treasury } = await supabase.from("wallets").select("wallet_address").eq("family_id", payer.familyId).eq("kind", "family").maybeSingle();
    if (!treasury?.wallet_address) return { ok: false, message: "Your family wallet isn't set up yet. Ask a parent." };
    return new PublicKey(treasury.wallet_address);
  }
  const configured = process.env.SHOP_SETTLEMENT_ADDRESS?.trim();
  try {
    return configured ? new PublicKey(configured) : keypairFromEnv("FEE_PAYER_SECRET_KEY").publicKey;
  } catch {
    return { ok: false, message: "Shop payments aren't set up on the server yet." };
  }
}

/** The device that signs: the kid's paired device, or the guardian's own registered device. */
async function signingDevice(supabase: SupabaseClient, payer: Payer): Promise<DeviceRow | null> {
  const query = supabase.from("devices").select("pubkey,role_id");
  const { data } =
    payer.kind === "kid"
      ? await query.eq("id", payer.deviceId).maybeSingle()
      : await query.eq("user_id", payer.userId).is("kid_id", null).eq("status", "active").limit(1).maybeSingle();
  return (data as DeviceRow | null) ?? null;
}

/** Whether this payer may pay shops at all. */
async function payEnabled(supabase: SupabaseClient, payer: Payer): Promise<Failure | null> {
  if (payer.kind === "guardian") return null; // The family's Sqril customer is the check; ensureSqrilCustomer says so.
  // Payments are opt-in per kid: a parent switches "Pay a shop" on in Settings.
  const { data: kidRow } = await supabase.from("kids").select("shop_pay_enabled").eq("id", payer.kidId).maybeSingle();
  return (kidRow as { shop_pay_enabled?: boolean } | null)?.shop_pay_enabled ? null : { ok: false, message: "Ask a parent to switch on shop payments for you." };
}

/** Decode and quote a scanned code. A ready quote is stored (status quoted) so prepare can trust its numbers. */
export async function quoteShopFor(supabase: SupabaseClient, payer: Payer, input: { qrString: string; amountLocal?: number }): Promise<ShopQuoteView> {
  const notEnabled = await payEnabled(supabase, payer);
  if (notEnabled) return notEnabled;
  const qrString = typeof input.qrString === "string" ? input.qrString.trim() : "";
  if (!qrString || qrString.length > MAX_QR_LENGTH) return { ok: false, message: "That code isn't a payment code." };
  if (input.amountLocal !== undefined && !(Number.isFinite(input.amountLocal) && input.amountLocal > 0 && input.amountLocal <= MAX_AMOUNT_LOCAL)) {
    return { ok: false, message: "Enter an amount above zero." };
  }

  const customer = await ensureSqrilCustomer(payer.familyId);
  if (!customer.ok) return customer;
  const quote = await quoteShopPayment({ qrString, customerId: customer.customerId, amountLocal: input.amountLocal });
  if ("ok" in quote) return { ok: false, message: quote.message };
  if (quote.needsAmount) return toQuoteView(quote);

  const existing = await loadPayment(supabase, quote.txId, payer);
  if (existing && existing.status !== "quoted") return { ok: false, message: "This code was already paid. Ask the shop for a fresh one." };
  const wallet = await payingWallet(supabase, payer);
  if (!wallet) return walletNotReady(payer);
  const blocked = await checkCanPay(supabase, payer, quote.totalUsdUnits, wallet.wallet_address);
  if (blocked) return blocked;

  const now = new Date().toISOString();
  const row = {
    family_id: payer.familyId,
    kid_id: payerKidId(payer),
    user_id: payer.userId,
    sqril_tx_id: quote.txId,
    merchant: quote.merchant,
    country: quote.country,
    currency: quote.currency,
    amount_local: quote.amountLocal,
    amount_usd_units: Number(quote.amountUsdUnits),
    fee_usd_units: Number(quote.feeUsdUnits),
    total_usd_units: Number(quote.totalUsdUnits),
    status: "quoted",
    signature: null,
    failure_reason: null,
    expires_at: quote.expiresAt,
    updated_at: now,
  };
  const { error } = existing ? await supabase.from("shop_payments").update(row).eq("id", existing.id) : await supabase.from("shop_payments").insert(row);
  if (error) return { ok: false, message: "Couldn't save the quote. Scan the code again." };
  return toQuoteView(quote);
}

/** Build the paying wallet → destination transfer for the stored quote; the device signs it next. */
export async function prepareShopPaymentFor(supabase: SupabaseClient, payer: Payer, input: { txId: string }): Promise<{ ok: true; token: string; txBase64: string; summary: string } | Failure> {
  const payment = await loadPayment(supabase, input.txId, payer);
  if (!payment) return QUOTE_GONE;
  if (payment.status !== "quoted") return ALREADY_STARTED;
  if (!isQuoteUsable(payment.expires_at, new Date())) return QUOTE_STALE;
  const units = BigInt(payment.total_usd_units);

  const [wallet, destination, device] = await Promise.all([payingWallet(supabase, payer), destinationFor(supabase, payer), signingDevice(supabase, payer)]);
  if (!wallet) return walletNotReady(payer);
  if (!(destination instanceof PublicKey)) return destination;
  if (!device?.pubkey || device.pubkey.startsWith("pending:")) {
    return payer.kind === "kid"
      ? { ok: false, message: "This device isn't approved yet. Ask a parent to approve it." }
      : { ok: false, message: "This device isn't a key on your wallet. Set it up in Settings first." };
  }

  const blocked = await checkCanPay(supabase, payer, units, wallet.wallet_address);
  if (blocked) return blocked;

  const connection = getConnection();
  const feePayer = keypairFromEnv("FEE_PAYER_SECRET_KEY");
  const mint = usdcMint();
  const owner = new PublicKey(wallet.wallet_address);
  const fromAta = getAssociatedTokenAddressSync(mint, owner, true);
  const toAta = getAssociatedTokenAddressSync(mint, destination, true);
  const tx = new Transaction();
  try {
    // The destination's token account is created inside the same verified, capped
    // transaction, never as a side effect of preparing one.
    const toAtaExists = await getAccount(connection, toAta).then(() => true).catch(() => false);
    const swig = await fetchSwig(connection, new PublicKey(wallet.swig_address));
    // The stored role id is the kid device's role on the spend jar; the chain is the fallback (and the parent's root role).
    const roleId = typeof device.role_id === "number" ? device.role_id : roleIdFor(swig, new PublicKey(device.pubkey));
    const transfer = createTransferInstruction(fromAta, toAta, owner, units, [], TOKEN_PROGRAM_ID);
    const ixs = await getSignInstructions(swig, roleId, [transfer], false, { payer: feePayer.publicKey });
    if (!toAtaExists) tx.add(createAssociatedTokenAccountIdempotentInstruction(feePayer.publicKey, toAta, destination, mint));
    tx.add(...ixs);
    tx.feePayer = feePayer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  } catch {
    return CHAIN_READ_FAILED;
  }

  const token = await issuePreparedToken({ userId: payer.userId, messageHash: messageHashOf(tx), purpose: "transfer" });
  return {
    ok: true,
    token,
    txBase64: bytesToBase64(new Uint8Array(tx.serialize({ requireAllSignatures: false, verifySignatures: false }))),
    summary: shopPaySummary(payment),
  };
}

/** Co-sign and send the device-signed transfer, then hand the payout to Sqril with the signature as its idempotency key. */
export async function submitShopPaymentFor(supabase: SupabaseClient, payer: Payer, input: { txId: string; token: string; signedTxBase64: string }): Promise<{ ok: true; txId: string; explorerUrl: string } | Failure> {
  const claims = await verifyPreparedToken(input.token);
  if (!claims || claims.userId !== payer.userId || claims.purpose !== "transfer") return TOOK_TOO_LONG;
  let tx: Transaction;
  try {
    tx = Transaction.from(base64ToBytes(input.signedTxBase64));
  } catch {
    return NOT_PREPARED;
  }
  // The fee payer co-signs only the exact message it prepared.
  if (messageHashOf(tx) !== claims.messageHash) return NOT_PREPARED;

  const payment = await loadPayment(supabase, input.txId, payer);
  if (!payment) return QUOTE_GONE;
  if (payment.status !== "quoted") return ALREADY_STARTED;
  if (!isQuoteUsable(payment.expires_at, new Date())) return QUOTE_STALE;
  const wallet = await payingWallet(supabase, payer);
  if (!wallet) return walletNotReady(payer);
  // The cap is enforced where the fee payer actually signs, not only at prepare time.
  const sinceIso = startOfTodayIso(new Date(), await familyTimezone(supabase, payer.familyId));
  if ((await countSponsoredToday(supabase, payer.userId)) + (await countShopSponsoredToday(supabase, payer.userId, sinceIso)) >= SPONSORED_PER_DAY) {
    return { ok: false, message: "You've done a lot today. More tomorrow." };
  }
  const customer = await ensureSqrilCustomer(payer.familyId);
  if (!customer.ok) return customer;

  const units = BigInt(payment.total_usd_units);
  const connection = getConnection();
  let signature: string;
  try {
    tx.partialSign(keypairFromEnv("FEE_PAYER_SECRET_KEY"));
    signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    const latest = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
  } catch (error) {
    // Nothing moved: the quote stays usable so "Try again" works.
    const balance = await balanceOf(wallet.wallet_address);
    const logs = error && typeof error === "object" && "logs" in error ? ((error as { logs?: string[] }).logs ?? []) : [];
    const wrapped = error instanceof TxError ? error : new TxError((error as Error).message, logs);
    const reason = reasonFor(wrapped, balance, units);
    const message = shopReasonMessage(reason.code);
    await supabase.from("shop_payments").update({ failure_reason: reason.code, updated_at: new Date().toISOString() }).eq("id", payment.id);
    await supabase.from("events").insert({ user_id: payer.userId, family_id: payer.familyId, kid_id: payerKidId(payer), kind: "blocked", amount_units: payment.total_usd_units, counterparty: payment.merchant, reason: reason.code, summary: message });
    // A rule said no: the same amount will be refused again, so no "Try again". A dropped
    // transaction is worth one more tap.
    return { ok: false, message, retryable: reason.code === "unknown" };
  }

  const nowIso = new Date().toISOString();
  const { data: marked, error: markError } = await supabase
    .from("shop_payments")
    .update({ status: "paid_onchain", signature, failure_reason: null, updated_at: nowIso })
    .eq("id", payment.id)
    .eq("status", "quoted")
    .select(SHOP_PAYMENT_COLUMNS)
    .maybeSingle();
  if (markError) console.error("shop.submit: paid on-chain but could not mark the row", payment.id, markError.message);
  const paid = (marked as ShopPaymentRow | null) ?? { ...payment, status: "paid_onchain" as const, signature, failure_reason: null };

  const advanced = await advanceWithSqril(supabase, paid, customer.customerId);
  if (advanced.status === "failed") return { ok: false, message: shopStatusMessage(advanced, payerWalletLabel(payer)) };
  return { ok: true, txId: payment.sqril_tx_id, explorerUrl: explorerUrl(signature, "tx") };
}

/**
 * Push an in-flight payment forward with Sqril. paid_onchain: hand over the
 * payout (idempotent by the signature, so a retry after a dropped call is
 * safe; "not pending" means Sqril already has it). processing: ask for the
 * outcome and settle it the way the webhook would. Sqril being unreachable
 * leaves the row where it is for the next poll; only a definite refusal
 * (no float, quote lapsed) settles it as failed.
 */
async function advanceWithSqril(supabase: SupabaseClient, payment: ShopPaymentRow, customerId: string | null): Promise<ShopPaymentRow> {
  let current = payment;
  if (current.status === "paid_onchain" && current.signature && customerId) {
    const executed = await executeShopPayment({
      txId: current.sqril_tx_id,
      customerId,
      amountLocal: Number(current.amount_local),
      currency: current.currency,
      idempotencyKey: current.signature,
    });
    if (executed.ok || executed.reason === "not_pending") {
      const { data } = await supabase.from("shop_payments").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", current.id).eq("status", "paid_onchain").select(SHOP_PAYMENT_COLUMNS).maybeSingle();
      current = (data as ShopPaymentRow | null) ?? { ...current, status: "processing" };
    } else if (executed.reason === "unavailable") {
      return current;
    } else {
      // The money reached the destination but Sqril will not pay the shop: event + refund seam.
      const settled = await settleShopPayment(supabase, { txId: current.sqril_tx_id, outcome: "failed", reason: executed.reason });
      return settled.payment ?? current;
    }
  }
  if (current.status === "processing") {
    const client = getSqrilClient();
    if (client) {
      try {
        const { transaction } = await client.getTransaction(current.sqril_tx_id);
        const outcome = webhookOutcome(transaction.status ?? "");
        if (outcome) {
          const settled = await settleShopPayment(supabase, { txId: current.sqril_tx_id, outcome, reason: outcome === "failed" ? "sqril_reported_failed" : null });
          if (settled.payment) current = settled.payment;
        }
      } catch {
        // Sqril unreachable right now: report what we know and let the next poll try again.
      }
    }
  }
  return current;
}

/**
 * Where the payment is, for the screen to poll. An in-flight row is nudged
 * forward with Sqril first, so a dropped executePayout call or a missed
 * webhook (or mock mode, which has none) still finishes.
 */
export async function getShopPaymentStatusFor(supabase: SupabaseClient, payer: Payer, txId: string): Promise<ShopPaymentStatusView | Failure> {
  let payment = await loadPayment(supabase, txId, payer);
  if (!payment) return QUOTE_GONE;

  if (payment.status === "paid_onchain" || payment.status === "processing") {
    let customerId: string | null = null;
    if (payment.status === "paid_onchain") {
      const customer = await ensureSqrilCustomer(payer.familyId);
      customerId = customer.ok ? customer.customerId : null;
    }
    payment = await advanceWithSqril(supabase, payment, customerId);
  }
  return toStatusView(payment, payment.signature ? explorerUrl(payment.signature, "tx") : null, payerWalletLabel(payer));
}
