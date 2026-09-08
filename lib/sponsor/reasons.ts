import { TxError } from "@/lib/solana/tx";

export type ReasonCode = "not_on_list" | "over_person_limit" | "over_daily_limit" | "not_enough_money" | "unknown";

const MESSAGES: Record<ReasonCode, string> = {
  not_on_list: "That person isn't on your list yet. Ask a parent to add them.",
  over_person_limit: "That's more than you can send to this person this week.",
  over_daily_limit: "That's more than your limit for today. Try again tomorrow.",
  not_enough_money: "You don't have enough for that yet.",
  unknown: "That didn't go through. Nothing was sent. Try again in a moment.",
};

export function reasonFor(error: unknown, balanceUnits: bigint, amountUnits: bigint): { code: ReasonCode; message: string } {
  let code: ReasonCode = "unknown";
  if (error instanceof TxError) {
    const swig = error.swigErrorCode;
    if (swig === 3006) code = "not_on_list";
    else if (swig === 3032) code = "over_person_limit";
    else if (error.logs.some((l) => /insufficient funds/i.test(l))) code = balanceUnits >= amountUnits ? "over_daily_limit" : "not_enough_money";
  }
  return { code, message: MESSAGES[code] };
}
