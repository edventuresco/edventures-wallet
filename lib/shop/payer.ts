/**
 * Who is paying a shop. A kid pays from their Spend jar under their daily
 * limit, and the money lands in the family treasury; a parent pays from the
 * family wallet with no limit, and the money goes to the settlement
 * address (the family's account with Edventures, which prefunds Sqril).
 * Pure: the pay core resolves one of these from the session and everything
 * after that asks the payer rather than the session.
 */
export type Payer =
  | { kind: "kid"; familyId: string; userId: string; kidId: string; deviceId: string }
  | { kind: "guardian"; familyId: string; userId: string };

/** How copy refers to the paying wallet. */
export function payerWalletLabel(payer: Pick<Payer, "kind">): string {
  return payer.kind === "kid" ? "Spend jar" : "family wallet";
}

/** The kid on a payment row, or null for a parent's. */
export function payerKidId(payer: Payer): string | null {
  return payer.kind === "kid" ? payer.kidId : null;
}

/** Where the payer lands after paying. */
export function payerHome(payer: Pick<Payer, "kind">): string {
  return payer.kind === "kid" ? "/kid" : "/";
}
