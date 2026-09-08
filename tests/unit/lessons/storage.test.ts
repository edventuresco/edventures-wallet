// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getCompletedLessonIds, markLessonComplete } from "@/lib/lessons/storage";

const KEY = "edventures-wallet.lessons";
const LEGACY_KEY = "keluwa.lessons";

// This jsdom does not provide localStorage (see PayShopFlow.test.tsx), so
// the test supplies a small in-memory one.
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

describe("lesson storage", () => {
  beforeEach(() => Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true }));

  it("remembers completion under the current key", () => {
    markLessonComplete("safe-sending");
    expect(getCompletedLessonIds()).toEqual(["safe-sending"]);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ completed: ["safe-sending"] });
  });

  it("reads progress saved under the pre-rename key", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ completed: ["safe-sending"] }));
    expect(getCompletedLessonIds()).toEqual(["safe-sending"]);
  });

  it("carries pre-rename progress over on the next write and drops the old key", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ completed: ["safe-sending"] }));
    markLessonComplete("what-is-a-wallet");
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ completed: ["safe-sending", "what-is-a-wallet"] });
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it("prefers the current key when both exist", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ completed: ["old"] }));
    window.localStorage.setItem(KEY, JSON.stringify({ completed: ["new"] }));
    expect(getCompletedLessonIds()).toEqual(["new"]);
  });
});
