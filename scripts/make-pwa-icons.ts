// Draws the PWA icons from the leaf mark: `npm run icons`.
// Same picture as the favicon (app/icon.tsx): the leaf on a sand tile. The
// maskable one keeps the leaf inside Android's safe zone (the middle 80%).

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const SAND = "#f4ecdd";
const LEAF = join(process.cwd(), "public", "illustrations", "edventures-wallet-leaf-mark.png");

async function draw(size: number, leafScale: number, radius: number, out: string) {
  const leaf = Uint8Array.from(await readFile(LEAF)).buffer as unknown as string;
  const w = Math.round(size * leafScale);
  const h = Math.round(w * (1199 / 1312));
  const element = {
    type: "div",
    props: {
      style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: SAND, borderRadius: radius },
      children: { type: "img", props: { src: leaf, width: w, height: h, style: { objectFit: "contain" } } },
    },
  };
  const png = await new ImageResponse(element as unknown as React.ReactElement, { width: size, height: size }).arrayBuffer();
  await writeFile(join(process.cwd(), "public", out), Buffer.from(png));
  console.log(`wrote public/${out}`);
}

// Square corners: the manifest icons get masked or framed by the platform.
async function main() {
  await draw(192, 0.75, 0, "icon-192.png");
  await draw(512, 0.75, 0, "icon-512.png");
  await draw(512, 0.56, 0, "icon-512-maskable.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
