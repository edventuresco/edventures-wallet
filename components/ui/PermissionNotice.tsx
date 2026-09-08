import { ShieldCheck } from "lucide-react";

/**
 * A plain-language permission statement (spec: "PermissionNotice"), e.g.
 * "Maya approves every change." Limits, recovery, and reversibility text
 * sit behind a native `<details>` disclosure rather than cluttering the
 * primary sentence.
 */
export type PermissionNoticeProps = {
  /** One plain-language sentence, e.g. "Maya approves every change." */
  message: string;
  /** Disclosure trigger text. Defaults to "Limits and recovery". */
  detailsLabel?: string;
  /** Body shown when the disclosure is open: limits, recovery, reversibility. */
  detailsText: string;
  /** Surface tint: sand-dark (default) or pale green. */
  tone?: "sand" | "green";
  className?: string;
};

export function PermissionNotice({
  message,
  detailsLabel = "Limits and recovery",
  detailsText,
  tone = "sand",
  className,
}: PermissionNoticeProps) {
  const surface = tone === "green" ? "bg-sage/15" : "bg-sand-dark/60";

  return (
    <section className={`rounded-[20px] border border-sand-dark p-4 ${surface} ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-forest" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{message}</p>
          <details className="mt-2 text-sm text-ink/70">
            <summary className="cursor-pointer font-medium text-forest">{detailsLabel}</summary>
            <p className="mt-2">{detailsText}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
