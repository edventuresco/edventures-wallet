import { GuardianShell } from "@/components/family/GuardianShell";

/** Settings is for everyone: a kid sees it in the adult palette, without the guardian footer. */
export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <GuardianShell kids="allow">{children}</GuardianShell>;
}
