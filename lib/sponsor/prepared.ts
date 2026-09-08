import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { VersionedTransaction, type Transaction } from "@solana/web3.js";

export type PreparedPurpose = "transfer" | "share" | "approve_device" | "allowance" | "rule_update" | "jar_move" | "swap";
const PURPOSES: PreparedPurpose[] = ["transfer", "share", "approve_device", "allowance", "rule_update", "jar_move", "swap"];
export type PreparedClaims = { userId: string; messageHash: string; purpose: PreparedPurpose };

function secret(): Uint8Array {
  const value = process.env.PREPARED_TX_SECRET;
  if (!value || value.length < 32) throw new Error("PREPARED_TX_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(value);
}

/** SHA-256 of the transaction message: what signatures cover, without the signatures. */
export function messageHashOf(tx: Transaction | VersionedTransaction): string {
  const message = tx instanceof VersionedTransaction ? tx.message.serialize() : tx.serializeMessage();
  return createHash("sha256").update(message).digest("hex");
}

/** Two minutes: a blockhash lasts about that long anyway. */
export async function issuePreparedToken(claims: PreparedClaims): Promise<string> {
  return new SignJWT({ ...claims }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").sign(secret());
}

export async function verifyPreparedToken(token: string): Promise<PreparedClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || typeof payload.messageHash !== "string" || !PURPOSES.includes(payload.purpose as PreparedPurpose)) return null;
    return { userId: payload.userId, messageHash: payload.messageHash, purpose: payload.purpose as PreparedPurpose };
  } catch {
    return null;
  }
}
