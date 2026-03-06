import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageCircle, AlertTriangle } from 'lucide-react';
import type { SkillMetrics } from '@/hooks/useJohariReport';

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

  return (
    <div className="p-2 rounded border bg-card hover:bg-muted/50 transition-colors flex flex-col">
      {/* A) Skill name */}
      <div className="flex items-start gap-1 flex-1 min-h-[2rem]">
        <h4 className="font-medium text-sm leading-tight flex-1 min-w-0">{skill.skill_name}</h4>
        <div className="flex items-center gap-0.5 flex-shrink-0 mt-0.5">
          {skill.grey_zone && (
            <TooltipProvider><Tooltip><TooltipTrigger><MessageCircle className="w-3 h-3 text-yellow-600" /></TooltipTrigger><TooltipContent><p>Серая зона</p></TooltipContent></Tooltip></TooltipProvider>
          )}
          {skill.is_polarized && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                  <p className="font-semibold">Поляризация оценок</p>
                  <p>Оценки в группе «Все кроме меня» сильно расходятся между собой.</p>
                  {skill.others_raters_cnt > 0 && (
                    <p className="text-muted-foreground">Респондентов в группе: {skill.others_raters_cnt}</p>
                  )}
                  <p className="text-muted-foreground italic">Высокая Δ и поляризация — разные явления.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40 my-1.5" />

      {/* B) Metrics — always at bottom */}
      <div className="grid grid-cols-3 text-center">
        {metricColumns.map((col) => (
          <div key={col.key} className="flex flex-col items-center">
            <div className="text-[10px] text-muted-foreground/70 leading-none h-[20px] flex items-end justify-center pb-0.5">{col.label}</div>
            <div className="text-xs font-normal text-muted-foreground tabular-nums leading-tight">{fmt(skill[col.key])}</div>
          </div>
        ))}
        <div className="flex flex-col items-center">
          <div className="text-[10px] text-muted-foreground/70 leading-none h-[20px] flex items-end justify-center pb-0.5">Δ</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`text-sm font-semibold tabular-nums leading-tight cursor-help ${skill.delta >= 0.75 ? 'text-orange-600' : 'text-foreground'}`}>
                  {skill.delta.toFixed(2)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs space-y-1">
                <p className="font-semibold">Расхождение оценок (Δ)</p>
                <p>Я = {fmt(skill.self_avg)}</p>
                <p>Все кроме меня = {fmt(skill.others_avg)}</p>
                <p>Δ = {skill.delta.toFixed(2)}</p>
                <p className="text-muted-foreground italic">Расхождение между самооценкой и агрегированной оценкой остальных.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};
