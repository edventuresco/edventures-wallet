# Sqril setup: keys, webhooks, funding, spike

Edventures Wallet uses [Sqril](https://docs.sqril.io) to pay a merchant's QR code in local
currency from a stablecoin balance. This is the manual setup a human does once
per environment. Nothing here goes in git except this file.

## What Sqril is for Edventures Wallet

- **Corridors (2026-09-07):** Vietnam, the Philippines, Thailand, Cambodia,
  six African and six Latin American countries. **Malaysia is not live**;
  Sqril expects it before the end of the year. A Kuching DuitNow QR cannot be
  paid yet, so demos use Sqril's sample QR codes for VN, TH or PH.
- **Who pays:** Sqril needs a fully identified adult as the sender, so the
  **parent** is the registered Sqril customer. Kids pay within their own
  on-chain limits; the family account settles with Sqril.
- **Flow:** `decodeQrUnregistered` → `getQuotation` → kid's on-chain USDC
  transfer to the family treasury → `executePayout` (idempotency key = the
  Solana signature) → signed webhook → "Paid".
- **Money model:** payouts draw from a **prefunded account balance** at
  Sqril. Edventures tops it up with a stablecoin deposit; nothing is paid per
  transaction from a user's wallet to Sqril.

## 1. API credentials

1. Sqril issues a `client_id` and `client_secret` per environment. Staging
   API base URL is `https://stg-api.sqril.io`. There is no self-serve
   sign-up; credentials come from Sqril (info@sqril.io or your contact).
   Ask at the same time for the production base URL, which is not in the docs.
2. Put them in `.env.local` (local) and on Vercel (production):

   ```bash
   # .env.local
   SQRIL_BASE_URL=https://stg-api.sqril.io
   SQRIL_CLIENT_ID=...
   SQRIL_CLIENT_SECRET=...
   SQRIL_MOCK=false
   ```

   ```bash
   # Vercel (run from the repo; repeat for preview if wanted)
   printf '%s' 'https://stg-api.sqril.io' | vercel env add SQRIL_BASE_URL production
   printf '%s' '<client_id>'              | vercel env add SQRIL_CLIENT_ID production
   printf '%s' '<client_secret>'          | vercel env add SQRIL_CLIENT_SECRET production
   printf '%s' 'false'                    | vercel env add SQRIL_MOCK production
   ```

3. Never prefix these with `NEXT_PUBLIC_`. They are used only in server code
   (`lib/sqril/config.ts`).

## 2. Webhook

Sqril posts `transaction.success`, `transaction.failed` and
`transaction.refunded` to one URL. Signing is **opt-in on Sqril's side**: the
`X-SQRIL-Signature` header (base64 HMAC-SHA256 of the exact raw body) is only
sent when a webhook secret is configured. Our receiver **fails closed**: with
no secret configured it answers 503, with a bad or missing signature 401.
Configuring the secret is therefore mandatory, not optional.

1. Generate a secret:

   ```bash
   openssl rand -base64 32
   ```

2. In Sqril's webhook configuration (dashboard, or via your Sqril contact if
   there is no self-serve screen), register:
   - URL: `https://edventures-wallet.vercel.app/api/sqril/webhook`
   - Events: `transaction.success`, `transaction.failed`, `transaction.refunded`
   - Secret: the value from step 1

3. Put the **same** value in the environment:

   ```bash
   # .env.local
   SQRIL_WEBHOOK_SECRET=<same value>
   ```

   ```bash
   printf '%s' '<same value>' | vercel env add SQRIL_WEBHOOK_SECRET production
   ```

4. Redeploy so the production route sees the secret: `npm run release`.

Local development cannot receive Sqril's webhooks directly (no public URL).
Either point Sqril at the Vercel URL and read deliveries from Supabase (below),
or use the mock (`SQRIL_MOCK=true`) and post a signed payload yourself:

```bash
BODY='{"tx_id":"mock-tx-dyn-0123456789abcdef","status":"SUCCESS","amount":120000}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SQRIL_WEBHOOK_SECRET" -binary | base64)
curl -s -X POST http://localhost:3000/api/sqril/webhook \
  -H "Content-Type: application/json" -H "X-SQRIL-Signature: $SIG" --data-binary "$BODY"
```

