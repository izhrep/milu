# Логика подбора шага карьерного трека к грейду сотрудника

## Обзор алгоритма

Система анализирует соответствие сотрудника шагам карьерного трека на основе его текущих компетенций (навыков и качеств) и требований каждого грейда в треке.

## Структура данных

### CareerTrackStep
```typescript
interface CareerTrackStep {
  id: string;
  step_order: number;          // Порядок шага в треке
  duration_months: number;     // Длительность в месяцах
  grade: {                     // Грейд для данного шага
    id: string;
    name: string;
    level?: number;
  };
  required_skills: Array<{     // Требуемые навыки
    skill_id: string;
    skill_name: string;
    target_level: number;      // Целевой уровень навыка
    user_level: number;        // Текущий уровень пользователя
    is_ready: boolean;         // Готов ли пользователь по данному навыку
  }>;
  required_qualities: Array<{  // Требуемые качества
    quality_id: string;
    quality_name: string;
    target_level: number;      // Целевой уровень качества
    user_level: number;        // Текущий уровень пользователя
    is_ready: boolean;         // Готов ли пользователь по данному качеству
  }>;
  overall_readiness: number;   // Общая готовность (0-100%)
  compatibility_score: number; // Показатель совместимости (0-100%)
}
```

## Алгоритм расчета совместимости

### 1. Сбор данных
```sql
-- Получение всех треков с шагами и требованиями
SELECT 
  career_tracks.*,
  career_track_steps.*,
  grades.*,
  grade_skills.target_level,
  skills.name as skill_name,
  grade_qualities.target_level,
  qualities.name as quality_name
FROM career_tracks
JOIN career_track_steps ON career_tracks.id = career_track_steps.career_track_id
JOIN grades ON career_track_steps.grade_id = grades.id
LEFT JOIN grade_skills ON grades.id = grade_skills.grade_id
LEFT JOIN skills ON grade_skills.skill_id = skills.id
LEFT JOIN grade_qualities ON grades.id = grade_qualities.grade_id
LEFT JOIN qualities ON grade_qualities.quality_id = qualities.id
```

### 2. Сопоставление с профилем пользователя

Для каждого требования (навыка или качества) грейда:

```typescript
// Сравнение навыков
const required_skills = gradeSkills.map((gs) => {
  const userSkill = competencyProfile?.skills.find(s => s.id === gs.skill_id);
  return {
    skill_id: gs.skill_id,
    skill_name: gs.skills.name,
    target_level: gs.target_level,
    user_level: userSkill?.current_level || 0,
    is_ready: (userSkill?.current_level || 0) >= gs.target_level
  };
});

// Сравнение качеств
const required_qualities = gradeQualities.map((gq) => {
  const userQuality = competencyProfile?.qualities.find(q => q.id === gq.quality_id);
  return {
    quality_id: gq.quality_id,
    quality_name: gq.qualities.name,
    target_level: gq.target_level,
    user_level: userQuality?.current_level || 0,
    is_ready: (userQuality?.current_level || 0) >= gq.target_level
  };
});
```

### 3. Расчет базовой готовности (Binary Readiness)

```typescript
const totalRequirements = required_skills.length + required_qualities.length;
const readyRequirements = required_skills.filter(s => s.is_ready).length + 
                         required_qualities.filter(q => q.is_ready).length;

const basic_readiness = totalRequirements > 0 ? (readyRequirements / totalRequirements) * 100 : 0;
```

**Принцип**: Простой подсчет доли требований, которые пользователь уже выполняет.

### 4. Расчет детального показателя совместимости (Weighted Compatibility)

```typescript
let compatibility_score = 0;
if (totalRequirements > 0) {
  // Вклад навыков в совместимость
  const skillsMatch = required_skills.reduce((sum, skill) => {
    return sum + Math.min(skill.user_level / skill.target_level, 1);
  }, 0);
  
  // Вклад качеств в совместимость
  const qualitiesMatch = required_qualities.reduce((sum, quality) => {
    return sum + Math.min(quality.user_level / quality.target_level, 1);
  }, 0);
  
  compatibility_score = ((skillsMatch + qualitiesMatch) / totalRequirements) * 100;
}
```

