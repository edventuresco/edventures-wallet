# Demo tools

Two scripts that put one family into a demo-ready state. Devnet only; both
run from a checkout with a filled-in `.env.local` (service role and, for
anything on-chain, the fee payer).

- `npm run demo:seed` builds the family out: kids with their wallets, limits
  and allowance, people on every kid's list, a funded treasury, "Pay a shop"
  on. Adds what is missing, never duplicates.
- `npm run demo:reset` gives the family a fresh day: sponsorship count, stale
  requests and pending raises cleared, expired pairing codes gone, optional
  treasury top-up. Nothing is removed that a guardian wants to show.

Both take `--family <family id | guardian email>` (a `families.id`, or the
sign-in email of one of its guardians), print the plan, ask for a `y` before
changing anything, and exit 1 on any refusal or error. Pass `--yes` to skip
the prompt (required when stdin is not a terminal). `--dry-run` prints the
plan and stops.

## Demo seed

```bash
npm run demo:seed -- --family <family id | guardian email> --dry-run            # look first
npm run demo:seed -- --family parent@example.com \
  --kids "Ten:2016,Eight:2018" \
  --contacts "Grandma:<address>,Friend:<address>" \
  --zara <address> --treasury 100 --shop-pay
```

| Flag | What it does |
| --- | --- |
| `--kids "Name:birthYear,..."` | Creates each kid that does not exist by name (case-insensitive), born in January of that year. Mirrors `addKid` in `app/family/actions.ts` step for step: the `kids` row with the default split, three Swig wallets on Solana with the guardian's device as root, their `wallets` rows, a `limits` row from `DEFAULTS`, an `allowances` row of the kid's age in dollars a week from next Monday 09:00, and the `wallet_created` event. Avatars cycle through the animal set in `lib/avatars.ts`, skipping the ones the family already uses. |
| `--contacts "Label:address,..."` | Puts each person on every kid's list with the default weekly cap (`DEFAULT_CONTACT_WEEKLY_UNITS`) and the `person` avatar. Labels and addresses pass the same checks as the guardian's "add someone" form. |
| `--zara <address>` | A "Zara" contact with a $2.00 weekly cap on every kid's list: the send the demo shows being blocked. |
| `--treasury <dollars>` | Mints test USDC until the family wallet's token account holds at least this much (default 100, only the difference is minted; `0` leaves it alone). The fee payer is the mint authority and creates the token account if needed. The tx and treasury explorer links are printed. |
| `--shop-pay` | Sets `kids.shop_pay_enabled = true` for every kid that does not have it yet. Refuses until the shop-pay migration is applied. |

Every kid, new or existing, also gets the family wallet ("Mum", or "Guardian"
when the root guardian is one, avatar `parent`) and every sibling both ways,
exactly as `addKid` does. A contact whose address is already on a kid's list
is skipped (the unique key is `kid_id, address`); a removed one at the same
address comes back, as `addContact` does.

New contact rows have `onchain_synced = false`. They reach the wallet only
when the guardian presses "Update on-chain" on `/family/rules`, which needs
the kid's device to be approved first. The script says so, and prints per
kid the newest invite (`kid_invites`), the device state (none, waiting for
approval, active) and how many contacts are still to push.

### What the seed needs first

The guardian's registered device (`devices`: `user_id` = the guardian,
`kid_id` null, `status = 'active'`): it is the root of every kid wallet.
When `--family` is an email, that guardian must hold it; for an id, any
guardian with one will do. And the family wallet (`wallets.kind = 'family'`),
which the guardian's own wallet becomes when the family is started. Without
either the script refuses with a message saying where to set it up.

### What the seed cannot do

Invites, the on-chain device approval and the keeper role need the
guardian's device key, so they stay in the app:

1. Invite each kid by email from `/family`; the kid accepts on `/join`.
2. Approve the device on-chain from `/family` (this also pushes the kid's
   contacts and limits on-chain).
3. Push contacts added later with "Update on-chain" on `/family/rules`.
4. Turn on automatic allowance on `/family/allowance` so the keeper role can
   pay allowances from the family wallet.

### Running it again

The seed is idempotent: a kid that exists by name is kept and only what it is
missing is added (wallets, limits, allowance, contacts). A kid with some but
not all of its three wallets is refused, so a half-finished earlier run is
fixed by hand rather than guessed at. If a run fails after wallets were
created on Solana but before their rows were saved, those wallets are
orphaned (the same as `addKid`); run again and the kid gets a fresh set.

