import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local production builds write to a separate directory so `npm run build`
  // never overwrites the running dev server's .next folder. On Vercel the
  // builder reads .next, so the override applies only off-platform.
  distDir: process.env.VERCEL ? ".next" : process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
