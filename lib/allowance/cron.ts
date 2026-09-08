import { timingSafeEqual } from "node:crypto";

/**
 * The scheduled allowance run is a GET that only the scheduler may call.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` on every cron
 * invocation; anything else, or no configured secret at all, is refused.
 */
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
