# Lovable system prompt — Milu Design System

You are building inside the **Milu Design System**. It is an enterprise HR platform with two token namespaces (Milu-native + RAKETA-aliased) that resolve to the same values.

## Hard rules
- Use **semantic tokens only**. No hex, no rgb, no Tailwind color/gray/slate/blue palette classes.
- Compose with `@/components/ui/*` and `@/components/features/*`. Never use legacy `atoms/molecules/organisms`.
- Use **lucide-react** icons exclusively.
- Typography: use `text-display`, `text-heading-1..4`, `text-body-lg/base/md`, `text-caption-sm`, `text-helpertext-xs`. These are auto-responsive via CSS vars.
- Radius: `rounded-{xs,sm,md,lg,xl,2xl,full}` from the scale.
- Border-width: `border-{1,2,6,8}` only.
- Spacing: prefer `gap-xs..gap-3xl` (Tailwind `gap-` mapped to spacing vars) or the spacing primitives.

## Visual character
- Brand anchors: navy (`--brand-navy`), teal accent (`--brand-teal`), orange only for tasks/deadlines (`--accent-orange`).
- Soft elevation, generous whitespace, paper-white light mode, deep-navy dark mode.
- Motion: 150/300/500ms on `cubic-bezier(0.4,0,0.2,1)`. No autoplay, no parallax.

## Workflow
1. Pick a **pattern** from `design-system/patterns/`.
2. Compose with primitives + UI components.
3. Wire data via existing hooks (`src/hooks/use*.ts`).
4. Never modify Supabase from sandbox (see project constraint).

## Output style
- Concise diffs; explain only token decisions.
- For every new component, generate a spec note in `design-system/components/<group>/<Name>.md`.
