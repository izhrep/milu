# Milu Design System (extracted)

AI-native, exportable representation of the design system used in this project.

```
design-system/
├── foundation/   # philosophy: visual, spacing, typography, motion, a11y, layout
├── tokens/       # primitive → semantic → component token JSON files
├── primitives/   # Stack, Inline, Grid, Container, Surface, Text, Heading, Divider
├── components/   # forms / navigation / overlays / feedback / layout / data-display
├── patterns/     # auth, dashboard, settings, empty-state, data-table, search, profile
├── templates/    # full-page compositions
├── ai/           # prompting rules, naming, generation guidelines, Lovable system prompt
└── export/       # tokens.json, semantic-tokens.json, component-tokens.json,
                 # variables.css, tailwind.theme.ts, shadcn-theme.json
```

## Source mapping
- CSS vars: `src/index.css` (3-layer token architecture — primitive / semantic / mode)
- Tailwind theme: `tailwind.config.ts`
- shadcn config: `components.json`
- UI primitives: `src/components/ui/*` (CVA + Radix)
- Theme editor (live token overrides): `src/features/ThemeEditor/`

## Token namespaces
Two parallel naming schemes resolve to the same values (RAKETA migration in progress):
- **Milu-native:** `--foreground`, `--surface`, `--text-primary`, `--brand-navy`, …
- **RAKETA-aliased:** `--foreground-primary`, `--background-secondary`, `--divider`, …

Prefer RAKETA-aliased names in new code when they map cleanly.

## Consuming this export
- **Cursor / Claude Code / Lovable:** feed `ai/lovable-system-prompt.md` as system context.
- **Token editors (Tokens Studio etc.):** import `export/tokens.json`.
- **Fresh Tailwind project:** copy `export/tailwind.theme.ts` + `export/variables.css`.
- **shadcn registry:** install via `export/shadcn-theme.json`.
