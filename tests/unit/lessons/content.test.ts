import { describe, expect, it } from "vitest";
import { LESSONS, lessonById } from "@/lib/lessons/content";

describe("LESSONS", () => {
  it("has the two expected lessons", () => {
    expect(LESSONS.map((lesson) => lesson.id).sort()).toEqual(["before-you-send", "spot-a-scam"]);
  });

  it("gives every lesson exactly three steps", () => {
    for (const lesson of LESSONS) {
      expect(lesson.steps).toHaveLength(3);
      for (const step of lesson.steps) {
        expect(step.heading.length).toBeGreaterThan(0);
        expect(step.body.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every question exactly three options with a correctIndex in range", () => {
    for (const lesson of LESSONS) {
      expect(lesson.question.options).toHaveLength(3);
      expect(lesson.question.correctIndex).toBeGreaterThanOrEqual(0);
      expect(lesson.question.correctIndex).toBeLessThan(lesson.question.options.length);
      expect(lesson.question.explain.length).toBeGreaterThan(0);
      expect(lesson.question.prompt.length).toBeGreaterThan(0);
    }
  });

  it("gives every lesson a positive duration", () => {
    for (const lesson of LESSONS) {
      expect(lesson.minutes).toBeGreaterThan(0);
    }
  });

  it("never says 'password' anywhere; Edventures Wallet has none", () => {
    const text = JSON.stringify(LESSONS).toLowerCase();
    expect(text).not.toContain("password");
  });

  it("never says 'something went wrong'", () => {
    const text = JSON.stringify(LESSONS).toLowerCase();
    expect(text).not.toContain("something went wrong");
  });
});

describe("lessonById", () => {
  it("finds a lesson by id", () => {
    expect(lessonById("before-you-send")?.title).toBe("Before you send");
  });

  it("returns undefined for an unknown id", () => {
    expect(lessonById("not-a-real-lesson")).toBeUndefined();
  });
});