**Принцип**: Учитывает частичное соответствие. Если пользователь имеет 80% от требуемого уровня навыка, это засчитывается как 0.8 балла.

### 5. Расчет совместимости всего трека

```typescript
// Агрегация всех требований по треку
const allRequiredSkills = stepsWithRequirements.flatMap(s => s.required_skills);
const allRequiredQualities = stepsWithRequirements.flatMap(s => s.required_qualities);

const totalCompatibility = allRequiredSkills.length + allRequiredQualities.length;
const readyCompatibility = allRequiredSkills.filter(s => s.is_ready).length + 
                          allRequiredQualities.filter(q => q.is_ready).length;

const track_compatibility_score = totalCompatibility > 0 ? 
  (readyCompatibility / totalCompatibility) * 100 : 0;
```

### 6. Расчет gap-анализа

```typescript
// Расчет общего разрыва в компетенциях
const skillsGap = allRequiredSkills.reduce((sum, s) => 
  sum + Math.max(0, s.target_level - s.user_level), 0);

const qualitiesGap = allRequiredQualities.reduce((sum, q) => 
  sum + Math.max(0, q.target_level - q.user_level), 0);

const total_gap = skillsGap + qualitiesGap;
```

## Алгоритм определения следующего шага

### 1. Логика статусов шагов

```typescript
const isActive = step.id === progress.current_step_id;        // Текущий шаг
const isCompleted = currentStep && step.step_order < currentStep.step_order;  // Пройденные шаги
const isNext = !currentStep && index === 0 ||               // Первый шаг при отсутствии прогресса
               (currentStep && step.step_order === currentStep.step_order + 1);  // Следующий шаг
```

### 2. Определение доступности перехода

- **Первый шаг**: Доступен всегда, если нет активного прогресса
- **Следующий шаг**: Доступен только если текущий шаг завершен или пропущен
- **Произвольный шаг**: Недоступен для прямого перехода (линейная прогрессия)

### 3. Механизм выбора шага

```typescript
const handleSelectStep = async (stepId: string) => {
  try {
    // Обновление прогресса через updateCareerProgress
    await selectTrack(progress.career_track_id, stepId);
  } catch (error) {
    console.error('Error selecting step:', error);
  }
};
```

## Визуализация совместимости

### Цветовая индикация готовности:
- **Зеленый (is_ready: true)**: Пользователь соответствует требованию
- **Красный (is_ready: false)**: Пользователь не соответствует требованию

### Процентные показатели:
- **overall_readiness**: Базовая готовность (binary)
- **compatibility_score**: Детальная совместимость (weighted)

## Сортировка и ранжирование треков

```typescript
// Треки сортируются по убыванию совместимости
tracksWithSteps.sort((a, b) => b.compatibility_score - a.compatibility_score);
```

**Результат**: Наиболее подходящие треки отображаются первыми.

## Примечания по реализации

1. **Производительность**: Все данные загружаются одним запросом с использованием Promise.all()
2. **Кэширование**: Используются Map для быстрого доступа к связанным данным
3. **Обработка ошибок**: Graceful handling для отсутствующих данных
4. **Точность расчетов**: Результаты округляются до 1 знака после запятой

## База данных

### Ключевые таблицы:
- `career_tracks` - Карьерные треки
- `career_track_steps` - Шаги треков
- `grades` - Грейды/уровни
- `grade_skills` - Требуемые навыки для грейдов
- `grade_qualities` - Требуемые качества для грейдов
- `user_skills` - Текущие навыки пользователя
- `user_qualities` - Текущие качества пользователя
- `user_career_progress` - Прогресс пользователя по трекам