import { PayFlow } from "@/components/wallet/PayFlow";

export const metadata = { title: "Pay a shop" };

/** A parent pays a shop from the family wallet. The shell already sent a kid device to its own home. */
export default function PayPage() {
  return <PayFlow />;
}
