import type { PublicKey } from "@solana/web3.js";
import type { Actions } from "@swig-wallet/classic";
import { destinationLimitActions, type DestinationLimit } from "@/lib/swig/actions";

/**
 * What a kid's device may do on each of the kid's three wallets. Pure: no
 * chain, no env. Used when the device is first approved and again whenever
 * the guardian pushes changed rules on-chain.
 *
 * Spend: each contact within its weekly cap, both jars, and a daily total.
 * Save: back to spend only. Share: to contacts (the server enforces approval
 * before it co-signs); with an empty list, back to spend so the role is valid.
 */

export type WalletKind = "spend" | "save" | "share";

export type KidRolePlanInput = {
  mint: PublicKey;
  weeklySlots: bigint;
  dailySlots: bigint;
  atas: Record<WalletKind, PublicKey>;
  contactLimits: DestinationLimit[];
  dailyLimitUnits: bigint;
  jarWeeklyUnits: bigint;
};

export type KidRolePlan = { kind: WalletKind; actions: Actions };

/** Rules change what spend and share may do; save only ever sends back to spend. */
export const RULE_SYNC_WALLETS: readonly WalletKind[] = ["spend", "share"];

export function kidRolePlans(input: KidRolePlanInput): KidRolePlan[] {
  const { mint, weeklySlots, dailySlots, atas, contactLimits, dailyLimitUnits, jarWeeklyUnits } = input;
  const toSpend: DestinationLimit = { destinationAta: atas.spend, recurringAmount: jarWeeklyUnits };
  return [
    {
      kind: "spend",
      actions: destinationLimitActions({
        mint,
        windowSlots: weeklySlots,
        limits: [...contactLimits, { destinationAta: atas.save, recurringAmount: jarWeeklyUnits }, { destinationAta: atas.share, recurringAmount: jarWeeklyUnits }],
        dailyTotal: dailyLimitUnits,
        dailyWindowSlots: dailySlots,
      }),
    },
    { kind: "save", actions: destinationLimitActions({ mint, windowSlots: weeklySlots, limits: [toSpend] }) },
    { kind: "share", actions: destinationLimitActions({ mint, windowSlots: weeklySlots, limits: contactLimits.length ? contactLimits : [toSpend] }) },
  ];
}
