# Edventures Wallet wallet UI specification

Edventures Wallet is a calm, family-first digital wallet for saving, allowances, and age-appropriate financial learning.

**Product line:** Digital money. Family rules.  
**Experience promise:** Help families grow money confidence together without trading, gambling, or speculative clutter.

The PNGs in `mockups/` are visual references. Rebuild the interface with native text and components; do not ship screenshots as UI. Custom illustrations are provided separately in `assets/`.

## 1. Experience principles

1. **Family before finance.** Lead with people, goals, and progress—not tokens or market charts.
2. **Explain before action.** Every unfamiliar action gets one plain-language sentence before its CTA.
3. **One primary decision per screen.** Supporting actions remain visually quieter.
4. **Permission is visible.** Clearly state who can spend, approve, change, or recover funds.
5. **Progress should feel warm, not addictive.** Celebrate consistency with gentle motion and illustration; avoid streak anxiety, confetti overload, countdowns, and casino patterns.
6. **Crypto stays under the hood.** There are two assets and they are called **USD** and **Solana** (SOL): never USDC, stablecoin, token, or any other coin. USD is held, spent, saved and swapped; Solana is held and, later, earns interest in a “Solana savings account” with one info icon that says where the interest comes from. Say “your list” and “your limit.” There are no seed phrases in Edventures Wallet: a lost device is recovered by the parent, so never ask a family to write anything down. Use “network” only where the distinction matters. See `KIT-ASSET-BRIEF.md` for the artwork rules.

## 2. Brand tokens

### Color

| Token | Hex | Use |
|---|---:|---|
| `--sand` | `#F4ECDD` | Main canvas; approximately 60% of the interface |
| `--sand-dark` | `#E4D4B8` | Dividers, secondary surfaces, progress tracks |
| `--forest` | `#2E4636` | Primary text, navigation, controls; approximately 25% |
| `--forest-light` | `#3F6049` | Hover states, supporting surfaces |
| `--terracotta` | `#C2693F` | Primary CTA and progress accents; approximately 10% |
| `--terracotta-dark` | `#A4502C` | Pressed CTA, critical emphasis |
| `--ink` | `#221F1A` | Highest-contrast text; approximately 5% |
| `--white` | `#FFFDF8` | Elevated card surface |
| `--blue-muted` | `#48788F` | Travel and education accents only |
| `--success` | `#4E7657` | Completed lesson or funded state |
| `--warning` | `#B47A32` | Needs-review state, never speculative urgency |

Maintain the brand balance: **60% sand / 25% forest / 10% terracotta / 5% ink**.

```css
:root {
  --sand: #f4ecdd;
  --sand-dark: #e4d4b8;
  --forest: #2e4636;
  --forest-light: #3f6049;
  --terracotta: #c2693f;
  --terracotta-dark: #a4502c;
  --ink: #221f1a;
  --white: #fffdf8;
  --blue-muted: #48788f;

  --font-display: "Fraunces", Georgia, serif;
  --font-body: "Inter", system-ui, sans-serif;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 22px;
  --radius-pill: 999px;
  --shadow-card: 0 8px 28px rgb(34 31 26 / 8%);
  --focus: 0 0 0 3px rgb(194 105 63 / 35%);
}
```

### Type

- Display/headings: **Fraunces**, 600 weight. Warm, human, sentence case.
- UI/body/numbers: **Inter**, 400–700 weight.
- Use tabular numerals for balances and contribution values.
- Never use all caps for ordinary UI labels.

| Role | Mobile style |
|---|---|
| Display | 40/44, Fraunces 600 |
| Page title | 30/36, Fraunces 600 |
| Section title | 22/28, Fraunces 600 |
| Large balance | 36/40, Inter 700, tabular numerals |
| Body | 16/24, Inter 400 |
| UI label | 14/20, Inter 600 |
| Caption | 12/16, Inter 500 |

### Shape and depth

