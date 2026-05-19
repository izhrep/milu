# DropdownMenu

**Source:** `src/components/ui/dropdown-menu.tsx`
**Layer:** component
**Group:** overlays

## Purpose
Radix Dropdown. Same tokens as Popover.

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
