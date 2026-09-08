/**
 * The landing page's words, in one place. The page renders them, the root
 * layout puts them in the Open Graph and Twitter tags, and
 * app/opengraph-image.tsx paints them on the share card, so changing a line
 * here changes what a shared link shows. Adult voice; sentence case.
 */
export const LANDING = {
  /** The kicker above the headline, and the last line of the share card. */
  tagline: "Digital money. Family rules.",
  /** The h1, and og:title. */
  headline: "Grow money confidence together.",
  /** Under the h1, and og:description. */
  subhead: "Save together, automate kids' funds, and learn safely, with parents in control.",
  /** The small note under the actions. */
  betaNote: "Free while we're in beta. We email you when it's your family's turn.",
} as const;
