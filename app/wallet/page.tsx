import { requireUser } from "@/lib/auth/session";
import { WalletScreen } from "@/components/wallet/WalletScreen";

export const metadata = { title: "Send" };

export default async function WalletPage() {
  const user = await requireUser();
  return <WalletScreen email={user.email} />;
}
