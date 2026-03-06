import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CompetencyDetailedResult } from '@/hooks/useCorrectAssessmentResults';

const THRESHOLD = 2;

interface GapItem {
  competencyId: string;
  competencyName: string;
  externalAvg: number;
}

interface GapsAnalysisBlockProps {
  skillResults: CompetencyDetailedResult[];
  qualityResults: CompetencyDetailedResult[];
}

export const GapsAnalysisBlock: React.FC<GapsAnalysisBlockProps> = ({
  skillResults,
  qualityResults,
}) => {
  const gapItems = useMemo<GapItem[]>(() => {
    const all = [...skillResults, ...qualityResults];
    const seen = new Map<string, GapItem>();

    for (const result of all) {
      if (seen.has(result.competency_id)) continue;

      const peersByCategory = result.data.peers_by_position_category;
      if (!peersByCategory) continue;

      const externalAverages: number[] = [];
      for (const catData of Object.values(peersByCategory)) {
        const cat = catData as { average: number; count: number; name: string };
        if (cat.name?.toLowerCase().includes('(внешний)')) {
          if (cat.average != null && !isNaN(cat.average) && cat.count > 0) {
            externalAverages.push(cat.average);
          }
        }
      }

      if (externalAverages.length === 0) continue;

      const externalAvg = externalAverages.reduce((a, b) => a + b, 0) / externalAverages.length;
      if (isNaN(externalAvg)) continue;

      if (externalAvg <= THRESHOLD) {
        seen.set(result.competency_id, {
          competencyId: result.competency_id,
          competencyName: result.competency_name,
          externalAvg,
        });
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      if (a.externalAvg !== b.externalAvg) return a.externalAvg - b.externalAvg;
      return a.competencyName.localeCompare(b.competencyName, 'ru');
    });
  }, [skillResults, qualityResults]);

  const hasGaps = gapItems.length > 0;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Alert row */}
        <div className={`flex items-start gap-3 rounded-md border p-3 ${
          hasGaps 
            ? 'border-destructive/50 bg-destructive/5' 
            : 'border-accent/50 bg-accent/5'
        }`}>
          {hasGaps ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium">
              {hasGaps
                ? 'Есть компетенции, требующие внимания'
                : 'Критичных разрывов не обнаружено'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasGaps
                ? `Найдены оценки ≤ ${THRESHOLD} среди внешних респондентов`
                : 'Все оценки внешних респондентов выше бенчмарка'}
            </p>
          </div>
        </div>

        {/* Competency table — only when gaps exist */}
        {hasGaps && (
          <div>
            <h4 className="text-sm font-semibold mb-2">
              Компетенции ниже бенчмарка (внешние респонденты)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Компетенция
                    </th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                      Оценка внешних
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gapItems.map((item) => (
                    <tr key={item.competencyId} className="border-b last:border-0">
                      <td className="py-2 pr-4">{item.competencyName}</td>
                      <td className="py-2 pl-4 text-right font-medium text-destructive">
                        {item.externalAvg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
