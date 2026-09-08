import { GuardianShell } from "@/components/family/GuardianShell";

export const metadata = { title: "Family" };

/** Guardian pages: adult palette only. Kid colours never appear here. */
export default function FamilyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <GuardianShell>{children}</GuardianShell>;
}