- Cards: 20–22px radius, one-pixel `--sand-dark` border, very soft shadow.
- Buttons: 16px radius or pill for compact controls; 52–56px minimum height.
- Touch targets: minimum 44×44px.
- Avoid glassmorphism, neon gradients, glossy coin effects, and finance-terminal density.
- Use hand-painted illustrations as moments of warmth, not as card backgrounds behind text.

## 3. App shell

- Reference viewport: **390×844px**. Support 360px through tablet widths.
- Horizontal page gutter: 20px at 390px, 24px at 430px+.
- Content max-width on tablet: 560px, centered.
- Top safe area: platform inset + 12px.
- Bottom navigation: 72px + platform safe area; fixed with a solid sand/white surface.
- Vertical rhythm: 24px between major sections, 12px between related elements.
- Scroll content must clear the bottom navigation by at least 96px.

### Navigation model

| Destination | Purpose | Child access |
|---|---|---|
| Home | Balance, family members, current priorities | Own summary only |
| Goals | Shared saving goals | Contribute within limits |
| Learn | Short financial and security lessons | Yes |
| Family | Allowances, rules, approvals, recovery | Parent-managed |

Recommended icon set: **Lucide** with 2px strokes. Use `Home`, `Target`, `BookOpen`, `Users`, `Plus`, `Send`, `PiggyBank`, `Bell`, `Menu`, `ArrowLeft`, `MoreHorizontal`, `ShieldCheck`, `CalendarDays`, `GraduationCap`, `Heart`, `ShoppingCart`, and `Sprout`. Interface symbols should remain code-native rather than raster assets.

## 4. Reusable components

### `BrandMark`

- Use `assets/edventures-wallet-leaf-mark.png` at 28–36px.
- Pair with a Fraunces wordmark rendered as live text: **Edventures Wallet**.
- Accessible label: “Edventures Wallet home.”

### `PrimaryButton`

- Full width, 54px tall, terracotta fill, `--white` label.
- Hover: `--terracotta-dark`; pressed: translate Y by 1px.
- Only one primary button should be visible in the main decision area.

### `FamilyAvatar`

- Sizes: 36px compact, 52px standard, 72px selector.
- Use the matching PNG from `assets/` and preserve the entire circular rim.
- Add live-text names beneath selector avatars; never bake names into images.

### `BalanceCard`

- Forest surface, white primary value, sand secondary label.
- Hide/reveal control must have an accessible text label.
- Keep token breakdowns behind disclosure; the family balance is the default.

### `QuickAction`

- Circular 48px icon button above a 13–14px label.
- Maximum three in a row: **Add money**, **Send**, **Save**.
- Child users only see actions allowed by their family rules.

### `ProgressBar`

- Height 10–12px, sand-dark track, terracotta fill, fully rounded ends.
- Always pair color with live text such as “61%” and “$3,680 of $6,000.”
- Animate only on first appearance, 350ms ease-out; respect reduced motion.

### `GoalCard`

- Title, human description, amount/progress, participant avatars, and one action.
- Optional illustration sits above or to the right; keep a quiet text surface.

### `LessonCard`

- Show one lesson idea, estimated duration, progress, and a single start/continue CTA.
- Completion uses a check plus text—not color alone.
- Use the owl only as a guide or explainer, never as a pressure mechanic.

### `PermissionNotice`

- Sand-dark or pale green surface with `ShieldCheck`.
- Plain-language pattern: “Maya approves every change.”
- A details disclosure explains limits, recovery, and reversibility.

### `BottomNav`

- Four destinations. Selected item uses forest text and a soft terracotta/sand indicator.
- Labels remain visible; do not use icon-only navigation.

## 5. Page specifications

### Page 01 — Onboarding

Reference: `mockups/01-onboarding.png`  
Hero asset: `assets/family-path-wallet.png`

**Goal:** establish safety, family ownership, and warmth before asking for setup details.

**Order**

1. Brand mark and wordmark.
2. Display headline: **Digital money. Family rules.**
3. Body: **Learn together, save for what matters, and give kids room to grow—with you in control.**
4. Family path illustration, centered and no more than 42% of viewport height.
5. Primary CTA: **Start our family wallet**
6. Supporting line: **Small steps. A bigger world.**

