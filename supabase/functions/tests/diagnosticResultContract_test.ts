import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
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
} from '../_shared/diagnosticResultContract.ts';

// ---------------------------------------------------------------------------
// getScaleDomain
// ---------------------------------------------------------------------------
Deno.test('getScaleDomain — legacy hard defaults', () => {
  const d = getScaleDomain('hard');
  assertEquals(d, { min: 0, max: LEGACY_HARD_MAX, reversed: false, labels: [] });
});

Deno.test('getScaleDomain — legacy soft defaults', () => {
  const d = getScaleDomain('soft');
  assertEquals(d, { min: 0, max: LEGACY_SOFT_MAX, reversed: false, labels: [] });
});

Deno.test('getScaleDomain — null config falls back to legacy', () => {
  assertEquals(getScaleDomain('hard', null), { min: 0, max: 4, reversed: false, labels: [] });
});

Deno.test('getScaleDomain — uses config for hard', () => {
  const cfg = {
    hardScaleMin: 1, hardScaleMax: 10,
    softScaleMin: 0, softScaleMax: 5,
    hardScaleReversed: true, softScaleReversed: false,
    scaleLabels: {
      hard: [{ level_value: 1, label_text: 'Low' }, { level_value: 10, label_text: 'High' }],
      soft: [],
    },
  };
  const d = getScaleDomain('hard', cfg);
  assertEquals(d.min, 1);
  assertEquals(d.max, 10);
  assertEquals(d.reversed, true);
  assertEquals(d.labels.length, 2);
});

// ---------------------------------------------------------------------------
// getEffectiveNumericValue
// ---------------------------------------------------------------------------
Deno.test('getEffectiveNumericValue — no reverse', () => {
  assertEquals(getEffectiveNumericValue(3, { min: 0, max: 4, reversed: false, labels: [] }), 3);
});

Deno.test('getEffectiveNumericValue — reverse 0-4', () => {
  const d = { min: 0, max: 4, reversed: true, labels: [] };
  assertEquals(getEffectiveNumericValue(1, d), 3);
  assertEquals(getEffectiveNumericValue(4, d), 0);
});

Deno.test('getEffectiveNumericValue — reverse 1-10', () => {
  const d = { min: 1, max: 10, reversed: true, labels: [] };
  assertEquals(getEffectiveNumericValue(3, d), 8);
  assertEquals(getEffectiveNumericValue(1, d), 10);
});

// ---------------------------------------------------------------------------
// isNotObserved
// ---------------------------------------------------------------------------
Deno.test('isNotObserved — zero is not observed', () => {
  assertEquals(isNotObserved(0), true);
  assertEquals(isNotObserved(NOT_OBSERVED_VALUE), true);
});

Deno.test('isNotObserved — non-zero is observed', () => {
  assertEquals(isNotObserved(1), false);
  assertEquals(isNotObserved(5), false);
});

// ---------------------------------------------------------------------------
// getScoredValues
// ---------------------------------------------------------------------------
Deno.test('getScoredValues — filters zeros', () => {
  assertEquals(getScoredValues([0, 1, 2, 0, 3]), [1, 2, 3]);
});

Deno.test('getScoredValues — all zeros', () => {
  assertEquals(getScoredValues([0, 0, 0]), []);
});

// ---------------------------------------------------------------------------
// computeScoredAverage
// ---------------------------------------------------------------------------
Deno.test('computeScoredAverage — excludes zeros', () => {
  assertEquals(computeScoredAverage([0, 2, 4, 0]), 3);
});

Deno.test('computeScoredAverage — null for all zeros', () => {
  assertEquals(computeScoredAverage([0, 0]), null);
});

Deno.test('computeScoredAverage — null for empty', () => {
  assertEquals(computeScoredAverage([]), null);
});

// ---------------------------------------------------------------------------
// getDisplayStats
// ---------------------------------------------------------------------------
Deno.test('getDisplayStats — mixed', () => {
  const s = getDisplayStats([0, 1, 2, 0, 3, 0]);
  assertEquals(s.responsesTotal, 6);
  assertEquals(s.responsesScored, 3);
  assertEquals(s.responsesNotObserved, 3);
});

Deno.test('getDisplayStats — empty', () => {
  const s = getDisplayStats([]);
  assertEquals(s.responsesTotal, 0);
  assertEquals(s.responsesScored, 0);
  assertEquals(s.responsesNotObserved, 0);
});

// ---------------------------------------------------------------------------
// getScaleLabel
// ---------------------------------------------------------------------------
Deno.test('getScaleLabel — exact match', () => {
  const labels = [
    { level_value: 1, label_text: 'Low' },
    { level_value: 2, label_text: 'Mid' },
    { level_value: 3, label_text: 'High' },
  ];
  assertEquals(getScaleLabel(2, labels), 'Mid');
});

Deno.test('getScaleLabel — closest fractional', () => {
  const labels = [
    { level_value: 1, label_text: 'Low' },
    { level_value: 3, label_text: 'High' },
  ];
  assertEquals(getScaleLabel(2.1, labels), 'High'); // closer to 3? no, 2.1 is closer to 1 (dist 1.1 vs 0.9) → High
  assertEquals(getScaleLabel(1.4, labels), 'Low');
});

Deno.test('getScaleLabel — empty labels returns string', () => {
  assertEquals(getScaleLabel(3.5, []), '3.5');
});
