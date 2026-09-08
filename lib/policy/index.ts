import { MockPolicyEngine } from "./mock";
import type { PolicyEngine, PolicyEngineName } from "./types";

export type { KidRules, PolicyEngine, PolicyEngineName, TransferDecision, TransferRequest } from "./types";

let engine: PolicyEngine | null = null;

/** The active engine, chosen by POLICY_ENGINE (default "mock"). Server-side only. */
export function getPolicyEngine(): PolicyEngine {
  if (engine) return engine;
  const name = (process.env.POLICY_ENGINE ?? "mock") as PolicyEngineName;
  switch (name) {
    case "mock":
      engine = new MockPolicyEngine();
      return engine;
    case "swig":
    case "postgres":
      throw new Error(`POLICY_ENGINE="${name}" is not implemented yet; use "mock".`);
    default:
      throw new Error(`Unknown POLICY_ENGINE "${name}"`);
  }
}
