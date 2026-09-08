# Edventures Wallet

A wallet for families. Parents set a few rules once. Kids get their own
wallet with an allowance, a savings jar, a way to pay at a shop, and a
friendly owl that helps them along. The rules are enforced by Solana, not by
us, so a kid can't overspend even if our app is down.

We built it at Startup Village Borneo 2026 in Kuching (Superteam Malaysia).
Try it at https://edventures-wallet.vercel.app. The pitch deck is in `pitch/`.

## Why Solana

Fast and cheap. When a kid sends $2.50 to a friend, it lands in about a
second and costs less than a cent. We cover that cent, so the family never
sees a fee.

The family holds its own money. The keys live on the parent's phone and the
kid's phone. We never have them. The limits a parent sets (how much a day,
how much a week, how much to each person) are written into the kid's wallet
on the chain. If we switched our servers off tomorrow, the money would still
be there and the rules would still hold.

Paying real shops. Some local payment companies already take Solana dollars
and pay the shop in local money. Today a kid can scan a shop's QR code in
Vietnam and it settles in dong. Malaysian ringgit is next.

## What it's made of

If you've built a web app before, none of this will surprise you.

- A Next.js website that works like an app on a phone. No app store.
- Supabase for signing in with an email code and for keeping the family
  list: who the parents are, who the kids are, what the rules say.
- Solana for the money. Each kid has three small wallets: spend, save and
  share. They are Swig smart wallets, which let a parent set limits on the
  kid's key without holding the key themselves.
- Sqril to pay shops from a QR code, and Jupiter to swap between dollars
  and SOL. The QR code you show when someone wants to send you money is
  the standard Solana one, so any Solana wallet can scan it.
- The owl runs on simple rules today. Next it gets a voice: Claude to
  understand what a kid says and ElevenLabs to answer out loud. Either way
  it can suggest a payment but never make one on its own.

We are on Solana's test network for now, with test dollars. Nothing here
touches real money yet.

## What we built each day

The whole app was written in Kuching from Sunday 6 to Tuesday 8 September
2026. There is an older browser-extension experiment from January parked in
`extension/`. We don't use any of it.

**Sunday 6.** Started the web app from scratch. Worked out how to put a
parent's limits into a kid's wallet on Solana, and proved with a test script
that the chain refuses a send that breaks a limit.

**Monday 7.** The long day. Signing in by email code. A wallet tied to your
own phone. The family: adding kids, inviting them by email, the three jars,
approving a kid's phone. Setting limits and pushing them on-chain. The
allowance, paid every Monday or right now. The kid's home screen, sending
money, moving money between jars, the share jar, a savings goal. The owl.
Short lessons. Paying a shop from a QR code. Receiving money. Swapping.
An activity feed. Demo scripts. The look and feel.

**Tuesday 8.** Renamed from Keluwa to Edventures Wallet. A landing page and
a waitlist, so the beta is invite only. Onboarding for a new parent. Family
goals: put money aside for a trip or a class, and let each kid's allowance
add to it. This README.

## Run it

```bash
cp .env.example .env.local   # fill in what you have; see the comments in the file
npm install
npm run icons                # placeholder PWA icons (until real ones land)
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run build` (writes to `.next-build`, so it never breaks
the dev server), `npm test` (Vitest), `npm run lint`, `npm run type-check`,
`npm run demo:reset` and `npm run demo:seed` (see `docs/demo-tools.md`).

Everything runs on Solana devnet with a test USDC mint (`npm run mint`
creates one). Supabase holds auth, the family model and realtime. The
server holds one key, the fee payer, which pays every transaction fee and
is also the keeper that pays allowances. Kids and guardians sign with a
key that lives on their own device (IndexedDB); the server never sees it.

## How a family works

**The front door.** Signed out, `/` is the landing page (the one
edventures.co/wallet shows too): join the waitlist, or explore Edventures.
The beta is by invitation: `/admin` (the accounts listed in the
`ADMIN_EMAILS` environment variable only) accepts a waitlist email, and only
an accepted email may create an account.

**Sign in.** `/login` is one email form: a code arrives by email, sent
through Resend (`lib/auth/send-code.ts` asks Supabase for the digits and
mails them itself; there is never a link to click). Where
you land next depends on who you are: a guardian goes to `/` (their
wallet), a paired kid device to `/kid`, an invited kid to `/join`, and a
new grown-up to `/onboarding`: their name, this device, their wallet, then
the family. Done once; after that home is `/`.

**Set up the family** (`/family`, `components/family/FamilySetup.tsx`).
The guardian's device registers its key, the guardian's own wallet becomes
the family wallet (a Swig smart wallet whose treasury the keeper role can
pay allowances from), then the family is created. Each kid added gets three
Swig wallets of their own, the jars: spend, save and share. The family
wallet and every sibling are on a new kid's list from the start.

