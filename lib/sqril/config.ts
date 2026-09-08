// Env-driven Sqril client factory. SQRIL_MOCK=true wins even when credentials
// exist (predictable local dev); credentials alone mean live staging; neither
// means unconfigured, and callers must fail closed rather than mock a
// payments API by accident.

import { HttpSqrilClient } from "./client";
import type { SqrilClient } from "./client";
import { MockSqrilClient } from "./mock";

export type SqrilMode = "mock" | "live" | "unconfigured";

export const SQRIL_STAGING_URL = "https://stg-api.sqril.io";

export function getSqrilMode(): SqrilMode {
  if (process.env.SQRIL_MOCK === "true") return "mock";
  if (process.env.SQRIL_CLIENT_ID && process.env.SQRIL_CLIENT_SECRET) return "live";
  return "unconfigured";
}

let cached: { mode: SqrilMode; client: SqrilClient } | null = null;

export function getSqrilClient(): SqrilClient | null {
  const mode = getSqrilMode();
  if (mode === "unconfigured") return null;
  if (cached?.mode === mode) return cached.client;
  const client =
    mode === "mock"
      ? new MockSqrilClient()
      : new HttpSqrilClient({
          baseUrl: process.env.SQRIL_BASE_URL || SQRIL_STAGING_URL,
          clientId: process.env.SQRIL_CLIENT_ID!,
          clientSecret: process.env.SQRIL_CLIENT_SECRET!,
        });
  cached = { mode, client };
  return client;
}
