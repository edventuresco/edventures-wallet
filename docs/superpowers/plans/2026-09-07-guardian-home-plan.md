# Plan: guardian home, family, goals and the footer

Spec: `docs/superpowers/specs/2026-09-07-guardian-home-design.md`.
Each phase ends green on `npm run type-check`, `npm run lint`, `npm test`,
`npm run build`, plus a signed-in browser check of the guardian pages on
the production build.

## Phase 1: shell and routes

1. `components/family/places.ts`: destinations Home `/`, Family `/family`,
   Goals `/goals`; menu Settings, Activity, Rules. BottomNav grows a `more`
   item that opens the drawer (footer only; `HeaderMenu` and `TopBar` are
   removed).
2. `app/(guardian)/layout.tsx`: a route group holding `page.tsx` (home),
   `family/**`, `goals/`, `settings/**`, `wallet/`, `receive/`, `pay/`,
   `swap/`. The layout renders `AppShell` with the footer for guardians;
   for a signed-out visitor `/` still renders the landing page (the layout
   passes children through without the shell when there is no guardian).
   Kid context on any of these redirects to `/kid`, except `/settings`
   which stays available to everyone in the adult palette.
3. Home: `app/(guardian)/page.tsx` + `components/home/HomeScreen.tsx`.
   Owner name from email, balance from the family wallet, action row,
   own transactions (phase 2 makes them appear; until then the list reads
   the owner's `events` by `user_id`).
4. Family: `FamilySetup` gets the family name as its title; allowance and
   requests are linked from it; the feed section stays.
5. Goals: `app/(guardian)/goals/page.tsx` reading `savings_goals` joined
   to kids and save balances; `components/family/GoalsScreen.tsx`.
6. Rules: move the page to `app/(guardian)/settings/rules/page.tsx`;
   `/family/rules` redirects.
7. Tests: BottomNav More item, places, HomeScreen, GoalsScreen; update
   GuardianNav tests. Docs: README structure, AGENTS shell paragraph.

## Phase 2: everyone's transactions

1. `app/wallet/actions.ts`: `submitTransfer` and `fundWallet` write
   `family_id` when the user is a guardian.
2. `lib/family/feed.ts`: a row with no `kid_id` is labelled with the owner
   name passed in, not "Family". Unit test.
3. `app/family/feed-actions.ts`: `getFamilyFeed({ owner: true })` filters
   to `kid_id is null`; Home uses it.

## Phase 3: receive

1. Add `qrcode` (or render the QR as SVG with a small encoder) and
   `components/wallet/ReceiveScreen.tsx`: address, copy, QR.
2. `app/(guardian)/receive/page.tsx`.

## Phase 4: pay for parents

1. `lib/shop/payer.ts`: `resolvePayer(ctx)` returns the wallet to pay
   from and the limit rule (kid: spend wallet + daily limit; guardian:
   family wallet, no limit). Unit tests.
2. `app/kid/pay/actions.ts` becomes `app/pay/actions.ts` used by both
   sides; the kid page keeps its route and screen.
3. `app/(guardian)/pay/page.tsx` renders `PayShopFlow` in the adult
   palette. Events written with `family_id`.

## Phase 5: swap

1. `lib/swap/provider.ts`: `SwapProvider { quote, buildSwap }`;
   `jupiter.ts` (mainnet, `@jup-ag/api`), `devnet.ts` (fixed-rate quote
   against the test mint). Unit tests for the quote maths.
2. `app/(guardian)/swap/actions.ts`: quote, prepare, submit on the
   prepared-token seam. `components/wallet/SwapScreen.tsx`.
3. Events `kind = 'swapped'` (migration adding the kind).
