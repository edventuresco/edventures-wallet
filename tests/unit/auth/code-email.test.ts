import { describe, expect, it } from "vitest";
import { displayCode, signInCodeEmail } from "@/lib/auth/code-email";

const loginUrl = "https://wallet.edventures.co/login";

describe("displayCode", () => {
  it("splits six digits into two groups", () => {
    expect(displayCode("123456")).toBe("123 456");
  });
  it("splits eight digits, the length this project's Supabase mints, the same way", () => {
    expect(displayCode("12345678")).toBe("1234 5678");
  });
  it("leaves odd or short codes alone", () => {
    expect(displayCode("1234567")).toBe("1234567");
    expect(displayCode("1234")).toBe("1234");
  });
});

describe("signInCodeEmail", () => {
  it("puts the code in the subject and both bodies, and never a link to sign in with", () => {
    const email = signInCodeEmail({ code: "483920", loginUrl });
    expect(email.subject).toBe("Your Edventures Wallet code is 483 920");
    expect(email.text).toContain("Your code: 483 920");
    expect(email.html).toContain("483 920");
    expect(email.text).toContain(loginUrl);
    expect(email.text).not.toMatch(/token|auth\/callback|confirm/i);
  });

  it("speaks to the kid by name on an invite", () => {
    const email = signInCodeEmail({ code: "000111", loginUrl, kidName: "Maya" });
    expect(email.subject).toBe("Maya, your Edventures Wallet code is 000 111");
    expect(email.text).toContain("Hi Maya!");
    expect(email.text).toContain("invited you");
    expect(email.html).toContain(`<a href="${loginUrl}">`);
  });

  it("escapes what goes into the html", () => {
    const email = signInCodeEmail({ code: "111222", loginUrl, kidName: "<b>Max</b>" });
    expect(email.html).not.toContain("<b>Max</b>");
    expect(email.html).toContain("&lt;b&gt;Max&lt;/b&gt;");
  });
});
