# Design Lab Migration Guide (Milu Style 2.0)

Этот документ — карта перехода с legacy semantic-системы на **canonical Design Lab**.

## Status

- ✅ Фаза 1: Canonical-слой помечен, legacy задеприкейчен.
- ✅ Фаза 2: Кодмод `src/**/*.tsx` — все классы переведены на canonical.
- ✅ Фаза 3: `src/lib/colors.ts` мапится на canonical CSS-vars. Inline HEX остался только в `MapDialog` (mapbox API требует hex).
- ✅ Фаза 4: Legacy Tailwind-мапы удалены из `tailwind.config.ts`. Legacy CSS-vars в `index.css` оставлены как внутренние алиасы для Theme Editor (не доступны как Tailwind-классы).
- ✅ Фаза 5: Dark-mode — единственный механизм `.dark` класс через `next-themes`, runtime-overrides только через Theme Editor (`themeOverrides.ts`).

## Canonical semantic tokens (единственно разрешённые в новом коде)

```
background  foreground  card        popover
primary     secondary   muted       accent
destructive success     warning     info
border      input       ring
sidebar-*   chart-*
```

## Mapping: legacy → canonical

| Legacy class / token                | Canonical replacement              | Notes |
|-------------------------------------|------------------------------------|-------|
| `bg-surface`                        | `bg-card`                          | белые карточки |
| `bg-surface-secondary`              | `bg-muted`                         | серый фон секций |
| `bg-background-primary`             | `bg-background`                    |  |
| `bg-background-secondary`           | `bg-muted`                         |  |
| `bg-background-tertiary`            | `bg-muted`                         |  |
| `text-text-primary`                 | `text-foreground`                  |  |
| `text-text-secondary`               | `text-muted-foreground`            |  |
| `text-text-tertiary`                | `text-muted-foreground/70`         |  |
| `text-text-inverse`                 | `text-primary-foreground`          |  |
| `text-text-accent`                  | `text-accent-foreground`           |  |
| `text-foreground-primary`           | `text-foreground`                  | RAKETA alias |
| `text-foreground-secondary`         | `text-muted-foreground`            |  |
| `bg-foreground-primary`             | `bg-foreground`                    |  |
| `bg-brand-navy` / `text-brand-navy` | `bg-primary` / `text-primary`      |  |
| `bg-brand-navy-light`               | `bg-primary/80`                    |  |
| `bg-brand-navy-dark`                | `bg-primary` (Atlas merges)        |  |
| `bg-brand-teal` / `text-brand-teal` | `bg-accent` / `text-accent`        | либо chart-2 для графиков |
| `bg-brand-primary`                  | `bg-primary`                       | дубль |
| `bg-brand-accent`                   | `bg-accent`                        | дубль |
| `bg-accent-orange`                  | `bg-warning` (для дедлайнов/задач) |  |
| `border-border-2`                   | `border-border`                    |  |
| `border-divider`                    | `border-border`                    |  |
| `bg-towhite`                        | `bg-background`                    |  |
| `bg-primitive`                      | `bg-foreground`                    |  |
| `bg-alpha-20` … `bg-alpha-90`       | `bg-foreground/10..90`             | Tailwind opacity |
| `bg-static-white`                   | `bg-background` (или hardcode)     |  |
| `bg-static-black`                   | `bg-foreground`                    |  |
| `bg-interactive-bg-hover`           | `hover:bg-accent`                  |  |
| `bg-info`                           | `bg-muted`                         |  |

## Правила для нового кода

1. Только canonical tokens из таблицы выше.
2. Никаких hardcoded HEX/HSL в JSX. Для recharts/canvas — `getComputedStyle(document.documentElement).getPropertyValue('--primary')`.
3. Никаких inline `style={{ color: '#...' }}`.
4. Все hover/focus/active — через Tailwind state-modifiers, не отдельные `--interactive-*` переменные.
5. Dark-mode — только через `.dark` класс из `next-themes`, без runtime overrides.

## Проверка

```bash
bash scripts/check-legacy-tokens.sh
```

Выводит список файлов, в которых остались legacy-классы (исключая `src/components/ui/*`, `src/pages/KitPage.tsx`, `src/index.css` и `tailwind.config.ts`).

## Удаляемое (Фаза 4)

CSS-переменные: `--surface`, `--surface-secondary`, `--foreground-primary/secondary/disabled`, `--background-primary/secondary/tertiary/disabled`, `--static-white/black`, `--divider`, `--border-2`, `--towhite`, `--primitive`, `--alpha-20/40/50/70/90`, `--brand-navy*`, `--brand-teal*`, `--brand-primary*`, `--brand-accent*`, `--text-primary/secondary/tertiary/muted/inverse/accent`, `--interactive-bg*`, `--accent-orange`.

Tailwind-мапы под теми же именами в `tailwind.config.ts`.