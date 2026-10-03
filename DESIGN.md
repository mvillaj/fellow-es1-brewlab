---
name: Crema
description: A warm, quiet bench logbook for the Fellow ES1, in dark and light.
colors:
  crema-amber: "#e0a458"
  crema-amber-dim: "#a97a3f"
  crema-amber-hover: "#eab066"
  espresso-rust: "#c4703f"
  on-accent: "#241606"
  roast-black: "#100e0c"
  counter-raised: "#17140f"
  surface: "#1d1915"
  surface-2: "#241f1a"
  border: "#322b24"
  border-strong: "#453b31"
  steamed-milk: "#f3ece2"
  text-dim: "#b3a596"
  text-faint: "#7d7266"
  good-sage: "#7fae72"
  warn-honey: "#d9a441"
  bad-cherry: "#d4674f"
  cool-water: "#6f9dc4"
  light-crema-amber: "#9c6416"
  light-crema-amber-hover: "#855314"
  light-espresso-rust: "#a2542a"
  light-on-accent: "#fffaf2"
  light-paper: "#f7f3ec"
  light-surface: "#fffdfa"
  light-surface-2: "#f0e9de"
  light-border: "#e2d8c9"
  light-border-strong: "#c8b9a4"
  light-ink: "#241c14"
  light-text-dim: "#665949"
  light-text-faint: "#907f6c"
  light-good-sage: "#46733a"
  light-warn-honey: "#97690f"
  light-bad-cherry: "#a83f28"
  light-cool-water: "#3a6a91"
typography:
  wordmark:
    fontFamily: "Space Grotesk, Inter, -apple-system, sans-serif"
    fontSize: "1.72rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.022em"
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.4rem"
    fontWeight: 600
    letterSpacing: "-0.015em"
  subtitle:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 500
    letterSpacing: "0.1em"
  reading:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1.7rem"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  pip: "6px"
  sm: "8px"
  md: "12px"
  modal: "16px"
  pill: "99px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "18px"
  xl: "26px"
  page-x: "40px"
  control-h: "2.55rem"
components:
  button:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.steamed-milk}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-hover:
    backgroundColor: "#2c251e"
  button-primary:
    backgroundColor: "{colors.crema-amber}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-primary-hover:
    backgroundColor: "{colors.crema-amber-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.bad-cherry}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  input:
    backgroundColor: "{colors.counter-raised}"
    textColor: "{colors.steamed-milk}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
    height: "{spacing.control-h}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "18px"
  stat:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  nav-link:
    textColor: "{colors.text-dim}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-link-active:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.steamed-milk}"
  segmented:
    backgroundColor: "{colors.counter-raised}"
    rounded: "{rounded.sm}"
    padding: "3px"
---

# Design System: Crema

## Overview

**Creative North Star: "The Bench Logbook"**

Crema looks like a barista's working notebook left open on the counter: warm, dark, and quiet. Every surface is a coffee-brown tone, whether it's the near-black of a roasted bean or, in light mode, the cream of unbleached paper. Nothing on the page decorates. Numbers are set in tabular mono because they are the record, and the single amber accent marks the one thing that matters on the screen: the action to take, the page you're on, the pressure line of a shot.

Density is that of a working tool rather than a showcase. Flat bordered panels sit in a sidebar shell, and the numbers inside them carry the page. Personality lives in a few small details tied to the product: the shot-profile bar row ruled above the wordmark, and the same bars "pulling" as the loading indicator. Components are soft and warm: gently rounded corners, tinted rather than saturated status colors, pill tags. Even the precise parts never feel clinical.

Both themes are first-class. Light is not dark inverted by formula; it is the same coffee character re-tuned so the amber stays legible on cream. Crema is not a generic SaaS dashboard (no blue/purple gradients, glassy cards or meaningless hero stats), and it does not borrow Fellow's own visual language.

**Key Characteristics:**
- Warm coffee neutrals in both themes; never cool grey.
- One amber accent, kept for action and current state.
- Tabular mono for every reading, unit and setting.
- Flat tonal layers with 1px borders; the only shadow belongs to modals.
- Soft, rounded, tinted components.
- The shot-profile bar is the recurring brand signature.

