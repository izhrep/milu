/**
 * Johari skill markers and sorting logic.
 * 
 * Markers are computed from raw evaluator scores for each skill.
 * Sorting follows the priority list from the spec.
 * 
 * PILOT LIMITATION (March 2026):
 * Distribution markers (💪, 👌, 🔧, ⚡) use hardcoded values 1, 2, 3
 * matching the current pilot scale (1–3). When the scale changes,
 * these thresholds must be updated to use scale-relative values.
 */

import type { SkillMetrics } from '@/hooks/useJohariReport';

/** Marker codes as displayed on skill cards */
export type MarkerCode = 
  | '💪' | '👌' | '🔧' | '⚡' | '❔' 
  | 'В↑' | 'В↓' | 'Л↑' | 'Л↓';

export interface MarkerInfo {
  code: MarkerCode;
  label: string;
}

/** Full marker descriptions for tooltips */
export const MARKER_DESCRIPTIONS: Record<MarkerCode, string> = {
  '💪': 'Большинство оценок на минимальном уровне (1)',
  '👌': 'Большинство оценок на среднем уровне (2)',
  '🔧': 'Большинство оценок на максимальном уровне (3)',
  '⚡': 'Противоречивые оценки — есть одновременно минимальные (1) и максимальные (3)',
  '❔': 'Недостаточно данных или большинство оценок «не наблюдал»',
  'В↑': 'Внешние / клиенты оценивают выше команды (без лида)',
  'В↓': 'Внешние / клиенты оценивают ниже команды (без лида)',
  'Л↑': 'Лид оценивает выше коллег',
  'Л↓': 'Лид оценивает строже коллег',
};

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
 * 
 * PILOT LIMITATION: Distribution markers use hardcoded values 1/2/3.
 */
export function computeMarkers(skill: SkillMetrics): MarkerCode[] {
  const markers: MarkerCode[] = [];

  // Get all others' scores (non-zero for distribution markers)
  const allOthersScores = [
    ...(skill.manager_scores || []),
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ];
  
  const allOthersIncludingZeros = allOthersScores;
  const nonZeroScores = allOthersScores.filter(s => s > 0);

  // ❔ - more than half are 0 or insufficient data
  if (allOthersIncludingZeros.length === 0 || 
      allOthersIncludingZeros.filter(s => s === 0).length > allOthersIncludingZeros.length / 2 ||
      skill.confidence_tier === 'insufficient') {
    markers.push('❔');
    return markers; // No other distribution markers make sense
  }

  // Distribution markers based on non-zero scores
  // PILOT LIMITATION: hardcoded values 1, 2, 3 for current scale (1–3)
  if (nonZeroScores.length > 0) {
    const has1 = nonZeroScores.some(s => s === 1);
    const has3 = nonZeroScores.some(s => s === 3);

    // ⚡ - contradictory: has both 1 and 3
    if (has1 && has3) {
      markers.push('⚡');
    } else {
      // Count distribution
      const count1 = nonZeroScores.filter(s => s === 1).length;
      const count2 = nonZeroScores.filter(s => s === 2).length;
      const count3 = nonZeroScores.filter(s => s === 3).length;
      const majority = nonZeroScores.length / 2;

      if (count1 > majority) {
        markers.push('💪');
      } else if (count2 > majority) {
        markers.push('👌');
      } else if (count3 > majority) {
        markers.push('🔧');
      }
    }
  }

  // В↑/В↓ - external peers vs internal peers (WITHOUT manager)
  // external_scores = external peers only
  // peer_scores = internal (non-external) peers only
  const externalScores = (skill.external_scores || []).filter(s => s > 0);
  const internalPeerScores = (skill.peer_scores || []).filter(s => s > 0);

  if (externalScores.length > 0 && internalPeerScores.length > 0) {
    const externalAvg = externalScores.reduce((a, b) => a + b, 0) / externalScores.length;
    const internalAvg = internalPeerScores.reduce((a, b) => a + b, 0) / internalPeerScores.length;
    const diff = externalAvg - internalAvg;
    
    // Threshold: 0.3 absolute diff for marker display
    if (diff > 0.3) {
      markers.push('В↑');
    } else if (diff < -0.3) {
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

    if (diff > 0.3) {
      markers.push('Л↑');
    } else if (diff < -0.3) {
      markers.push('Л↓');
    }
  }

  return markers;
}

/**
 * Sorting priority for skills within a zone.
 * Uses the first matching rule from the priority list.
 * 
 * Priority (from spec):
 * 1. Unanimous scores from respondents = 1
 * 2. Scores 1 and 2, ascending delta
 * 3. Scores 2 and 3, ascending delta
 * 4. Contradictory scores (has both 1 and 3)
 * 5. External lower than internal
 * 6. External higher than internal
 * 7. Lead higher than peers
 * 8. Lead stricter than peers
 * 
 * PILOT LIMITATION: Rules 1–4 use hardcoded values 1/2/3 for scale (1–3).
 */
function getSortPriority(skill: SkillMetrics): number {
  const allScores = [
    ...(skill.manager_scores || []),
    ...(skill.peer_scores || []),
    ...(skill.external_scores || []),
  ].filter(s => s > 0);

  if (allScores.length === 0) return 99;

  const uniqueValues = new Set(allScores);

  // Rule 1: All scores are 1 (PILOT: hardcoded for scale 1–3)
  if (uniqueValues.size === 1 && uniqueValues.has(1)) return 1;

  // Rule 2: Only 1 and 2 (PILOT: hardcoded for scale 1–3)
  if (uniqueValues.size <= 2 && allScores.every(s => s <= 2)) return 2;

  // Rule 3: Only 2 and 3 (PILOT: hardcoded for scale 1–3)
  if (uniqueValues.size <= 2 && allScores.every(s => s >= 2)) return 3;

  // Rule 4: Contradictory (has 1 and 3) (PILOT: hardcoded for scale 1–3)
  if (allScores.some(s => s === 1) && allScores.some(s => s === 3)) return 4;

  // Rules 5-6: В↑/В↓ — external vs internal peers (WITHOUT manager)
  const externalScores = (skill.external_scores || []).filter(s => s > 0);
  const internalPeerScores = (skill.peer_scores || []).filter(s => s > 0);
  
  if (externalScores.length > 0 && internalPeerScores.length > 0) {
    const extAvg = externalScores.reduce((a, b) => a + b, 0) / externalScores.length;
    const intAvg = internalPeerScores.reduce((a, b) => a + b, 0) / internalPeerScores.length;
    
    if (extAvg < intAvg - 0.2) return 5; // External lower
    if (extAvg > intAvg + 0.2) return 6; // External higher
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
    
    if (mgrAvg > peerAvg + 0.2) return 7; // Lead higher
    if (mgrAvg < peerAvg - 0.2) return 8; // Lead stricter
  }

  return 9; // Default
}

/**
 * Sort skills within a zone by priority rules, then by ascending |delta| within same priority.
 */
export function sortSkillsInZone(skills: SkillMetrics[]): SkillMetrics[] {
  return [...skills].sort((a, b) => {
    const pa = getSortPriority(a);
    const pb = getSortPriority(b);
    if (pa !== pb) return pa - pb;
    return Math.abs(a.delta) - Math.abs(b.delta);
  });
}
