import { GuardianShell } from "@/components/family/GuardianShell";

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <GuardianShell>{children}</GuardianShell>;
}
