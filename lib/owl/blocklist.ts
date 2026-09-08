/**
 * Blocklist for owl names. Lowercase only; entries are matched as substrings
 * against a normalised form of the candidate name, so keep entries as short
 * base words rather than every possible variant.
 *
 * Normalisation (see `normalizeForBlocklistMatch`) maps common leetspeak
 * digits back to letters (0→o, 1→i, 3→e, 4→a, 5→s, 7→t), strips anything
 * that isn't a-z (spaces, hyphens, punctuation), and collapses repeated
 * letters, so "Sh1t", "sh-i-t", and "shhhiiit" all normalise the same way.
 */
export const OWL_NAME_BLOCKLIST: readonly string[] = [
  // Profanity
  "fuck",
  "fuk",
  "fck",
  "shit",
  "shyt",
  "bitch",
  "byotch",
  "ass",
  "asshole",
  "jackass",
  "dumbass",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "whore",
  "slut",
  "piss",
  "damn",
  "crap",
  "twat",
  "wanker",
  "bollocks",
  "douche",
  // Slurs and hate terms
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "dyke",
  "tranny",
  "retard",
  "retarded",
  "spic",
  "chink",
  "gook",
  "kike",
  "wetback",
  "coon",
  "paki",
  "raghead",
  "towelhead",
  // Hate symbols / extremist references
  "nazi",
  "hitler",
  "kkk",
  // Sexual content not appropriate for a kids' app
  "porn",
  "penis",
  "vagina",
  "boob",
  "titty",
  "rape",
  "sex",
] as const;

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

/**
 * Lowercases, maps leetspeak digits back to letters, drops everything that
 * isn't a-z, then collapses runs of the same letter to one. Used on both the
 * candidate name and the blocklist entries so "assss" still matches "ass".
 */
function toLettersOnly(input: string): string {
  const lowered = input.toLowerCase();
  const mapped = Array.from(lowered)
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("");
  return mapped.replace(/[^a-z]/g, "");
}

function collapseRepeats(input: string): string {
  return input.replace(/(.)\1+/g, "$1");
}

export function normalizeForBlocklistMatch(input: string): string {
  return collapseRepeats(toLettersOnly(input));
}

// Two comparison lists:
//  - RAW: letters-only, un-collapsed, so short words with an intentional
//    double letter ("ass", "kkk") still match their literal spelling.
//  - COLLAPSED: repeated letters collapsed to one, to catch elongation
//    obfuscation ("fuuuuck", "shhhiiit"). Entries shorter than 3 characters
//    after collapsing are dropped — a short entry like "kkk" collapses to a
//    single "k", which would otherwise match almost any name.
const RAW_BLOCKLIST = OWL_NAME_BLOCKLIST.map(toLettersOnly).filter((w) => w.length > 0);
const COLLAPSED_BLOCKLIST = RAW_BLOCKLIST.map(collapseRepeats).filter((w) => w.length >= 3);

/** True if the name contains a blocked word, literally or as an elongated variant. */
export function containsBlockedWord(name: string): boolean {
  const lettersOnly = toLettersOnly(name);
  if (RAW_BLOCKLIST.some((word) => lettersOnly.includes(word))) {
    return true;
  }
  const collapsed = collapseRepeats(lettersOnly);
  return COLLAPSED_BLOCKLIST.some((word) => collapsed.includes(word));
}