**Invite a kid.** From the kid's card the guardian types an email. The kid
gets a code by email (the same Resend path as sign-in), opens `/login` on
their own device, types their email and the code, lands on `/join`, and
`acceptInvite` matches the invite by email and records a pending device.

**Approve on-chain.** The pending device shows on the guardian's kid card.
Approving signs one transaction with the guardian's device key that adds
the kid's device as a limited role on all three jars: per-person weekly
caps for everyone on the list, a daily total, and jar-to-jar moves. From
then on the chain, not the app, is what stops a send that breaks a rule.

**Rules** (`/family/rules`). Daily limit, weekly limit and approval
threshold per kid, and a weekly cap per person on the list. Lowering a
limit applies at once; raising one waits four hours. Guardians add people
(name, picture, Solana address, weekly cap) and remove them here. Saved
rules show "Updating" until the guardian taps "Update on-chain", which
rewrites the kid's role in one transaction.

**Requests** (`/family/requests`). A send above the approval threshold, and
every share from the share jar, waits here for a yes or no. A yes is good
for today, for that person and amount, once. The badge in the guardian nav
counts live over Supabase Realtime.

**Allowance** (`/family/allowance`). Defaults to the kid's age in dollars a
week. Paid Monday 09:00 family time by the keeper (`vercel.json` cron →
`/api/cron/allowance`, protected by `CRON_SECRET`), or right now with "Pay
now". One keeper-signed transaction moves the money from the family
treasury into the kid's three jars in the kid's chosen split.

**Kid home** (`/kid`). The spend balance, when the allowance is coming, the
save and share jars, one Send button, their people, what happened lately,
and the owl. A first visit asks the kid to name their owl. The screen
reacts live: a guardian's yes, an allowance landing or money arriving
shows a toast and refreshes.