**Behavior**

- CTA starts a short setup sequence: adult identity → family members → permissions → recovery.
- Explain self-custody or account recovery only when it becomes actionable.
- Do not show assets, prices, or token charts on this screen.

### Page 02 — Family home

Reference: `mockups/02-family-home.png`  
Assets: `avatar-maya.png`, `avatar-aria.png`, `avatar-eli.png`

**Goal:** answer “How is our family doing?” in five seconds.

**Order and copy**

1. Greeting: **Good morning, Maya**
2. Balance card: **Family balance** / **$8,420.16**
3. Profile selector: **Maya**, **Aria**, **Eli**
4. Quick actions: **Add money**, **Send**, **Save**
5. Goal card: **Japan together** / **$3,680 of $6,000**
6. Lesson card: **Who can move your money: your list and your limits**
7. Bottom navigation.

**Behavior**

- Switching a family member changes the summary to that member’s permitted view.
- Parent mode exposes approvals; child mode exposes only available and saved amounts.
- Notifications prioritize approvals, completed deposits, and security—not price movement.

### Page 03 — Shared goal: Japan together

Reference: `mockups/03-shared-goal-japan.png`  
Hero asset: `assets/japan-goal-vignette.png`

**Goal:** turn saving into a shared family story.

**Order and copy**

1. Back button, title: **Japan together**, overflow menu.
2. Label: **Family goal**
3. Hero vignette.
4. Progress: **$3,680 saved** / **61%** / **$6,000 goal**
5. Contributions:
   - **Maya — $2,900**
   - **Aria — $430**
   - **Eli — $350**
6. Primary CTA: **Add to our goal**
7. Closing line: **Different contributions. Same direction.**

**Behavior**

- Contribution flow shows source, amount, frequency, and whether approval is required.
- Children may contribute within parent-set limits; withdrawals remain parent-controlled.
- Goal details can include target date and a plain-language asset choice.

### Page 04 — Aria’s education fund

Reference: `mockups/04-education-fund.png` (the mockup shows Bitcoin; build the USD version below)  
Hero asset: `assets/savings-grow-usd.png` (the same plant-on-coins with “$” coins; see `KIT-ASSET-BRIEF.md`)

**Goal:** make recurring long-term saving understandable and controlled.

**Order and copy**

1. Back button and title: **Aria’s education fund**
2. Category: **Savings plan** (digital dollars)
3. Recurring amount: **$25 every month**
4. Schedule: **Next contribution: Oct 1**
5. Illustration.
6. Benefits: automatic, long-term, visible to the family.
7. Permission notice: **Maya approves every change.**
8. Primary CTA: **Review savings plan**

**Behavior**

- Balances are USD; show them as dollars, never as a token name or symbol. Solana is the only other asset and is called Solana or SOL.
- Parent confirmation must show fee information and who can withdraw, in plain language.
- Changing amount, schedule, or funding source requires parent authentication.
- Never imply guaranteed returns or show projected gains as certain. A yield option, if ever added, is a separate parent decision.

### Page 05 — Eli’s allowance and learning

Reference: `mockups/05-allowance-learning.png`  
Guide asset: `assets/owl-compass-guide.png`

**Goal:** connect a real allowance with one practical money skill.

**Order and copy**

1. Title: **Eli’s weekly allowance**
2. Amount: **$12 every week**
3. Allocation:
   - **Save — 50%**
   - **Spend — 40%**
   - **Give — 10%**
4. Learning progress: **3 lessons completed**
5. Lesson title: **Before you send**
6. Checklist: **Check the person. Check the amount. Check your limit.**
7. Primary CTA: **Practice with $1**

**Behavior**

- Practice occurs in a simulation or parent-controlled sandbox—never an irreversible live transfer.
- A real payment uses a separate review screen and parent rules.
- The allowance allocation uses direct manipulation but requires a total of 100%.

## 6. Interaction states

Every money-moving component needs these states:

