# Components

All components are shadcn/ui-based and wrapped with CVA variants. Every component:
1. Consumes only semantic tokens.
2. Exposes a `className` prop merged with `cn()`.
3. Forwards refs.
4. Carries explicit ARIA where Radix doesn't supply it.

Groups:
- `forms/` — input, textarea, select, checkbox, radio-group, switch, slider, form, label, time-picker, input-otp, expandable-textarea
- `navigation/` — sidebar, breadcrumb, tabs, pagination, navigation-menu, menubar, command
- `overlays/` — dialog, alert-dialog, sheet, drawer, popover, hover-card, dropdown-menu, context-menu, tooltip
- `feedback/` — alert, toast, sonner, progress, skeleton, badge
- `layout/` — card, separator, scroll-area, resizable, accordion, collapsible, aspect-ratio, sidebar
- `data-display/` — table, avatar, chart, calendar, carousel, toggle, toggle-group