## Colors

A roasted-bean palette: brown-black or cream ground, steamed-milk or ink text, a single crema-amber accent, and muted earthy status hues. All values are CSS custom properties in `client/src/styles/app.css`. Dark is the `:root` default, light overrides under `:root[data-theme='light']`, and every rule below the token blocks is shared.

### Primary
- **Crema Amber** (`crema-amber`; `light-crema-amber` in light): the primary button fill, the active nav rail, the brand bars, the pressure line and area in profile charts, star ratings, the range-slider thumb and the focus ring. In light mode it darkens to a mid-tone and takes light text (`light-on-accent`), and its hover darkens instead of lightening.
- **Crema Amber Dim** (`crema-amber-dim`): the border color of a focused input. It is quieter than the full accent, so focus reads without shouting.

### Secondary
- **Espresso Rust** (`espresso-rust`): the ramp-down stage in pressure-profile charts. It works as the darker partner to amber and never appears as a UI control color.

### Tertiary
- **Cool Water** (`cool-water`): the pre-infusion stage, the dashed flow line in profile charts, and `cool` tags. It is the one cool hue in the system and stands for water and flow.

### Neutral
- **Roast Black** (`roast-black` / `light-paper`): the page background.
- **Counter Raised** (`counter-raised`): the sidebar, input wells and segmented-control tracks; one step up from the page.
- **Surface / Surface 2** (`surface`, `surface-2`): cards and stat tiles, then the layer inside them (default buttons, the active nav item, hovered table rows).
- **Border / Border Strong** (`border`, `border-strong`): card outlines and dividers, then control outlines and unlit rating stars.
- **Steamed Milk** (`steamed-milk` / `light-ink`): primary text.
- **Text Dim / Text Faint** (`text-dim`, `text-faint`): secondary copy and field labels, then uppercase labels, units, hints and chart axes.

### Status
- **Good Sage**, **Warn Honey** and **Bad Cherry** (`good-sage`, `warn-honey`, `bad-cherry`): shot-quality coloring (rating ≥4, ≥3, below), the target-time band, banners and tags. On surfaces they always appear as a tinted pair (`--tint-*-bg` / `--tint-*-border`, `--banner-*`) and never as a solid fill.

### Named Rules
**The One Amber Rule.** Crema Amber marks action or current state: the primary button, the active nav item, the line being read. If two things on a screen are amber and only one is actionable, one of them is wrong.

**The Tinted Status Rule.** Status colors appear as text on a tinted background with a matching tinted border, never as saturated fills. It keeps a warning warm rather than alarming.

**The Per-Theme Alpha Rule.** Chart tints have separate opacities per theme (`--chart-band-opacity`, `--chart-target-opacity`, `--chart-area-opacity`), because a tint that lightens on dark has to darken on cream. Never hardcode a color or alpha at the point of use; add a token and give it both theme values.

## Typography

**Display Font:** Space Grotesk 700, reserved for the lowercase `crema` wordmark.
**Body Font:** Inter (400/500/600, falling back to the system UI stack).
**Label/Mono Font:** JetBrains Mono (400/500), with `font-variant-numeric: tabular-nums`.

**Character:** Inter carries the interface without drawing attention, and JetBrains Mono carries the data. The split is literal: if it's a measured value (grams, seconds, bar, °C, microns, a grind setting), it's mono. Space Grotesk appears once, in the brand.

### Hierarchy
- **Wordmark** (Space Grotesk 700, 1.72rem sidebar / 1.25rem top bar / 3.1rem auth, line-height 1, lowercase): the brand lockup only. It is set larger than the headings because an all-x-height word reads small.
- **Headline** (Inter 600, 2rem → 1.6rem on phones, 1.15, −0.022em): the page title in `.page-head`, followed by a dim sub-line capped at 62ch.
- **Title** (Inter 600, 1.4rem → 1.2rem, −0.015em): section headings.
- **Subtitle** (Inter 600, 1.1rem, −0.01em): card and empty-state headings.
- **Body** (Inter 400, 15px, 1.55): everything else. Inputs use 0.92rem, raised to 16px on phones so iOS doesn't zoom on focus.
- **Label** (Inter 500, 0.66–0.78rem, 0.1–0.14em tracking, uppercase): stat labels, table headers, nav group labels, the brand sub-line. Field labels use 0.78rem at 0.04em in sentence case.
- **Reading** (JetBrains Mono 400, 1.7rem → 1.4rem, tabular): stat values, with the unit at 0.9rem in Text Faint. The same face sets table numbers, number inputs and chart labels (9px, or 17px on phones in the 720-unit viewBox).

