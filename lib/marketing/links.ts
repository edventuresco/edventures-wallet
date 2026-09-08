/** The rest of Edventures. */
export const EDVENTURES_URL = "https://edventures.co/";

/**
 * The app's own origin, no trailing slash: NEXT_PUBLIC_APP_ORIGIN in a
 * deployment, the local dev server otherwise. Link previews use it as the
 * base for absolute image URLs, so a share of edventures.co/wallet (a
 * rewrite to this app) still finds the picture here.
 */
export function appOrigin(): string {
  const set = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? "").trim().replace(/\/$/, "");
  return set || "http://localhost:3000";
}

/**
 * The landing page is also served at edventures.co/wallet through a rewrite,
 * where a root-relative link such as /login would leave the app. With
 * NEXT_PUBLIC_APP_ORIGIN set to the app's own origin those links become
 * absolute; unset, they stay relative for local work.
 */
export function appHref(path: string): string {
  const origin = (process.env.NEXT_PUBLIC_APP_ORIGIN ?? "").trim().replace(/\/$/, "");
  return `${origin}${path}`;
}
