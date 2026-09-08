import { ReceiveScreen } from "@/components/wallet/ReceiveScreen";
import { getReceiveState } from "./actions";

export const metadata = { title: "Receive" };
export const dynamic = "force-dynamic";

export default async function ReceivePage() {
  const state = await getReceiveState();
  return <ReceiveScreen state={state} />;
}
