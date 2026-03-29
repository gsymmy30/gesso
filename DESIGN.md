# Design System — Gesso

## Product Context
- **What this is:** CLI tool that generates complete brand identity from code analysis
- **Who it's for:** Developers shipping open-source tools who want professional brand identity without hiring a designer
- **Space/industry:** Developer tools, brand/design automation
- **Project type:** CLI tool with terminal UI. Future web presence possible but not in v1.

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian with warmth
- **Decoration level:** Intentional. Not minimal (that reads as "just another CLI tool"). Not expressive (too loud for a generator). The decoration IS the precision: warm colors, careful spacing, box-drawing characters used sparingly.
- **Mood:** A well-lit design studio, not a dark server room. Function-first but with intentional moments of beauty. The tool earns trust by looking like it was made by someone who cares about visual craft.
- **Reference sites:** Bun (bun.sh) for warmth on dark, Biome (biomejs.dev) for utilitarian clarity. Deliberately NOT Vite/Astro (purple gradient territory).

## Typography
- **Display/Hero:** Space Grotesk 700 — geometric but warm, technical without being cold. Used in generated assets (logo, OG image, brand.md headers).
- **Body:** DM Sans 400/500 — clean and readable without being overused. Used in generated copy, brand.md body text, future web presence.
- **UI/Labels:** DM Sans 500 — same as body, slightly heavier for labels.
- **Data/Tables:** JetBrains Mono 400 — industry standard for code and data. Supports tabular-nums. Used in terminal output, brand.tokens.json examples.
- **Code:** JetBrains Mono 400
- **Loading:** Google Fonts for preview/web. Bundled .woff2 files for logo SVG generation (opentype.js needs local files). Satori handles font loading for OG images.
- **Scale:** 48px (display) / 28px (heading) / 16px (body) / 14px (code) / 13px (small/labels) / 12px (caption)

## Color

### Gesso Default Palette (terminal output before brand colors load)
- **Approach:** Warm and intentional. Says "design tool" not "build tool."
- **Primary:** #5BA4A4 (muted teal) — main brand color. Headers, spinner, section dividers.
- **Accent:** #E8B87D (warm amber) — warnings, highlights, brand score header.
- **Success:** #7EC89B (soft sage green) — completed steps, accepted sections.
- **Error:** #D4726A (warm terracotta red) — failures, fatal errors.
- **Text:** #E8E6E3 (warm off-white) — primary text on dark terminals.
- **Muted:** #8B8B8B (neutral gray) — secondary info, durations, labels.
- **Background:** Terminal default (never force a background color).

### Light Mode (future web presence)
- **Primary:** #4A8F8F (slightly darker teal for contrast on light bg)
- **Accent:** #C99A5E (warmer amber)
- **Success:** #5EA87B (darker sage)
- **Error:** #C45A52 (deeper terracotta)
- **Text:** #1A1A2E (charcoal)
- **Muted:** #6B6B7B (medium gray)
- **Background:** #F5F3F0 (warm off-white)
- **Surface:** #FFFFFF (pure white for cards/panels)
- **Elevated:** #EDEAE6 (warm light gray)

### Dark Mode (future web presence)
- **Background:** #1A1A2E (deep warm navy)
- **Surface:** #222238 (elevated surface)
- **Elevated:** #2A2A42 (highest elevation)
- **Border:** #3A3A52 (subtle warm border)

### Semantic Colors
- Success: use Success color above
- Warning: use Accent color above
- Error: use Error color above
- Info: use Primary color above

### Brand Color Switch
After the visual identity generation step completes, terminal output switches from gesso's default palette to the user's generated brand palette. This is an intentional "aha" moment. The spinner, section headers, and score bars all transition to the user's colors, demonstrating the product by using it.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable (not cramped, not spacious)
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Terminal indent:** 2 spaces for content under a header
- **Terminal section gap:** 1 blank line between sections, 2 between stages

## Layout
- **Approach:** Single-column (CLI is inherently single-column)
- **Hierarchy:** Indentation (2-space), section headers with box-drawing, strategic whitespace
- **Max content width:** 60 chars for wrapped terminal content (fits 80-col terminals with indent)
- **Future web grid:** 12 columns, max 960px content width

### Border Radius
- sm: 4px (buttons, inputs, small elements)
- md: 8px (cards, swatches, component groups)
- lg: 12px (terminal mockups, large panels)
- full: 9999px (pills, badges)

## Motion
- **Approach:** Minimal-functional
- **Terminal:** Spinner cycle (◐◓◑◒), 300ms key confirmation pause, brand-color-switch transition
- **Future web:** enter(ease-out) exit(ease-in) move(ease-in-out). Micro(50-100ms) short(150-250ms) medium(250-400ms).
- **No decorative animations.** Every motion serves comprehension or feedback.

## Terminal Symbols
- Success: ✓ (U+2713)
- Failure: ✗ (U+2717)
- Spinner: ◐◓◑◒ cycle (U+25D0-25D3)
- Bar filled: █ (U+2588)
- Bar empty: ░ (U+2591)
- Box: ┌ ┐ └ ┘ │ ─ (box-drawing)
- Section divider: ── (U+2500)

### Plain ASCII Fallback (--no-color)
- Success: [OK]
- Failure: [FAIL]
- Spinner: -\|/ cycle
- Bar filled: #
- Bar empty: .
- Box: + - | (ASCII)
- Section headers: -- {Name} -- (plain dashes)

## Anti-Patterns (never use)
- Purple/violet gradients (AI slop, and every other dev tool does this)
- 3-column icon grids
- Centered everything
- Decorative blobs or wavy SVG dividers
- Emoji as design elements
- Generic hero copy ("Welcome to..." "Unlock the power of...")
- Overused fonts as primary: Inter, Roboto, Poppins, Montserrat, Open Sans, Lato

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | Initial design system created | /design-consultation with competitive research (Vite, Bun, Biome, Turbo, Astro). Warm palette differentiates from cold/technical dev tool norms. |
| 2026-03-29 | Space Grotesk + DM Sans + JetBrains Mono | Space Grotesk: geometric warmth for display. DM Sans: clean body without being overused. JetBrains Mono: industry standard for code. |
| 2026-03-29 | Brand-color-switch moment | Terminal output shifts from gesso palette to user's brand palette after visual identity generates. Demonstrates the product by using it. No other CLI does this. |