- `idle`
- `pressed`
- `loading` with specific copy, e.g. “Adding to Japan together…”
- `success` with receipt/reference
- `needs_approval`
- `scheduled`
- `failed_recoverable` with a clear retry
- `blocked_by_rule` with the relevant family rule and who can change it

Do not use “Something went wrong” when a specific cause is known.

## 7. Safety and accessibility

- WCAG AA contrast minimum for all text and controls.
- Dynamic type must work to 200% without clipping values or CTAs.
- Never rely on red/green alone; add an icon and explicit label.
- Biometrics are a convenience layer, not the only recovery method.
- Require review for address, network, amount, fee, and approver before an irreversible transfer.
- Hide balances in app switcher previews and provide a persistent balance-privacy setting.
- Parent and child roles must be enforced server-side, not only hidden in the client.
- Avoid dark patterns: no countdowns, loss framing, streak punishment, or price alerts by default.
- Use age-appropriate language and obtain parental consent before creating child profiles.

## 8. Suggested data model

```ts
type Role = "owner" | "parent" | "child";

interface FamilyMember {
  id: string;
  name: string;
  role: Role;
  avatarSrc: string;
  spendLimitMinor?: number;
}

interface SavingsGoal {
  id: string;
  title: string;
  targetMinor: number;
  savedMinor: number;
  currency: string;
  targetDate?: string;
  contributions: Array<{ memberId: string; amountMinor: number }>;
}

interface RecurringSavingsPlan {
  id: string;
  beneficiaryId: string;
  /** Digital dollars only in this build. */
  asset: "USD";
  amount: string;
  cadence: "weekly" | "monthly";
  nextRunAt: string;
  approvalRequired: boolean;
}

interface AllowanceRule {
  childId: string;
  amountMinor: number;
  cadence: "weekly" | "monthly";
  allocation: { save: number; spend: number; give: number };
}
```

## 9. Asset manifest

| File | Purpose | Recommended placement |
|---|---|---|
| `assets/edventures-wallet-leaf-mark.png` | Brand emblem | Header, onboarding, app icon source |
| `assets/family-path-wallet.png` | Family safety/onboarding hero | Page 01 |
| `assets/japan-goal-vignette.png` | Shared travel goal | Page 03 and compact goal cards |
| `assets/savings-grow-usd.png` | Long-term savings illustration (“savings grow”, “$” coins) | Page 04 |
| `assets/owl-compass-guide.png` | Learning guide | Page 05 and lesson empty states |
| `assets/avatar-maya.png` | Parent avatar | Profile switcher and approvals |
| `assets/avatar-aria.png` | Child avatar | Profile switcher and contributions |
| `assets/avatar-eli.png` | Child avatar | Profile switcher and allowance |

All assets are PNG. The production assets contain alpha transparency. Keep aspect ratio, use `object-fit: contain`, and do not crop faces or the leaf emblem.

## 10. Suggested project structure

```text
src/
  assets/illustrations/
  components/
    AppShell.tsx
    BalanceCard.tsx
    BottomNav.tsx
    FamilyAvatar.tsx
    GoalCard.tsx
    LessonCard.tsx
    PermissionNotice.tsx
    PrimaryButton.tsx
    ProgressBar.tsx
    QuickAction.tsx
  pages/
    OnboardingPage.tsx
    FamilyHomePage.tsx
    SharedGoalPage.tsx
    EducationFundPage.tsx
    AllowanceLearningPage.tsx
  styles/tokens.css
```

## 11. Motion guidance

- Standard transition: 180–220ms ease-out.
- Progress fill: 350ms once when entering the view.
- Success: small leaf lift or check draw, under 600ms.
- Owl: blink or slight compass tilt only after a user action; never loop continuously.
- Honor `prefers-reduced-motion` by removing transforms and nonessential animation.

## 12. Copy checklist

- Sentence case.
- One idea per sentence.
- Prefer “Add to our goal” over “Execute contribution.”
- Prefer “Maya approves every change” over “Admin authorization required.”
- Explain fees, limits, who can move the money, and finality before confirmation.
- Never frame speculation as education.

