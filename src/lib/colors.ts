/**
 * Theme-aware color constants.
 * Используется в JSX-атрибутах (recharts, SVG, inline styles, mapbox),
 * где CSS-классы Tailwind не работают.
 *
 * Формат "hsl(var(--name))" — браузер вычислит значение из текущей темы
 * и оно автоматически переключится между light/dark.
 *
 * Для библиотек, которые НЕ умеют CSS-переменные (mapbox, canvas),
 * есть _HSL варианты с фиксированными значениями для light theme.
 */

// === CSS-var форма (для recharts, SVG attributes, inline styles) ===
// Все значения мапятся на canonical Design Lab semantic tokens.
export const COLORS = {
  // Brand → canonical
  brandNavy:     'hsl(var(--primary))',
  brandNavyDark: 'hsl(var(--primary))',
  brandTeal:     'hsl(var(--accent))',
  accentOrange:  'hsl(var(--warning))',

  // Status
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  error:   'hsl(var(--destructive))',

  // Text
  foreground:    'hsl(var(--foreground))',
  textPrimary:   'hsl(var(--foreground))',
  textSecondary: 'hsl(var(--muted-foreground))',
  textTertiary:  'hsl(var(--muted-foreground))',

  // Structure
  border:    'hsl(var(--border))',
  surface:   'hsl(var(--card))',
  muted:     'hsl(var(--muted))',

  // Chart (категориальная палитра)
  chart1: 'hsl(var(--chart-1))',
  chart2: 'hsl(var(--chart-2))',
  chart3: 'hsl(var(--chart-3))',
  chart4: 'hsl(var(--chart-4))',
  chart5: 'hsl(var(--chart-5))',
} as const;

// === Фиксированные HEX-значения light theme (для библиотек без CSS-var support: mapbox, canvas) ===
export const COLORS_LIGHT_HEX = {
  brandNavy:     '#0a1a3e',
  brandNavyDark: '#061024',
  brandTeal:     '#1DB9A6',
  accentOrange:  '#F79640',
  success:       '#10B981',
  warning:       '#F59E0B',
  error:         '#EF4444',
  chart1:        '#205bb8',
  chart2:        '#1DB9A6',
  chart3:        '#F59E0B',
  chart4:        '#10B981',
  chart5:        '#EF4444',
} as const;
