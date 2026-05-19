# Layout Primitives

Low-level layout building blocks. They carry **no color, no border, no shadow** — only structural intent. Compose them with `Surface`, `Text`, `Heading` to build any UI.

| Primitive   | Purpose                                 | Props (intent)               |
|-------------|-----------------------------------------|------------------------------|
| `Stack`     | Vertical layout, gap from spacing scale | `gap`, `align`, `as`         |
| `Inline`    | Horizontal layout, gap + wrap           | `gap`, `align`, `justify`    |
| `Grid`      | Responsive 12-col grid                  | `cols`, `gap`, `responsive`  |
| `Container` | Max-width page container                | `size: sm|md|lg|xl|2xl`      |
| `Surface`   | Card/panel surface w/ tokens            | `variant: card|raised|sunken`|
| `Text`      | Body text                               | `size`, `tone`, `weight`     |
| `Heading`   | Display/heading text                    | `level: 1|2|3|4|display`     |
| `Divider`   | Horizontal/vertical rule                | `orientation`                |

## Rules
1. Primitives **never** import from `@/components/ui/*`.
2. Primitives **never** declare colors directly — only token references.
3. Anything that needs interactivity (hover, focus, click) belongs in `components/ui/*`, not here.
4. Default `gap` everywhere is `spacing.md` (12px). Override explicitly.
