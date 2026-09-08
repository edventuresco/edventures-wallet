import { BookOpen, Check } from "lucide-react";
import { ProgressBar } from "./ProgressBar";
import { PrimaryButton } from "./PrimaryButton";

/**
 * One lesson idea (spec: "LessonCard"): estimated duration, progress, and a
 * single start/continue CTA. Completion is shown with a check plus text,
 * never color alone.
 */
export type LessonCardProps = {
  title: string;
  /** e.g. "5 minutes". */
  durationLabel: string;
  /** 0-100; ignored once `completed` is true. */
  progress: number;
  /** Live text for the bar, e.g. "2 of 3 steps". */
  progressLabel: string;
  /** True once the lesson is finished; swaps the CTA for a completion line. */
  completed?: boolean;
  ctaLabel: string;
  onAction?: () => void;
  className?: string;
};

export function LessonCard({
  title,
  durationLabel,
  progress,
  progressLabel,
  completed = false,
  ctaLabel,
  onAction,
  className,
}: LessonCardProps) {
  return (
    <article
      className={`rounded-[22px] border border-sand-dark bg-white p-5 shadow-[0_8px_28px_rgba(34,31,26,0.08)] ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-ink/50">
        <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
        <span>{durationLabel}</span>
      </div>

      <h3 className="mt-2 font-display text-xl font-semibold text-forest">{title}</h3>

      <div className="mt-4">
        <ProgressBar value={completed ? 100 : progress} valueLabel={progressLabel} />
      </div>

      <div className="mt-5">
        {completed ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-[#4E7657]">
            <Check size={18} strokeWidth={2.5} aria-hidden="true" />
            Lesson complete
          </p>
        ) : (
          <PrimaryButton onClick={onAction}>{ctaLabel}</PrimaryButton>
        )}
      </div>
    </article>
  );
}
