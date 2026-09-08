# Guardian home, family, goals and the footer

Date: 2026-09-07. Status: agreed in chat, being built.

## What changes

The signed-in guardian's app is reorganised around the person, not the
family. Four places in a fixed footer, the rest behind More.

| Place | Route | Shows |
| --- | --- | --- |
| Home | `/` | The owner's name, their balance, four actions (Receive, Send, Pay, Swap), their own transactions. |
| Family | `/family` | The family's name, the family wallet, kids with balances and account state, invites and device approval, allowances, the activity of everyone. |
| Goals | `/goals` | The kids' savings goals, read-only for v0. |
| More | (sheet) | Settings, Activity, Rules (a settings page), Sign out. |

- `/settings` keeps account, device, family and payments. Rules moves to
  `/settings/rules`.
- `/family/rules`, `/family/allowance`, `/family/requests` and
  `/family/activity` keep working: allowance and requests stay as family
  sub-pages reached from `/family`; rules redirects to `/settings/rules`.
- There is no header. Every guardian page starts with its own title.
- The footer is one component rendered by one guardian layout that wraps
  `/`, `/family/**`, `/goals`, `/settings/**` and `/wallet`, so it shows
  on every one of them. The burger is the footer's More item.
- Kid screens are untouched.

## Facts that shape it

- The guardian's own wallet **is** the family wallet: starting the family
  turns the guardian's wallet into `wallets.kind = 'family'`. So Home's
  balance and Family's wallet are the same number with two labels.
- Guardians have no name column; `guardians.label` is "Parent" or
  "Guardian". Home uses the sign-in email's local part, capitalised, until
  a name field exists (see Later).
- Owner sends already write `events` rows (`kind = 'sent'` or `'blocked'`)
  but with only `user_id` and `wallet_id`, so the family feed, which
  filters on `family_id`, never shows them.
- Pay a shop is kid-scoped (`spendWallet(kidId)`, `kids.shop_pay_enabled`,
  the kid's daily limit). The Sqril customer is already the family's.
- Jupiter's swap API serves mainnet only. This app runs on devnet with a
  test USDC mint. Swap therefore goes through a provider seam.

## Phases

1. **Shell and routes.** Guardian layout with the four-item footer and the
   More sheet; `/` becomes the owner's home; `/goals`; rules under
   settings; family page reorganised. Home's action row links to Receive,
   Send (`/wallet`), Pay and Swap. Pay and Swap link to their pages once
   built and render as "coming soon" cards before that.
2. **Everyone's transactions in the feed.** Owner sends, funds, receipts
   and (later) shop payments and swaps write events carrying `family_id`.
   The feed labels guardian rows with the owner's name. Home lists the
   owner's rows only; Family and Activity list everyone's.
3. **Receive.** `/receive`: the wallet address, a copy button, a QR code.
4. **Pay for parents.** `/pay`: the kid pay flow generalised to a
   "payer" (a kid's spend wallet with its limits, or the family wallet
   with none), same Sqril quote / prepare / sign-on-device / co-sign seam.
5. **Swap.** `/swap`: `lib/swap/` with a `SwapProvider` interface
   (quote, build transaction). `JupiterProvider` on mainnet, a
   `DevnetProvider` that quotes at a fixed rate and moves test USDC so
   the flow can be demoed. Same sign-on-device / co-sign seam.

## Not in this pass

- A guardian name field (`guardians.name`, editable in Settings).
- Goals for guardians beyond reading the kids' goals.
- The desktop view.

## Testing

Pure rules get unit tests first (feed labelling, payer selection, swap
quote maths). Screens get jsdom tests for what they show and link to. The
guardian layout gets a browser check on a production build with a signed-in
session before each phase is called done: the earlier shell bug only showed
there.