### Named Rules
**The Mono Means Measured Rule.** Every measured quantity is set in JetBrains Mono with tabular numerals, and its unit sits beside it in Text Faint at a smaller size. Prose is never set in mono.

**The One Wordmark Rule.** Space Grotesk is only for the `crema` lockup. Headings stay in Inter.

## Layout

A sidebar shell: a 232px sticky sidebar (Counter Raised, 1px right border) next to a main column capped at 1180px with 32px/40px/80px padding. Below 860px the sidebar becomes a sticky top bar, with brand and account on one line and the links on a horizontally scrolling strip beneath. The active marker turns from a left rail into a bottom rule.

Content sits in auto-fit grids, `grid-2` / `grid-3` / `grid-4` with 300 / 230 / 165px minimums and a 16px gap. At 600px and below, `grid-2` and `grid-3` collapse to one column, `grid-4` holds two columns so stat tiles don't eat the fold, and tables turn into one labelled card per row (each `td` shows its own `data-label`).

Spacing follows a loose 4px-based rhythm: 8 / 12 / 16 px for stacks and rows, 18px card padding (14px on phones), and 26px between the page header and content. Touch targets are keyed to `pointer: coarse`, not viewport width, so buttons, nav links, segmented buttons and rating stars all reach at least 44px on any touch device, touch laptops included.

## Elevation & Depth

Flat, with tonal layering. Depth comes from stepping up through Roast Black → Counter Raised → Surface → Surface 2, each separated by a 1px warm border. Cards, stat tiles and list items carry no shadow. The single shadow token belongs to the modal, which also sits over a warm scrim with a 3px backdrop blur.

### Shadow Vocabulary
- **Modal lift** (`box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.7)`; light mode `0 1px 2px rgba(60,44,26,0.08), 0 8px 24px -12px rgba(60,44,26,0.28)`): dialogs only. The light version is tinted brown, not black.

### Named Rules
**The Flat-By-Default Rule.** Surfaces separate by tone and border, not by shadow. Hover deepens the tone and strengthens the border; it never lifts.

## Shapes

Soft and warm. Corners are gently rounded throughout: 8px (`sm`) for controls, nav items and banners; 12px (`md`) for cards, stat tiles and list items; 16px for modals (14px on phones); a full pill for tags; 6px for buttons inside the segmented track. Borders are always 1px. The brand bars are near-square with a hint of rounding (0.09em) and sit flush to a shared baseline, which is also the shape language of the profile charts.

## Components

### Buttons
Soft, warm and quiet, never loud.
- **Shape:** gently rounded (8px), 1px border, Inter 500 at 0.9rem, a 7px icon gap, nowrap.
- **Default:** Surface 2 fill with Border Strong outline; on hover the fill deepens one tone and the border warms.
- **Primary:** Crema Amber fill and border, `on-accent` text at weight 600. Hover moves to `crema-amber-hover`, lighter in dark mode and darker in light. One per view.
- **Ghost:** transparent with Text Dim; on hover it takes on Surface 2 and full text color. Used for secondary actions in headers and rows.
- **Danger:** Bad Cherry text with a tinted cherry border, and a tinted cherry fill on hover. Never a solid red.
- **Small:** 5px × 10px at 0.82rem. Disabled buttons drop to 45% opacity with a not-allowed cursor.
- **Working state:** a busy button shows four `currentColor` bars pulling in sequence plus a mono elapsed-seconds clock. With reduced motion the bars hold still and the clock alone shows progress.

