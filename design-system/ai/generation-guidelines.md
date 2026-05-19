# Generation guidelines

When generating new UI in this codebase:

## Checklist
- [ ] Identify pattern (`patterns/`) before reaching for components
- [ ] Use `Container` for max-width, never inline `max-w-*` on sections
- [ ] Default spacing: `Stack gap="md"`, sections `gap="2xl"`
- [ ] Card titles → `Heading level={4}`; page titles → `level={2}`
- [ ] Body copy → `Text size="body-base" tone="primary"`; helpers → `body-md tone="secondary"`
- [ ] Primary CTA: `Button variant="default"`; secondary: `outline`; tertiary: `ghost`
- [ ] Destructive actions: `Button variant="destructive"` + `AlertDialog` confirmation
- [ ] Forms: always `Form` + `FormField` + `FormMessage`. Never raw `<input>`.
- [ ] Empty states: SVG illustration + `Heading 4` + secondary text + primary CTA
- [ ] Loading: `Skeleton` matching final layout, not generic spinners

## Forbidden output
- Hex colors, rgb(), Tailwind color palette classes
- New radius/spacing values outside the scale
- New keyframes outside `motion.tokens.json`
- Inline `style={{ color, background, padding, margin }}`
