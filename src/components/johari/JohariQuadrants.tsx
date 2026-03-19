import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, Sparkles, HelpCircle, AlertCircle } from 'lucide-react';
import { JohariSkillCard } from './JohariSkillCard';
import { sortSkillsInZone } from '@/lib/johariMarkers';
import type { SkillMetrics } from '@/hooks/useJohariReport';

interface JohariQuadrantsProps {
  skills: SkillMetrics[];
  scaleMax: number;
  externalOnly?: boolean;
}

interface QuadrantConfig {
  zone: SkillMetrics['zone'];
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
}

const quadrantConfigs: QuadrantConfig[] = [
  {
    zone: 'arena',
    title: 'Открытая зона',
    subtitle: 'Самооценка и внешняя оценка близки',
    icon: <CheckCircle className="w-4 h-4 text-green-600" />,
    bgClass: 'bg-green-50 dark:bg-green-950',
    borderClass: 'border-green-200 dark:border-green-800'
  },
  {
    zone: 'blind_spot',
    title: 'Слепая зона',
    subtitle: 'Сотрудник оценивает себя выше окружающих',
    icon: <Eye className="w-4 h-4 text-orange-600" />,
    bgClass: 'bg-orange-50 dark:bg-orange-950',
    borderClass: 'border-orange-200 dark:border-orange-800'
  },
  {
    zone: 'hidden_strength',
    title: 'Скрытая зона',
    subtitle: 'Окружающие оценивают выше сотрудника',
    icon: <Sparkles className="w-4 h-4 text-blue-600" />,
    bgClass: 'bg-blue-50 dark:bg-blue-950',
    borderClass: 'border-blue-200 dark:border-blue-800'
  },
  {
    zone: 'unknown',
    title: 'Чёрный ящик',
    subtitle: 'Недостаточно данных для классификации',
    icon: <HelpCircle className="w-4 h-4 text-gray-600" />,
    bgClass: 'bg-gray-50 dark:bg-gray-900',
    borderClass: 'border-gray-200 dark:border-gray-700'
  }
];

const QuadrantCard: React.FC<{ config: QuadrantConfig; zoneSkills: SkillMetrics[]; scaleMax: number; externalOnly?: boolean }> = ({ config, zoneSkills, scaleMax, externalOnly = false }) => {
  const sortedSkills = sortSkillsInZone(zoneSkills);
  const total = sortedSkills.length;

  return (
    <Card className={`${config.bgClass} ${config.borderClass} border`}>
      <CardHeader className="px-3 py-2 pb-1.5">
        <CardTitle className="flex items-start justify-between gap-2 text-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            {config.icon}
            <div className="min-w-0">
              <div className="font-semibold">{config.title}</div>
              <div className="text-xs font-normal text-muted-foreground leading-snug">
                {config.subtitle}
              </div>
            </div>
          </div>
          {total > 0 && (
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 whitespace-nowrap flex-shrink-0">
              {total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {total > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {sortedSkills.map((skill) => (
              <JohariSkillCard key={skill.skill_id} skill={skill} scaleMax={scaleMax} externalOnly={externalOnly} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            Нет навыков в этой зоне
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export const JohariQuadrants: React.FC<JohariQuadrantsProps> = ({ skills, scaleMax, externalOnly = false }) => {
  // Server already applies classification and borderline rounding — consume as-is
  const sufficientSkills = skills.filter(s => s.confidence_tier !== 'insufficient');
  const insufficientSkills = skills.filter(s => s.confidence_tier === 'insufficient');

  const groupedSkills = sufficientSkills.reduce((acc, skill) => {
    if (!acc[skill.zone]) acc[skill.zone] = [];
    acc[skill.zone].push(skill);
    return acc;
  }, {} as Record<SkillMetrics['zone'], SkillMetrics[]>);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quadrantConfigs.map((config) => (
          <QuadrantCard
            key={config.zone}
            config={config}
            zoneSkills={groupedSkills[config.zone] || []}
            scaleMax={scaleMax}
            externalOnly={externalOnly}
          />
        ))}
      </div>

      {/* Insufficient data skills */}
      {insufficientSkills.length > 0 && (
        <Card className="border-muted">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Недостаточно данных
              <span className="text-xs font-normal">
                — не хватает ответов для помещения в одну из зон, слишком субъективно
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {insufficientSkills.map((skill) => (
                <JohariSkillCard key={skill.skill_id} skill={skill} scaleMax={scaleMax} externalOnly={externalOnly} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
