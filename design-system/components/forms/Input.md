# Input

**Source:** `src/components/ui/input.tsx`
**Layer:** component
**Group:** forms

## Purpose
Text input. States: rest, hover, focus, disabled, error. Tokens: color.component.input.bg, color.component.input.border, color.component.input.focus.ring, radius.input, typography.body-base.

## Accessibility
- Radix primitive (where applicable) provides focus management, keyboard nav, ARIA.
- All interactive states include visible focus ring (`focus-visible:ring-2 ring-ring`).
- Disabled state: `opacity-50 pointer-events-none`.

## Token dependencies
See "Tokens" line above. All colors come from `color.semantic.*` or `color.component.*`. No raw hex, no Tailwind palette classes.

## Composition rules
- Compose with primitives (`Stack`, `Inline`, `Surface`).
- Never introduce new variants without updating CVA + this spec.
- Never re-color via `text-gray-*`/`bg-slate-*`/hex — use tokens.
