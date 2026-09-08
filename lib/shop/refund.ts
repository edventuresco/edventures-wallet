/**
 * SEAM: refunding a shop payment that failed after the money moved.
 *
 * The kid's spend jar pays the family treasury on-chain first; if Sqril then
 * refuses or fails the payout, that USDC is sitting in the treasury. The
 * keeper role on the family wallet is meant to send it back to the kid's
 * spend jar within its on-chain cap. That wiring is not built yet: this
 * stub throws, callers catch and record that the refund is still owed, and
 * the kid-facing copy says a parent can move it back.
 *
 * Replace the body, keep the shape: resolve with the refund's transaction
 * signature, throw on failure so the caller leaves the row marked failed.
 */
export type ShopRefund = {
  paymentId: string;
  familyId: string;
  kidId: string | null;
  /** USDC base units to send back: the total the kid paid, fee included. */
  amountUnits: bigint;
  /** The original spend jar → treasury signature, for the audit trail. */
  signature: string | null;
};

export async function refundShopPayment(refund: ShopRefund): Promise<{ signature: string }> {
  void refund;
  throw new Error("refundShopPayment: not implemented (keeper role refund is a TODO)");
}
