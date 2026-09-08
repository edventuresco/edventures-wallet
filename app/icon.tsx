import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The favicon: the leaf mark from the landing page header, on a sand tile
// so it reads on light and dark tab strips alike. Drawn once at build time.

export const size = { width: 128, height: 128 };
export const contentType = "image/png";

export default async function Icon() {
  const leaf = await readFile(join(process.cwd(), "public", "illustrations", "edventures-wallet-leaf-mark.png"));
  const src = Uint8Array.from(leaf).buffer as unknown as string;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4ecdd", borderRadius: 28 }}>
        <img alt="" src={src} width={96} height={88} style={{ objectFit: "contain" }} />
      </div>
    ),
    size,
  );
}
