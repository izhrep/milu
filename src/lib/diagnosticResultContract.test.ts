import { describe, it, expect } from 'vitest';
import {
  getScaleDomain,
  getEffectiveNumericValue,
  isNotObserved,
  getScoredValues,
  computeScoredAverage,
  getDisplayStats,
  getScaleLabel,
  NOT_OBSERVED_VALUE,
  LEGACY_HARD_MAX,
  LEGACY_SOFT_MAX,
  type StageScaleConfig,
} from './diagnosticResultContract';

// ---------------------------------------------------------------------------
// getScaleDomain
// ---------------------------------------------------------------------------
describe('getScaleDomain', () => {
  it('returns legacy hard defaults when no config', () => {
    const d = getScaleDomain('hard');
    expect(d).toEqual({ min: 0, max: LEGACY_HARD_MAX, reversed: false, labels: [] });
  });

  it('returns legacy soft defaults when no config', () => {
    const d = getScaleDomain('soft');
    expect(d).toEqual({ min: 0, max: LEGACY_SOFT_MAX, reversed: false, labels: [] });
  });

  it('returns legacy defaults when config is null', () => {
    expect(getScaleDomain('hard', null)).toEqual({ min: 0, max: 4, reversed: false, labels: [] });
  });

  it('uses config values for hard', () => {
    const cfg: StageScaleConfig = {
      hardScaleMin: 1, hardScaleMax: 10,
      softScaleMin: 0, softScaleMax: 5,
      hardScaleReversed: true, softScaleReversed: false,
      scaleLabels: {
        hard: [{ level_value: 1, label_text: 'Low' }, { level_value: 10, label_text: 'High' }],
        soft: [],
      },
    };
    const d = getScaleDomain('hard', cfg);
    expect(d.min).toBe(1);
    expect(d.max).toBe(10);
    expect(d.reversed).toBe(true);
    expect(d.labels).toHaveLength(2);
  });

  it('uses config values for soft', () => {
    const cfg: StageScaleConfig = {
      hardScaleMin: 0, hardScaleMax: 4,
      softScaleMin: 2, softScaleMax: 8,
      hardScaleReversed: false, softScaleReversed: true,
      scaleLabels: { hard: [], soft: [{ level_value: 2, label_text: 'Min' }] },
    };
    const d = getScaleDomain('soft', cfg);
    expect(d.min).toBe(2);
    expect(d.max).toBe(8);
    expect(d.reversed).toBe(true);
    expect(d.labels).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveNumericValue
// ---------------------------------------------------------------------------
describe('getEffectiveNumericValue', () => {
  it('returns raw when not reversed', () => {
    const d = { min: 0, max: 4, reversed: false, labels: [] };
    expect(getEffectiveNumericValue(3, d)).toBe(3);
  });

  it('reverses on 0-4 scale', () => {
    const d = { min: 0, max: 4, reversed: true, labels: [] };
    expect(getEffectiveNumericValue(1, d)).toBe(3); // 0+4-1
    expect(getEffectiveNumericValue(4, d)).toBe(0);
    expect(getEffectiveNumericValue(0, d)).toBe(4);
  });

  it('reverses on 1-10 scale', () => {
    const d = { min: 1, max: 10, reversed: true, labels: [] };
    expect(getEffectiveNumericValue(3, d)).toBe(8); // 1+10-3
    expect(getEffectiveNumericValue(1, d)).toBe(10);
    expect(getEffectiveNumericValue(10, d)).toBe(1);
  });

  it('reverses on 0-5 scale', () => {
    const d = { min: 0, max: 5, reversed: true, labels: [] };
    expect(getEffectiveNumericValue(2, d)).toBe(3); // 0+5-2
  });
});

// ---------------------------------------------------------------------------
// isNotObserved / NOT_OBSERVED_VALUE
// ---------------------------------------------------------------------------
describe('isNotObserved', () => {
  it('returns true for 0', () => {
    expect(isNotObserved(0)).toBe(true);
    expect(isNotObserved(NOT_OBSERVED_VALUE)).toBe(true);
  });

  it('returns false for any non-zero value', () => {
    expect(isNotObserved(1)).toBe(false);
    expect(isNotObserved(0.5)).toBe(false);
    expect(isNotObserved(-1)).toBe(false);
    expect(isNotObserved(5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getScoredValues
// ---------------------------------------------------------------------------
describe('getScoredValues', () => {
  it('filters out zeros', () => {
    expect(getScoredValues([0, 1, 2, 0, 3])).toEqual([1, 2, 3]);
  });

  it('returns empty for all zeros', () => {
    expect(getScoredValues([0, 0, 0])).toEqual([]);
  });

  it('returns all when no zeros', () => {
    expect(getScoredValues([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('handles empty array', () => {
    expect(getScoredValues([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeScoredAverage
// ---------------------------------------------------------------------------
describe('computeScoredAverage', () => {
  it('computes average excluding zeros', () => {
    expect(computeScoredAverage([0, 2, 4, 0])).toBe(3); // (2+4)/2
  });

  it('returns null for all zeros', () => {
    expect(computeScoredAverage([0, 0])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(computeScoredAverage([])).toBeNull();
  });

  it('handles single scored value', () => {
    expect(computeScoredAverage([0, 5, 0])).toBe(5);
  });

  it('handles all scored', () => {
    expect(computeScoredAverage([1, 2, 3])).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getDisplayStats
// ---------------------------------------------------------------------------
describe('getDisplayStats', () => {
  it('calculates correct stats', () => {
    const stats = getDisplayStats([0, 1, 2, 0, 3, 0]);
    expect(stats.responsesTotal).toBe(6);
    expect(stats.responsesScored).toBe(3);
    expect(stats.responsesNotObserved).toBe(3);
  });

  it('all scored', () => {
    const stats = getDisplayStats([1, 2, 3]);
    expect(stats.responsesTotal).toBe(3);
    expect(stats.responsesScored).toBe(3);
    expect(stats.responsesNotObserved).toBe(0);
  });

  it('empty', () => {
    const stats = getDisplayStats([]);
    expect(stats.responsesTotal).toBe(0);
    expect(stats.responsesScored).toBe(0);
    expect(stats.responsesNotObserved).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getScaleLabel
// ---------------------------------------------------------------------------
describe('getScaleLabel', () => {
  const labels = [
    { level_value: 1, label_text: 'Начинающий' },
    { level_value: 2, label_text: 'Базовый' },
    { level_value: 3, label_text: 'Уверенный' },
    { level_value: 4, label_text: 'Эксперт' },
  ];

  it('returns exact match', () => {
    expect(getScaleLabel(2, labels)).toBe('Базовый');
  });

  it('returns closest for fractional value', () => {
    expect(getScaleLabel(2.3, labels)).toBe('Базовый');
    expect(getScaleLabel(2.7, labels)).toBe('Уверенный');
  });

  it('returns closest for boundary', () => {
    expect(getScaleLabel(3.5, labels)).toBe('Уверенный'); // equidistant → first found
  });

  it('returns String(value) when no labels', () => {
    expect(getScaleLabel(3.5, [])).toBe('3.5');
  });

  it('handles single label', () => {
    expect(getScaleLabel(5, [{ level_value: 3, label_text: 'Only' }])).toBe('Only');
  });
});
