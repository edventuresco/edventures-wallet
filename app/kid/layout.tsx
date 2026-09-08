import { KidShell } from "@/components/kid/KidShell";

export const metadata = { title: "Kid" };

export default function KidLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <KidShell>{children}</KidShell>;
}
