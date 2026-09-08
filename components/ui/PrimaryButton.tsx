import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The one primary decision on a screen (spec: "PrimaryButton"). Full width,
 * 54px tall, terracotta fill, white label, 16px radius. Hover goes
 * terracotta-dark; a press nudges the label down 1px; disabled dims it.
 */
export type PrimaryButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  /** True while the action is in flight; disables the button and swaps in `loadingLabel`. */
  loading?: boolean;
  /** Copy shown instead of `children` while `loading` is true, e.g. "Adding to Japan together…". */
  loadingLabel?: string;
};

export function PrimaryButton({
  children,
  loading = false,
  loadingLabel,
  disabled,
  className,
  type = "button",
  ...rest
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`flex h-[54px] w-full items-center justify-center rounded-2xl bg-terracotta px-6 text-base font-semibold text-white transition-[background-color,transform] duration-200 ease-out hover:bg-terracotta-dark active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0 ${className ?? ""}`}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
