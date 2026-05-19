# Component rules

1. **Source of truth:** `src/components/ui/*` for primitives, `src/components/features/*` for domain.
2. **Forbidden imports:** `@/components/atoms|molecules|organisms` (legacy folders).
3. **CVA for variants.** Every component using >1 visual variant must use `class-variance-authority`.
4. **`cn()` everywhere.** Merge user `className` last.
5. **`forwardRef` on all interactive primitives.**
6. **Asymmetric props.** Accept `leftIcon` / `rightIcon` as nodes; never positional children for icons.
7. **Loading state lives in primitives** (e.g. `Button loading`), not in parents.
8. **Icons:** lucide-react only. Size via `[&_svg]:size-4`.
