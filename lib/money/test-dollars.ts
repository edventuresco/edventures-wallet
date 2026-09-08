// Devnet practice money. One amount, so the button, the action and the
// feed line agree; the wallet action mints it (app/wallet/actions.ts).

export const TEST_DOLLARS = "25";
export const TEST_DOLLARS_LABEL = `$${TEST_DOLLARS}`;

/** Whether the app runs on devnet, where test dollars can be minted. */
export function testDollarsAvailable(): boolean {
  return (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") === "devnet";
}
