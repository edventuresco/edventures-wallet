/**
 * Lesson completion, remembered in localStorage under "edventures-wallet.lessons".
 * Progress saved under the pre-rename key "keluwa.lessons" is read once and
 * carried over on the next write.
 *
 * TODO(backend): once a kid has an account, completion should live on the
 * server keyed by kid id, so it survives a new device and a parent can see
 * it too. This is a client-only stand-in until that lands.
 */

const STORAGE_KEY = "edventures-wallet.lessons";
const LEGACY_STORAGE_KEY = "keluwa.lessons";

type StoredProgress = { completed: string[] };

function readStorage(): StoredProgress {
  if (typeof window === "undefined") return { completed: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { completed: [] };
    const parsed: unknown = JSON.parse(raw);
    const completed =
      parsed && typeof parsed === "object" && Array.isArray((parsed as { completed?: unknown }).completed)
        ? (parsed as { completed: unknown[] }).completed.filter((id): id is string => typeof id === "string")
        : [];
    return { completed };
  } catch {
    return { completed: [] };
  }
}

function writeStorage(progress: StoredProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private browsing, quota). Completion
    // just won't be remembered for next time; nothing else depends on it.
  }
}

export function getCompletedLessonIds(): string[] {
  return readStorage().completed;
}

export function isLessonComplete(lessonId: string): boolean {
  return getCompletedLessonIds().includes(lessonId);
}

export function markLessonComplete(lessonId: string): void {
  const progress = readStorage();
  if (progress.completed.includes(lessonId)) return;
  writeStorage({ completed: [...progress.completed, lessonId] });
}
