import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CompetencyFilterType, RadarRoleType } from '@/components/CompetencyFilter';

interface AssessmentData {
  name: string;
  self_assessment: number;
  peers_average: number;
  all_except_self?: number | null;
  manager_assessment: number;
  category_name?: string;
  subcategory_name?: string;
}

interface RadarChartResultsProps {
  data: AssessmentData[];
  assessmentType: 'skill_survey' | 'survey_360';
  loading?: boolean;
  maxValue?: number;
  filterType?: CompetencyFilterType;
  selectedRoles?: RadarRoleType[];
  isPrinting?: boolean;
}

// Цвета согласно требованиям
const CHART_COLORS = {
  self: {
    stroke: '#3A3FBC',
    fill: 'rgba(58, 63, 188, 0.22)' // ~22% opacity
  },
  peers: {
    stroke: '#2EAE80',
    fill: 'rgba(46, 174, 128, 0.22)'
  },
  manager: {
    stroke: '#F28C28',
    fill: 'rgba(242, 140, 40, 0.22)'
  }
};

// Цвета для сегментов категорий
const CATEGORY_COLORS = [
  'rgba(58, 63, 188, 0.08)',
  'rgba(46, 174, 128, 0.08)',
  'rgba(242, 140, 40, 0.08)',
  'rgba(155, 89, 182, 0.08)',
  'rgba(231, 76, 60, 0.08)',
  'rgba(241, 196, 15, 0.08)',
  'rgba(52, 152, 219, 0.08)',
  'rgba(26, 188, 156, 0.08)',
];

// Кастомная форма для маркеров с поддержкой подсветки
// Личный фидбек - круглый маркер
const CircleMarker = (props: any) => {
  const { cx, cy, stroke, payload, hoveredCategory } = props;
  const isHighlighted = !hoveredCategory || payload?.category_name === hoveredCategory;
  return (
    <circle 
      cx={cx} 
      cy={cy} 
      r={isHighlighted ? 5 : 3} 
      fill={isHighlighted ? "white" : "hsl(var(--muted))"}
      stroke={stroke} 
      strokeWidth={isHighlighted ? 2 : 1}
      opacity={isHighlighted ? 1 : 0.3}
      style={{ transition: 'all 0.2s ease' }}
    />
  );
};

// Средний фидбек коллег - квадратный маркер
const SquareMarker = (props: any) => {
  const { cx, cy, stroke, payload, hoveredCategory } = props;
  const isHighlighted = !hoveredCategory || payload?.category_name === hoveredCategory;
  const size = isHighlighted ? 7 : 5;
  return (
    <rect 
      x={cx - size/2} 
      y={cy - size/2} 
      width={size} 
      height={size} 
      fill={isHighlighted ? "white" : "hsl(var(--muted))"}
      stroke={stroke} 
      strokeWidth={isHighlighted ? 2 : 1}
      opacity={isHighlighted ? 1 : 0.3}
      style={{ transition: 'all 0.2s ease' }}
    />
  );
};

// Фидбек unit-лида - треугольный маркер
const TriangleMarker = (props: any) => {
  const { cx, cy, stroke, payload, hoveredCategory } = props;
  const isHighlighted = !hoveredCategory || payload?.category_name === hoveredCategory;
  const size = isHighlighted ? 6 : 4;
  // Треугольник: вершина сверху, основание снизу
  return (
    <polygon 
      points={`${cx},${cy-size} ${cx+size},${cy+size} ${cx-size},${cy+size}`}
      fill={isHighlighted ? "white" : "hsl(var(--muted))"}
      stroke={stroke} 
      strokeWidth={isHighlighted ? 2 : 1}
      opacity={isHighlighted ? 1 : 0.3}
      style={{ transition: 'all 0.2s ease' }}
    />
  );
};

// Маркеры для легенды (статичные, без hover)
const LegendCircleMarker = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" className="inline-block mr-2">
    <circle cx="7" cy="7" r="5" fill="white" stroke={color} strokeWidth="2" />
  </svg>
);

const LegendSquareMarker = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" className="inline-block mr-2">
    <rect x="3" y="3" width="8" height="8" fill="white" stroke={color} strokeWidth="2" />
  </svg>
);

const LegendTriangleMarker = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" className="inline-block mr-2">
    <polygon points="7,2 12,12 2,12" fill="white" stroke={color} strokeWidth="2" />
  </svg>
);

