import { describe, it, expect } from 'vitest';
import { groupSkillsIntoCompetencies } from './johariCompetencies';
import type { SkillMetrics } from '@/hooks/useJohariReport';

function makeSkill(overrides: Partial<SkillMetrics> = {}): SkillMetrics {
  return {
    skill_id: 'test',
    skill_name: 'Test Skill',
    zone: 'arena',
    self_avg: null,
    manager_avg: null,
    peers_avg: null,
    others_avg: null,
    delta: 0,
    signed_delta: 0,
    others_raters_cnt: 3,
    grey_zone: false,
    is_polarized: false,
    is_contradictory: false,
    confidence_tier: 'confident',
    manager_scores: [],
    peer_scores: [],
    external_scores: [],
    others_individual_scores: [],
    ...overrides,
  };
}

describe('groupSkillsIntoCompetencies', () => {
  it('groups skills by category', () => {
    const skills = [
      makeSkill({ skill_id: 'a', category: 'Leadership', zone: 'arena' }),
      makeSkill({ skill_id: 'b', category: 'Leadership', zone: 'blind_spot' }),
      makeSkill({ skill_id: 'c', category: 'Technical', zone: 'arena' }),
    ];

    const { competencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies).toHaveLength(2);

    const leadership = competencies.find(c => c.category === 'Leadership');
    expect(leadership).toBeDefined();
    expect(leadership!.skills).toHaveLength(2);

    const technical = competencies.find(c => c.category === 'Technical');
    expect(technical).toBeDefined();
    expect(technical!.skills).toHaveLength(1);
  });

  it('all insufficient skills → competency goes to insufficientCompetencies', () => {
    const skills = [
      makeSkill({ skill_id: 'a', category: 'Data', confidence_tier: 'insufficient' }),
      makeSkill({ skill_id: 'b', category: 'Data', confidence_tier: 'insufficient' }),
    ];

    const { competencies, insufficientCompetencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies).toHaveLength(0);
    expect(insufficientCompetencies).toHaveLength(1);
    expect(insufficientCompetencies[0].category).toBe('Data');
  });

  it('dominant zone is determined by count, with tie-breaking by ZONE_PRIORITY', () => {
    // arena and hidden_strength tied at 1 each
    // ZONE_PRIORITY: arena > hidden_strength > blind_spot > unknown
    const skills = [
      makeSkill({ skill_id: 'a', category: 'Mix', zone: 'arena' }),
      makeSkill({ skill_id: 'b', category: 'Mix', zone: 'hidden_strength' }),
    ];

    const { competencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies).toHaveLength(1);
    // arena has priority over hidden_strength in ZONE_PRIORITY
    expect(competencies[0].zone).toBe('arena');
  });

  it('higher count wins over priority', () => {
    const skills = [
      makeSkill({ skill_id: 'a', category: 'Cat', zone: 'arena' }),
      makeSkill({ skill_id: 'b', category: 'Cat', zone: 'blind_spot' }),
      makeSkill({ skill_id: 'c', category: 'Cat', zone: 'blind_spot' }),
    ];

    const { competencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies[0].zone).toBe('blind_spot');
  });

  it('insufficient skills are separated but still reported', () => {
    const skills = [
      makeSkill({ skill_id: 'a', category: 'Cat', zone: 'arena', confidence_tier: 'confident' }),
      makeSkill({ skill_id: 'b', category: 'Cat', zone: 'arena', confidence_tier: 'insufficient' }),
    ];

    const { competencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies).toHaveLength(1);
    expect(competencies[0].skills).toHaveLength(1);
    expect(competencies[0].insufficientSkills).toHaveLength(1);
  });

  it('skills without category go to "Без категории"', () => {
    const skills = [
      makeSkill({ skill_id: 'a', category: undefined, zone: 'arena' }),
    ];

    const { competencies } = groupSkillsIntoCompetencies(skills);
    expect(competencies[0].category).toBe('Без категории');
  });
});
