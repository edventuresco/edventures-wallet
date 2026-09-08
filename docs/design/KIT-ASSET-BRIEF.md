# Kit asset brief

Artwork the component kit (`/kit`, `components/ui/`) needs so the real
screens can match `docs/design/mockups/`. Written 2026-09-08 for Britt;
the components get built in parallel and pick these up by filename.

Everything lands in `public/illustrations/`. Filenames below are final.

## Naming rules (apply to every piece)

- Money is **USD** and **Solana** (SOL). Never USDC, stablecoin, token,
  Bitcoin, BTC, or any third-party coin logo, in artwork or lettering.
- USD is a plain **"$" coin**. Solana is a plain coin with a simple
  stylised mark; it does not need the official logo.
- Solana that earns interest is a **"Solana savings account"**: a sprout or
  plant on a coin, never a chart, arrow-up, or percentage.
- No prices, charts, candles, rockets, or trading imagery anywhere.
- No text baked into images. Names, amounts and taglines are live text.

## Style

Same hand as the existing set: painted, soft edges, warm paper feel.
Palette from the UI spec: sand `#F4ECDD`, sand-dark `#E4D4B8`, forest
`#2E4636`, terracotta `#C2693F`, ink `#221F1A`, olive `#596941`, sage
`#7B9271`, blue-muted `#48788F` (travel and education only). Kid-only
pieces may use the kid palette (kid-green `#27663C`, kid-sun `#FABA2A`,
kid-teal `#39A1AD`, kid-purple `#A36DB0`, kid-orange `#EC822F`).

## Formats

| Kind | Format | Size | Notes |
| --- | --- | --- | --- |
| Avatar | PNG, alpha | 1254 × 1254 | Circular portrait with the painted rim, like `avatar-maya.png`. Nothing cropped at the rim. |
| Spot illustration | PNG, alpha | 1254 × 1254 | Sits in a card or empty state at 120–200px. Read well small. |
| Wide vignette | PNG, alpha | 1774 × 887 | Goal hero and compact goal card, like `japan-goal-vignette.png`. Keep the subject in the right two-thirds so a title can overlay the left. |
| Scene | PNG, alpha | 1536 × 1024 | Full-width moment, like `family-path-wallet.png`. |
| Decoration | PNG, alpha | as noted | Faded, low contrast; text sits on top of it. |
| Icon | SVG | 24 × 24 viewBox | 2px stroke or solid fill, single colour via `currentColor`, matches Lucide weight. |
| Glyph | SVG | 48 × 24 viewBox | Small line-art accents beside a tagline. |

Keep sources under 2 MB; the app resizes them. sRGB.

## Keep as they are

`edventures-wallet-leaf-mark.png`, `family-path-wallet.png`,
`japan-goal-vignette.png`, `owl-compass-guide.png`, `avatar-maya.png`,
`avatar-aria.png`, `avatar-eli.png`, the three `benefit-*.png` (landing),
`hero-phone-cluster.png` (landing), `founding-family-stamp.*` (landing).

## Retire

`bitcoin-growth-plant.png` — replaced by `savings-grow-usd.png` below.

## P1 — needed for the first screens (Home, Family, Goal detail, Allowance)

### Brand and chrome

| File | Used by | Spec | What it is |
| --- | --- | --- | --- |
| `leaf-mark.svg` | `BrandMark`, `GreetingHeader`, app icon | Icon (any viewBox, single forest fill) | Vector of the existing leaf mark so it stays crisp at 28–36px. |
| `app-icon.png` | PWA icon, home screen | 1024 × 1024, no alpha, maskable-safe (subject inside the central 80%) | Leaf mark on forest. The current icons are placeholders. |
| `header-art.png` | `GreetingHeader` on Home and Family | Decoration, 1200 × 700 | Mountains, pines, sun and two birds at ~20% opacity, faded into sand at the left and bottom. Sits top-right behind the greeting (mockup 02). |
| `corner-foliage-left.png`, `corner-foliage-right.png` | Onboarding, Allowance, Learn | Decoration, 600 × 600 each | Leaf sprigs for the bottom corners (mockup 01, 05). |
| `glyph-mountains.svg`, `glyph-compass.svg`, `glyph-leaf.svg` | `Tagline`, `QuoteBlock` | Glyph | Thin line-art: a mountain ridge, a compass rose, a single leaf (mockups 03, 04, 05). |

