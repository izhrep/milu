import { describe, it, expect } from 'vitest';
import { computeMarkers, sortSkillsInZone, type ScaleConfig } from './johariMarkers';
import type { SkillMetrics } from '@/hooks/useJohariReport';

/** Helper to build a minimal SkillMetrics with score arrays */
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

// ─── computeMarkers ────────────────────────────────────────────────

describe('computeMarkers', () => {
  // ── Scale 1–3 ──

  describe('scale 1–3', () => {
    const sc: ScaleConfig = { min: 1, max: 3 };

    it('all low scores → 💪', () => {
      const skill = makeSkill({ peer_scores: [1, 1, 1] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('💪');
      expect(markers).not.toContain('👌');
      expect(markers).not.toContain('🔧');
    });

    it('all mid scores → 👌', () => {
      const skill = makeSkill({ peer_scores: [2, 2, 2] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('👌');
    });

    it('all high scores → 🔧', () => {
      const skill = makeSkill({ peer_scores: [3, 3, 3] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('🔧');
    });

    it('mix of low and high → ⚡ (contradictory)', () => {
      const skill = makeSkill({ peer_scores: [1, 3, 1, 3] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('⚡');
      expect(markers).not.toContain('💪');
      expect(markers).not.toContain('🔧');
    });

    it('majority zeros → ❔', () => {
      const skill = makeSkill({ peer_scores: [0, 0, 0, 2] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toEqual(['❔']);
    });

    it('insufficient confidence → ❔', () => {
      const skill = makeSkill({ peer_scores: [2, 2], confidence_tier: 'insufficient' });
      const markers = computeMarkers(skill, sc);
      expect(markers).toEqual(['❔']);
    });
  });

  // ── Scale 0–5 ──

  describe('scale 0–5', () => {
    const sc: ScaleConfig = { min: 0, max: 5 };

    it('all scores at 0 (min) → 💪', () => {
      // normalized 0/5 = 0.0 → low band
      const skill = makeSkill({ peer_scores: [0.5, 0.5, 0.5] });
      // 0.5/5 = 0.1 → low
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('💪');
    });

    it('all scores at 5 (max) → 🔧', () => {
      const skill = makeSkill({ peer_scores: [5, 5, 5] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('🔧');
    });

    it('mid-range scores (2–3) → 👌', () => {
      // 2/5=0.4, 3/5=0.6 → both mid band
      const skill = makeSkill({ peer_scores: [2, 3, 2, 3] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('👌');
    });

    it('extreme spread (1 and 5) → ⚡', () => {
      // 1/5=0.2 (low), 5/5=1.0 (high)
      const skill = makeSkill({ peer_scores: [1, 5, 1, 5] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('⚡');
    });
  });

  // ── Scale 1–10 ──

  describe('scale 1–10', () => {
    const sc: ScaleConfig = { min: 1, max: 10 };

    it('all scores at 1–2 → 💪 (low band)', () => {
      // (1-1)/9=0, (2-1)/9≈0.11 → low
      const skill = makeSkill({ peer_scores: [1, 2, 1] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('💪');
    });

    it('all scores at 9–10 → 🔧 (high band)', () => {
      // (9-1)/9≈0.89, (10-1)/9=1.0 → high
      const skill = makeSkill({ peer_scores: [9, 10, 10] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('🔧');
    });

    it('all scores at 5 → 👌 (mid band)', () => {
      // (5-1)/9 ≈ 0.44 → mid
      const skill = makeSkill({ peer_scores: [5, 5, 5] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('👌');
    });

    it('1 and 10 together → ⚡', () => {
      const skill = makeSkill({ peer_scores: [1, 10, 1] });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('⚡');
    });
  });

  // ── Directional markers ──

  describe('directional markers', () => {
    const sc: ScaleConfig = { min: 1, max: 3 };
    // threshold = 0.15 * 2 = 0.30

    it('external higher than internal → В↑', () => {
      const skill = makeSkill({
        peer_scores: [1, 1],
        external_scores: [2, 2],
      });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('В↑');
    });

    it('external lower than internal → В↓', () => {
      const skill = makeSkill({
        peer_scores: [3, 3],
        external_scores: [2, 2],
      });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('В↓');
    });

    it('manager higher than peers → Л↑', () => {
      const skill = makeSkill({
        manager_scores: [3],
        peer_scores: [1, 1],
      });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('Л↑');
    });

    it('manager lower than peers → Л↓', () => {
      const skill = makeSkill({
        manager_scores: [1],
        peer_scores: [3, 3],
      });
      const markers = computeMarkers(skill, sc);
      expect(markers).toContain('Л↓');
    });

    it('proportional threshold on scale 1–10', () => {
      const sc10: ScaleConfig = { min: 1, max: 10 };
      // threshold = 0.15 * 9 = 1.35
      // diff = 1.0 (below threshold) → no marker
      const skill = makeSkill({
        peer_scores: [5, 5],
        external_scores: [6, 6],
      });
      const markers = computeMarkers(skill, sc10);
      expect(markers).not.toContain('В↑');
      expect(markers).not.toContain('В↓');

      // diff = 2.0 (above threshold) → marker
      const skill2 = makeSkill({
        peer_scores: [4, 4],
        external_scores: [6, 6],
      });
      const markers2 = computeMarkers(skill2, sc10);
      expect(markers2).toContain('В↑');
    });
  });

  // ── Default scale fallback ──

  it('works without explicit scaleConfig (defaults to 1–3)', () => {
    const skill = makeSkill({ peer_scores: [1, 1, 1] });
    const markers = computeMarkers(skill);
    expect(markers).toContain('💪');
  });
});

// ─── sortSkillsInZone ──────────────────────────────────────────────

describe('sortSkillsInZone', () => {
  const sc: ScaleConfig = { min: 1, max: 3 };

  it('sorts by priority: all-low before low+mid', () => {
    const allLow = makeSkill({ skill_id: 'a', peer_scores: [1, 1, 1], delta: 0.5 });
    const lowMid = makeSkill({ skill_id: 'b', peer_scores: [1, 2, 1], delta: 0.3 });
    const sorted = sortSkillsInZone([lowMid, allLow], sc);
    expect(sorted[0].skill_id).toBe('a');
    expect(sorted[1].skill_id).toBe('b');
  });

  it('tie-breaks by ascending |delta|', () => {
    const a = makeSkill({ skill_id: 'a', peer_scores: [1, 1, 1], delta: 0.8 });
    const b = makeSkill({ skill_id: 'b', peer_scores: [1, 1, 1], delta: 0.2 });
    const sorted = sortSkillsInZone([a, b], sc);
    expect(sorted[0].skill_id).toBe('b');
    expect(sorted[1].skill_id).toBe('a');
  });

  it('works without explicit scaleConfig', () => {
    const a = makeSkill({ skill_id: 'a', peer_scores: [3, 3, 3], delta: 0.1 });
    const b = makeSkill({ skill_id: 'b', peer_scores: [1, 1, 1], delta: 0.1 });
    const sorted = sortSkillsInZone([a, b]);
    // all-low (b) has priority 1, all-high (a) has priority 3
    expect(sorted[0].skill_id).toBe('b');
  });
});
