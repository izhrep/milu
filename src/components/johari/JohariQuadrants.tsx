import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, Sparkles, HelpCircle, AlertCircle } from "@/components/icons";
import { JohariSkillCard } from './JohariSkillCard';
import { sortSkillsInZone } from '@/lib/johariMarkers';
import type { SkillMetrics } from '@/hooks/useJohariReport';

interface JohariQuadrantsProps {
  skills: SkillMetrics[];
  scaleMax: number;
  scaleMin?: number;
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
    icon: <CheckCircle className="w-4 h-4 text-success" />,
    bgClass: 'bg-success/10 dark:bg-success',
    borderClass: 'border-success/30 dark:border-success'
  },
  {
    zone: 'blind_spot',
    title: 'Слепая зона',
    subtitle: 'Сотрудник оценивает себя выше окружающих',
    icon: <Eye className="w-4 h-4 text-warning" />,
    bgClass: 'bg-warning/10 dark:bg-warning',
    borderClass: 'border-warning/30 dark:border-warning'
  },
  {
    zone: 'hidden_strength',
    title: 'Скрытая зона',
    subtitle: 'Окружающие оценивают выше сотрудника',
    icon: <Sparkles className="w-4 h-4 text-primary" />,
    bgClass: 'bg-primary/10 dark:bg-primary',
    borderClass: 'border-primary/30 dark:border-primary'
  },
  {
    zone: 'unknown',
    title: 'Чёрный ящик',
    subtitle: 'Недостаточно данных для классификации',
    icon: <HelpCircle className="w-4 h-4 text-muted-foreground" />,
    bgClass: 'bg-muted',
    borderClass: 'border-border'
  }
];

const QuadrantCard: React.FC<{ config: QuadrantConfig; zoneSkills: SkillMetrics[]; scaleMax: number; scaleMin?: number; externalOnly?: boolean }> = ({ config, zoneSkills, scaleMax, scaleMin = 1, externalOnly = false }) => {
  const sortedSkills = sortSkillsInZone(zoneSkills, { min: scaleMin, max: scaleMax });
  const total = sortedSkills.length;

  return (
    <Card className={`${config.bgClass} ${config.borderClass} border`}>
      <CardHeader className="px-3 py-2 pb-1.5">
        <CardTitle className="flex items-start justify-between gap-2 text-body-md">
          <div className="flex items-center gap-1.5 min-w-0">
            {config.icon}
            <div className="min-w-0">
              <div className="font-semibold">{config.title}</div>
              <div className="text-caption-sm font-normal text-muted-foreground leading-snug">
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
              <JohariSkillCard key={skill.skill_id} skill={skill} scaleMax={scaleMax} scaleMin={scaleMin} externalOnly={externalOnly} />
            ))}
          </div>
        ) : (
          <p className="text-caption-sm text-muted-foreground text-center py-3">
            Нет навыков в этой зоне
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export const JohariQuadrants: React.FC<JohariQuadrantsProps> = ({ skills, scaleMax, scaleMin = 1, externalOnly = false }) => {
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
            scaleMin={scaleMin}
            externalOnly={externalOnly}
          />
        ))}
      </div>

      {/* Insufficient data skills */}
      {insufficientSkills.length > 0 && (
        <Card className="border-muted">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-body-md text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Недостаточно данных
              <span className="text-caption-sm font-normal">
                — не хватает ответов для помещения в одну из зон, слишком субъективно
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {insufficientSkills.map((skill) => (
                <JohariSkillCard key={skill.skill_id} skill={skill} scaleMax={scaleMax} scaleMin={scaleMin} externalOnly={externalOnly} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