### Icons (things Lucide does not have)

| File | Used by | What it is |
| --- | --- | --- |
| `icon-family.svg` | `BalanceCard` (family balance) | Three people, the middle one taller, solid forest (mockup 02). |
| `icon-shield-sprout.svg` | `PermissionNotice` | Shield with a sprout inside, solid (mockup 04). |
| `icon-usd-coin.svg` | `BalanceCard`, `StatTile`, Swap | A round coin with "$". |
| `icon-solana-coin.svg` | `BalanceCard`, Swap, Solana savings | A round coin with a simple Solana mark. |
| `icon-savings-sprout.svg` | Solana savings account card, info disclosure | Sprout growing from a coin. This is the only "earning" image; it pairs with an info icon that explains where the interest comes from. |

### Avatars

The picker has 3 illustrated people and 20 emoji animals today; the emoji
render inconsistently and clash with the painted look. Grown-ups also get
an avatar (they show as 🧑 now).

| File | What it is |
| --- | --- |
| `avatar-adult-01.png` … `avatar-adult-04.png` | Four more grown-ups, varied in age, skin tone and hair, same warmth as Maya. |
| `avatar-kid-01.png` … `avatar-kid-04.png` | Four more kids, varied, ages 6–14. |
| `avatar-otter.png` (default), `avatar-fox.png`, `avatar-panda.png`, `avatar-koala.png`, `avatar-owl.png`, `avatar-bunny.png`, `avatar-puppy.png`, `avatar-kitten.png`, `avatar-penguin.png`, `avatar-turtle.png`, `avatar-lion.png`, `avatar-frog.png` | Twelve painted animals, head-and-shoulders, friendly, same rim. Ids match `lib/avatars.ts` so families keep their pick. |
| `avatar-family.png` | The family as a whole: the house with the leaf wallet (mockup 01). Used in the feed and the kid's "your people". |
| `avatar-shop.png` | A small storefront with an awning. Used when a kid pays a shop. |

### Illustrations

| File | Used by | Spec | What it is |
| --- | --- | --- | --- |
| `savings-grow-usd.png` | `PlanCard`, education fund, savings plan | Scene | The plant-on-coins from mockup 04 with "$" coins instead of Bitcoin. Keep the "small amounts grow" feel. |
| `solana-savings.png` | Solana savings account card | Spot | A sprout in a pot on a Solana coin, forest and sage. Calm, no arrows. |
| `goal-trip.png` | Goal vignettes (kind: trip) | Wide | A generic journey: road, hills, a small car or train, no landmark. Japan stays for that specific goal. |
| `goal-bike.png` | Goal (kind: thing) | Wide | A bicycle leaning on a fence in a field. |
| `goal-sport.png` | Goal (kind: activity) | Wide | A pool or a pitch at golden hour, a ball or a swim cap. |
| `goal-education.png` | Goal (kind: education) | Wide | Books, a graduation cap, a window with trees. |
| `goal-gift.png` | Goal (kind: giving) | Wide | Hands passing a wrapped gift, or a donation jar with a heart. |
| `goal-jar.png` | Goal fallback | Wide | A glass jar with coins and a small leaf label. |

### Owl guide poses

The owl is the app's explainer. It appears as an emoji 🦉 in five places
today. Same character as `owl-compass-guide.png`, backpack and all.