### Needs from `.env.local`

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `USDC_MINT` (to
read and fund the treasury; not needed with `--treasury 0`); for anything
on-chain (new kids, minting) `FEE_PAYER_SECRET_KEY` and (optionally)
`SOLANA_RPC_URL`. `NEXT_PUBLIC_SOLANA_CLUSTER` must be unset or `devnet`.

The pure planning logic is `lib/demo/seed.ts` (tested in
`tests/unit/scripts/demo-seed.test.ts`); `scripts/demo-seed.ts` is the I/O
around it. `lib/demo/family-ref.ts` resolves `--family` for both scripts.

## Demo reset

```bash
npm run demo:reset -- --family <family id | guardian email> --dry-run   # look first
npm run demo:reset -- --family <family id | guardian email>             # then apply
npm run demo:reset -- --family <family id | guardian email> --topup 100 # and mint $100 test USDC to the treasury
```

### What it changes

| Step | Rows | Why |
| --- | --- | --- |
| Sponsor counter | Today's `events` rows of kind `sent` or `funded` by the family's members: `sponsor_counted` becomes `false` | `countSponsoredToday` (the 10-a-day cap the fee payer enforces) now counts only rows where `sponsor_counted` is true. The rows, signatures and explorer links stay. "Today" is the same window the cap uses: since midnight Asia/Kuching. |
| Requests | Every `requests` row for the family, any status | Stale approvals do not pile up on the parent screen. |
| Pending raises | `limits.pending_raise` set to null where one is waiting | The four-hour raise delay does not carry over from a rehearsal. |
| Expired pairing codes | `devices` rows with `status = 'pending'`, no `user_id`, and `pairing_expires_at` in the past | Dead codes go; a kid who has joined and is waiting for approval keeps their row. |
| Top-up (optional) | Mints `--topup` test dollars to the treasury wallet's token account (`wallets.kind = 'family'`), creating the account if needed | The fee payer is the mint authority of the devnet test USDC. The tx and treasury explorer links are printed. |

Members are the family's guardians plus the auth user behind each kid
device. Sponsored events carry `user_id` rather than `family_id`, which is why
the reset keys on members.

### What it leaves alone

Kids, wallets, contacts, allowances (`next_run_at`, `last_paid_at`), savings
goals, active and joined devices, and every past event. Nothing on-chain is
undone; a top-up only adds.

### Before the first run

Apply `supabase/migrations/20260907090000_events_sponsor_counted.sql`. Until
it is applied the script still prints a dry-run plan but refuses to apply,
and `countSponsoredToday` throws (the cap fails closed rather than reading as
zero), so apply the migration before releasing this change.

### Needs from `.env.local`

`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; for `--topup` also
`FEE_PAYER_SECRET_KEY`, `USDC_MINT` and (optionally) `SOLANA_RPC_URL`.
`NEXT_PUBLIC_SOLANA_CLUSTER` must be unset or `devnet`.

The pure planning logic is `lib/demo/reset.ts` (tested in
`tests/unit/scripts/demo-reset.test.ts`); `scripts/demo-reset.ts` is the I/O
around it.

## Moving a family onto a new root key

The guardian's device key is the root of every Swig the family owns (the
treasury and each kid's three jars), and it lives only in that browser's
IndexedDB. Signing out used to delete it; since 8 Sept 2026 the key is kept
per account and never deleted. For a family whose root key is already gone,
`npm run recover:root-key` recreates the wallets with the guardian's current
device key as root. Devnet only: balances are minted back, not moved.

```bash
npm run recover:root-key -- --family <family id | guardian email> --to <device pubkey> --dry-run   # look first
npm run recover:root-key -- --family <family id | guardian email> --to <device pubkey>             # then apply
```

`--to` is the full key Settings shows as "Key FTLe…QaTm" on the guardian's
current browser; open Settings there first so the device is registered.
The script reads each wallet's root from the chain and refuses when every
wallet already has the new key. It then: creates a new Swig per wallet,
points the same `wallets` rows (and any contact that named an old address)
at the new ones, revokes the guardian's old device rows, sets each joined
kid device back to `pending`, switches the keeper off, writes one
`wallet_created` event, and mints each old balance to the new wallet.

Afterwards, from the new device: approve each kid's device again in Family
and turn automatic allowance back on in Allowance. Both put the roles the
old root had granted onto the new wallets.
