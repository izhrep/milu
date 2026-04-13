/**
 * Johari skill markers and sorting logic.
 * 
 * Markers are computed from raw evaluator scores for each skill.
 * Sorting follows the priority list from the spec.
 * 
 * All thresholds are scale-relative via `scaleConfig: { min, max }`.
 * Scores are normalized to 0..1 range and classified into bands:
 *   low:  [0, 0.35)
 *   mid:  [0.35, 0.7)
 *   high: [0.7, 1.0]
 * 
 * These bands preserve intuitive behavior for the pilot 1–3 scale:
 *   1 → 0.0  (low)     2 → 0.5  (mid)     3 → 1.0  (high)
 * and scale correctly for 0–5, 1–10, etc.
 */

import type { SkillMetrics } from '@/hooks/useJohariReport';

/** Scale configuration for marker & sort logic */
export interface ScaleConfig {
  min: number;
  max: number;
}

/** Default scale matching the pilot (soft 1–3) */
const DEFAULT_SCALE: ScaleConfig = { min: 1, max: 3 };

/** Band boundaries (on a 0..1 normalized axis) */
const LOW_UPPER = 0.35;
const HIGH_LOWER = 0.70;

/** Normalize a raw score to 0..1 within the scale range */
function normalize(value: number, sc: ScaleConfig): number {
  const range = sc.max - sc.min;
  if (range <= 0) return 0;
  return Math.max(0, Math.min(1, (value - sc.min) / range));
}

type Band = 'low' | 'mid' | 'high';

function toBand(normalized: number): Band {
  if (normalized < LOW_UPPER) return 'low';
  if (normalized >= HIGH_LOWER) return 'high';
  return 'mid';
}

/** Marker codes as displayed on skill cards */
export type MarkerCode = 
  | '💪' | '👌' | '🔧' | '⚡' | '❔' 
  | 'В↑' | 'В↓' | 'Л↑' | 'Л↓';

export interface MarkerInfo {
  code: MarkerCode;
  label: string;
}

/** Full marker descriptions for tooltips (scale-neutral) */
export const MARKER_DESCRIPTIONS: Record<MarkerCode, string> = {
  '💪': 'Большинство оценок в нижней части шкалы',
  '👌': 'Большинство оценок в средней части шкалы',
  '🔧': 'Большинство оценок в верхней части шкалы',
  '⚡': 'Противоречивые оценки — есть одновременно низкие и высокие баллы',
  '❔': 'Недостаточно данных или большинство оценок «не наблюдал»',
  'В↑': 'Внешние / клиенты оценивают выше команды (без лида)',
  'В↓': 'Внешние / клиенты оценивают ниже команды (без лида)',
  'Л↑': 'Лид оценивает выше коллег',
  'Л↓': 'Лид оценивает строже коллег',
};

/**
 * Directional marker threshold, proportional to scale range.
 * For scale 1–3 (range=2): 0.15 * 2 = 0.30  — matches pilot behaviour.
 * For scale 0–5 (range=5): 0.15 * 5 = 0.75
 * For scale 1–10 (range=9): 0.15 * 9 = 1.35
 */
function directionalThreshold(sc: ScaleConfig): number {
  return 0.15 * (sc.max - sc.min);
}

/**
 * Compute markers for a skill based on its score arrays.
 * 
 * Field semantics (set by edge function):
 * - manager_scores: manager per-evaluator averages
 * - peer_scores: INTERNAL (non-external) peer per-evaluator averages
 * - external_scores: EXTERNAL peer per-evaluator averages
 * 
 * Marker logic:
 * - В↑/В↓: external_scores vs peer_scores (internal peers only, NO manager)
 * - Л↑/Л↓: manager_scores vs ALL peers (peer_scores + external_scores)
 */
