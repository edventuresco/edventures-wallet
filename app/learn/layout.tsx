import { KidShell } from "@/components/kid/KidShell";

/** Lessons live on the kid side: same shell, same palette, same bottom nav once paired. */
export default function LearnLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <KidShell>{children}</KidShell>;
}
