import type { MetadataRoute } from "next";
import { LANDING } from "@/lib/marketing/copy";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edventures Wallet",
    short_name: "Edventures Wallet",
    description: LANDING.subhead,
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4ecdd",
    theme_color: "#f4ecdd",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
