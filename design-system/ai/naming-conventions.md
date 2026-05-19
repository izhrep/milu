# Naming conventions

## Tokens
`color.<layer>.<role>[.<state>]` → `color.semantic.foreground.primary`, `color.component.button.primary.bg`.

## CSS variables
- Primitive: `--<palette>-<step>` e.g. `--navy-700`
- Semantic: `--<role>` or `--<role>-<modifier>` e.g. `--foreground`, `--text-secondary`
- Component: `--<component>-<part>` e.g. `--sidebar-accent`
- RAKETA-aliased (parallel): `--foreground-primary`, `--background-secondary` — preferred for new code.

## Files
- Primitives: `PascalCase.tsx` in `src/components/primitives/`
- UI: `kebab-case.tsx` in `src/components/ui/`
- Features: `PascalCase.tsx` in `src/components/features/<domain>/`
- Hooks: `useX.ts`

## Tailwind classes
Always use semantic class names: `text-foreground`, `bg-surface`, `border-border`, `text-heading-2`. Never `text-gray-700`, `bg-[#fff]`.
