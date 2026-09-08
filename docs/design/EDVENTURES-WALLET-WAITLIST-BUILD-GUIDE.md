# Edventures Wallet waitlist website — build guide

## 1. Project summary

**Product:** Edventures Wallet  
**Product line:** Digital money. Family rules.  
**Category:** Family-first digital wallet and financial learning product  
**Primary buyer:** Parents, especially mothers, who want practical digital money tools without trading culture  
**End users:** Parents and their children  
**Primary conversion:** A parent pays a one-time $1 reservation fee for founding-family early access  
**Primary CTA:** **Reserve early access — $1**

Edventures Wallet helps families save toward shared goals, automate children’s allowances and long-term funds, and build financial fluency in a parent-controlled environment.

The homepage should make the product understandable in under ten seconds. It is not the place to explain every wallet feature, chain, asset, custody model, or future integration.

## 2. Positioning

### The category contrast

Most crypto wallets are designed around trading, speculation, and expert users. Edventures Wallet is designed around normal family money behaviors:

- saving together;
- giving children structured independence;
- building long-term funds;
- learning before money moves;
- keeping adult permissions visible.

Do not attack competitors by name on the homepage. Express the difference positively through product visuals and the phrase **No trading clutter**.

### Value proposition

> A family wallet that turns digital money into shared goals, growing independence, and practical learning—with parents in control.

### Emotional promise

Edventures Wallet should feel like a capable parent opening a door: optimistic, calm, protective, and never patronizing.

## 3. Conversion offer

### Offer

- One-time $1 reservation
- Priority invitation when early access opens
- Eligibility for early product testing
- Founding-family product updates

### Required checkout clarity

Before payment, state:

- the $1 is a one-time reservation fee;
- it is not a subscription;
- early access timing is not guaranteed;
- what refund policy applies;
- which adult is agreeing to Terms and Privacy;
- no child information is required to join.

The mockup intentionally does not claim the fee is refundable or credited toward a future plan. Add either claim only after the business policy is final.

### CTA behavior

Every primary CTA triggers the same action:

1. Open the reservation panel or route to `/reserve`.
2. Ask for parent email and country.
3. Require Terms and Privacy consent.
4. Start hosted checkout for $1.
5. Return to `/confirmed` after successful payment.
6. Send a confirmation email.

Use hosted checkout such as Stripe Checkout rather than collecting payment details directly.

## 4. Information architecture

The homepage has five communication sections plus a minimal footer:

1. Hero
2. Three benefits
3. Four steps
4. Trust/origin
5. Founding-family offer
6. Footer

The announcement bar and header are interface chrome, not additional content sections.

## 5. Exact homepage copy

### Announcement bar

> Founding families: early access for $1

### Header

- Wordmark: **Edventures Wallet**
- Links: **How it works**, **Why Edventures Wallet**
- CTA: **Reserve for $1**

On mobile, hide the text links behind a menu. Keep the CTA in the hero rather than crowding the header.

### Hero

**Eyebrow**

> A wallet for families

**Headline**

> Grow money confidence together.

**Support**

> Save together, automate kids’ funds, and learn safely—with parents in control.

**CTA**

> Reserve early access — $1

**Microcopy**

> One time. No subscription today.

**Visual**

Use `assets/hero-phone-cluster.png`. On narrow mobile, prioritize the center dashboard screen; crop only transparent padding, never the phone bodies.

### Benefits

**Section heading**

> Built for real family money

**Card one**

- Title: **Save together**
- Body: **Fund goals everyone can see.**
- Asset: `benefit-save-together.png`

**Card two**

- Title: **Grow their future**
- Body: **Automate allowances and savings.**
- Asset: `benefit-grow-future.png`

**Card three**

- Title: **Learn safely**
- Body: **Practice before money moves.**
- Asset: `benefit-learn-safely.png`

### How it works

**Section heading**

> Four small steps