export function computeMarkers(skill: SkillMetrics, scaleConfig?: ScaleConfig): MarkerCode[] {
  const sc = scaleConfig ?? DEFAULT_SCALE;
  const markers: MarkerCode[] = [];

  const allOthersScores = [
    ...(skill.manager_scores || []),
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ];
  
  const nonZeroScores = allOthersScores.filter(s => s > 0);

  // ❔ - more than half are 0 or insufficient data
  if (allOthersScores.length === 0 || 
      allOthersScores.filter(s => s === 0).length > allOthersScores.length / 2 ||
      skill.confidence_tier === 'insufficient') {
    markers.push('❔');
    return markers;
  }

  // Distribution markers based on normalized bands
  if (nonZeroScores.length > 0) {
    const bands = nonZeroScores.map(s => toBand(normalize(s, sc)));
    const hasLow = bands.includes('low');
    const hasHigh = bands.includes('high');

    // ⚡ - contradictory: has both low and high
    if (hasLow && hasHigh) {
      markers.push('⚡');
    } else {
      const majority = nonZeroScores.length / 2;
      const countLow = bands.filter(b => b === 'low').length;
      const countMid = bands.filter(b => b === 'mid').length;
      const countHigh = bands.filter(b => b === 'high').length;

      if (countLow > majority) {
        markers.push('💪');
      } else if (countMid > majority) {
        markers.push('👌');
      } else if (countHigh > majority) {
        markers.push('🔧');
      }
    }
  }

  const threshold = directionalThreshold(sc);

  // В↑/В↓ - external peers vs internal peers (WITHOUT manager)
  const externalScores = (skill.external_scores || []).filter(s => s > 0);
  const internalPeerScores = (skill.peer_scores || []).filter(s => s > 0);

  if (externalScores.length > 0 && internalPeerScores.length > 0) {
    const externalAvg = externalScores.reduce((a, b) => a + b, 0) / externalScores.length;
    const internalAvg = internalPeerScores.reduce((a, b) => a + b, 0) / internalPeerScores.length;
    const diff = externalAvg - internalAvg;
    
    if (diff > threshold) {
      markers.push('В↑');
    } else if (diff < -threshold) {
      markers.push('В↓');
    }
  }

  // Л↑/Л↓ - manager vs ALL peers (internal + external)
  const managerScores = (skill.manager_scores || []).filter(s => s > 0);
  const allPeerScores = [
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ].filter(s => s > 0);

  if (managerScores.length > 0 && allPeerScores.length > 0) {
    const managerAvg = managerScores.reduce((a, b) => a + b, 0) / managerScores.length;
    const peerAvg = allPeerScores.reduce((a, b) => a + b, 0) / allPeerScores.length;
    const diff = managerAvg - peerAvg;

    if (diff > threshold) {
      markers.push('Л↑');
    } else if (diff < -threshold) {
      markers.push('Л↓');
    }
  }

  return markers;
}

/**
 * Sorting priority for skills within a zone.
 * Uses normalized band classification instead of hardcoded values.
 * 
 * Priority (from spec):
 * 1. Unanimous scores in low band
 * 2. Scores in low+mid bands only, ascending delta
 * 3. Scores in mid+high bands only, ascending delta
 * 4. Contradictory scores (has both low and high)
 * 5. External lower than internal
 * 6. External higher than internal
 * 7. Lead higher than peers
 * 8. Lead stricter than peers
 */
function getSortPriority(skill: SkillMetrics, sc: ScaleConfig): number {
  const allScores = [
    ...(skill.manager_scores || []),
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ].filter(s => s > 0);

  if (allScores.length === 0) return 99;

  const bands = allScores.map(s => toBand(normalize(s, sc)));
  const bandSet = new Set(bands);

  // Rule 1: All scores in low band
  if (bandSet.size === 1 && bandSet.has('low')) return 1;

  // Rule 2: Only low and mid (no high)
  if (!bandSet.has('high') && (bandSet.has('low') || bandSet.has('mid'))) return 2;

  // Rule 3: Only mid and high (no low)
  if (!bandSet.has('low') && (bandSet.has('mid') || bandSet.has('high'))) return 3;

  // Rule 4: Contradictory (has both low and high)
  if (bandSet.has('low') && bandSet.has('high')) return 4;

  const sortThreshold = 0.10 * (sc.max - sc.min);

  // Rules 5-6: В↑/В↓ — external vs internal peers (WITHOUT manager)
  const externalScores = (skill.external_scores || []).filter(s => s > 0);
  const internalPeerScores = (skill.peer_scores || []).filter(s => s > 0);
  
  if (externalScores.length > 0 && internalPeerScores.length > 0) {
    const extAvg = externalScores.reduce((a, b) => a + b, 0) / externalScores.length;
    const intAvg = internalPeerScores.reduce((a, b) => a + b, 0) / internalPeerScores.length;
    
    if (extAvg < intAvg - sortThreshold) return 5;
    if (extAvg > intAvg + sortThreshold) return 6;
  }

  // Rules 7-8: Л↑/Л↓ — manager vs ALL peers
  const managerScores = (skill.manager_scores || []).filter(s => s > 0);
  const allPeerScores = [
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ].filter(s => s > 0);
  
  if (managerScores.length > 0 && allPeerScores.length > 0) {
    const mgrAvg = managerScores.reduce((a, b) => a + b, 0) / managerScores.length;
    const peerAvg = allPeerScores.reduce((a, b) => a + b, 0) / allPeerScores.length;
    
    if (mgrAvg > peerAvg + sortThreshold) return 7;
    if (mgrAvg < peerAvg - sortThreshold) return 8;
  }

  return 9;
}

/**
 * Sort skills within a zone by priority rules, then by ascending |delta| within same priority.
 */
export function sortSkillsInZone(skills: SkillMetrics[], scaleConfig?: ScaleConfig): SkillMetrics[] {
  const sc = scaleConfig ?? DEFAULT_SCALE;
  return [...skills].sort((a, b) => {
    const pa = getSortPriority(a, sc);
    const pb = getSortPriority(b, sc);
    if (pa !== pb) return pa - pb;
    return Math.abs(a.delta) - Math.abs(b.delta);
  });
}
