"use server";

import QRCode from "qrcode";
import { requireUser } from "@/lib/auth/session";
import { usdcMint } from "@/lib/solana/mint";
import { createClient } from "@/lib/supabase/server";
import { receiveUri } from "@/lib/wallet/receive";

export type ReceiveState = {
  /** Null until this account has a wallet. */
  address: string | null;
  /** The QR as inline SVG markup, ready to drop in the page. */
  qrSvg: string | null;
};

/** The signed-in grown-up's wallet address and its QR. */
export async function getReceiveState(): Promise<ReceiveState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: wallet } = await supabase.from("wallets").select("wallet_address").eq("user_id", user.id).maybeSingle();
  if (!wallet) return { address: null, qrSvg: null };
  const qrSvg = await QRCode.toString(receiveUri(wallet.wallet_address, usdcMint().toBase58()), { type: "svg", margin: 1, color: { dark: "#2e4636", light: "#ffffff00" } });
  return { address: wallet.wallet_address, qrSvg };
}
