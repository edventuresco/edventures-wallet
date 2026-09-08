import { dollarsToUnits } from "@/lib/money/usdc";

/** Defaults from the Q&A with Britt (Sept 7). Every one is guardian-editable in the app. */
export const DEFAULTS = {
  kidDailyUnits: dollarsToUnits("50"),
  kidWeeklyUnits: dollarsToUnits("100"),
  guardianDailyUnits: dollarsToUnits("1000"),
  guardianWeeklyUnits: dollarsToUnits("7000"),
  approvalThresholdUnits: dollarsToUnits("20"),
  perContactWeeklyUnits: dollarsToUnits("50"),
  split: { spend: 50, save: 40, share: 10 },
  /** Jar transfers (spend → save / share) get a generous on-chain cap. */
  jarWeeklyUnits: dollarsToUnits("500"),
  /** The keeper (the server's fee payer) may move this much a week out of the family wallet for allowances. */
  keeperWeeklyUnits: dollarsToUnits("200"),
  raiseDelayMs: 4 * 60 * 60 * 1000,
  timezone: "Asia/Kuching",
} as const;

// Age, allowance and the Monday schedule live in lib/rules/allowance (timezone-aware).
export { ageFromBirth, defaultAllowanceUnits, nextMondayAt } from "@/lib/rules/allowance";

