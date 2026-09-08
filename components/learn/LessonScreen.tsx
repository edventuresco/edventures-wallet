"use client";

import Link from "next/link";
import { LessonPlayer } from "@/components/learn/LessonPlayer";
import { markLessonComplete } from "@/lib/lessons/storage";

/** Plays one lesson and remembers completion locally once it's answered. */
export function LessonScreen({ lessonId, title }: { lessonId: string; title: string }) {
  return (
    <div className="space-y-6">
      <Link href="/learn" className="inline-block text-sm font-semibold text-kid-green/70">
        ← Learn
      </Link>
      <h1 className="font-display text-2xl text-kid-green">{title}</h1>
      <LessonPlayer lessonId={lessonId} onComplete={markLessonComplete} />
    </div>
  );
}
