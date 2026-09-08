import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LANDING } from "@/lib/marketing/copy";

// The picture behind a shared link: the landing page's words (lib/marketing/copy.ts) on the left,
// the three phone screens on the right, on the dark ground the phone art
// already has. Built once at deploy time; Next serves it at /opengraph-image
// and puts its absolute URL (see metadataBase in layout.tsx) in og:image.

export const alt = `Edventures Wallet. ${LANDING.headline} Three phone screens: a family balance, a savings goal called Japan together, and a kid's fund.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A font file the renderer can read (TTF), kept in the repo so the build needs no network. */
async function font(file: string): Promise<ArrayBuffer> {
  const data = await readFile(join(process.cwd(), "assets", "fonts", file));
  return Uint8Array.from(data).buffer;
}

async function illustration(name: string): Promise<ArrayBuffer> {
  const data = await readFile(join(process.cwd(), "public", "illustrations", name));
  return Uint8Array.from(data).buffer;
}

export default async function Image() {
  const [fraunces, inter, phones, leaf] = await Promise.all([font("Fraunces-SemiBold.ttf"), font("Inter-Regular.ttf"), illustration("hero-phone-cluster.png"), illustration("edventures-wallet-leaf-mark.png")]);
  const fonts = [
    { name: "Fraunces", data: fraunces, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #10160f 0%, #1c2a1f 55%, #0f1511 100%)", color: "#f4ecdd", fontFamily: "Inter, sans-serif", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 520, padding: "0 0 0 64px", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img alt="" src={leaf as unknown as string} width={44} height={40} style={{ objectFit: "contain" }} />
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, letterSpacing: -0.3 }}>Edventures Wallet</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Fraunces, serif", fontSize: 60, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1 }}>{LANDING.headline}</div>
          <div style={{ display: "flex", fontSize: 24, lineHeight: 1.35, color: "rgba(244,236,221,0.82)" }}>{LANDING.subhead}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 20, color: "#e9c46a" }}>
            <span style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: "#c2693f" }} />
            {LANDING.tagline}
          </div>
        </div>
        <img alt="" src={phones as unknown as string} width={900} height={600} style={{ position: "absolute", right: -150, top: 15, objectFit: "contain" }} />
      </div>
    ),
    { ...size, fonts },
  );
}
