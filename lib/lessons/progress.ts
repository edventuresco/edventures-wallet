/**
 * Pure helpers for stepping through a lesson. No I/O here; see
 * lib/lessons/storage.ts for where finished lessons get remembered.
 */

import { lessonById } from "@/lib/lessons/content";

export type LessonState = {
  lessonId: string;
  /** 0-based index into the lesson's steps. Equal to steps.length once the question is showing. */
  step: number;
  answered?: boolean;
  correct?: boolean;
};

/** Index at which the question shows, i.e. one past the last step. */
function questionIndex(lessonId: string): number {
  return lessonById(lessonId)?.steps.length ?? 0;
}

/** Advance to the next step. Stops once the question is reached; never advances past it. */
export function nextStep(state: LessonState): LessonState {
  const atQuestion = questionIndex(state.lessonId);
  if (state.step >= atQuestion) return state;
  return { ...state, step: state.step + 1 };
}

/** Record the picked option. Correctness is compared against the lesson's answer key. */
export function answer(state: LessonState, index: number): LessonState {
  const lesson = lessonById(state.lessonId);
  const correct = lesson?.question.correctIndex === index;
  return { ...state, answered: true, correct };
}

/** A lesson is complete once its question has been answered, right or wrong. */
export function isComplete(state: LessonState): boolean {
  return state.answered === true;
}
