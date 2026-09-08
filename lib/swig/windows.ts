import type { Connection } from "@solana/web3.js";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Solana is moving slot time from 400 ms toward 200 ms (SIMD-0525). A window
 * is a fixed slot count, so as slots get faster a spend limit resets more
 * often. Sizing for the floor keeps caps conservative.
 */
export const SLOT_MS_FLOOR = 200;

export function slotsFor(durationMs: number, slotMs: number): bigint {
  if (!(durationMs > 0) || !(slotMs > 0)) {
    throw new Error(`slotsFor: durationMs and slotMs must be positive (got ${durationMs}, ${slotMs})`);
  }
  return BigInt(Math.ceil(durationMs / slotMs));
}

/** Window for a recurring spend limit: assume slots at least as fast as the floor. */
export function spendWindowSlots(durationMs: number, measuredSlotMs: number): bigint {
  return slotsFor(durationMs, Math.min(measuredSlotMs, SLOT_MS_FLOOR));
}

/**
 * Average slot time over the last `sampleSlots` slots, from block timestamps.
 * Walks back over skipped slots (no block time) up to 32 times.
 */
export async function measureSlotMs(connection: Connection, sampleSlots = 5_000): Promise<number> {
  const now = await connection.getSlot("finalized");
  const nowTime = await blockTimeNear(connection, now);
  const then = await blockTimeNear(connection, now - sampleSlots);
  const ms = ((nowTime.time - then.time) * 1000) / (nowTime.slot - then.slot);
  if (!(ms > 50 && ms < 2000)) {
    throw new Error(`measureSlotMs: implausible slot time ${ms} ms`);
  }
  return ms;
}

async function blockTimeNear(connection: Connection, slot: number): Promise<{ slot: number; time: number }> {
  for (let s = slot; s > slot - 32; s--) {
    const time = await connection.getBlockTime(s);
    if (time !== null) return { slot: s, time };
  }
  throw new Error(`No block time near slot ${slot}`);
}
