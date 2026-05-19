#!/usr/bin/env bash
# Detect legacy Design System tokens in new code.
# Excludes shadcn primitives, the design showcase page, and the CSS/Tailwind
# config files where the legacy layer is intentionally still defined.
#
# Usage: bash scripts/check-legacy-tokens.sh
# Exit code: 0 if no legacy usage found, 1 otherwise.

set -u

PATTERN='\b(bg|text|border|ring|fill|stroke|from|to|via)-(surface|surface-secondary|background-(primary|secondary|tertiary|disabled)|foreground-(primary|secondary|disabled)|text-(primary|secondary|tertiary|muted|inverse|accent)|brand-(navy|teal|primary|accent)(-(light|dark|foreground))?|accent-orange|static-(white|black)|towhite|primitive|divider|border-2|alpha-(20|40|50|70|90)|interactive-bg(-hover|-active)?)\b'

EXCLUDES=(
  '!src/components/ui/**'
  '!src/pages/KitPage.tsx'
  '!src/features/ThemeEditor/**'
  '!src/index.css'
  '!tailwind.config.ts'
  '!design-system/**'
  '!**/*.test.*'
)

ARGS=()
for e in "${EXCLUDES[@]}"; do
  ARGS+=(-g "$e")
done

if rg --color never -nP "$PATTERN" src "${ARGS[@]}"; then
  echo ""
  echo "❌ Found legacy Design System tokens. See design-system/MIGRATION.md for replacements."
  exit 1
fi

echo "✅ No legacy Design System tokens in new code."