| Step | Label | Description |
|---:|---|---|
| 1 | Join | Reserve your place. |
| 2 | Set up | Add your family. |
| 3 | Choose | Create your rules. |
| 4 | Grow | Save and learn. |

### Trust/origin

**Heading**

> Built by a parent, educator, and web3 builder.

**Body**

> Edventures Wallet makes digital money feel useful, human, and safe.

**Proof chips**

- Parent permissions
- Guided learning
- No trading clutter

If a named founder bio is added later, cap it at 35 words and link to a separate About page.

### Founding-family offer

**Heading**

> Be a founding family.

**Support**

> Get priority access and help shape Edventures Wallet.

**Benefits**

- One-time $1 reservation
- Early testing access
- Founding-family updates

**CTA**

> Reserve early access — $1

**Microcopy**

> Adults only. Secure checkout.

### Footer

- Edventures Wallet
- Digital money. Family rules.
- Privacy
- Terms
- Contact

Do not add social icons until active branded accounts exist.

## 6. Desktop layout

Reference: `mockups/edventures-wallet-waitlist-desktop.png`

### Global

- Content max-width: 1280px
- Main page gutter: 48–64px
- Section padding: 80–104px
- Header height: 76px
- Maximum body text width: 620px

### Hero

- Two-column grid: 46% copy / 54% visual
- Minimum height: 680px
- Align copy vertically to the phone cluster’s center
- Headline max-width: 650px
- Phone cluster may extend slightly beyond the right content edge
- CTA width: content-fit, minimum 300px

### Benefits

- Three equal cards in one row
- Card art occupies roughly 45% of card height
- Card copy remains left-aligned

### Steps

- Full-width forest band
- Four horizontally distributed steps
- Use a connecting line only on desktop

### Trust

- Two-column layout: illustration/portrait 30%, copy 70%
- Proof chips may sit in one row

### Offer

- Wide rounded panel with copy on the left and light landscape art on the right
- Do not place essential text over an illustration

## 7. True mobile layout

Reference: `mockups/edventures-wallet-waitlist-mobile.png`

### Global

- Target width: 360–430px
- Side gutter: 20px
- Section padding: 52–64px
- Card radius: 18–22px
- Full-width primary CTA

### Mobile-specific changes

- Hide desktop navigation links.
- Stack hero copy above product visual.
- Use one visually dominant phone.
- Display benefits as compact stacked rows, not three squeezed columns.
- Display the four steps in a 2×2 grid.
- Stack proof chips if they do not fit at 320 CSS pixels.
- Keep the final CTA visible without placing a sticky CTA over content.
- Reduce decorative scenery before reducing functional whitespace.

This must be implemented as a responsive composition, not a scaled desktop screenshot.

## 8. Visual system

### Color tokens

| Token | Value | Use |
|---|---:|---|
| `--sand` | `#F4ECDD` | Primary canvas |
| `--sand-dark` | `#E4D4B8` | Dividers and tracks |
| `--forest` | `#2E4636` | Headings, header, trust band |
| `--forest-light` | `#3F6049` | Hover and secondary green |
| `--terracotta` | `#C2693F` | CTA and active accents |
| `--terracotta-dark` | `#A4502C` | Pressed CTA |
| `--ink` | `#221F1A` | Body text |
| `--paper` | `#FFFDF8` | Card surfaces |
| `--blue-muted` | `#48788F` | Travel illustration accents |

Preserve the brand balance: 60% sand, 25% forest, 10% terracotta, 5% ink.

### Typography

- Headings: Fraunces 600
- Body and controls: Inter 400–700
- Sentence case only
- Use `font-display: swap`

Suggested scale:

| Role | Desktop | Mobile |
|---|---|---|
| Hero title | 72/74 | 45/48 |
| Section title | 42/48 | 32/38 |
| Card title | 25/31 | 20/26 |
| Body | 19/29 | 16/24 |
| Label | 14/20 | 13/18 |

