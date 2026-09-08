"use server";

import { feedItemFrom, type FeedEventRow, type FeedItem } from "@/lib/family/feed";
import { ownerNameOf } from "@/lib/family/owner";
import { getFamilyContext } from "@/lib/family/session";
import { testDollarsAvailable } from "@/lib/money/test-dollars";
import { toView, type MoneyView } from "@/lib/money/usdc";
import { currentFamily } from "@/lib/rules/family";
import { usdcBalanceOf } from "@/lib/solana/balance";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";

export type HomeState = {
  ownerName: string;
  /** Null until this account has a wallet. */
  balance: MoneyView | null;
  familyName: string | null;
  /** The owner's own moves: events with no kid on them. */
  transactions: FeedItem[];
  /** Devnet with a wallet: the home balance offers practice money. */
  canAddTestDollars: boolean;
};

const HOME_TRANSACTIONS = 10;

/** What the signed-in grown-up's home shows. Null when nobody is signed in. */
export async function getHomeState(): Promise<HomeState | null> {
  const user = await getUser();
  if (!user) return null;
  const ctx = await getFamilyContext();
  const supabase = await createClient();
  const ownerName = ownerNameOf(user);
  const [{ data: wallet }, family] = await Promise.all([
    supabase.from("wallets").select("wallet_address").eq("user_id", user.id).maybeSingle(),
    ctx.kind === "guardian" ? currentFamily(supabase) : Promise.resolve(null),
  ]);
  const [balance, { data: rows }] = await Promise.all([
    wallet ? usdcBalanceOf(wallet.wallet_address) : Promise.resolve<bigint | null>(null),
    supabase
      .from("events")
      .select("id,kid_id,kind,summary,signature,created_at")
      .eq("user_id", user.id)
      .is("kid_id", null)
      .order("created_at", { ascending: false })
      .limit(HOME_TRANSACTIONS),
  ]);
  const now = new Date();
  const timeZone = family?.timezone ?? "UTC";
  return {
    ownerName,
    balance: balance === null ? null : toView(balance),
    familyName: family?.name ?? null,
    transactions: ((rows as FeedEventRow[] | null) ?? []).map((row) => feedItemFrom(row, [], now, timeZone, { ownerName })),
    canAddTestDollars: Boolean(wallet) && testDollarsAvailable(),
  };
}
