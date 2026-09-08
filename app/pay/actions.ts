"use server";

// A parent paying a shop from the family wallet: every action is gated on a
// guardian, then handed to the shared core (lib/shop/pay-core.ts) as a
// guardian payer. No daily limit; the money goes to the settlement address.

import { getFamilyContext } from "@/lib/family/session";
import type { ShopPaymentStatusView, ShopQuoteView } from "@/lib/shop/flow";
import { getShopPaymentStatusFor, prepareShopPaymentFor, quoteShopFor, submitShopPaymentFor, type Failure } from "@/lib/shop/pay-core";
import type { Payer } from "@/lib/shop/payer";
import { createClient } from "@/lib/supabase/server";

const NOT_A_GUARDIAN: Failure = { ok: false, message: "Paying from the family wallet is for a parent or guardian. Start your family in Settings first." };

async function guardianPayer(): Promise<Payer | null> {
  const ctx = await getFamilyContext();
  return ctx.kind === "guardian" ? { kind: "guardian", familyId: ctx.familyId, userId: ctx.userId } : null;
}

export async function quoteShop(input: { qrString: string; amountLocal?: number }): Promise<ShopQuoteView> {
  const payer = await guardianPayer();
  if (!payer) return NOT_A_GUARDIAN;
  return quoteShopFor(await createClient(), payer, input);
}

export async function prepareShopPayment(input: { txId: string }): Promise<{ ok: true; token: string; txBase64: string; summary: string } | Failure> {
  const payer = await guardianPayer();
  if (!payer) return NOT_A_GUARDIAN;
  return prepareShopPaymentFor(await createClient(), payer, input);
}

export async function submitShopPayment(input: { txId: string; token: string; signedTxBase64: string }): Promise<{ ok: true; txId: string; explorerUrl: string } | Failure> {
  const payer = await guardianPayer();
  if (!payer) return NOT_A_GUARDIAN;
  return submitShopPaymentFor(await createClient(), payer, input);
}

export async function getShopPaymentStatus(txId: string): Promise<ShopPaymentStatusView | Failure> {
  const payer = await guardianPayer();
  if (!payer) return NOT_A_GUARDIAN;
  return getShopPaymentStatusFor(await createClient(), payer, txId);
}
