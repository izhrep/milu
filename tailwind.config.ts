import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // === CANONICAL — Design Lab ===
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },

        // Chart colors
        "chart-1": "hsl(var(--chart-1))",
        "chart-2": "hsl(var(--chart-2))",
        "chart-3": "hsl(var(--chart-3))",
        "chart-4": "hsl(var(--chart-4))",
        "chart-5": "hsl(var(--chart-5))",

        // Shadcn semantic
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          muted: "hsl(var(--sidebar-muted))",
        },
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
        "2xl": "var(--spacing-2xl)",
        "3xl": "var(--spacing-3xl)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        text:    ["var(--font-text)"],
        sans:    ["var(--font-text)"],
      },
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
      fontWeight: {
        light: "var(--font-weight-light)",
        normal: "var(--font-weight-normal)",
        medium: "var(--font-weight-medium)",
        semibold: "var(--font-weight-semibold)",
        bold: "var(--font-weight-bold)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        card: "var(--shadow-card)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      backgroundImage: {
        "gradient-navy": "var(--gradient-navy)",
        "gradient-navy-light": "var(--gradient-navy-light)",
        "gradient-teal": "var(--gradient-teal)",
        "gradient-header": "var(--gradient-header)",
      },
      borderRadius: {
        none: "var(--radius-none)",
        xs:   "var(--radius-xs)",
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl":"var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      borderWidth: {
        1: "var(--border-width-1)",
        2: "var(--border-width-2)",
        6: "var(--border-width-6)",
        8: "var(--border-width-8)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
