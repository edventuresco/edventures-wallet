import { describe, expect, it } from "vitest";
import { LESSONS } from "@/lib/lessons/content";
import { answer, isComplete, nextStep, type LessonState } from "@/lib/lessons/progress";

const lesson = LESSONS[0];
const questionIndex = lesson.steps.length;

describe("nextStep", () => {
  it("advances the step by one", () => {
    const state: LessonState = { lessonId: lesson.id, step: 0 };
    expect(nextStep(state).step).toBe(1);
    expect(nextStep(nextStep(state)).step).toBe(2);
  });

  it("stops at the question and does not go further", () => {
    const atQuestion: LessonState = { lessonId: lesson.id, step: questionIndex };
    expect(nextStep(atQuestion).step).toBe(questionIndex);
    expect(nextStep(nextStep(atQuestion)).step).toBe(questionIndex);
  });

  it("does not mutate the input state", () => {
    const state: LessonState = { lessonId: lesson.id, step: 0 };
    nextStep(state);
    expect(state.step).toBe(0);
  });
});

describe("answer", () => {
  it("marks the correct option as correct", () => {
    const state: LessonState = { lessonId: lesson.id, step: questionIndex };
    const result = answer(state, lesson.question.correctIndex);
    expect(result.answered).toBe(true);
    expect(result.correct).toBe(true);
  });

  it("marks any other option as incorrect, without blocking completion", () => {
    const state: LessonState = { lessonId: lesson.id, step: questionIndex };
    const wrongIndex = (lesson.question.correctIndex + 1) % lesson.question.options.length;
    const result = answer(state, wrongIndex);
    expect(result.answered).toBe(true);
    expect(result.correct).toBe(false);
  });
});

describe("isComplete", () => {
  it("is false before the question is answered", () => {
    expect(isComplete({ lessonId: lesson.id, step: 0 })).toBe(false);
    expect(isComplete({ lessonId: lesson.id, step: questionIndex })).toBe(false);
  });

  it("is true once answered, regardless of correctness", () => {
    expect(isComplete({ lessonId: lesson.id, step: questionIndex, answered: true, correct: true })).toBe(true);
    expect(isComplete({ lessonId: lesson.id, step: questionIndex, answered: true, correct: false })).toBe(true);
  });
});
