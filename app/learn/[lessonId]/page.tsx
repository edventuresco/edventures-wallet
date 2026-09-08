import { notFound } from "next/navigation";
import { LessonScreen } from "@/components/learn/LessonScreen";
import { lessonById } from "@/lib/lessons/content";

type Params = { lessonId: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { lessonId } = await params;
  return { title: lessonById(lessonId)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { lessonId } = await params;
  const lesson = lessonById(lessonId);
  if (!lesson) notFound();

  return <LessonScreen lessonId={lesson.id} title={lesson.title} />;
}
