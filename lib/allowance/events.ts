import { splitSummary } from "@/lib/family/split";
import { unitsToDisplay } from "@/lib/money/usdc";
import type { AllowanceReceipt } from "./keeper";

/**
 * The two events a paid allowance leaves behind: the payment, and how it was
 * split across the jars. Pure; both the guardian's "Pay now" and the
 * scheduled run insert exactly these rows.
 */
export function allowanceEventRows(input: { userId: string; familyId: string; kidId: string; walletId: string | null; amountUnits: bigint; receipt: AllowanceReceipt }) {
  const base = {
    user_id: input.userId,
    family_id: input.familyId,
    kid_id: input.kidId,
    wallet_id: input.walletId,
    amount_units: Number(input.amountUnits),
    signature: input.receipt.signature,
  };
  return [
    { ...base, kind: "allowance", summary: `Allowance of ${unitsToDisplay(input.amountUnits)} paid` },
    { ...base, kind: "split", summary: splitSummary(input.receipt.split) },
  ];
}
