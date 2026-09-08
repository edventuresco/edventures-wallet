import Image from "next/image";
import { ProgressBar } from "./ProgressBar";
import { PrimaryButton } from "./PrimaryButton";

/** One family member's avatar in a `GoalCard`'s participant row. */
export type GoalParticipant = {
  name: string;
  /** Image path; falls back to `emoji`, then the first letter of `name`. */
  src?: string;
  emoji?: string;
};

/**
 * A shared saving goal (spec: "GoalCard"): title, human description, an
 * amount/progress readout via `ProgressBar`, participant avatars, and one
 * action. The illustration slot is optional and never sits behind text.
 */
export type GoalCardProps = {
  title: string;
  /** e.g. "Different contributions. Same direction." */
  description: string;
  /** 0-100 */
  progress: number;
  /** Live text for the bar, e.g. "61%". */
  progressLabel: string;
  /** e.g. "$3,680 of $6,000". */
  amountLabel: string;
  participants: GoalParticipant[];
  actionLabel: string;
  onAction?: () => void;
  /** Optional hero illustration shown above the copy. */
  illustrationSrc?: string;
  className?: string;
};

export function GoalCard({
  title,
  description,
  progress,
  progressLabel,
  amountLabel,
  participants,
  actionLabel,
  onAction,
  illustrationSrc,
  className,
}: GoalCardProps) {
  return (
    <article
      className={`rounded-[22px] border border-sand-dark bg-white p-5 shadow-[0_8px_28px_rgba(34,31,26,0.08)] ${className ?? ""}`}
    >
      {illustrationSrc && (
        <div className="mb-4 overflow-hidden rounded-2xl bg-sand">
          <Image
            src={illustrationSrc}
            alt=""
            width={480}
            height={240}
            className="h-auto w-full object-contain"
          />
        </div>
      )}

      <h3 className="font-display text-xl font-semibold text-forest">{title}</h3>
      <p className="mt-1 text-sm text-ink/70">{description}</p>

      <div className="mt-4">
        <ProgressBar value={progress} valueLabel={progressLabel} />
        <p className="mt-1 text-sm font-medium text-ink/70">{amountLabel}</p>
      </div>

      {participants.length > 0 && (
        <ul className="mt-4 flex items-center -space-x-2">
          {participants.map((participant) => (
            <li key={participant.name}>
              <ParticipantAvatar participant={participant} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <PrimaryButton onClick={onAction}>{actionLabel}</PrimaryButton>
      </div>
    </article>
  );
}

function ParticipantAvatar({ participant }: { participant: GoalParticipant }) {
  const { name, src, emoji } = participant;
  return (
    <span
      title={name}
      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-sand-dark text-sm font-semibold text-forest"
    >
      {src ? (
        <Image src={src} alt={name} width={36} height={36} className="h-full w-full object-cover" />
      ) : emoji ? (
        <span aria-hidden="true">{emoji}</span>
      ) : (
        <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
