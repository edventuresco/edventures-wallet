import { describe, expect, it, vi } from "vitest";

// chooseSecret is pure; the module around it opens IndexedDB and calls a server action, neither of which exists here.
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) }));
vi.mock("@/lib/device/actions", () => ({ whoseDevice: async () => "free" }));

import { chooseSecret } from "@/lib/device/key";

const secret = (fill: number) => new Uint8Array(64).fill(fill);
const MINE = secret(1);
const LEGACY = secret(2);

describe("chooseSecret", () => {
  it("uses the account's own key when it has one, whatever the legacy slot holds", () => {
    expect(chooseSecret({ mine: MINE, legacy: LEGACY }, "other")).toEqual({ source: "mine", secret: MINE });
  });

  it("adopts the legacy key when it is this account's registered device: the browser that set the wallet up keeps its root", () => {
    expect(chooseSecret({ mine: undefined, legacy: LEGACY }, "mine")).toEqual({ source: "legacy", secret: LEGACY });
  });

  it("adopts a legacy key nobody has registered yet", () => {
    expect(chooseSecret({ mine: undefined, legacy: LEGACY }, "free")).toEqual({ source: "legacy", secret: LEGACY });
  });

  it("makes a new key rather than share another account's", () => {
    expect(chooseSecret({ mine: undefined, legacy: LEGACY }, "other")).toEqual({ source: "new" });
  });

  it("makes a new key when there is nothing stored, or what is stored is not a key", () => {
    expect(chooseSecret({ mine: undefined, legacy: undefined }, null)).toEqual({ source: "new" });
    expect(chooseSecret({ mine: new Uint8Array(10), legacy: new Uint8Array(3) }, "mine")).toEqual({ source: "new" });
  });
});
