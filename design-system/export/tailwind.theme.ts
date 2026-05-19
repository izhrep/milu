// Tailwind theme excerpt mirroring Milu semantic tokens.
// Full source: tailwind.config.ts
export const miluTheme = {
  colors: {
    background: "hsl(var(--background))",
    foreground: "hsl(var(--foreground))",
    surface:    "hsl(var(--surface))",
    border:     "hsl(var(--border))",
    ring:       "hsl(var(--ring))",
    primary:    { DEFAULT: "hsl(var(--primary))",       foreground: "hsl(var(--primary-foreground))" },
    "brand-navy":{ DEFAULT: "hsl(var(--brand-navy))",   light: "hsl(var(--brand-navy-light))", dark: "hsl(var(--brand-navy-dark))" },
    "brand-teal":{ DEFAULT: "hsl(var(--brand-teal))",   foreground: "hsl(var(--brand-teal-foreground))" },
    success:    { DEFAULT: "hsl(var(--success))",       foreground: "hsl(var(--success-foreground))" },
    warning:    { DEFAULT: "hsl(var(--warning))",       foreground: "hsl(var(--warning-foreground))" },
    error:      { DEFAULT: "hsl(var(--error))",         foreground: "hsl(var(--error-foreground))" },
    "accent-orange": "hsl(var(--accent-orange))",
    "chart-1": "hsl(var(--chart-1))", "chart-2":"hsl(var(--chart-2))", "chart-3":"hsl(var(--chart-3))",
    "chart-4": "hsl(var(--chart-4))", "chart-5":"hsl(var(--chart-5))",
  },
  fontFamily: { display: ["var(--font-display)"], text: ["var(--font-text)"], sans: ["var(--font-text)"] },
  fontSize: {
    display:        ["var(--text-display)",       { lineHeight: "var(--leading-display)" }],
    "heading-1":    ["var(--text-heading-1)",     { lineHeight: "var(--leading-heading-1)" }],
    "heading-2":    ["var(--text-heading-2)",     { lineHeight: "var(--leading-heading-2)" }],
    "heading-3":    ["var(--text-heading-3)",     { lineHeight: "var(--leading-heading-3)" }],
    "heading-4":    ["var(--text-heading-4)",     { lineHeight: "var(--leading-heading-4)" }],
    "body-lg":      ["var(--text-body-lg)",       { lineHeight: "var(--leading-body-lg)" }],
    "body-base":    ["var(--text-body-base)",     { lineHeight: "var(--leading-body-base)" }],
    "body-md":      ["var(--text-body-md)",       { lineHeight: "var(--leading-body-md)" }],
    "caption-sm":   ["var(--text-caption-sm)",    { lineHeight: "var(--leading-caption-sm)" }],
    "helpertext-xs":["var(--text-helpertext-xs)", { lineHeight: "var(--leading-helpertext-xs)" }],
  },
  borderRadius: {
    none:"var(--radius-none)", xs:"var(--radius-xs)", sm:"var(--radius-sm)", md:"var(--radius-md)",
    lg:"var(--radius-lg)", xl:"var(--radius-xl)", "2xl":"var(--radius-2xl)", full:"var(--radius-full)",
  },
  boxShadow: { sm:"var(--shadow-sm)", card:"var(--shadow-card)", md:"var(--shadow-md)", lg:"var(--shadow-lg)" },
  spacing: {
    xs:"var(--spacing-xs)", sm:"var(--spacing-sm)", md:"var(--spacing-md)", lg:"var(--spacing-lg)",
    xl:"var(--spacing-xl)", "2xl":"var(--spacing-2xl)", "3xl":"var(--spacing-3xl)",
  },
} as const;
