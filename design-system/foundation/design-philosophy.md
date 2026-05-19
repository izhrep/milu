# Milu Design System — Design Philosophy

## Visual philosophy
A calm, trustworthy enterprise HR platform. The look is **navy-anchored, teal-accented**, with generous whitespace, soft elevation, and zero decorative noise. The system is currently undergoing a **RAKETA** migration: two parallel token namespaces (Milu-native + RAKETA-aliased) resolve to the same underlying values, allowing incremental adoption.

- **Mood:** authoritative, optimistic, restrained.
- **Brand anchors:** `--brand-navy` (deep navy `#0a1a3e`), `--brand-teal` (`#1DB9A6`), `--accent-orange` (egg-400, used only for tasks/deadlines/active goals).
- **Light vs dark:** light mode is paper-white surfaces on near-white background; dark mode is deep navy/charcoal with the same teal accent. Both modes share semantic tokens — components never branch on theme.
- **Imagery:** SVG illustrations only (`/src/assets/illustrations/*`). Raster avatars are accent, never hero. Background SVG (raketa) is dark-mode only.

## Spacing philosophy
8-point baseline with a compressed near-end scale:
- `--spacing-xs` 4 / `sm` 8 / `md` 12 / `lg` 16 / `xl` 24 / `2xl` 32 / `3xl` 48.
- **Density tiers:** dashboard/table dense → `sm`–`md`; content/forms comfortable → `lg`–`xl`; marketing/empty-state generous → `2xl`–`3xl`.
- Never use raw Tailwind numeric spacing for **section rhythm** — use the semantic scale.

## Typography philosophy
- **Display:** Plus Jakarta Sans (light) / Rubik (dark) — geometric, friendly.
- **Body:** SF Pro (light) / Plus Jakarta Sans (dark) — neutral, high legibility.
- **Responsive type:** sizes scale **mobile → tablet (≥768) → desktop (≥1024)** via CSS-var redefinition, not Tailwind `md:` variants. Components stay class-stable.
- **10-step scale:** `display, heading-1..4, body-lg, body-base, body-md, caption-sm, helpertext-xs`.
- Headings (`h1`–`h4`) are bound by element selectors; semantic classes mirror them for non-heading use.

## Interaction philosophy
- Transitions: `0.15s` (fast utility) / `0.3s` (default) / `0.5s` (stage), all on `cubic-bezier(0.4,0,0.2,1)`.
- Hover: subtle (`bg-*/15`, `shadow-md`, `-translate-y-0.5`). Never re-color text on hover.
- Focus: 2px ring on `--ring`, 2px offset. Always visible — no `outline-none` without a replacement ring.
- Disabled: `opacity-50` + `pointer-events-none`.
- States are layered (`--interactive-bg`, `-hover`, `-active`) as low-alpha overlays so they compose on any surface.

## Motion philosophy
- Purpose-driven only: stage transitions, form reveal, progress fills, card lift.
- Named keyframes: `stage-enter`, `stage-exit`, `slide-in-up`, `fade-in`, `accordion-down/up`.
- No parallax, no autoplay video, no gratuitous micro-interactions.
- Respect `prefers-reduced-motion` at the component level.

## Accessibility patterns
- All color pairs guarantee WCAG AA in both themes (foreground tokens always paired with background tokens).
- Radix primitives underpin every overlay/focus-trap component (dialog, popover, dropdown, tooltip).
- Focus rings on every interactive element; never removed without replacement.
- Icons are decorative by default (`aria-hidden`); meaningful icons require `aria-label` on the wrapping control.
- Form fields ship with `<Label>` (Radix Label primitive) and helper/error text via the `Form` field wrapper.

## Layout principles
- **App shell:** collapsible Sidebar (`w-16` ↔ `w-64`) + main content with optional dark-mode raketa background.
- **Content max-widths:** dashboard `max-w-screen-2xl`; forms `max-w-2xl`; reading `max-w-prose`.
- **Card-first:** information lives in `Card` surfaces (`--card`, `--shadow-card`, `--radius-lg`).
- **Grid:** 12-col responsive grid via Tailwind, but **gaps come from the semantic spacing scale**, not arbitrary `gap-7`.
- **Sticky regions:** sidebar, page headers, table headers — never sticky CTAs.
