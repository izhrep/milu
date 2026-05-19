import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from "@/components/icons";

interface SubSkillResult {
  sub_skill_id: string;
  sub_skill_name: string;
  average_score: number;
  responses: number;
}

interface SubSkillsDetailedReportProps {
  subSkills: SubSkillResult[];
  selfScore?: number;
  supervisorScore?: number;
  colleagueScore?: number;
  /** Max scale value for display. Defaults to 5 (legacy). */
  maxScore?: number;
}

export const SubSkillsDetailedReport: React.FC<SubSkillsDetailedReportProps> = ({
  subSkills,
  selfScore,
  supervisorScore,
  colleagueScore,
  maxScore = 5
}) => {
  if (!subSkills || subSkills.length === 0) {
    return null;
  }

  const getTrendIcon = (avgScore: number) => {
    if (!selfScore) return <Minus className="w-4 h-4 text-muted-foreground/70" />;
    
    const diff = avgScore - selfScore;
    if (diff > 0.5) return <TrendingUp className="w-4 h-4 text-success" />;
    if (diff < -0.5) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground/70" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-success';
    if (score >= 3) return 'text-primary';
    if (score >= 2) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-body-lg font-semibold text-foreground">Детализация по поднавыкам</h4>
        <Badge variant="outline">{subSkills.length} поднавыков</Badge>
      </div>

      <div className="space-y-3">
        {subSkills.map((subSkill) => (
          <Card key={subSkill.sub_skill_id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-foreground">
                      {subSkill.sub_skill_name}
                    </h5>
                    {getTrendIcon(subSkill.average_score)}
                  </div>
                  <p className="text-caption-sm text-muted-foreground/70 mt-1">
                    На основе {subSkill.responses} оценок
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-heading-3 font-bold ${getScoreColor(subSkill.average_score)}`}>
                    {subSkill.average_score.toFixed(1)}
                  </div>
                  <p className="text-caption-sm text-muted-foreground">из {maxScore.toFixed(1)}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={(subSkill.average_score / 5) * 100} className="h-2" />
                
                {/* Сравнение оценок */}
                <div className="grid grid-cols-3 gap-2 text-caption-sm">
                  {selfScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-primary/10 rounded">
                      <span className="text-primary">Само</span>
                      <span className="font-semibold text-primary">{selfScore.toFixed(1)}</span>
                    </div>
                  )}
                  {supervisorScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-success/10 rounded">
                      <span className="text-success">Руков.</span>
                      <span className="font-semibold text-success">{supervisorScore.toFixed(1)}</span>
                    </div>
                  )}
                  {colleagueScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-chart-3/10 rounded">
                      <span className="text-chart-3">Коллеги</span>
                      <span className="font-semibold text-chart-3">{colleagueScore.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
