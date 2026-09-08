import Link from "next/link";

/**
 * A plain text link to Settings. Unstyled beyond the essentials so the host
 * screen picks the palette: pass the adult or kid classes as className.
 */
export function SettingsLink({ className }: { className?: string }) {
  return (
    <Link href="/settings" className={className ?? "text-sm font-semibold underline-offset-4 hover:underline"}>
      Settings
    </Link>
  );
}
