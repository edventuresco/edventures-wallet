import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { LANDING } from "@/lib/marketing/copy";
import { appOrigin } from "@/lib/marketing/links";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Link previews (Slack, iMessage, WhatsApp, X) read the Open Graph and
// Twitter tags below plus app/opengraph-image.tsx; the words come from
// lib/marketing/copy.ts, so they follow the landing page. metadataBase makes the
// image URL absolute, which a share of edventures.co/wallet needs: that page
// is a rewrite to this app, so a relative image path would 404 over there.
export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  title: { default: "Edventures Wallet", template: "%s · Edventures Wallet" },
  description: LANDING.subhead,
  openGraph: {
    type: "website",
    siteName: "Edventures Wallet",
    title: LANDING.headline,
    description: LANDING.subhead,
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING.headline,
    description: LANDING.subhead,
  },
  applicationName: "Edventures Wallet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Edventures Wallet",
  },
  formatDetection: { telephone: false },
  // Icons are file conventions: app/icon.tsx (the leaf, generated) and
  // app/apple-icon.png. Next links both; an icons entry here would replace them.
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4ecdd",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