### Chips (Tags)
- **Style:** a pill (99px), 0.74rem, 2px × 8px, Surface 2 with a Border outline and Text Dim.
- **Variants:** `crema`, `good`, `bad` and `cool`, each its hue's text on that hue's tint pair. They label confidence (measured / community / estimated), origin and status.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Surface, with a 1px Border.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 18px (14px on phones), or 14px for `.tight`. The card head is a baseline-aligned spread with a 14px bottom margin.
- **List item:** the same panel as a link or button (15px × 17px). On hover it takes Border Strong and Surface 2.

### Inputs / Fields
- **Style:** a Counter Raised well, a Border Strong outline and 8px corners, 8px × 10px padding, and a fixed `--control-h` height (2.55rem, or 2.7rem on phones) that other elements align to.
- **Focus:** the border turns Crema Amber Dim, with a soft 3px amber halo (`--focus-ring`). The default outline is removed.
- **Numbers:** number inputs and `.numeric` fields use JetBrains Mono, tabular.
- **Labels and hints:** a dim 0.78rem label above the field and a faint 0.75rem hint below it. The hints carry the inferred machine limits.
- **Selects** draw their own two-triangle chevron in Text Faint. **Range and checkbox** controls use the amber `accent-color`.

### Navigation
- **Style:** a sidebar list of 0.92rem Text Dim links with a glyph column, grouped under uppercase 0.66rem labels.
- **Hover:** Surface background and full text color.
- **Active:** Surface 2 background with a 2px inset Crema Amber rail on the left. In the mobile top-bar strip the rail becomes a 2px bottom rule.

### Segmented Control
A Counter Raised track with a 3px inset and 6px buttons in Text Dim. The selected button takes Surface 2 and full text color. On phones it stretches to full width with equal segments. The theme toggle uses it.

### Stat Tile
A Surface panel with an uppercase faint label, a large mono reading with its unit in Text Faint, and an optional dim note. It shows a number and the context it needs, never a decorative hero metric.

### Brand Lockup (Signature)
A row of six Crema Amber bars (heights 28 / 62 / 100 / 97 / 72 / 45%) traces a shot's ramp, hold and decline above the lowercase `crema` wordmark. The bars are flex children of a shrink-wrapped box, so the row always measures exactly as wide as the word. The same bar motif drives the working indicator.

### Profile & Shot Charts (Signature)
Hand-rolled SVG with no chart library. Pressure is drawn as a 2.2px Crema Amber line over an amber gradient area; flow as a dashed Cool Water line; stage bands use pre-infusion = Cool Water, infusion = Crema Amber and ramp-down = Espresso Rust at per-theme band opacity. Shot-time charts plot rating-colored dots ringed in Surface over a tinted Good Sage target band. Gridlines are Border, axes Border Strong, and labels mono in Text Faint.

## Do's and Don'ts

### Do:
- **Do** define every new color as a token in both the dark `:root` block and the `[data-theme='light']` block, then use it through `var(--…)`.
- **Do** set every measured value in JetBrains Mono with `tabular-nums`, with its unit beside it in Text Faint.
- **Do** keep Crema Amber for the one primary action and current state on a screen.
- **Do** show status as a tint pair (hue text, tinted background, tinted border), as tags and banners already do.
- **Do** separate surfaces by tone and a 1px border, and hold cards to 12px corners and controls to 8px.
- **Do** key touch sizing to `@media (pointer: coarse)` and keep inputs at 16px on phones.
- **Do** honor `prefers-reduced-motion` by freezing motion into a static, still-readable state rather than hiding it.

### Don't:
- **Don't** make it look like a generic SaaS dashboard: no blue/purple gradients, glassy or blurred cards, or hero stats that don't mean anything.
- **Don't** borrow Fellow's visual language, logos or product imagery. Crema is independent.
- **Don't** use cool greys. Every neutral in the palette is warm.
- **Don't** add shadows to cards or lift elements on hover; the one shadow belongs to modals.
- **Don't** use Space Grotesk anywhere but the wordmark.
- **Don't** fill a surface with a saturated status color.
- **Don't** hardcode a hex or opacity at the point of use, in CSS or in SVG.
