import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Eye, Sparkles, HelpCircle, AlertCircle } from 'lucide-react';
import { JohariCompetencyCard } from './JohariCompetencyCard';
import { groupSkillsIntoCompetencies } from '@/lib/johariCompetencies';
import { ZONE_LABELS, type JohariZone } from '@/lib/johariConfig';
import type { SkillMetrics } from '@/hooks/useJohariReport';

interface JohariCompetencyViewProps {
  skills: SkillMetrics[];
}

interface QuadrantConfig {
  zone: JohariZone;
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

export const JohariCompetencyView: React.FC<JohariCompetencyViewProps> = ({ skills }) => {
  // Server already applies classification and borderline rounding — consume as-is
  const { competencies, insufficientCompetencies } = groupSkillsIntoCompetencies(skills);

  // Group competencies by their dominant zone
  const groupedByZone: Record<JohariZone, typeof competencies> = {
    arena: [],
    blind_spot: [],
    hidden_strength: [],
    unknown: [],
  };

  for (const comp of competencies) {
    groupedByZone[comp.zone].push(comp);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {quadrantConfigs.map(config => {
          const zoneCompetencies = groupedByZone[config.zone];
          return (
            <Card key={config.zone} className={`${config.bgClass} ${config.borderClass} border`}>
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
                  {zoneCompetencies.length > 0 && (
                    <Badge variant="secondary" className="text-[11px] px-1.5 py-0 whitespace-nowrap flex-shrink-0">
                      {zoneCompetencies.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                {zoneCompetencies.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {zoneCompetencies.map(comp => (
                      <JohariCompetencyCard key={comp.category} competency={comp} />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Нет компетенций в этой зоне
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Insufficient competencies */}
      {insufficientCompetencies.length > 0 && (
        <Card className="border-muted">
          <CardHeader className="px-3 py-2 pb-1.5">
            <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Недостаточно данных
              <span className="text-xs font-normal">— все навыки компетенции имеют менее 3 оценок</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {insufficientCompetencies.map(comp => (
                <div key={comp.category} className="p-2 rounded border bg-muted/30 text-sm">
                  <span className="font-medium">{comp.category}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    ({comp.insufficientSkills.length} навыков)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