### CSS foundation

```css
:root {
  --sand: #f4ecdd;
  --sand-dark: #e4d4b8;
  --forest: #2e4636;
  --forest-light: #3f6049;
  --terracotta: #c2693f;
  --terracotta-dark: #a4502c;
  --ink: #221f1a;
  --paper: #fffdf8;
  --blue-muted: #48788f;
  --display: "Fraunces", Georgia, serif;
  --body: "Inter", system-ui, sans-serif;
  --radius-card: 22px;
  --radius-button: 16px;
  --shadow-card: 0 14px 40px rgb(34 31 26 / 8%);
  --focus-ring: 0 0 0 3px rgb(194 105 63 / 38%);
}
```

### Buttons

- Height: 54px desktop and mobile
- Horizontal padding: 28px
- Background: terracotta
- Label: paper white
- Radius: 16px
- Hover: terracotta-dark
- Active: translateY(1px)
- Focus: visible three-pixel terracotta ring
- Never use disabled styling during network loading; show progress and prevent duplicate submission

### Illustration treatment

- Use `object-fit: contain`.
- Never place body copy over detailed art.
- Preserve transparent padding when it improves balance.
- Raster assets render at no more than their intrinsic pixel dimensions.
- Export responsive WebP/AVIF derivatives while retaining PNG originals.

## 9. Component inventory

| Component | Required behavior |
|---|---|
| `AnnouncementBar` | One line; dismissible only if dismissal persists |
| `Header` | Wordmark, two anchors, one CTA; compact mobile menu |
| `Hero` | Copy, primary CTA, phone cluster |
| `PrimaryCTA` | One label and one checkout action everywhere |
| `BenefitCard` | Image, title, one short sentence |
| `StepsBand` | Four numbered steps; semantic ordered list |
| `TrustBlock` | Origin statement and three proof chips |
| `ProofChip` | Icon plus two-to-three-word label |
| `OfferCard` | Offer, three benefits, CTA, checkout microcopy |
| `ReservationPanel` | Parent email, country, consent, checkout |
| `Footer` | Brand line and three essential links |

Use code-native icons from Lucide for navigation, checkmarks, shields, and arrows. Do not crop icons from the mockup.

## 10. Reservation and confirmation screens

### Reservation panel

**Heading**

> Reserve Edventures Wallet early access

**Support**

> Join as a founding family for a one-time $1 reservation.

**Fields**

- Parent email
- Country/region
- Consent checkbox

Do not request a child’s name, age, school, wallet address, or financial information.

**Payment CTA**

> Continue to secure checkout

### Confirmation page

**Heading**

> You’re a founding family.

**Body**

> We’ll email you when your Edventures Wallet invitation is ready.

**Optional action**

> Share Edventures Wallet

The referral action is appropriate only after conversion and must not compete with the initial reservation CTA.

## 11. Analytics

Track the funnel without recording child data or payment details.

| Event | Trigger | Recommended properties |
|---|---|---|
| `page_view` | Homepage loads | source, campaign, device_class |
| `hero_cta_click` | Hero CTA | placement, source |
| `header_cta_click` | Header CTA | placement |
| `offer_cta_click` | Final CTA | placement |
| `reservation_panel_view` | Panel or page opens | entry_placement |
| `checkout_start` | Hosted checkout begins | currency, amount |
| `checkout_complete` | Payment confirmed server-side | currency, amount |
| `waitlist_joined` | Reservation record created | country, campaign |
| `checkout_abandoned` | Checkout expires | entry_placement |
| `referral_share_click` | Confirmation share action | channel |

Do not send email addresses, names, wallet addresses, or free-form text into analytics.

Primary metrics:

- homepage → reservation-panel rate;
- reservation-panel → checkout-start rate;
- checkout-start → completed-payment rate;
- cost per completed reservation;
- referral share rate after conversion.

## 12. Accessibility

