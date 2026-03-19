/**
 * Johari Window UI configuration.
 * 
 * IMPORTANT: Business thresholds (open_delta_pct, blind_hidden_delta_pct, borderline policy)
 * are computed on the backend (edge function) and delivered via metrics_json.
 * This file contains ONLY UI labels, display constants, and zone priority for frontend rendering.
 * Do NOT duplicate business calculation thresholds here.
 */

export type ConfidenceTier = 'insufficient' | 'preliminary' | 'confident';

export type JohariZone = 'arena' | 'blind_spot' | 'hidden_strength' | 'unknown';

/**
 * Zone priority for competency-level tie-breaking.
 * Lower index = higher priority.
 */
export const ZONE_PRIORITY: JohariZone[] = ['arena', 'hidden_strength', 'blind_spot', 'unknown'];

/** Map zone codes to Russian display names */
export const ZONE_LABELS: Record<JohariZone, string> = {
  arena: 'Открытая зона',
  blind_spot: 'Слепая зона',
  hidden_strength: 'Скрытая зона',
  unknown: 'Чёрный ящик',
};

/**
 * @deprecated Server now handles all borderline rounding via frozen_config johari_rules.
 * This function is kept as a no-op for backward compatibility with legacy snapshots
 * that were generated before server-side rounding was implemented.
 * For new snapshots, the server applies rounding before saving to metrics_json.
 */
export function applyPilotDeltaRounding<T extends {
  delta: number;
  signed_delta: number;
  zone: JohariZone;
  confidence_tier: string;
}>(skills: T[]): T[] {
  // No-op: server now handles rounding. Return skills unchanged.
  return skills;
}
