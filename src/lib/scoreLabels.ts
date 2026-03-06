// Текстовые описания для оценок Hard Skills (0-4)

export interface ScaleLabelOverride {
  level_value: number;
  label_text: string;
}

export interface ScaleConfig {
  min: number;
  max: number;
  labels?: ScaleLabelOverride[];
}

// Константы для максимальных уровней
export const HARD_SKILLS_MAX_LEVEL = 4;
export const SOFT_SKILLS_MAX_LEVEL = 5;

// Default hard skill labels (0-4)
const DEFAULT_HARD_LABELS: ScaleLabelOverride[] = [
  { level_value: 0, label_text: 'Не оценено' },
  { level_value: 1, label_text: 'Начинающий' },
  { level_value: 2, label_text: 'Базовый' },
  { level_value: 3, label_text: 'Уверенный' },
  { level_value: 4, label_text: 'Эксперт' },
];

// Default soft skill labels (0-5)
const DEFAULT_SOFT_LABELS: ScaleLabelOverride[] = [
  { level_value: 0, label_text: 'Не оценено' },
  { level_value: 1, label_text: 'Слабо' },
  { level_value: 2, label_text: 'Удовлетворительно' },
  { level_value: 3, label_text: 'Хорошо' },
  { level_value: 4, label_text: 'Отлично' },
  { level_value: 5, label_text: 'Превосходно' },
];

/**
 * Get label for a score. If overrides provided, uses them; otherwise falls back to defaults.
 */
export const getSkillScoreLabel = (score: number, overrides?: ScaleConfig): string => {
  if (overrides?.labels && overrides.labels.length > 0) {
    return findClosestLabel(score, overrides.labels);
  }
  // Legacy default
  if (score < 0.5) return 'Не оценено';
  if (score < 1.5) return 'Начинающий';
  if (score < 2.5) return 'Базовый';
  if (score < 3.5) return 'Уверенный';
  return 'Эксперт';
};

export const getQualityScoreLabel = (score: number, overrides?: ScaleConfig): string => {
  if (overrides?.labels && overrides.labels.length > 0) {
    return findClosestLabel(score, overrides.labels);
  }
  // Legacy default
  if (score < 0.5) return 'Не оценено';
  if (score < 1.5) return 'Слабо';
  if (score < 2.5) return 'Удовлетворительно';
  if (score < 3.5) return 'Хорошо';
  if (score < 4.5) return 'Отлично';
  return 'Превосходно';
};

/** Find the closest label by rounding score to the nearest level_value */
function findClosestLabel(score: number, labels: ScaleLabelOverride[]): string {
  if (labels.length === 0) return String(score);
  const sorted = [...labels].sort((a, b) => a.level_value - b.level_value);
  // Find the label whose level_value is closest
  let closest = sorted[0];
  let minDist = Math.abs(score - closest.level_value);
  for (const label of sorted) {
    const dist = Math.abs(score - label.level_value);
    if (dist < minDist) {
      minDist = dist;
      closest = label;
    }
  }
  return closest.label_text;
}

// Цвета для оценок (очень мягкие приглушенные оттенки)
export const getScoreColor = (score: number, maxScore: number = 5): string => {
  const percentage = (score / maxScore) * 100;
  if (percentage < 30) return 'hsl(0, 45%, 70%)';
  if (percentage < 50) return 'hsl(25, 50%, 68%)';
  if (percentage < 70) return 'hsl(45, 55%, 65%)';
  if (percentage < 85) return 'hsl(145, 40%, 60%)';
  return 'hsl(160, 45%, 58%)';
};

// Цвета фона для оценок
export const getScoreBgColor = (score: number, maxScore: number = 5): string => {
  const percentage = (score / maxScore) * 100;
  if (percentage < 30) return 'bg-red-50 border-red-200';
  if (percentage < 50) return 'bg-orange-50 border-orange-200';
  if (percentage < 70) return 'bg-yellow-50 border-yellow-200';
  if (percentage < 85) return 'bg-green-50 border-green-200';
  return 'bg-emerald-50 border-emerald-200';
};
