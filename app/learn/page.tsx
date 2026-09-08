import { LessonListItem } from "@/components/learn/LessonListItem";
import { LESSONS } from "@/lib/lessons/content";

export const metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl text-forest">Learn</h1>
        <p className="text-ink/70">Short lessons that help you use Edventures Wallet safely.</p>
      </header>
      <div className="space-y-4">
        {LESSONS.map((lesson) => (
          <LessonListItem key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </div>
  );
}
