"use client";

import { useEffect, useRef, useState } from "react";
import type { Lesson, LessonStep } from "@/lib/lessons/content";
import { lessonById } from "@/lib/lessons/content";
import { answer, isComplete, nextStep, type LessonState } from "@/lib/lessons/progress";

const nextButton =
  "flex h-[54px] w-full items-center justify-center rounded-2xl bg-kid-orange text-lg font-semibold text-white transition-colors motion-reduce:transition-none active:translate-y-px motion-reduce:active:translate-y-0";

type Props = {
  lessonId: string;
  onComplete: (lessonId: string) => void;
};

/**
 * Plays one lesson: a step at a time, then a question, then the answer's
 * explanation and a done state. Reports back once the question is answered
 * so the caller can remember it (see lib/lessons/storage.ts).
 */
export function LessonPlayer({ lessonId, onComplete }: Props) {
  const lesson = lessonById(lessonId);
  const [state, setState] = useState<LessonState>({ lessonId, step: 0 });
  const notified = useRef(false);

  useEffect(() => {
    if (isComplete(state) && !notified.current) {
      notified.current = true;
      onComplete(lessonId);
    }
  }, [state, lessonId, onComplete]);

  if (!lesson) {
    return (
      <p className="rounded-2xl border border-sand-dark bg-white p-5 text-ink/80">
        We couldn&apos;t find that lesson. Head back to Learn and pick another one.
      </p>
    );
  }

  const atQuestion = state.step >= lesson.steps.length;

  if (atQuestion && state.answered) {
    return <DoneCard lesson={lesson} correct={state.correct === true} />;
  }

  if (atQuestion) {
    return (
      <QuestionCard
        lesson={lesson}
        onAnswer={(index) => setState((current) => answer(current, index))}
      />
    );
  }

  return (
    <StepCard
      step={lesson.steps[state.step]}
      stepNumber={state.step + 1}
      totalSteps={lesson.steps.length}
      onNext={() => setState((current) => nextStep(current))}
    />
  );
}

function Progress({ label }: { label: string }) {
  return <p className="text-sm font-semibold text-kid-green/70">{label}</p>;
}

function StepCard({
  step,
  stepNumber,
  totalSteps,
  onNext,
}: {
  step: LessonStep;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <Progress label={`Step ${stepNumber} of ${totalSteps}`} />
      <div className="space-y-3 rounded-3xl border border-sand-dark bg-white p-6">
        <h2 className="font-display text-2xl text-kid-green">{step.heading}</h2>
        <p className="text-lg leading-relaxed text-ink/85">{step.body}</p>
      </div>
      <button type="button" onClick={onNext} className={nextButton}>
        Next
      </button>
    </div>
  );
}

function QuestionCard({ lesson, onAnswer }: { lesson: Lesson; onAnswer: (index: number) => void }) {
  return (
    <div className="space-y-6">
      <Progress label="Quick check" />
      <div className="space-y-4 rounded-3xl border border-sand-dark bg-white p-6">
        <p className="text-lg leading-relaxed text-ink">{lesson.question.prompt}</p>
        <div className="space-y-3">
          {lesson.question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(index)}
              className="flex min-h-[54px] w-full items-center rounded-2xl border border-sand-dark bg-sand px-4 py-3 text-left text-base font-medium text-ink transition-colors hover:border-kid-orange motion-reduce:transition-none"
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DoneCard({ lesson, correct }: { lesson: Lesson; correct: boolean }) {
  return (
    <div className="space-y-6">
      <Progress label="All done" />
      <div className="space-y-3 rounded-3xl border border-sand-dark bg-white p-6">
        <p className="text-lg font-semibold text-kid-green">{correct ? "Yes, that's it." : "Good thinking to check."}</p>
        <p className="text-lg leading-relaxed text-ink/85">{lesson.question.explain}</p>
      </div>
      <div className="flex items-center gap-3 rounded-2xl bg-kid-sage/30 px-4 py-3 text-kid-green">
        <CheckIcon />
        <p className="font-semibold">You finished &ldquo;{lesson.title}&rdquo;.</p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
