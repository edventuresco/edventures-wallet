/**
 * The rules seam. Every read or write of family rules goes through a
 * PolicyEngine. Screens never know which engine is active.
 *
 *  - "mock":     in-memory, for screen development and unit tests
 *  - "swig":     rules live on Solana as smart-wallet roles (the real one)
 *  - "postgres": rules enforced by our server only (fallback)
 */

export type PolicyEngineName = "mock" | "swig" | "postgres";

/** A Solana address as base58. */
export type Address = string;

export type KidRules = {
  /** Whitelist: the only addresses the kid may send to, each with a weekly cap in USDC base units. */
  weeklyLimitsByContact: Record<Address, bigint>;
  /** Program ids the kid's wallet may call (transfers need System + Token). */
  allowedPrograms: string[];
};

export type TransferRequest = {
  kidId: string;
  toAddress: Address;
  units: bigint;
  /** Injectable clock for tests. Defaults to Date.now(). */
  nowMs?: number;
};

export type TransferDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "not_on_list" | "over_limit" | "no_rules";
      /** Extra context for the kid-language explanation. */
      detail?: { limitUnits?: bigint; spentUnits?: bigint };
    };

export interface PolicyEngine {
  readonly name: PolicyEngineName;
  setRules(kidId: string, rules: KidRules): Promise<void>;
  getRules(kidId: string): Promise<KidRules | null>;
  /** Pre-flight check used to explain outcomes before or after a send. */
  checkTransfer(request: TransferRequest): Promise<TransferDecision>;
  /** Record a completed transfer so recurring limits can be tracked. */
  noteTransfer(request: TransferRequest): Promise<void>;
}
