"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Lesson } from "@/lib/lessons/content";
import { isLessonComplete } from "@/lib/lessons/storage";

/** One LessonCard-like tile on the Learn list: title, minutes, and a start button. */
export function LessonListItem({ lesson }: { lesson: Lesson }) {
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    setComplete(isLessonComplete(lesson.id));
  }, [lesson.id]);

  return (
    <div className="space-y-4 rounded-3xl border border-sand-dark bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-kid-green">{lesson.title}</h2>
          <p className="mt-1 text-sm text-ink/70">{lesson.minutes} min</p>
        </div>
        {complete && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-kid-sage/30 px-3 py-1 text-xs font-semibold text-kid-green">
            <CheckIcon /> Done
          </span>
        )}
      </div>
      <Link
        href={`/learn/${lesson.id}`}
        className="flex h-[44px] w-full items-center justify-center rounded-2xl bg-kid-orange text-sm font-semibold text-white transition-colors motion-reduce:transition-none hover:brightness-95"
      >
        {complete ? "Review lesson" : "Start lesson"}
      </Link>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
