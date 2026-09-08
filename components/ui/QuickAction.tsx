import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * A circular 48px icon button with a 13-14px label beneath it (spec:
 * "QuickAction"). `QuickActionRow` lays out up to three of these, matching
 * the family-home row: Add money, Send, Save.
 */
export type QuickActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
};

export function QuickAction({ icon: Icon, label, className, type = "button", ...rest }: QuickActionProps) {
  return (
    <button
      type={type}
      className={`flex w-16 flex-col items-center gap-2 disabled:opacity-40 ${className ?? ""}`}
      aria-label={label}
      {...rest}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-white shadow-[0_8px_28px_rgba(34,31,26,0.08)]">
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="text-[13px] font-medium leading-tight text-ink/80">{label}</span>
    </button>
  );
}

export type QuickActionRowProps = {
  /** Up to three actions; extras are ignored (spec caps this row at three). */
  actions: QuickActionProps[];
};

/** Lays out up to three `QuickAction`s in a centered row. */
export function QuickActionRow({ actions }: QuickActionRowProps) {
  return (
    <div className="flex items-start justify-center gap-8">
      {actions.slice(0, 3).map(({ label, ...action }) => (
        <QuickAction key={label} label={label} {...action} />
      ))}
    </div>
  );
}
