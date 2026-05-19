# Prompting rules (for AI agents working in Milu)

1. **Tokens before code.** Before writing JSX, identify the semantic tokens you'll use. Reject any value not in `tokens/`.
2. **Compose, don't restyle.** Build with primitives + components. New variants → update CVA + spec.
3. **One theme, two modes.** Never branch on theme in JSX. Dark mode handled automatically by CSS vars.
4. **Responsive via tokens, not breakpoints.** Typography sizes scale via `--text-*` redefinition. Add `md:`/`lg:` only for layout (cols, hide/show).
5. **Accessibility is non-negotiable.** Every interactive element gets visible focus, ARIA label, keyboard support.
6. **No new colors.** If a color is missing, propose a semantic token addition — never inline a hex.
7. **Patterns over components.** When user asks for "a settings page", reach for `patterns/settings-page.md`, not raw components.
