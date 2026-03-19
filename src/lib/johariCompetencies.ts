/**
 * Johari competency-level aggregation.
 * 
 * Groups skills by category (= competency) and determines the dominant zone
 * for each competency based on skill counts per zone.
 */

import type { SkillMetrics } from '@/hooks/useJohariReport';
import { type JohariZone, ZONE_PRIORITY } from './johariConfig';

export interface CompetencyGroup {
  category: string;
  /** Dominant zone for this competency */
  zone: JohariZone;
  /** All skills in this competency (across all zones, excluding insufficient) */
  skills: SkillMetrics[];
  /** Count of skills per zone (excluding insufficient) */
  zoneCounts: Record<JohariZone, number>;
  /** Total skill count (excluding insufficient) */
  totalSkills: number;
  /** Skills with insufficient data */
  insufficientSkills: SkillMetrics[];
}

/**
 * Group skills into competencies and determine dominant zone.
 * 
 * Rules:
 * - Only non-insufficient skills participate in zone determination
 * - If all skills are insufficient, competency goes to insufficient list
 * - Dominant zone = zone with most skills
 * - Tie-breaking priority: Open > Hidden > Blind > Unknown
 */
export function groupSkillsIntoCompetencies(skills: SkillMetrics[]): {
  competencies: CompetencyGroup[];
  insufficientCompetencies: CompetencyGroup[];
} {
  // Group by category
  const categoryMap = new Map<string, SkillMetrics[]>();
  
  for (const skill of skills) {
    const category = skill.category || 'Без категории';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(skill);
  }

  const competencies: CompetencyGroup[] = [];
  const insufficientCompetencies: CompetencyGroup[] = [];

  for (const [category, categorySkills] of categoryMap) {
    const sufficientSkills = categorySkills.filter(s => s.confidence_tier !== 'insufficient');
    const insufficientSkills = categorySkills.filter(s => s.confidence_tier === 'insufficient');

    // Count skills per zone (only sufficient ones)
    const zoneCounts: Record<JohariZone, number> = {
      arena: 0,
      blind_spot: 0,
      hidden_strength: 0,
      unknown: 0,
    };

    for (const skill of sufficientSkills) {
      const zone = skill.zone as JohariZone;
      if (zone in zoneCounts) {
        zoneCounts[zone]++;
      }
    }

    const group: CompetencyGroup = {
      category,
      zone: 'unknown',
      skills: sufficientSkills,
      zoneCounts,
      totalSkills: sufficientSkills.length,
      insufficientSkills,
    };

    // If no sufficient skills, this is an insufficient competency
    if (sufficientSkills.length === 0) {
      insufficientCompetencies.push(group);
      continue;
    }

    // Determine dominant zone
    let maxCount = 0;
    let dominantZone: JohariZone = 'unknown';

    for (const zone of ZONE_PRIORITY) {
      const count = zoneCounts[zone];
      if (count > maxCount) {
        maxCount = count;
        dominantZone = zone;
      }
    }

    group.zone = dominantZone;
    competencies.push(group);
  }

  return { competencies, insufficientCompetencies };
}
