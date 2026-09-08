import { afterEach, describe, expect, it } from "vitest";
import { appHref, appOrigin } from "@/lib/marketing/links";

const saved = process.env.NEXT_PUBLIC_APP_ORIGIN;
afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  else process.env.NEXT_PUBLIC_APP_ORIGIN = saved;
});

describe("appOrigin", () => {
  it("is the app's own origin, with no trailing slash, when set", () => {
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://edventures-wallet.vercel.app/";
    expect(appOrigin()).toBe("https://edventures-wallet.vercel.app");
    expect(appHref("/login")).toBe("https://edventures-wallet.vercel.app/login");
  });

  it("falls back to the local dev server, so link previews and share images still resolve to a real URL", () => {
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(appOrigin()).toBe("http://localhost:3000");
    expect(appHref("/login")).toBe("/login");
  });
});
