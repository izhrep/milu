import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ZONE_LABELS, type JohariZone } from '@/lib/johariConfig';
import type { CompetencyGroup } from '@/lib/johariCompetencies';

interface JohariCompetencyCardProps {
  competency: CompetencyGroup;
}

const zoneEmoji: Record<JohariZone, string> = {
  arena: '🟢',
  blind_spot: '🟠',
  hidden_strength: '🔵',
  unknown: '⚪',
};

export const JohariCompetencyCard: React.FC<JohariCompetencyCardProps> = ({ competency }) => {
  return (
    <div className="p-2.5 rounded border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-medium text-sm leading-tight flex-1 min-w-0">
          {competency.category}
        </h4>
        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0">
          {competency.totalSkills}
        </Badge>
      </div>

      {/* Compact zone distribution */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['arena', 'hidden_strength', 'blind_spot', 'unknown'] as JohariZone[]).map(zone => {
          const count = competency.zoneCounts[zone];
          if (count === 0) return null;
          return (
            <span key={zone} className="text-[11px] text-muted-foreground flex items-center gap-0.5">
              {zoneEmoji[zone]} {count}
            </span>
          );
        })}
        {competency.insufficientSkills.length > 0 && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
            ❔ {competency.insufficientSkills.length}
          </span>
        )}
      </div>
    </div>
  );
};