**Send.** Faces from the list → a big number pad → "Send $2.50 to Sam?" →
a gentle celebration. The server decides (list, daily and weekly limits,
this person's cap, the threshold), prepares the transaction, the kid's
device signs it, the server co-signs and sends. A stop is a warm, specific
sentence with a next step, never a wall. Over the threshold, the kid sees
"We asked Mum" and, once approved, "Mum said yes, tap to send".

**Jars.** Save (`/kid/goal`): one named goal with a target and progress,
"Add to goal" and "Take back" between spend and save, no approval needed.
Split (`/kid/split`): three sliders that always add up to 100 decide how
the next allowance lands. Share (`/kid/share`): a donation jar; the kid
picks a person from the list and an amount the jar holds, asks, and after
the guardian's yes taps once to share.

**Pay a shop** (`/kid/pay`). Scan a VietQR code, see the merchant and the
amount in dollars, tap pay. USDC goes from the spend jar to the family
treasury within the kid's limits; the server settles with the merchant
through Sqril and refunds on failure (`docs/sqril-setup.md`).

**Learn** (`/learn`). Short lessons on the kid side: three taps and one
question each. "Before you send" and "Spot a scam".

**The owl.** The kid talks or types; the server interprets the sentence
(Claude with tool use when `ANTHROPIC_API_KEY` is set, plain rules when
not) and answers out loud (ElevenLabs when configured, the browser's voice
otherwise). It can propose a send, which opens the confirm card; money
never moves from voice alone.

**Settings** (`/settings`, adult palette for everyone). The account (your
family's name, whether you are "Parent" or "Guardian"), this device (its
key and your wallet on Solana), starting the family, and payments: the
guardian fills in a short KYC form once, which registers them as the
Sqril customer, then switches "Pay a shop" on or off per kid.

**Demo tools.** `npm run demo:seed -- --family <id or guardian email>`
builds a family out for a demo: kids with their wallets, limits and
allowance, people on every list, a funded treasury. `npm run demo:reset`
gives it a fresh day: sponsorship count, stale requests and pending raises
cleared, optional treasury top-up. Both in `docs/demo-tools.md`.

## Structure

```
app/            Next.js App Router
  page.tsx      the grown-up's home (name, balance, actions, own moves);
                the landing page when signed out. home-actions.ts reads it
  login/ join/  email sign-in (the beta gate lives in login/actions.ts); a kid
                accepting an invite
  onboarding/   a new grown-up: name, device, wallet, family, once
  admin/        the waitlist, for the admin accounts only
  family/       the family: kids, wallet, invites, allowance, requests,
                kids/[kidId] (and kids/[kidId]/add: money from the family
                wallet into a kid's spending), activity, feed-actions;
                rules/actions.ts serves /settings/rules
  goals/        family goals: sub-savings accounts for trips, activities and
                more, set aside from the family wallet; goals/[goalId] is the
                shared-goal page; the kids' own jar goals sit below, read-only
  receive/      the wallet's address and a Solana Pay QR
  pay/          a parent pays a shop from the family wallet (lib/shop/pay-core)
  swap/         USDC and SOL both ways: Jupiter on mainnet, a fixed-price
                stand-in on devnet (lib/swap)
  kid/          kid screens and server actions: home, goal, split, share, pay,
                data.ts (reads), actions.ts (sends, jar moves, shares)
  learn/        lessons (kid shell)
  settings/     account, device, family, payments (KYC and per-kid shop pay),
                rules (each kid's limits and contacts)
  wallet/       the signed-in user's own wallet (device key, first funds)
  api/          health, owl (interpret, speak), cron/allowance, sqril/webhook
  (kit)/        component gallery and demo pages, not linked from the app
components/
  family/       guardian UI; contract.ts is the typed props every screen uses
  kid/          kid UI; send/ is the Send flow (ContactGrid, AmountPad,
                ConfirmCard, Celebration, SendFlow)
  settings/     the settings screen and the link to it
  owl/ learn/ join/ auth/ wallet/ onboarding/ admin/
  marketing/    the landing page and the waitlist form
  ui/           shared primitives from the UI spec (adult palette), including
                the mobile shell: AppShell, BottomNav, MenuDrawer
  parent/       the first fixture-driven parent overview (see lib/mock)
lib/
  money/        USDC base units and dollar formatting
  family/       the family model: session, on-chain wallets and roles,
                allowance split, jars, share, contacts feed, kid home view,
                goals (family sub-savings: earmarks, never transfers)
  kid/          the send decision rules; what the kid's live toast says
  rules/        limits (four-hour raise), allowance schedule, timezone,
                contacts validation
  allowance/    the keeper transfer and the cron run
  shop/         Sqril quote, execute, settle, refund, VietQR; the pay core
                and the payer seam (a kid or a parent)
  swap/         the swap seam: amounts, provider, Jupiter, the devnet stand-in
  sponsor/      the 10-a-day cap and server-prepared transaction tokens
  swig/ solana/ Swig wallet helpers, connection, mint, explorer links
  owl/          intent interpretation, name check, blocklist
  lessons/      lesson content and local progress
  waitlist/     email check; who may make an account, who runs /admin
  auth/         the session user; sign-in codes (Supabase mints, Resend sends)
  email/        Resend, the one outbound email path
  onboarding/   the grown-up's display name
  marketing/    links the landing page shares with edventures.co
  device/       the per-device signing key and its server registration
  supabase/     server, browser and admin clients
  demo/         the demo reset plan
  policy/       the early in-memory rules engine (POLICY_ENGINE=mock)
  mock/         fixtures for the first screens
supabase/       migrations (headers say whether each is applied)
scripts/        PWA icons from the leaf mark (npm run icons), demo reset
docs/           Sqril setup, demo tools, design/ (UI spec, waitlist build guide and
                north star, mockups)
public/         PWA icons; public/illustrations/ holds the brand art
tests/unit/     Vitest; component tests opt into jsdom per file
extension/      January 2026 browser-extension prototype, parked, own toolchain
```

## Conventions

- Next.js 15 App Router, React 19, TypeScript, Tailwind v4. Server components
  by default; `"use client"` only where needed. Business logic in `lib/`,
  UI in `components/`, server actions next to the routes that use them.
- Money is stored and passed as USDC base units (integers, 6 decimals).
  Screens receive ready-to-render `display` strings; a bigint that has to
  reach the client crosses as a decimal string. No floats.
- Guardian screens use the adult palette (`forest`, `sand`, `terracotta`);
  kid screens use the `kid-*` palette. The two never mix on one surface.
- Kid-facing rules: no timers, no failure buzzers, no red-X walls. Big touch
  targets. Wrong turns get a warm, specific explanation and a next step.
- Every money move follows one seam: the server decides and prepares a
  transaction, the device signs it, the server co-signs only the exact
  message it prepared (a short-lived token carries the hash) and sends it.
- Migrations under `supabase/migrations/` are applied by hand (Supabase
  MCP or dashboard); each file's header says whether it has been.
- `npm run type-check`, `npm test`, `npm run lint` and `npm run build`
  pass before merging to `master`.
- Pushing to `master` does not deploy. Releases are manual (`npm run release`).
- Secrets live in `.env.local` only. Fixtures use placeholder names.

## Releasing

There is no deploy-on-push. A release is a deliberate, manual step from a
checkout of `master` that builds and tests clean:

```bash
npm run build && npm test
npm run release      # = vercel deploy --prod (needs Vercel team access)
```

Production: https://edventures-wallet.vercel.app (the marketing page is at https://edventures.co/wallet)