## 3. Recording deliveries (Supabase service-role key)

Every delivery is stored in `public.sqril_webhook_events` (migration
`supabase/migrations/20260907000000_sqril_webhook_events.sql`, already applied
to the Edventures Wallet Supabase project, ref `<project-ref>`). The route needs the service-role key:

1. Supabase dashboard → the Edventures Wallet project (ref `<project-ref>`) → Project Settings → API
   keys → copy the **service_role** secret.
2. `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=...`
3. Vercel: `printf '%s' '<key>' | vercel env add SUPABASE_SERVICE_ROLE_KEY production`
4. Without it the route still answers Sqril correctly but only logs to
   `vercel logs`.

To inspect deliveries:

```sql
select received_at, tx_id, status, signature_present, signature_valid, note
from public.sqril_webhook_events
order by received_at desc
limit 20;
```

## 4. Funding the account balance

- Sqril credits a stablecoin deposit sent to the account's **assigned
  receiving address** a few minutes after it confirms on chain. Find the
  address (and which chain and token) in the Sqril dashboard or ask your
  contact; it is not in the public docs.
- Check `getAccountBalances` (the spike does this first) before executing a
  payout; a payout that arrives before the credit fails with 402
  `INSUFFICIENT_FUNDS`.
- For staging, ask Sqril to credit a test balance.

## 5. Sample QR codes

The docs' examples use placeholders, not real payloads. Sqril supplies real
staging samples on request (for Vietnam they shared a document of VietQR
images). Decoded strings and the original images live in
`private/spike/sqril-samples.json` and `private/spike/qr/` (git-ignored; the
images are what the kids scan in the demo). Then:

```bash
# .env.local
SQRIL_SAMPLE_QR=<dynamic sample>
SQRIL_SAMPLE_QR_STATIC=<static sample>
SQRIL_STATIC_AMOUNT=50000
```

## 6. Test parent

Copy `private/spike/sqril-parent.example.json` to
`private/spike/sqril-parent.json` and adjust if Sqril wants specific test
identities. All fourteen fields are required by `registerCustomer`. The file
is git-ignored.

**In the app**, payments are opt-in and nothing registers on a kid's behalf.
A guardian opens Settings → Payments, fills in the KYC form (name, date of
birth, gender, nationality, address, ID, phone, email) and taps "Enable
payments"; `lib/shop/kyc.ts` (`validateKyc`, `registerFamilyForPayments`)
maps that to Sqril's fourteen `registerCustomer` fields and stores the
returned id in `families.sqril_customer_id`. Occupation is not asked for:
Sqril documents only the enum, so `OCC2` is sent (the value the mock client's
test parent carries). The guardian then switches "Pay a shop" on per kid
(`kids.shop_pay_enabled`, migration `20260907110000_kid_shop_pay.sql`);
`quoteShop` refuses a kid whose switch is off, and
`lib/shop/customer.ts` (`ensureSqrilCustomer`) only reads the stored id,
telling the kid to ask a parent when there is none.

The form's "Fill in test details" button enters the same obviously fake
placeholder the mock client answers with, never a real person: "Test
Parent", document number `000000000000`, `parent@example.com`,
`+60100000000`, "1 Jalan Test, Kuching". Staging accepts it. The Settings
screen says so in as many words: staging only, test details, not a real
identity.

## 7. Run the spike

```bash
npm run spike:sqril
```

It runs against staging and reports PASS/FAIL per check into
`private/spike-sqril-report.json`:

| # | Check |
|---|---|
| 1 | Credentials work; account balances |
| 2 | `previewQuotations` lists the corridors these keys can pay |
| 3 | Register the parent; read corridor eligibility back |
| 4 | Decode the sample QR without a customer |
| 5 | Whether the registered `decodeQr` path still exists |
| 6 | Quote, and re-quote the same transaction |
| 7 | Execute the payout (202 PROCESSING) |
| 8 | Replay with the same idempotency key returns the stored 202 |
| 9 | A new key on the same transaction is refused (`TRANSACTION_NOT_PENDING`) |
| 10 | Poll `getTransaction` until SUCCESS or FAILED (2 minutes max) |
| 11 | `listTransactions` shape |
| 12 | A signed webhook was recorded for the transaction |
| 13 | Static QR: decode without amount, quote with amount |

