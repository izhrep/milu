/**
 * diagnosticResultContract.ts  (server / Deno runtime)
 *
 * Shared pure-function contract for 360 diagnostic result calculations.
 * Identical logic exists in src/lib/diagnosticResultContract.ts
 * for browser-side use.
 *
 * This module is the SINGLE SOURCE OF TRUTH for:
 * - scale domain resolution (min + max + reversed + labels)
 * - not-observed (zero) semantics
 * - scored-value filtering and averaging
 * - display statistics (explainability)
 * - effective value calculation (reverse scales)
 * - scale label resolution
 *
 * Zero invariant:
 *   0 is ALWAYS reserved as "Не могу оценить" (cannot evaluate).
 *   It is stored as a factual response but excluded from numeric averages.
 *   If a future scale needs real scoring at 0, not-observed must be moved
 *   to a separate enum/flag — that is explicitly out of scope.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScaleLabelEntry {
  level_value: number;
  label_text: string;
}

export interface ScaleDomain {
  min: number;
  max: number;
  reversed: boolean;
  labels: ScaleLabelEntry[];
}

export interface DisplayStats {
  responsesTotal: number;
  responsesScored: number;
  responsesNotObserved: number;
}

export interface StageScaleConfig {
  hardScaleMin: number;
  hardScaleMax: number;
  softScaleMin: number;
  softScaleMax: number;
  hardScaleReversed: boolean;
  softScaleReversed: boolean;
  scaleLabels: {
    hard: ScaleLabelEntry[];
    soft: ScaleLabelEntry[];
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOT_OBSERVED_VALUE = 0;

export const LEGACY_HARD_MAX = 4;
export const LEGACY_SOFT_MAX = 5;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export function getScaleDomain(
  skillType: 'hard' | 'soft',
  stageConfig?: StageScaleConfig | null,
): ScaleDomain {
  if (stageConfig) {
    if (skillType === 'hard') {
      return {
        min: stageConfig.hardScaleMin,
        max: stageConfig.hardScaleMax,
        reversed: stageConfig.hardScaleReversed,
        labels: stageConfig.scaleLabels.hard,
      };
    }
    return {
      min: stageConfig.softScaleMin,
      max: stageConfig.softScaleMax,
      reversed: stageConfig.softScaleReversed,
      labels: stageConfig.scaleLabels.soft,
    };
  }

  if (skillType === 'hard') {
    return { min: 0, max: LEGACY_HARD_MAX, reversed: false, labels: [] };
  }
  return { min: 0, max: LEGACY_SOFT_MAX, reversed: false, labels: [] };
}

export function getEffectiveNumericValue(raw: number, domain: ScaleDomain): number {
  if (domain.reversed) {
    return domain.min + domain.max - raw;
  }
  return raw;
}

export function isNotObserved(value: number): boolean {
  return value === NOT_OBSERVED_VALUE;
}

export function getScoredValues(values: number[]): number[] {
  return values.filter((v) => !isNotObserved(v));
}

export function computeScoredAverage(values: number[]): number | null {
  const scored = getScoredValues(values);
  if (scored.length === 0) return null;
  return scored.reduce((sum, v) => sum + v, 0) / scored.length;
}

export function getDisplayStats(allValues: number[]): DisplayStats {
  const responsesNotObserved = allValues.filter(isNotObserved).length;
  return {
    responsesTotal: allValues.length,
    responsesScored: allValues.length - responsesNotObserved,
    responsesNotObserved,
  };
}

export function getScaleLabel(value: number, labels: ScaleLabelEntry[]): string {
  if (!labels || labels.length === 0) return String(value);

  const sorted = [...labels].sort((a, b) => a.level_value - b.level_value);
  let closest = sorted[0];
  let minDist = Math.abs(value - closest.level_value);

  for (const label of sorted) {
    const dist = Math.abs(value - label.level_value);
    if (dist < minDist) {
      minDist = dist;
      closest = label;
    }
  }

  return closest.label_text;
}
