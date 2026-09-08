import { Bell, Check, ShieldCheck, ShoppingCart, type LucideIcon } from "lucide-react";

/** The interaction states every money-moving component must support (spec section 6). */
export type MoneyMovingStatus =
  | "idle"
  | "pressed"
  | "loading"
  | "success"
  | "needs_approval"
  | "scheduled"
  | "failed_recoverable"
  | "blocked_by_rule";

/**
 * Renders one money-moving interaction state with copy the caller supplies.
 * There is no generic fallback message baked in here on purpose: the spec
 * forbids "Something went wrong", so every state requires a specific
 * `message` (e.g. loading: "Adding to Japan together…", blocked_by_rule:
 * "This is over Eli's daily limit. Maya can raise it in Family.").
 */
export type MoneyStateProps = {
  status: MoneyMovingStatus;
  message: string;
  /** success only: a receipt/reference line, e.g. "Ref #A93F · Oct 2". */
  reference?: string;
  /** failed_recoverable only: label for the retry action. */
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

const ICONS: Partial<Record<MoneyMovingStatus, LucideIcon>> = {
  success: Check,
  needs_approval: ShieldCheck,
  scheduled: Bell,
  blocked_by_rule: ShoppingCart,
};

const TONE: Record<MoneyMovingStatus, string> = {
  idle: "text-ink/70",
  pressed: "text-ink/70",
  loading: "text-ink/70",
  success: "text-[#4E7657]",
  needs_approval: "text-forest",
  scheduled: "text-forest",
  failed_recoverable: "text-terracotta-dark",
  blocked_by_rule: "text-terracotta-dark",
};

export function MoneyState({ status, message, reference, retryLabel, onRetry, className }: MoneyStateProps) {
  const Icon = ICONS[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 text-sm font-medium ${TONE[status]} ${className ?? ""}`}
    >
      {status === "loading" && (
        <span
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      )}
      {Icon && <Icon size={18} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {status === "success" && reference && <p className="mt-0.5 text-xs text-ink/60">{reference}</p>}
        {status === "failed_recoverable" && retryLabel && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 text-sm font-semibold text-terracotta underline underline-offset-2"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
