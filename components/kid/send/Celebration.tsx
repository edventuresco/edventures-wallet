"use client";

/**
 * Step four of Send: a gentle moment, not a fireworks show. A check draws
 * itself in under 600ms and the card lifts like a leaf; reduced motion
 * shows the finished state straight away.
 */
export function Celebration({
  contactLabel,
  amountDisplay,
  explorerUrl,
  onHome,
  sentence,
}: {
  /** Replaces "Sent. X has your $Y.", e.g. for a share. */
  sentence?: string;
  contactLabel: string;
  amountDisplay: string;
  /** Small "proof" link for grown-ups; kids never see addresses. */
  explorerUrl?: string;
  onHome: () => void;
}) {
  return (
    <section className="space-y-6">
      <div className="flex animate-leaf-lift flex-col items-center gap-5 rounded-3xl bg-kid-sage/35 px-6 py-10 text-center motion-reduce:animate-none">
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          aria-hidden="true"
          className="drop-shadow-[0_6px_16px_rgba(39,102,60,0.18)]"
        >
          <circle cx="48" cy="48" r="44" fill="var(--color-white, #fffdf8)" stroke="var(--color-kid-green)" strokeWidth="4" />
          <path
            d="M28 50 L42 63 L68 35"
            fill="none"
            stroke="var(--color-kid-green)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            className="animate-check-draw motion-reduce:animate-none"
          />
        </svg>
        <p className="font-display text-[30px] font-semibold leading-9 text-kid-green tabular-nums">
          {sentence ?? `Sent. ${contactLabel} has your ${amountDisplay}.`}
        </p>
      </div>

      <button
        type="button"
        onClick={onHome}
        className="h-14 w-full rounded-2xl bg-kid-orange text-xl font-bold text-white transition-transform duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kid-orange/50 motion-reduce:transition-none"
      >
        Back home
      </button>

      {explorerUrl && (
        <p className="text-center">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-ink/45 underline-offset-2 hover:underline"
          >
            <span aria-hidden="true">🔎</span> Proof for grown-ups
          </a>
        </p>
      )}
    </section>
  );
}
