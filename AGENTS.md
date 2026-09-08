# Agent instructions (Cursor, Claude Code, v0, and friends)

Read README.md first for what exists, the structure and the conventions.
Then:

## Where things go

- Guardian screens live in `components/family/` and render from the types
  in `components/family/contract.ts`; their data and actions live next to
  the route in `app/family/**/actions.ts` (`actions.ts`, `rules/actions.ts`,
  `requests/actions.ts`, `allowance/actions.ts`, `feed-actions.ts`).
- Kid screens live in `components/kid/`; reads are in `app/kid/data.ts`,
  money moves in `app/kid/actions.ts` (sends, jar moves, shares), and the
  smaller asks in `app/kid/*-actions.ts` (owl name, goal and split, contact
  and share requests). A page that needs the device key renders a `*Live`
  client wrapper (`KidHomeLive`, `GoalScreenLive`, `ShareScreenLive`) that
  wires a `use*` hook to the screen's `onSend` / `onMove` / `onShare` prop.
- Pure rules live in `lib/` and get unit tests: `lib/kid/rules.ts` (the
  send decision), `lib/rules/limits.ts` (four-hour raise), `lib/family/`
  (split, jars, share, contacts feed, kid home view, live toasts). Server
  actions should call these, not restate them.
- `components/parent/` + `lib/mock/` + `app/parent/` are the first
  fixture-driven overview; new guardian work goes in `components/family/`.
- The app is mobile first and a PWA, with no header. The grown-up side is
  `components/family/GuardianShell` (`AppShell` + the footer,
  `GuardianNav`: Home `/`, Family, Goals, More with Settings and Sign out) wrapped around every
  grown-up route by that route's `layout.tsx` (`family/`, `goals/`,
  `settings/`, `wallet/`, `receive/`, `pay/`, `swap/`) and by `app/page.tsx`
  for home. Every screen starts with its own title. Put a new place in
  `components/family/places.ts`: a tab in `GUARDIAN_DESTINATIONS` (at most
  four) or a row in `GUARDIAN_MENU` (the More sheet). That module holds icon
  functions, so a server component must not pass it into a client one. Kid
  screens keep their own `KidShell`/`KidNav`. A desktop view is later work.
- Swap goes through `lib/swap` (`swapProvider()`: Jupiter on mainnet, the
  fixed-price devnet stand-in otherwise) and `app/swap/actions.ts`, on the
  same prepare / sign-on-device / co-sign seam (purpose `swap`). The device
  key signs legacy and versioned transactions; `messageHashOf` hashes both.
- Goals (`/goals`, `lib/family/goals.ts`) are family sub-savings accounts.
  Money in a goal is set aside, never moved: a contribution earmarks part
  of the family wallet in the guardian's name (later, a kid's save jar),
  saved is the sum of unreleased contributions, and "free" is the wallet
  minus every earmark. Stopping a goal (`archiveGoal`, asked-and-confirmed
  on the goal page) releases everything and leaves it under Closed goals
  on `/goals`, where `reopenGoal` brings it back. The kid's own jar
  goal (`savings_goals`) is separate and stays read-only on the grown-up
  side.
- Home (`/`) is the signed-in grown-up: their name (`lib/family/owner.ts`),
  their balance, Receive / Send / Pay / Swap, their own moves. `/family` is
  the family. Rules live at `/settings/rules`; its actions stay in
  `app/family/rules/actions.ts`.
- Signed out, `/` renders `components/marketing/LandingPage` (also served at
  edventures.co/wallet). The beta gate is `lib/waitlist/access.ts`: only an
  accepted waitlist email or an admin may create an account
  (`app/login/actions.ts`), and `/onboarding` checks it again. Sign-in
  codes and kid invites are digits, never links: `lib/auth/send-code.ts`
  has Supabase mint the code and Resend (`lib/email/resend.ts`) deliver
  it, so keep every auth email on that path. A new
  grown-up sets name, device, wallet and family on `/onboarding`; the name
  lives in auth `user_metadata.display_name` and reaches screens through
  `getUser().name` / `ownerNameOf`. `/admin` is the waitlist, the
  `ADMIN_EMAILS` accounts only, no nav link.
- The landing page's words live in `lib/marketing/copy.ts` (`LANDING`);
  the page, the share tags and the share image all read them, so a copy
  change there changes the link preview too.
- Link previews come from the Open Graph and Twitter tags in
  `app/layout.tsx` and the picture `app/opengraph-image.tsx` draws at build
  time (twitter-image re-exports it). `metadataBase` is `appOrigin()`
  (`lib/marketing/links.ts`), so the image URL is absolute and a share of
  edventures.co/wallet, a rewrite to this app, still finds it.
- Do not import Supabase, Solana or `lib/policy` from a component. A client
  component may import a server action from `app/**/actions.ts`.

## Rules that do not bend

- Anything that signs, moves money or changes rules is a server action.
  Money moves follow the prepare / sign-on-device / co-sign seam in
  `app/kid/actions.ts` and `app/family/actions.ts`; the fee payer co-signs
  only the exact message it prepared (`lib/sponsor/prepared.ts`). Reuse
  that shape; never sign in the browser with anything but the device key.
- Four different caps exist; do not merge them in the UI: the per-person
  weekly cap (the list), the kid's daily limit and weekly limit
  (guardian-editable, on-chain), the approval threshold (a send above it
  waits for a yes), and the 10-sponsored-transactions-a-day cap
  (`lib/sponsor/policy.ts`, counts sent, funded, saved and shared).
- Money is integers in USDC base units. Show the `display` string you are
  given; never do arithmetic on dollars in a component. A bigint that must
  reach the client crosses as a decimal string.
- Kid screens use the `kid-*` colour tokens; guardian screens use `forest`,
  `sand`, `terracotta`, `olive`, `sage`, `slate`, `lagoon`. Never mix the
  two palettes on one surface. Kid copy: sentence case, one idea per
  sentence, a warm reason and a next step for every stop, no red-X walls.
- Kids never sign up from the site and there are no codes: a guardian
  invites by email, the kid accepts on `/join`, the guardian approves the
  device on-chain. Do not reintroduce pairing-code copy.
- RLS is the boundary: guardians read and write their family; a kid device
  reads its family and writes only requests, events for itself, its own
  goal and split. Anything a kid must update but RLS forbids goes through
  the service role in a server action, never through the anon key.
- Realtime: `requests` and `events` are in the `supabase_realtime`
  publication with replica identity full (`components/family/RequestsBadge`,
  `components/kid/KidLive`). Keep pure reducers for what a change means.
- Migrations are files under `supabase/migrations/` with a header saying
  whether they have been applied. Never apply one from a test or a build.
- No personal data in fixtures or tests. No secrets anywhere but `.env.local`.
- Leave `extension/` alone; it is a parked prototype with its own toolchain.

## Testing

- Vitest, `tests/unit/**`. Component tests add `// @vitest-environment jsdom`
  at the top and use `@testing-library/react`; mock `next/navigation` and
  any `app/**/actions` module they touch. Write the pure rule first, test
  it, then the screen.
- Before you finish: `npm run type-check`, `npm run lint`, `npm test`,
  `npm run build`.
- Never deploy. Pushing does not release; a human runs `npm run release`.
