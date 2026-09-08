"use server";

// The kid "pay a shop" flow: every action is gated on an active kid device,
// then handed to the shared core (lib/shop/pay-core.ts) as a kid payer.

import { getFamilyContext } from "@/lib/family/session";
import type { ShopPaymentStatusView, ShopQuoteView } from "@/lib/shop/flow";
import { getShopPaymentStatusFor, prepareShopPaymentFor, quoteShopFor, submitShopPaymentFor, type Failure } from "@/lib/shop/pay-core";
import type { Payer } from "@/lib/shop/payer";
import { createClient } from "@/lib/supabase/server";

const NOT_A_KID: Failure = { ok: false, message: "Paying a shop works on a paired kid device. Ask a parent to invite you." };

async function kidPayer(): Promise<Payer | null> {
  const ctx = await getFamilyContext();
  return ctx.kind === "kid" ? { kind: "kid", familyId: ctx.familyId, userId: ctx.userId, kidId: ctx.kidId, deviceId: ctx.deviceId } : null;
}

export async function quoteShop(input: { qrString: string; amountLocal?: number }): Promise<ShopQuoteView> {
  const payer = await kidPayer();
  if (!payer) return NOT_A_KID;
  return quoteShopFor(await createClient(), payer, input);
}

export async function prepareShopPayment(input: { txId: string }): Promise<{ ok: true; token: string; txBase64: string; summary: string } | Failure> {
  const payer = await kidPayer();
  if (!payer) return NOT_A_KID;
  return prepareShopPaymentFor(await createClient(), payer, input);
}

export async function submitShopPayment(input: { txId: string; token: string; signedTxBase64: string }): Promise<{ ok: true; txId: string; explorerUrl: string } | Failure> {
  const payer = await kidPayer();
  if (!payer) return NOT_A_KID;
  return submitShopPaymentFor(await createClient(), payer, input);
}

export async function getShopPaymentStatus(txId: string): Promise<ShopPaymentStatusView | Failure> {
  const payer = await kidPayer();
  if (!payer) return NOT_A_KID;
  return getShopPaymentStatusFor(await createClient(), payer, txId);
}
