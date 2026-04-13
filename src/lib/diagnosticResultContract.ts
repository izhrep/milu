/**
 * diagnosticResultContract.ts
 *
 * Shared pure-function contract for 360 diagnostic result calculations.
 * Identical logic exists in supabase/functions/_shared/diagnosticResultContract.ts
 * for server-side (edge function) use.
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

/**
 * Minimal stage config shape accepted by this contract.
 * Compatible with StageTemplateConfig from useStageTemplateConfig.
 */
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

/** Template invariant: 0 is always "cannot evaluate", never a real score. */
export const NOT_OBSERVED_VALUE = 0;

/** @deprecated Legacy fallback — use getScaleDomain with StageScaleConfig instead */
export const LEGACY_HARD_MAX = 4;
/** @deprecated Legacy fallback — use getScaleDomain with StageScaleConfig instead */
export const LEGACY_SOFT_MAX = 5;

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Resolve the ScaleDomain for a skill type.
 * If stageConfig is provided, uses its values; otherwise falls back to legacy defaults.
 */
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

  // Legacy defaults for stages without frozen_config
  if (skillType === 'hard') {
    return { min: 0, max: LEGACY_HARD_MAX, reversed: false, labels: [] };
  }
  return { min: 0, max: LEGACY_SOFT_MAX, reversed: false, labels: [] };
}

/**
 * Calculate the effective (display) value for a raw score on a potentially reversed scale.
 * Raw values are stored as-is in the DB; reverse is display-layer only.
 */
export function getEffectiveNumericValue(raw: number, domain: ScaleDomain): number {
  if (domain.reversed) {
    return domain.min + domain.max - raw;
  }
  return raw;
}

/**
 * Check if a value represents "cannot evaluate" (not observed).
 * Template invariant: 0 is always reserved for this purpose.
 */
export function isNotObserved(value: number): boolean {
  return value === NOT_OBSERVED_VALUE;
}

/**
 * Filter out not-observed (zero) values, returning only real scores.
 */
export function getScoredValues(values: number[]): number[] {
  return values.filter((v) => !isNotObserved(v));
}

/**
 * Compute the average of scored (non-zero) values.
 * Returns null if no scored values exist.
 */
export function computeScoredAverage(values: number[]): number | null {
  const scored = getScoredValues(values);
  if (scored.length === 0) return null;
  return scored.reduce((sum, v) => sum + v, 0) / scored.length;
}

/**
 * Build explainability statistics for a set of response values.
 * All surfaces showing aggregates should expose these numbers.
 */
export function getDisplayStats(allValues: number[]): DisplayStats {
  const responsesNotObserved = allValues.filter(isNotObserved).length;
  return {
    responsesTotal: allValues.length,
    responsesScored: allValues.length - responsesNotObserved,
    responsesNotObserved,
  };
}

/**
 * Find the label text for a given numeric value.
 * Uses closest-match strategy for averaged/fractional values.
 * Falls back to String(value) if no labels are configured.
 */
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
