# Yield2Pay Design System

Yield2Pay is a B2B fintech: a company makes a **single capital deposit**, Yield2Pay puts that
capital to work, and the **returns automatically pay for the company's software** (AI tools
and SaaS subscriptions). The company never spends its own cash on those tools — only the
yield works for it — and the capital stays the company's, withdrawable anytime.

This design system captures the **"private bank, digital" aesthetic** the product launched
with: sober, premium, monochrome **black + polished silver**, with **brushed-metal surfaces**
as the signature material. It is reserved and confident — closer to a metal charge card or a
private-bank statement than a loud crypto startup.

> **Source of truth:** this system was derived from the Yield2Pay marketing landing page
> (`Yield2Pay.dc.html` in the originating project — the "Material / metal" art direction).
> There is no external codebase or Figma; the landing page is the canonical reference.

---

## Index / manifest

- **`styles.css`** — root entry point; `@import`s every token + font file. Consumers link this.
- **`tokens/`** — `typography.css`, `colors.css`, `spacing.css`, `radius.css`, `shadows.css`,
  `motion.css`, `base.css`. CSS custom properties (prefixed `--fx-`).
- **`guidelines/`** — foundation specimen cards (Type, Colors, Spacing, Brand) for the Design
  System tab.
- **`components/`** — reusable React primitives, each with `.jsx` + `.d.ts` + `.prompt.md` and a
  directory `@dsCard`:
  - `button/` **Button** · `badge/` **Badge** · `eyebrow/` **Eyebrow** · `icon-tile/` **IconTile**
    · `metal-card/` **MetalCard** · `stat-panel/` **StatPanel**
  - `forms/` **Input · Select · Switch · SegmentedControl**
  - `display/` **Divider · StatTile · ProgressBar · SubscriptionRow · SectionHeading**
  - `navigation/` **Header · Footer · Marquee**
- **`ui_kits/`** — high-fidelity, interactive recreations composed from the primitives:
  - `yield2pay-landing/` — marketing landing (EN/PT toggle).
  - `yield2pay-dashboard/` — logged-in product overview (capital, returns, subscriptions paid).
  - `yield2pay-deposit/` — 3-step capital-deposit / onboarding flow with live returns projection.
- **`assets/`** — `logo-mark.svg` (the silver diamond mark).
- **`docs/BRIEFING.md`** — design brief (PT-BR): audience, feel, the precious-metals theme and how it
  applies to the site. Read first.
- **`SKILL.md`** — portable skill manifest (for Claude Code / Agent Skills).

Starting points are registered on `MetalCard`, `StatPanel`, `Button`, `Header`, and all three
UI-kit screens.

---

## CONTENT FUNDAMENTALS

**Voice.** Calm, plain-spoken, reassuring. It explains a novel mechanic in everyday words and
keeps promising the same three things: *you spend nothing*, *your money stays yours*, *withdraw
anytime*. No hype, no exclamation marks, no jargon beyond "capital", "returns", "subscriptions".