- Meet WCAG 2.2 AA contrast.
- Maintain logical `h1` → `h2` heading order.
- All controls must be keyboard accessible.
- Use visible focus styles.
- Minimum touch target: 44×44px.
- Give meaningful illustrations concise alt text.
- Treat decorative foliage as `alt=""`.
- Do not communicate checkout status with color alone.
- Respect `prefers-reduced-motion`.
- Ensure 200% zoom does not clip the CTA or checkout form.

Suggested hero alt text:

> Edventures Wallet screens showing a family balance, a shared Japan goal, and a child’s education fund.

## 13. Privacy and family-safety rules

- The waitlist is parent-facing.
- Collect no child personal data.
- Do not use behavioral ad pixels aimed at minors.
- Do not show real wallet addresses, seed phrases, or financial account data in demos.
- Clearly label mock balances as illustrative in legal/footer material if needed.
- Privacy and Terms must be available before checkout.
- Obtain separate consent for marketing email where required.

## 14. Performance

- Target LCP under 2.5 seconds on a mid-tier mobile connection.
- Preload only the display font’s required weights.
- Render the hero phone asset responsively at approximately 760px desktop and 520px mobile.
- Lazy-load below-the-fold benefit art.
- Use explicit image width and height to prevent layout shift.
- Keep initial JavaScript under 170KB compressed where practical.
- Do not autoplay video.

## 15. Suggested structure

```text
app/
  page.tsx
  reserve/page.tsx
  confirmed/page.tsx
components/
  AnnouncementBar.tsx
  Header.tsx
  Hero.tsx
  BenefitCard.tsx
  StepsBand.tsx
  TrustBlock.tsx
  OfferCard.tsx
  ReservationPanel.tsx
  Footer.tsx
public/
  assets/
styles/
  tokens.css
  globals.css
lib/
  analytics.ts
  checkout.ts
```

## 16. Asset manifest

| File | Use |
|---|---|
| `hero-phone-cluster.png` | Primary desktop and mobile product visual |
| `benefit-save-together.png` | Save together benefit |
| `benefit-grow-future.png` | Grow their future benefit |
| `benefit-learn-safely.png` | Learn safely benefit |
| `edventures-wallet-leaf-mark.png` | Header and footer mark |
| `family-path-wallet.png` | Origin/trust section |
| `japan-goal-vignette.png` | Optional offer-card landscape |
| `founding-family-stamp.svg` | Preferred scalable founding badge |
| `founding-family-stamp.png` | Raster fallback |

The website mockups are references and should not be embedded into the production page.

## 17. Source-of-truth warning for market claims

Do not place **“children control $101 billion”** on this conversion page by default. It adds cognitive load and is an extrapolated spending-power estimate rather than wallet balances or verified transaction data.

If used on a separate investor or market page, qualify it:

> A 2025 DKC survey estimates that U.S. children ages 8–14 have $101 billion in annual direct spending power.

Add a visible source footnote.

## 18. Definition of done

- [ ] A visitor understands “family wallet” without scrolling.
- [ ] The primary CTA is visible above the fold at 390×844.
- [ ] Every primary CTA opens the same reservation flow.
- [ ] The homepage has no more than five main sections.
- [ ] Hero support copy is 22 words or fewer.
- [ ] There are exactly three benefits and four steps.
- [ ] Desktop and mobile compositions are independently tuned.
- [ ] No child information is collected.
- [ ] Payment is handled by hosted checkout.
- [ ] Checkout copy states the final refund policy.
- [ ] Privacy and Terms appear before payment.
- [ ] Analytics contain no personal or financial data.
- [ ] Keyboard, screen-reader, zoom, and reduced-motion checks pass.
- [ ] Images are responsive and do not cause layout shift.
- [ ] There are no trading charts, token tickers, fake testimonials, or speculative language.
- [ ] Lighthouse targets: Performance 90+, Accessibility 95+, Best Practices 95+, SEO 90+.