export const RadarChartResults: React.FC<RadarChartResultsProps> = ({ 
  data, 
  assessmentType,
  loading = false,
  maxValue: propMaxValue,
  filterType = 'hard_skills',
  selectedRoles = ['self', 'manager', 'peers'],
  isPrinting = false
}) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [isTableOpen, setIsTableOpen] = useState(true);
  
  // Выделение категорий актуально только для уровня навыков
  const isSkillsLevel = filterType === 'hard_skills' || filterType === 'soft_skills';
  const effectiveHoveredCategory = isSkillsLevel ? hoveredCategory : null;

  // Определяем заголовок в зависимости от фильтра
  const getChartTitle = () => {
    if (filterType === 'hard_skills' || filterType === 'soft_skills') {
      return 'Роза навыков';
    } else if (filterType === 'hard_categories' || filterType === 'soft_categories') {
      return 'Роза компетенций';
    } else if (filterType === 'hard_subcategories' || filterType === 'soft_subcategories') {
      return 'Роза подкомпетенций';
    }
    return 'Роза компетенций';
  };

  // Динамическое название таблицы результатов под розой
  const getDetailTableTitle = () => {
    if (filterType === 'hard_skills') {
      return 'Таблица результатов розы Hard-навыков';
    } else if (filterType === 'soft_skills') {
      return 'Таблица результатов розы Soft-навыков';
    } else if (filterType === 'hard_categories') {
      return 'Таблица результатов розы Hard-компетенций';
    } else if (filterType === 'soft_categories') {
      return 'Таблица результатов розы Soft-компетенций';
    } else if (filterType === 'hard_subcategories') {
      return 'Таблица результатов розы Hard-подкомпетенций';
    } else if (filterType === 'soft_subcategories') {
      return 'Таблица результатов розы Soft-подкомпетенций';
    }
    return 'Таблица результатов розы';
  };

  // Получаем уникальные категории и их индексы для сегментации
  const categoryInfo = useMemo(() => {
    if (!data || data.length === 0) return { categories: [], categoryIndices: new Map() };
    
    const categories: string[] = [];
    const categoryIndices = new Map<string, { start: number; end: number; color: string }>();
    let currentCategory = '';
    let startIndex = 0;
    
    data.forEach((item, index) => {
      const cat = item.category_name || 'Без категории';
      if (cat !== currentCategory) {
        if (currentCategory) {
          categoryIndices.set(currentCategory, {
            start: startIndex,
            end: index - 1,
            color: CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
          });
        }
        currentCategory = cat;
        startIndex = index;
        categories.push(cat);
      }
      if (index === data.length - 1) {
        categoryIndices.set(currentCategory, {
          start: startIndex,
          end: index,
          color: CATEGORY_COLORS[categories.length - 1 % CATEGORY_COLORS.length]
        });
      }
    });
    
    return { categories, categoryIndices };
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{getChartTitle()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[500px]">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Результаты ещё не сформированы</CardTitle>
          <CardDescription>
            Результаты оценки ещё не сформированы. Обновите страницу позже.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Проверяем наличие данных для каждой роли (учитывая фильтр ролей)
  const hasSelfAssessment = selectedRoles.includes('self') && 
    data.some(item => item.self_assessment != null && item.self_assessment > 0);
  const hasPeersAverage = selectedRoles.includes('peers') && 
    data.some(item => (item as any).all_except_self != null && (item as any).all_except_self > 0);
  const hasManagerAssessment = selectedRoles.includes('manager') && 
    data.some(item => item.manager_assessment != null && item.manager_assessment > 0);
  
  const isPartialData = [hasSelfAssessment, hasPeersAverage, hasManagerAssessment].filter(Boolean).length < selectedRoles.length;
  
  // Определяем, сколько компетенций было оценено
  const assessedCount = data.filter(item => 
    (selectedRoles.includes('self') && item.self_assessment > 0) || 
    (selectedRoles.includes('peers') && (item as any).all_except_self > 0) || 
    (selectedRoles.includes('manager') && item.manager_assessment > 0)
  ).length;

  // Используем переданное максимальное значение шкалы:
  // Hard Skills: 0-4, Soft Skills: 0-5
  const maxValue = propMaxValue ?? (filterType.startsWith('hard') ? 4 : 5);

  // Преобразуем нулевые значения в null, чтобы линия их пропускала
  // Добавляем поля для подсвеченных данных
  // Для уровней Компетенции/Подкомпетенции - линии замыкаются через центр при отсутствии значений
  const isCategoryOrSubcategoryLevel = filterType === 'hard_categories' || 
    filterType === 'soft_categories' || 
    filterType === 'hard_subcategories' || 
    filterType === 'soft_subcategories';
  
  const chartData = useMemo(() => {
    // Находим индексы категории при наведении
    let categoryStartIndex = -1;
    let categoryEndIndex = -1;
    
    if (effectiveHoveredCategory) {
      data.forEach((item, index) => {
        const itemKey = item.category_name || item.name;
        if (itemKey === effectiveHoveredCategory) {
          if (categoryStartIndex === -1) categoryStartIndex = index;
          categoryEndIndex = index;
        }
      });
    }
    
    // Для уровней категорий/подкатегорий: находим индексы с реальными значениями
    // чтобы замыкать линию через центр между ними
    const getValueWithCenterConnection = (
      value: number | null | undefined, 
      index: number, 
      dataKey: 'self_assessment' | 'peers_average' | 'manager_assessment'
    ): number | null => {
      const hasValue = value != null && value > 0;
      
      if (hasValue) {
        return value;
      }
      
      // Для уровней навыков - просто null (линия пропускает)
      if (!isCategoryOrSubcategoryLevel) {
        return null;
      }
      
      // Для уровней компетенций/подкомпетенций:
      // Проверяем, есть ли соседние точки с значениями - если да, то идем через центр (0)
      // Это создаст визуальное замыкание через центр
      const prevIndex = index === 0 ? data.length - 1 : index - 1;
      const nextIndex = index === data.length - 1 ? 0 : index + 1;
      
      const prevValue = data[prevIndex]?.[dataKey];
      const nextValue = data[nextIndex]?.[dataKey];
      
      const hasPrevValue = prevValue != null && prevValue > 0;
      const hasNextValue = nextValue != null && nextValue > 0;
      
      // Если есть соседние значения с обеих сторон или это крайняя точка с одним соседом
      // используем 0 для прохода через центр
      if (hasPrevValue || hasNextValue) {
        return 0; // Визуально через центр, но не как значение
      }
      
      return null; // Нет соседей с значениями - просто пропускаем
    };
    
    return data.map((item, index) => {
      const itemKey = item.category_name || item.name;
      const isInHighlightedCategory = effectiveHoveredCategory ? itemKey === effectiveHoveredCategory : false;
      
      // Логика для подсвеченных значений:
      // - Точки внутри категории: реальные значения (соединяются напрямую)
      // - Точка сразу перед категорией: 0 (вход через центр)
      // - Точка сразу после категории: 0 (выход через центр)
      // - Остальные точки: null (пропускаются линией)
      let highlightedValue = (role: 'self' | 'peers' | 'manager', value: number | null) => {
        if (!effectiveHoveredCategory) return null;
        
        if (isInHighlightedCategory && value && value > 0) {
          return value; // Точка в категории - реальное значение
        }
        
        // Точка сразу перед или после категории - через центр (0)
        const isAdjacentBefore = index === categoryStartIndex - 1 || 
          (categoryStartIndex === 0 && index === data.length - 1); // Циклический переход
        const isAdjacentAfter = index === categoryEndIndex + 1 || 
          (categoryEndIndex === data.length - 1 && index === 0); // Циклический переход
        
        if (isAdjacentBefore || isAdjacentAfter) {
          return 0; // Через центр
        }
        
        return null; // Остальные точки пропускаются
      };
      
      const allExceptSelf = (item as any).all_except_self;
      return {
        ...item,
        // Для основных линий используем новую логику с замыканием через центр
        self_assessment: getValueWithCenterConnection(item.self_assessment, index, 'self_assessment'),
        all_except_self: getValueWithCenterConnection(allExceptSelf, index, 'peers_average'),
        manager_assessment: getValueWithCenterConnection(item.manager_assessment, index, 'manager_assessment'),
        // Храним оригинальные значения для tooltip и маркеров
        self_assessment_original: item.self_assessment > 0 ? item.self_assessment : null,
        all_except_self_original: allExceptSelf > 0 ? allExceptSelf : null,
        manager_assessment_original: item.manager_assessment > 0 ? item.manager_assessment : null,
        // Подсвеченные значения
        self_highlighted: highlightedValue('self', item.self_assessment),
        all_except_self_highlighted: highlightedValue('peers', allExceptSelf),
        manager_highlighted: highlightedValue('manager', item.manager_assessment),
        isHighlighted: effectiveHoveredCategory ? itemKey === effectiveHoveredCategory : true,
        index
      };
    });
  }, [data, effectiveHoveredCategory, isCategoryOrSubcategoryLevel]);

  // Предрасчёт позиций для вертикальных списков (N > 28)
  const labelPositions = useMemo(() => {
    const N = data.length;
    if (N <= 28) return null;
    
    // Разделяем навыки на левую и правую зоны по углу
    const leftItems: { index: number; angle: number; name: string }[] = [];
    const rightItems: { index: number; angle: number; name: string }[] = [];
    const topItems: { index: number; angle: number; name: string }[] = [];
    const bottomItems: { index: number; angle: number; name: string }[] = [];
    
    data.forEach((item, index) => {
      const angleStep = (2 * Math.PI) / N;
      const angle = -Math.PI / 2 + index * angleStep; // Начинаем сверху
      const normalizedAngle = ((angle * 180 / Math.PI) + 360) % 360;
      
      // Верхняя зона: 250-290° (узкая полоса сверху)
      // Нижняя зона: 70-110° (узкая полоса снизу)
      if (normalizedAngle > 250 && normalizedAngle < 290) {
        topItems.push({ index, angle, name: item.name });
      } else if (normalizedAngle > 70 && normalizedAngle < 110) {
        bottomItems.push({ index, angle, name: item.name });
      } else if (normalizedAngle >= 90 && normalizedAngle <= 270) {
        leftItems.push({ index, angle, name: item.name });
      } else {
        rightItems.push({ index, angle, name: item.name });
      }
    });
    
    // Сортируем по углу для правильного порядка
    // Левая сторона: сверху вниз (по возрастанию угла от 90° к 270°)
    leftItems.sort((a, b) => a.angle - b.angle);
    // Правая сторона: сверху вниз (от -90° через 0° к 90°, т.е. по возрастанию)
    rightItems.sort((a, b) => a.angle - b.angle);
    topItems.sort((a, b) => a.angle - b.angle);
    bottomItems.sort((a, b) => a.angle - b.angle);
    
    return { leftItems, rightItems, topItems, bottomItems };
  }, [data]);

  // Адаптивная система размещения подписей навыков
  const CustomAngleTick = (props: any) => {
    const { x, y, payload, cx, cy } = props;
    const item = chartData.find(d => d.name === payload.value);
    const isHighlighted = item?.isHighlighted !== false;
    const categoryName = item?.category_name || '';
    const itemIndex = item?.index ?? 0;
    
    const N = data.length;
    const angle = Math.atan2(y - cy, x - cx);
    const radius = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    
    const angleDeg = (angle * 180 / Math.PI);
    const normalizedAngle = ((angleDeg + 360) % 360);
    
    const fullName = payload.value;
    const hoverKey = categoryName || fullName;
    const maxChars = 35;
    const displayName = fullName.length > maxChars 
      ? fullName.substring(0, maxChars - 1) + '…' 
      : fullName;
    const needsTooltip = fullName.length > maxChars;
    
    // Точка оси на окружности (для leader line)
    const axisPointX = cx + (radius + 5) * Math.cos(angle);
    const axisPointY = cy + (radius + 5) * Math.sin(angle);
    
    // Расширенная зона hover
    const totalItems = data.length;
    const angleStepDeg = 360 / totalItems;
    const axisAngleDeg = 90 - (itemIndex * angleStepDeg);
    const startAngleDeg = axisAngleDeg + angleStepDeg / 2;
    const endAngleDeg = axisAngleDeg - angleStepDeg / 2;
    const startAngleRad = (Math.PI / 180) * startAngleDeg;
    const endAngleRad = (Math.PI / 180) * endAngleDeg;
    const outerRadius = radius + 180;
    const innerRadius = 0;
    const largeArcFlag = angleStepDeg > 180 ? 1 : 0;
    
    const x1 = cx + innerRadius * Math.cos(startAngleRad);
    const y1 = cy - innerRadius * Math.sin(startAngleRad);
    const x2 = cx + outerRadius * Math.cos(startAngleRad);
    const y2 = cy - outerRadius * Math.sin(startAngleRad);
    const x3 = cx + outerRadius * Math.cos(endAngleRad);
    const y3 = cy - outerRadius * Math.sin(endAngleRad);
    const x4 = cx + innerRadius * Math.cos(endAngleRad);
    const y4 = cy - innerRadius * Math.sin(endAngleRad);

    const sectorPath = `
      M ${x1} ${y1}
      L ${x2} ${y2}
      A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x3} ${y3}
      L ${x4} ${y4}
      A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1} ${y1}
      Z
    `;
    
    // Режим N <= 28: классическое размещение по окружности
    if (N <= 28) {
      const isRightHalf = normalizedAngle < 90 || normalizedAngle > 270;
      const isTopZone = normalizedAngle > 240 && normalizedAngle < 300;
      const isBottomZone = normalizedAngle > 60 && normalizedAngle < 120;
      
      const baseOffset = isTopZone || isBottomZone ? 35 : 15;
      const labelRadius = radius + baseOffset;
      const labelX = cx + labelRadius * Math.cos(angle);
      const labelY = cy + labelRadius * Math.sin(angle);
      
      const textAnchor = Math.abs(normalizedAngle - 90) < 10 || Math.abs(normalizedAngle - 270) < 10
        ? 'middle'
        : isRightHalf ? 'start' : 'end';
      
      return (
        <g 
          onMouseEnter={() => isSkillsLevel && setHoveredCategory(hoverKey)}
          onMouseLeave={() => isSkillsLevel && setHoveredCategory(null)}
          style={{ cursor: isSkillsLevel ? 'pointer' : 'default' }}
        >
          {/* Подсветка сектора при hover - только для уровня навыков */}
          {effectiveHoveredCategory === hoverKey && (
            <Sector
              cx={cx}
              cy={cy}
              innerRadius={0}
              outerRadius={radius + 18}
              startAngle={startAngleDeg}
              endAngle={endAngleDeg}
              fill="hsl(var(--primary) / 0.08)"
              stroke="hsl(var(--primary) / 0.18)"
              strokeWidth={1}
            />
          )}
          <path d={sectorPath} fill="transparent" stroke="none" style={{ pointerEvents: 'all' }} />
          <text
            x={labelX}
            y={labelY}
            fill={isHighlighted ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
            fontSize={11}
            fontWeight={isHighlighted && effectiveHoveredCategory ? 600 : 400}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            opacity={isHighlighted ? 1 : 0.4}
          >
            {displayName}
            {needsTooltip && <title>{fullName}</title>}
          </text>
        </g>
      );
    }
    
    // Режим N > 28: вертикальные списки слева и справа
    if (!labelPositions) return null;
    
    const { leftItems, rightItems, topItems, bottomItems } = labelPositions;
    
    // Определяем в какой зоне находится текущий элемент
    const isTop = topItems.some(i => i.index === itemIndex);
    const isBottom = bottomItems.some(i => i.index === itemIndex);
    const isLeft = leftItems.some(i => i.index === itemIndex);
    const isRight = rightItems.some(i => i.index === itemIndex);
    
    // Расчёт Y-позиции в вертикальном списке
    const lineHeight = 16; // Высота строки
    const chartHeight = radius * 2;
    
    let labelX: number;
    let labelY: number;
    let textAnchor: 'start' | 'end' | 'middle';
    
    if (isTop) {
      // Верхняя зона - следуем за точкой на окружности
      // Центральная точка (самая верхняя, ближе к 270°) выносится выше
      const isCenterTop = Math.abs(normalizedAngle - 270) < 15;
      const skillNum = itemIndex + 1;
      // Раздвигаем: левее центра → влево, правее центра → вправо
      const xOffset = (axisPointX - cx) * 0.4;
      labelX = axisPointX + xOffset;
      labelY = axisPointY - 20;
      if (isCenterTop) {
        labelY = axisPointY - 50;
      }
      // Навык #1 — ещё выше
      if (skillNum === 1) {
        labelY = axisPointY - 65;
      }
      textAnchor = axisPointX < cx ? 'end' : axisPointX > cx ? 'start' : 'middle';
    } else if (isBottom) {
      // Нижняя зона - следуем за точкой на окружности
      // Центральная точка (самая нижняя, ближе к 90°) выносится ниже
      const isCenterBottom = Math.abs(normalizedAngle - 90) < 15;
      const skillNum = itemIndex + 1;
      // Раздвигаем: левее центра → влево, правее центра → вправо
      const xOffset = (axisPointX - cx) * 0.4;
      labelX = axisPointX + xOffset;
      labelY = axisPointY + 20;
      if (isCenterBottom) {
        labelY = axisPointY + 50;
      }
      // Навык #20 — ещё ниже
      if (skillNum === 20) {
        labelY = axisPointY + 65;
      }
      textAnchor = axisPointX < cx ? 'end' : axisPointX > cx ? 'start' : 'middle';
    } else if (isLeft) {
      // Левая зона - подпись на том же Y что и точка на окружности
      labelX = cx - radius - 25;
      labelY = axisPointY; // Следуем за точкой на круге
      textAnchor = 'end'; // Левая зона → text-align: right
    } else {
      // Правая зона - подпись на том же Y что и точка на окружности
      labelX = cx + radius + 25;
      labelY = axisPointY; // Следуем за точкой на круге
      textAnchor = 'start'; // Правая зона → text-align: left
    }
    
    // Leader line: от точки на окружности к подписи
    const leaderEndX = textAnchor === 'end' ? labelX + 3 : textAnchor === 'start' ? labelX - 3 : labelX;
    const leaderEndY = labelY;
    
    return (
      <g 
        onMouseEnter={() => isSkillsLevel && setHoveredCategory(hoverKey)}
        onMouseLeave={() => isSkillsLevel && setHoveredCategory(null)}
        style={{ cursor: isSkillsLevel ? 'pointer' : 'default' }}
      >
        {/* Подсветка сектора при hover - только для уровня навыков */}
        {effectiveHoveredCategory === hoverKey && (
          <Sector
            cx={cx}
            cy={cy}
            innerRadius={0}
            outerRadius={radius + 18}
            startAngle={startAngleDeg}
            endAngle={endAngleDeg}
            fill="hsl(var(--primary) / 0.08)"
            stroke="hsl(var(--primary) / 0.18)"
            strokeWidth={1}
          />
        )}
        {/* Невидимая зона hover */}
        <path d={sectorPath} fill="transparent" stroke="none" style={{ pointerEvents: 'all' }} />
        {/* Leader line - пунктирная линия от точки на окружности к тексту */}
        <line
          x1={axisPointX}
          y1={axisPointY}
          x2={leaderEndX}
          y2={leaderEndY}
          stroke={isHighlighted ? 'hsl(var(--muted-foreground) / 0.5)' : 'hsl(var(--muted-foreground) / 0.2)'}
          strokeWidth={1}
          strokeDasharray="3,2"
        />
        {/* Маленькая точка на окружности */}
        <circle
          cx={axisPointX}
          cy={axisPointY}
          r={2}
          fill={isHighlighted ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground) / 0.3)'}
        />
        {/* Текст подписи */}
        <text
          x={labelX}
          y={labelY}
          fill={isHighlighted ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
          fontSize={11}
          fontWeight={isHighlighted && effectiveHoveredCategory ? 600 : 400}
          textAnchor={textAnchor}
          dominantBaseline="middle"
          opacity={isHighlighted ? 1 : 0.4}
        >
          {displayName}
          {needsTooltip && <title>{fullName}</title>}
        </text>
      </g>
    );
  };

  // Рендерим сегменты категорий
  const renderCategorySegments = () => {
    if (filterType !== 'hard_skills' && filterType !== 'soft_skills') return null;
    
    const segments: JSX.Element[] = [];
    const totalItems = data.length;
    const anglePerItem = 360 / totalItems;
    
    let currentIndex = 0;
    categoryInfo.categories.forEach((cat, catIndex) => {
      const catData = categoryInfo.categoryIndices.get(cat);
      if (!catData) return;
      
      const itemCount = catData.end - catData.start + 1;
      const startAngle = 90 - (currentIndex * anglePerItem);
      const endAngle = startAngle - (itemCount * anglePerItem);
      
      segments.push(
        <Sector
          key={cat}
          cx={200}
          cy={200}
          innerRadius={0}
          outerRadius={180}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={catData.color}
          stroke="none"
        />
      );
      
      currentIndex += itemCount;
    });
    
    return segments;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{getChartTitle()}</CardTitle>
          <CardDescription>
            Визуализация результатов по обратной связи 360
          </CardDescription>
          {/* Легенда категорий */}
          {(filterType === 'hard_skills' || filterType === 'soft_skills') && categoryInfo.categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {categoryInfo.categories.map((cat, index) => (
                <Badge
                  key={cat}
                  variant="outline"
                  className={`cursor-pointer transition-all ${
                    effectiveHoveredCategory === cat 
                      ? 'bg-primary/10 border-primary' 
                      : effectiveHoveredCategory 
                        ? 'opacity-40' 
                        : ''
                  }`}
                  onMouseEnter={() => setHoveredCategory(cat)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <span 
                    className="w-3 h-3 rounded-full mr-1.5" 
                    style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length].replace('0.08', '0.5') }}
                  />
                  {cat}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isPrinting ? (
            <RadarChart 
              width={700} 
              height={700} 
              data={chartData} 
              margin={{ top: 80, bottom: 80, left: data.length > 28 ? 180 : 20, right: data.length > 28 ? 180 : 20 }}
            >
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis 
                dataKey="name" 
                tick={CustomAngleTick}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, maxValue]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickCount={maxValue + 1}
              />
              {hasSelfAssessment && (
                <Radar
                  name="Личный фидбек"
                  dataKey="self_assessment"
                  stroke={CHART_COLORS.self.stroke}
                  fill={CHART_COLORS.self.stroke}
                  fillOpacity={0.22}
                  strokeWidth={2}
                  connectNulls={true}
                  dot={(props: any) => {
                    if (props.payload?.self_assessment === 0) return null;
                    return <CircleMarker {...props} stroke={CHART_COLORS.self.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
              {hasPeersAverage && (
                <Radar
                  name="Все кроме фидбека сотрудника"
                  dataKey="all_except_self"
                  stroke={CHART_COLORS.peers.stroke}
                  fill={CHART_COLORS.peers.stroke}
                  fillOpacity={0.22}
                  strokeWidth={2}
                  connectNulls={true}
                  dot={(props: any) => {
                    if (props.payload?.all_except_self === 0) return null;
                    return <SquareMarker {...props} stroke={CHART_COLORS.peers.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
              {hasManagerAssessment && (
                <Radar
                  name="Фидбек unit-лида"
                  dataKey="manager_assessment"
                  stroke={CHART_COLORS.manager.stroke}
                  fill={CHART_COLORS.manager.stroke}
                  fillOpacity={0.22}
                  strokeWidth={2}
                  connectNulls={true}
                  dot={(props: any) => {
                    if (props.payload?.manager_assessment === 0) return null;
                    return <TriangleMarker {...props} stroke={CHART_COLORS.manager.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
            </RadarChart>
          ) : (
           <ResponsiveContainer width="100%" height={700}>
            <RadarChart data={chartData} margin={{ top: 80, bottom: 80, left: data.length > 28 ? 180 : 20, right: data.length > 28 ? 180 : 20 }}>
               <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis 
                dataKey="name" 
                tick={CustomAngleTick}
              />
              <PolarRadiusAxis 
                angle={90} 
                domain={[0, maxValue]}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickCount={maxValue + 1}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                itemSorter={() => 0}
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  // Only show the 3 real dataKeys, skip *_highlighted/*_original
                  const allowedKeys = new Set(['self_assessment', 'all_except_self', 'manager_assessment']);
                  const filtered = payload.filter((entry: any) => allowedKeys.has(entry.dataKey));
                  if (filtered.length === 0) return null;
                  
                  const p = filtered[0]?.payload;
                  const allNull = p?.self_assessment_original == null && 
                                  p?.all_except_self_original == null && 
                                  p?.manager_assessment_original == null;
                  
                  const categoryName = p?.category_name;
                  const titleLabel = categoryName ? `${label} (${categoryName})` : label;
                  
                  return (
                    <div style={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}>
                      <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>{titleLabel}</p>
                      {allNull ? (
                        <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))' }}>Ещё не оценено</p>
                      ) : (
                        filtered.map((entry: any) => {
                          const val = entry.value;
                          const display = (val == null || val === 0) ? '—' : val.toFixed(1);
                          return (
                            <p key={entry.dataKey} style={{ margin: '2px 0', color: entry.color }}>
                              {entry.name} : {display}
                            </p>
                          );
                        })
                      )}
                    </div>
                  );
                }}
              />
              {/* Базовые радары (затемняются при наведении на категорию) */}
              {/* Личный фидбек - круглый маркер */}
              {hasSelfAssessment && (
                <Radar
                  name="Личный фидбек"
                  dataKey="self_assessment"
                  stroke={CHART_COLORS.self.stroke}
                  fill={CHART_COLORS.self.stroke}
                  fillOpacity={hoveredCategory ? 0.08 : 0.22}
                  strokeWidth={2}
                  strokeOpacity={hoveredCategory ? 0.25 : 1}
                  connectNulls={true}
                  dot={hoveredCategory ? false : (props: any) => {
                    // Скрываем маркер для 0-значений (через центр)
                    if (props.payload?.self_assessment === 0) return null;
                    return <CircleMarker {...props} stroke={CHART_COLORS.self.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
              {/* Все кроме фидбека сотрудника - квадратный маркер */}
              {hasPeersAverage && (
                <Radar
                  name="Все кроме фидбека сотрудника"
                  dataKey="all_except_self"
                  stroke={CHART_COLORS.peers.stroke}
                  fill={CHART_COLORS.peers.stroke}
                  fillOpacity={hoveredCategory ? 0.08 : 0.22}
                  strokeWidth={2}
                  strokeOpacity={hoveredCategory ? 0.25 : 1}
                  connectNulls={true}
                  dot={hoveredCategory ? false : (props: any) => {
                    if (props.payload?.all_except_self === 0) return null;
                    return <SquareMarker {...props} stroke={CHART_COLORS.peers.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
              {/* Фидбек unit-лида - треугольный маркер */}
              {hasManagerAssessment && (
                <Radar
                  name="Фидбек unit-лида"
                  dataKey="manager_assessment"
                  stroke={CHART_COLORS.manager.stroke}
                  fill={CHART_COLORS.manager.stroke}
                  fillOpacity={hoveredCategory ? 0.08 : 0.22}
                  strokeWidth={2}
                  strokeOpacity={hoveredCategory ? 0.25 : 1}
                  connectNulls={true}
                  dot={hoveredCategory ? false : (props: any) => {
                    if (props.payload?.manager_assessment === 0) return null;
                    return <TriangleMarker {...props} stroke={CHART_COLORS.manager.stroke} hoveredCategory={null} />;
                  }}
                  isAnimationActive={false}
                />
              )}
              
              {/* Подсвеченные сегменты при наведении на категорию */}
              {hoveredCategory && (
                <>
                  {hasSelfAssessment && (
                    <Radar
                      name=""
                      dataKey="self_highlighted"
                      stroke={CHART_COLORS.self.stroke}
                      fill={CHART_COLORS.self.stroke}
                      fillOpacity={0.35}
                      strokeWidth={3}
                      connectNulls={true}
                      dot={(props: any) => {
                        if (props.payload?.self_highlighted === 0) return null;
                        return <CircleMarker {...props} stroke={CHART_COLORS.self.stroke} hoveredCategory={null} />;
                      }}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  )}
                  {hasPeersAverage && (
                    <Radar
                      name=""
                      dataKey="all_except_self_highlighted"
                      stroke={CHART_COLORS.peers.stroke}
                      fill={CHART_COLORS.peers.stroke}
                      fillOpacity={0.35}
                      strokeWidth={3}
                      connectNulls={true}
                      dot={(props: any) => {
                        if (props.payload?.all_except_self_highlighted === 0) return null;
                        return <SquareMarker {...props} stroke={CHART_COLORS.peers.stroke} hoveredCategory={null} />;
                      }}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  )}
                  {hasManagerAssessment && (
                    <Radar
                      name=""
                      dataKey="manager_highlighted"
                      stroke={CHART_COLORS.manager.stroke}
                      fill={CHART_COLORS.manager.stroke}
                      fillOpacity={0.35}
                      strokeWidth={3}
                      connectNulls={true}
                      dot={(props: any) => {
                        if (props.payload?.manager_highlighted === 0) return null;
                        return <TriangleMarker {...props} stroke={CHART_COLORS.manager.stroke} hoveredCategory={null} />;
                      }}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  )}
                </>
              )}
              {/* Кастомная легенда с правильными маркерами */}
            </RadarChart>
          </ResponsiveContainer>
          )}
          
          {/* Кастомная легенда */}
          <div className="flex justify-center gap-6 pt-4">
            {hasSelfAssessment && (
              <div className="flex items-center">
                <LegendCircleMarker color={CHART_COLORS.self.stroke} />
                <span className="text-sm text-foreground">Личный фидбек</span>
              </div>
            )}
            {hasPeersAverage && (
              <div className="flex items-center">
                <LegendSquareMarker color={CHART_COLORS.peers.stroke} />
                <span className="text-sm text-foreground">Все кроме фидбека сотрудника</span>
              </div>
            )}
            {hasManagerAssessment && (
              <div className="flex items-center">
                <LegendTriangleMarker color={CHART_COLORS.manager.stroke} />
                <span className="text-sm text-foreground">Фидбек unit-лида</span>
              </div>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground text-center mt-4 space-y-1">
            {assessedCount < data.length && (
              <p className="text-amber-600 dark:text-amber-400">
                Оценено {assessedCount} из {data.length} компетенций
              </p>
            )}
            {isPartialData && (
              <p>Показаны результаты по тем группам, от которых уже есть ответы. Остальные ответы ещё не получены.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Collapsible open={isTableOpen} onOpenChange={setIsTableOpen}>
          <CardHeader className="py-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer group">
                <CardTitle className="text-base">{getDetailTableTitle()}</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 group-hover:bg-muted">
                  {isTableOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-2">
              <div className="space-y-1">
                {data.map((item, index) => {
              // Проверяем, выбрана ли роль для отображения
              const showSelf = selectedRoles.includes('self');
              const showManager = selectedRoles.includes('manager');
              const showPeers = selectedRoles.includes('peers');
              
              // Проверяем, есть ли данные для каждой роли
              const hasSelf = item.self_assessment != null && item.self_assessment > 0;
              const hasManager = item.manager_assessment != null && item.manager_assessment > 0;
              const hasPeers = item.all_except_self != null && item.all_except_self > 0;
              const isHighlighted = effectiveHoveredCategory ? item.category_name === effectiveHoveredCategory : true;
              
              // Считаем количество выбранных ролей для определения grid-cols
              const selectedCount = [showSelf, showManager, showPeers].filter(Boolean).length;
              const gridColsClass = selectedCount === 1 ? 'grid-cols-1' : selectedCount === 2 ? 'grid-cols-2' : 'grid-cols-3';
              
              return (
                <div 
                  key={index} 
                  className={`border-b border-border last:border-0 py-1 last:pb-0 transition-opacity ${
                    isHighlighted ? 'opacity-100' : 'opacity-40'
                  }`}
                  onMouseEnter={() => isSkillsLevel && setHoveredCategory(item.category_name || item.name)}
                  onMouseLeave={() => isSkillsLevel && setHoveredCategory(null)}
                >
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 className="font-medium text-foreground text-sm leading-tight">{item.name}</h3>
                    {/* Показываем категорию и подкатегорию для всех уровней фильтрации */}
                    <div className="flex gap-1.5 flex-wrap">
                      {item.category_name && (
                        <Badge variant="outline" className="text-xs py-0 px-1.5 font-normal">
                          {item.category_name}
                        </Badge>
                      )}
                      {item.subcategory_name && (
                        <Badge variant="secondary" className="text-xs py-0 px-1.5 font-normal">
                          {item.subcategory_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Всегда показываем grid с фиксированными позициями для выбранных ролей */}
                  {selectedCount > 0 ? (
                    <div className={`grid ${gridColsClass} gap-3 text-sm`}>
                      {showSelf && (
                        <div>
                          <span className={`text-xs ${hasSelf ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>Личный фидбек:</span>
                          {hasSelf ? (
                            <span className="ml-1.5 font-medium" style={{ color: CHART_COLORS.self.stroke }}>
                              {item.self_assessment.toFixed(1)}
                            </span>
                          ) : (
                            <span className="ml-1.5 text-muted-foreground/50">—</span>
                          )}
                        </div>
                      )}
                      {showManager && (
                        <div>
                          <span className={`text-xs ${hasManager ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>Фидбек unit-лида:</span>
                          {hasManager ? (
                            <span className="ml-1.5 font-medium" style={{ color: CHART_COLORS.manager.stroke }}>
                              {item.manager_assessment.toFixed(1)}
                            </span>
                          ) : (
                            <span className="ml-1.5 text-muted-foreground/50">—</span>
                          )}
                        </div>
                      )}
                      {showPeers && (
                        <div>
                          <span className={`text-xs ${hasPeers ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>Все кроме фидбека сотрудника:</span>
                          {hasPeers ? (
                            <span className="ml-1.5 font-medium" style={{ color: CHART_COLORS.peers.stroke }}>
                              {item.all_except_self.toFixed(1)}
                            </span>
                          ) : (
                            <span className="ml-1.5 text-muted-foreground/50">—</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Ещё не оценено</p>
                  )}
                </div>
              );
            })}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </>
  );
};