| File | Used by | Spec | Pose |
| --- | --- | --- | --- |
| `owl-hello.png` | `OwlGuide` on Home, empty states | Spot | Waving, one wing up. |
| `owl-thinking.png` | "Before you send", the info disclosure | Spot | Chin on wing, looking at a small checklist. |
| `owl-celebrate.png` | `Celebration`, lesson complete | Spot | Wings up, a leaf drifting down. No confetti. |
| `owl-waiting.png` | Needs approval, scheduled | Spot | Sitting with a lantern, patient, not asleep. |

## P2 — next screens (Learn, Requests, Swap, Settings)

| File | Used by | Spec | What it is |
| --- | --- | --- | --- |
| `empty-goals.png` | `EmptyState` on Goals | Spot | A jar with one seed in it. |
| `empty-activity.png` | `EmptyState` on Family activity and Home | Spot | A path with a signpost, nobody on it yet. |
| `empty-requests.png` | `EmptyState` on Requests | Spot | A quiet mailbox with a leaf on top. |
| `empty-people.png` | `EmptyState` on the kid's contact list | Spot | Two empty chairs on a porch. |
| `swap-usd-sol.png` | Swap screen | Spot | A "$" coin and a Solana coin trading places, two curved arrows. |
| `learn-hero.png` | Learn tab header | Scene | The owl at a trailhead with a map; lesson cards sit below it. |
| `goal-pet.png`, `goal-game.png`, `goal-music.png`, `goal-camp.png` | More goal kinds | Wide | A kitten in a basket; a board game on a table; a guitar by a window; a tent by a lake. |
| `lesson-star.svg` | `LessonProgress` | Icon | A rounded five-point star, solid, kid-sun (mockup 05). |

## P3 — later

| File | Used by | Spec | What it is |
| --- | --- | --- | --- |
| `onboard-device.png`, `onboard-family.png`, `onboard-rules.png` | Onboarding pages 2–4 | Scene | Pairing this phone (a phone with a leaf key); adding the family (three backpacks on hooks); setting rules (a signpost with three arms). |
| `celebration-leaf.png` | Success moments | Spot, 600 × 600 | A single sprig for the leaf-lift animation. |
| `og-share.png` | Link previews | 1200 × 630, no alpha | Family path scene with room for the wordmark. |

## Not assets: two decisions for Mark

1. **Handwritten accents.** The mockups use a script for "Brighter tomorrows
   together", "Small amounts grow big futures", "Good people further
   together", "Small steps today. Brighter tomorrows.", "Same direction.",
   "Learn today. Brighter tomorrow." Either pick a Google font (Caveat is
   the closest) and keep them as live text, or Britt letters those six as
   SVGs. Live text is the recommendation; it scales and translates.
2. **Solana savings interest explainer.** One info icon, one sentence, one
   short disclosure: "Your Solana is lent to help run the network, and the
   network pays a little back. Sanctum handles it. You can take it out any
   time." Copy to be agreed; no artwork beyond `icon-savings-sprout.svg`.

## Component to asset map

| Component | Assets |
| --- | --- |
| `BrandMark` | `leaf-mark.svg` |
| `GreetingHeader` | `leaf-mark.svg`, `header-art.png` |
| `BalanceCard` | `icon-family.svg`, `icon-usd-coin.svg`, `icon-solana-coin.svg`, `glyph-leaf.svg` |
| `Avatar`, `AvatarRow`, `PersonRow`, `ContributionRow`, `FeedRow` | the avatar set |
| `GoalCard`, `HeroVignette` | `goal-*.png`, `japan-goal-vignette.png` |
| `PlanCard` | `savings-grow-usd.png`, `solana-savings.png` |
| `PermissionNotice` | `icon-shield-sprout.svg` |
| `LessonCard`, `LessonProgress` | `owl-compass-guide.png`, `lesson-star.svg` |
| `OwlGuide`, `Celebration`, `MoneyState` | the owl poses |
| `EmptyState` | `empty-*.png` |
| `Tagline`, `QuoteBlock` | `glyph-*.svg` |
| Onboarding, Allowance | `corner-foliage-*.png`, `onboard-*.png` |
| Swap | `swap-usd-sol.png`, the two coin icons |