**Person.** Second person — "**you** / **your**". The company is "we" sparingly ("We put your
capital to work"). The reader's business is always the subject.

**Casing.** **Sentence case everywhere** — headlines, buttons, nav. Never ALL CAPS for prose.
The only uppercase is the **mono eyebrow/kicker** label (e.g. `BANKING, REINVENTED FOR SOFTWARE`)
and small mono meta inside cards (`CAPITAL WORKING`, `ACTIVE`) — set via letter-spacing, used as
a typographic accent, not for emphasis.

**Sentence shape.** Short. Often two beats joined by a period or em-dash:
*"Your capital pays for your software. You spend nothing."* /
*"Deposit once. The returns cover your subscriptions — automatically."*

**Numbers.** Monospace, concrete, plausible: `$18,400.00`, `+8.4% / yr`, `$214.80`, `7 tools`.
Localized per language (BRL uses `R$ 92.000,00`, `+8,4% / ano`).

**Bilingual.** Built EN + PT-BR, English default (global focus). Keep both in lockstep; tone is
identical in both. Examples — EN: *"Put your idle capital to work."* PT: *"Coloque seu capital
parado para trabalhar."*

**Emoji.** None. Ever. The brand's warmth comes from clarity and material, not emoji.

---

## VISUAL FOUNDATIONS

**Palette.** Strictly **monochrome**: near-black ink (`--fx-bg #0c0d0f`) through brushed greys to
**polished silver** (`--fx-silver #C0C2C5`, `--fx-silver-bright #D4D6D9`). **No vibrant hues** —
no purple, neon blue, or loud green. Elegance comes from black/silver contrast and negative space.
Primary actions use a **polished chrome gradient** (`--fx-chrome`, `#E6E8EA → #A8AAAD`) with dark
ink text.

**The signature material: brushed metal.** Cards, panels, chips and the hero centerpiece are not
flat — they use `--fx-metal` (a 135° multi-stop grey gradient) layered with a fine diagonal
**grain** (`--fx-metal-grain`) and edged with a 1px metal border (`--fx-border-metal`) plus a
**1px inner top-highlight** (`--fx-inset-edge`) that reads as light on a beveled edge.

**Light sweep.** The motif that makes metal feel real: a soft diagonal highlight (`--fx-sweep`)
that travels across a surface. It loops slowly (`--fx-dur-sweep`) on hero/CTA panels and fires
**once on hover** for grid cards and logo chips.

**Typography.** Two families only:
- **Hanken Grotesk** — display + body. Headings are weight 700, tight tracking
  (`--fx-tracking-display -0.025em`), and carry the **embossed text-shadow** (`--fx-emboss`) so
  type looks pressed into metal. Hero is fluid `clamp(38px, 5.6vw, 66px)`.
- **Geist Mono** — all data, labels, eyebrows, balances. Letter-spaced uppercase for kickers;
  natural for big numbers.

**Backgrounds.** Pure near-black with **static radial spotlights** behind sections
(`radial-gradient(... rgba(192,194,197,.05) ...)`) for depth. Backgrounds **do not animate** —
motion belongs to the metal, not the canvas. No images, no patterns, no full-bleed photography.

**Motion.** Restrained. Entrances **fade in** (opacity only — no big vertical travel); a subtle
stagger across grids. The hero panel **floats** gently and enters with a slight 3D tilt. Logos
scroll in an **infinite marquee** (pauses on hover). Everything respects
`prefers-reduced-motion`. Easing is `--fx-ease`.

**Hover / press.** Buttons: lift `translateY(-1px) scale(1.02)`, a brighter filter, and a silver
glow ring + chrome shine sweep. Cards: border brightens to `--fx-border-metal`, a hover light
sweep, and a small 3D tilt that follows the cursor on fine pointers. Links: muted → `--fx-text`.

**Borders.** Hairline, 1px. `--fx-border` for controls, `--fx-border-strong` for card edges,
`--fx-border-metal` for metal panels, `--fx-border-faint` (white @ 6%) for footer/dividers.
Dividers are often a center-fading gradient rule, not a solid line.

**Elevation.** Deep, soft drop shadows on black (`--fx-shadow-card` → `--fx-shadow-hero`) always
paired with the inner top-highlight. Higher = darker/larger shadow, never a colored glow (except
the optional silver hover ring).

**Radii.** `5px` engraved chips → `12px` icon tiles → `14px` small surfaces → `18px` cards →
`22–26px` large panels → `999px` pills/buttons. Cards are generously rounded, never sharp.

**Layout.** Centered, max `1200px`, `24px` gutters. Generous `clamp(86px,11vw,128px)` section
padding. Grids use `repeat(auto-fit, minmax(...))` with `gap`. Header is fixed and becomes a
translucent **backdrop-blur** bar once scrolled.

---

## ICONOGRAPHY

Icons are **thin line (stroke) icons**, 1.4px stroke, rounded caps/joins, on a 24×24 grid, drawn
in silver (`--fx-silver` / `--fx-silver-bright`). They sit inside **metal icon tiles** (`IconTile`)
— a 44–48px rounded-square brushed surface — or inline next to trust points. The visual weight
matches **Lucide** (https://lucide.dev) at stroke-width ~1.4–1.6, which is the recommended CDN
source for any icon not already in the system; match the thin stroke and rounded joins.

- **No emoji**, ever. **No filled/duotone icons** — line only.
- Unicode is used sparingly for tiny inline marks: `▲` for a positive return, `◆` (silver
  rotated square) as the Yield2Pay logo mark, `·` as a separator.
- The **logo** is the wordmark "Yield2Pay" (Hanken Grotesk 700, `-0.01em`) preceded by a small
  silver gradient diamond (an 11px rotated, radius-2 square with a soft glow). See
  `assets/logo.svg`.

If you need icons beyond the bundled set, pull from Lucide via CDN and keep stroke-width 1.4–1.6,
`currentColor` set to a silver token. **Flag** any icon substitution to the user.

---

## CAVEATS

- Fonts are served from **Google Fonts** (Hanken Grotesk, Geist Mono) — these match the live
  site, so no substitution, but swap to self-hosted `@font-face` if you need offline/perf.
- There was **no codebase or Figma** — everything here is reverse-engineered from the landing
  page, so component props are a sensible interpretation, not an existing API.