Check 10 and 12 tell us whether staging actually settles and calls back. If
it never does, the demo runs on `SQRIL_MOCK=true` and the pitch says so.

## 8. Mock mode for screen work

`SQRIL_MOCK=true` makes `getSqrilClient()` return a deterministic mock
(Vietnam corridor). Markers in the QR string select scenarios: `static`,
`invalid`, `fail`, `refund`, `float`. See `lib/sqril/mock.ts`.

## 9. The kid "pay a shop" flow (`shop_payments`)

Migration `supabase/migrations/20260907080000_shop_payments.sql` (apply it
before the `/kid/pay` screen can be used). One row per quote the kid took
to the Pay button, keyed by `sqril_tx_id`:

| status | meaning |
|---|---|
| `quoted` | `quoteShop` stored the decode + quotation; nothing has moved |
| `paid_onchain` | the kid's spend jar paid the family treasury on Solana (`signature`) |
| `processing` | `executePayout` accepted (idempotency key = that signature) |
| `success` / `failed` | settled by the signed webhook, or by a status poll that asked `getTransaction` |

Server actions live in `app/kid/pay/actions.ts` and are gated on an active
kid device: `quoteShop` → `prepareShopPayment` (the device signs in the
browser) → `submitShopPayment` (fee payer co-signs the exact message it
prepared) → `getShopPaymentStatus` (polled every 2 s for up to 2 min).
The status poll also nudges an in-flight row forward: a `paid_onchain` row
retries `executePayout` with the same idempotency key (a dropped call, or a
crash between the Solana confirm and the Sqril call), and a `processing` row
asks `getTransaction`. Settlement is one shared path, `lib/shop/settle.ts`:
it only moves rows out of `paid_onchain` / `processing`, so the webhook and
the poll cannot both write the history event. On success the kid's history gets a `shop_paid`
event ("Paid 79,000 VND at Pho 24 · $3.20"); on failure a `shop_failed`
event, and the webhook delivery row gets `processed_at`.

A failure after the money moved leaves the USDC in the family treasury. The
refund back to the kid's spend jar is the keeper role's job and is not built
yet: `lib/shop/refund.ts` (`refundShopPayment`) throws, callers log that a
refund is owed, and the kid-facing copy says a parent can move it back.

## 9b. A parent paying from the family wallet (`/pay`)

The same flow for a guardian. `app/pay/actions.ts` resolves a guardian
payer and `lib/shop/pay-core.ts` runs quote → prepare → submit → status for
either payer (`lib/shop/payer.ts`). Differences from the kid's:

- The paying wallet is the family wallet (`wallets.kind = 'family'`), signed
  by the guardian's own registered device (its root role on the Swig).
- No daily limit; the balance and the 10-a-day sponsor cap still apply.
- The on-chain leg goes to the settlement address, since the family wallet
  is the treasury: `SHOP_SETTLEMENT_ADDRESS` in `.env.local`, or the fee
  payer's own wallet when unset. That is the family settling with
  Edventures, which prefunds Sqril.
- The `shop_payments` row has `kid_id` null (migration
  `20260907150000_shop_payments_guardian.sql`, apply before `/pay` works);
  its events carry `family_id` and no kid, so the feed shows them under the
  parent's name.

## 10. Operational notes

- Rate limits: 60 requests per minute on `executePayout` and
  `previewQuotations`; the client retries 429 with backoff.
- Quotes expire after about 30 minutes (`QUOTATION_EXPIRED`); start again
  from decode.
- The client asks for `dp=4` so `amount_usd + fee` reconciles exactly with
  the balance deduction.
- Rotate keys by issuing new ones with Sqril, updating Vercel, and releasing;
  the old pair stops working the moment Sqril revokes it.
