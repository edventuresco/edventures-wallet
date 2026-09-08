import type { KidRules, PolicyEngine, TransferDecision, TransferRequest } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Spend = { toAddress: string; units: bigint; atMs: number };

/**
 * In-memory engine with a rolling seven-day window per contact. Good enough
 * to build every screen and to test the explanations; not a source of truth.
 */
export class MockPolicyEngine implements PolicyEngine {
  readonly name = "mock" as const;
  private rules = new Map<string, KidRules>();
  private spends = new Map<string, Spend[]>();

  async setRules(kidId: string, rules: KidRules): Promise<void> {
    this.rules.set(kidId, rules);
  }

  async getRules(kidId: string): Promise<KidRules | null> {
    return this.rules.get(kidId) ?? null;
  }

  async checkTransfer(request: TransferRequest): Promise<TransferDecision> {
    const rules = this.rules.get(request.kidId);
    if (!rules) return { allowed: false, reason: "no_rules" };

    const limit = rules.weeklyLimitsByContact[request.toAddress];
    if (limit === undefined) return { allowed: false, reason: "not_on_list" };

    const spent = this.spentInWindow(request);
    if (spent + request.units > limit) {
      return { allowed: false, reason: "over_limit", detail: { limitUnits: limit, spentUnits: spent } };
    }
    return { allowed: true };
  }

  async noteTransfer(request: TransferRequest): Promise<void> {
    const list = this.spends.get(request.kidId) ?? [];
    list.push({ toAddress: request.toAddress, units: request.units, atMs: request.nowMs ?? Date.now() });
    this.spends.set(request.kidId, list);
  }

  private spentInWindow(request: TransferRequest): bigint {
    const now = request.nowMs ?? Date.now();
    const since = now - WEEK_MS;
    return (this.spends.get(request.kidId) ?? [])
      .filter((s) => s.toAddress === request.toAddress && s.atMs > since)
      .reduce((sum, s) => sum + s.units, 0n);
  }
}
