# Naming: Edventures Wallet (formerly Keluwa)

**Status:** renamed on 2026-09-08. The product is **Edventures Wallet**. It
sits under the Edventures org so early demand and traffic land on
edventures.co while the app is a devnet demo. The marketing page lives at
https://edventures.co/wallet; the app is its own deployment at
https://edventures-wallet.vercel.app. A fresh name may come later; this note
records what the last rename touched so the next one is scoped.

## Why Keluwa was dropped

"Keluwa" was picked believing it meant "family" in Malay/Bahasa. It is not a
dictionary word. "Family" is *keluarga*. Phonetically, "keluwa" is how
*keluar* (go out, exit, get out) sounds in everyday Malay, especially in
east-coast dialects that drop the final r. A Malaysian listener is likely to
hear "get out" first.

## What changed

- Copy and metadata everywhere a person sees the name: app title and
  manifest, headings, the owl prompt, the Solana Pay label, the health
  endpoint, demo banners, comments, tests.
- `package.json` name is `edventures-wallet`; manifest short name is
  `Edventures`.
- Docs and assets renamed: `docs/design/EDVENTURES-WALLET-*.md`, the two
  waitlist mockups, `public/illustrations/edventures-wallet-leaf-mark.png`.
  The founding-family stamp SVG now reads EDVENTURES WALLET on its arc,
  and the hero phone cluster PNG was relettered in place (the old wordmark
  painted out, "Edventures Wallet" set in Fraunces). The stamp PNG raster
  still says KELUWA; nothing in the app uses it.
- Lesson progress moved from localStorage `keluwa.lessons` to
  `edventures-wallet.lessons`; the old key is read once and carried over on
  the next write (`lib/lessons/storage.ts`).
- The Supabase invite metadata key `keluwa_role` became `wallet_role`.
  Nothing reads it, so pending invites are unaffected.
- The invite-link fallback host and the Sqril webhook URL point at
  `edventures-wallet.vercel.app`.

## What deliberately did not change

- The IndexedDB database holding the device signing key was renamed to
  `edventures-wallet` later the same day, with no migration: there were no
  users yet, so every device simply onboards again. Any future rename of
  that name needs a copy-then-rename migration.
- The private working repo's GitHub name and the local folder name.

## Outside the repo (manual, one cutover)

1. Done 2026-09-08: the Vercel project is `edventures-wallet` and serves
   `edventures-wallet.vercel.app` (the old `keluwa.vercel.app` still works).
2. Add the new origin to the Supabase auth redirect allowlist before
   removing the old one; invite emails use it.
3. Update the Sqril webhook URL to the new host (see `docs/sqril-setup.md`).
4. Point edventures.co/wallet at the app: a rewrite to the app origin, with
   `NEXT_PUBLIC_APP_ORIGIN=https://edventures-wallet.vercel.app` set on the
   app so the landing page's sign-in links stay absolute.
