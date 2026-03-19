import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import type { SkillMetrics } from '@/hooks/useJohariReport';
import { computeMarkers, MARKER_DESCRIPTIONS, type MarkerCode } from '@/lib/johariMarkers';

interface JohariSkillCardProps {
  skill: SkillMetrics;
  scaleMax: number;
  externalOnly?: boolean;
}

const getMetricColumns = (externalOnly: boolean) => [
  { key: 'self_avg' as const, label: 'Я', tooltip: 'Самооценка сотрудника' },
  { key: 'others_avg' as const, label: externalOnly ? 'Внешние' : 'Все кроме меня', tooltip: externalOnly ? 'Только внешние оценщики' : 'Все кроме сотрудника' },
] as const;

export const JohariSkillCard: React.FC<JohariSkillCardProps> = ({ skill, scaleMax, externalOnly = false }) => {
  const metricColumns = getMetricColumns(externalOnly);
  const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(2));
  const markers = computeMarkers(skill);
  const isPreliminary = skill.confidence_tier === 'preliminary';
  const isInsufficient = skill.confidence_tier === 'insufficient';

  // Build score string for tooltip, e.g. "(1,1,2,3)"
  const othersScoreString = skill.others_individual_scores?.length > 0
    ? `(${skill.others_individual_scores.map(s => s.toFixed(s % 1 === 0 ? 0 : 1)).join(', ')})`
    : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`p-2 rounded border bg-card hover:bg-muted/50 transition-colors flex flex-col cursor-help ${
            isInsufficient ? 'opacity-60' : ''
          } ${isPreliminary ? 'border-dashed' : ''}`}>
            {/* A) Skill name + markers */}
            <div className="flex items-start gap-1 flex-1 min-h-[2rem]">
              <h4 className="font-medium text-sm leading-tight flex-1 min-w-0">{skill.skill_name}</h4>
              <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5 flex-wrap justify-end">
                {isPreliminary && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 border-dashed">
                    предв.
                  </Badge>
                )}
              </div>
            </div>

            {/* Markers row */}
            {markers.length > 0 && (
              <div className="flex items-center gap-0.5 mt-0.5 flex-wrap">
                {markers.map((marker, i) => (
                  <span key={i} className="text-[11px] leading-none">
                    {marker}
                  </span>
                ))}
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border/40 my-1.5" />

            {/* B) Metrics */}
            <div className="grid grid-cols-3 text-center">
              {metricColumns.map((col) => (
                <div key={col.key} className="flex flex-col items-center">
                  <div className="text-[10px] text-muted-foreground/70 leading-none h-[20px] flex items-end justify-center pb-0.5">{col.label}</div>
                  <div className="text-xs font-normal text-muted-foreground tabular-nums leading-tight">{fmt(skill[col.key])}</div>
                </div>
              ))}
              <div className="flex flex-col items-center">
                <div className="text-[10px] text-muted-foreground/70 leading-none h-[20px] flex items-end justify-center pb-0.5">Δ</div>
                <div className={`text-sm font-semibold tabular-nums leading-tight ${
                  Math.abs(skill.delta) >= 0.5 ? 'text-orange-600' : 'text-foreground'
                }`}>
                  {skill.signed_delta !== undefined
                    ? (skill.signed_delta >= 0 ? '+' : '') + skill.signed_delta.toFixed(2)
                    : skill.delta.toFixed(2)
                  }
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs space-y-1.5 p-3">
          <p className="font-semibold text-sm">{skill.skill_name}</p>
          
          {/* Skill description */}
          {skill.skill_description && (
            <p className="text-muted-foreground italic">{skill.skill_description}</p>
          )}
          
          {/* Delta explanation */}
          <div className="space-y-0.5">
            <p>Я = {fmt(skill.self_avg)}</p>
            <p>{externalOnly ? 'Внешние' : 'Все кроме меня'} = {fmt(skill.others_avg)}</p>
            <p>Δ = {skill.signed_delta !== undefined
              ? (skill.signed_delta >= 0 ? '+' : '') + skill.signed_delta.toFixed(2)
              : skill.delta.toFixed(2)
            }</p>
          </div>

          {/* Score string */}
          {othersScoreString && (
            <p className="text-muted-foreground">Оценки: {othersScoreString}</p>
          )}

          {/* Markers explanation */}
          {markers.length > 0 && (
            <div className="border-t border-border/30 pt-1.5 space-y-0.5">
              {markers.map((marker, i) => (
                <p key={i} className="text-muted-foreground">
                  <span className="font-medium">{marker}</span> — {MARKER_DESCRIPTIONS[marker]}
                </p>
              ))}
            </div>
          )}

          {/* Confidence info */}
          {isPreliminary && (
            <p className="text-muted-foreground italic">
              Предварительный вывод (3–4 оценки)
            </p>
          )}
          {isInsufficient && (
            <p className="text-muted-foreground italic">
              Не хватает ответов для помещения в одну из зон, слишком субъективно
            </p>
          )}

          {/* Contradictory scores */}
          {skill.is_contradictory && (
            <p className="text-muted-foreground">
              ⚡ Противоречивые оценки — респонденты сильно расходятся
            </p>
          )}

          <p className="text-muted-foreground/70 text-[10px]">
            Респондентов: {skill.others_raters_cnt}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
