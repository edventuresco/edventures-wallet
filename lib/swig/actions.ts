import type { PublicKey } from "@solana/web3.js";
import { Actions } from "@swig-wallet/classic";

export type DestinationLimit = {
  /** The recipient's token account for the mint (not their wallet address). */
  destinationAta: PublicKey;
  /** Base units per window. */
  recurringAmount: bigint;
};

/**
 * A role that may only send `mint` to the listed token accounts, each within
 * its own recurring cap. There is intentionally no general token limit: that
 * would let the role send to anyone.
 */
export function destinationLimitActions(input: {
  mint: PublicKey;
  windowSlots: bigint;
  limits: DestinationLimit[];
  /**
   * A general recurring cap across all destinations (the kid's daily limit).
   * Proven in the spike to leave the whitelist intact.
   */
  dailyTotal?: bigint;
  /** Window for the daily total; defaults to windowSlots. */
  dailyWindowSlots?: bigint;
}): Actions {
  if (input.limits.length === 0) {
    throw new Error("destinationLimitActions: need at least one destination");
  }
  // The token limits say how much may move; the role also needs leave to call the
  // token program at all. The SDK adds this on add-authority but not on update, so
  // it is explicit here: a rule sync that replaces the actions must keep it.
  const builder = Actions.set().programAll();
  for (const limit of input.limits) {
    builder.tokenRecurringDestinationLimit({
      mint: input.mint,
      recurringAmount: limit.recurringAmount,
      window: input.windowSlots,
      destination: limit.destinationAta,
    });
  }
  if (input.dailyTotal !== undefined) {
    builder.tokenRecurringLimit({
      mint: input.mint,
      recurringAmount: input.dailyTotal,
      window: input.dailyWindowSlots ?? input.windowSlots,
    });
  }
  return builder.get();
}

/** The parent's root role: everything, including managing authorities. */
export function rootActions(): Actions {
  return Actions.set().all().get();
}
