import React from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
}

export const SubSkillsDetailedReport: React.FC<SubSkillsDetailedReportProps> = ({
  subSkills,
  selfScore,
  supervisorScore,
  colleagueScore
}) => {
  if (!subSkills || subSkills.length === 0) {
    return null;
  }

  const getTrendIcon = (avgScore: number) => {
    if (!selfScore) return <Minus className="w-4 h-4 text-gray-400" />;
    
    const diff = avgScore - selfScore;
    if (diff > 0.5) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (diff < -0.5) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-blue-600';
    if (score >= 2) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-text-primary">Детализация по поднавыкам</h4>
        <Badge variant="outline">{subSkills.length} поднавыков</Badge>
      </div>

      <div className="space-y-3">
        {subSkills.map((subSkill) => (
          <Card key={subSkill.sub_skill_id} className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-text-primary">
                      {subSkill.sub_skill_name}
                    </h5>
                    {getTrendIcon(subSkill.average_score)}
                  </div>
                  <p className="text-xs text-text-tertiary mt-1">
                    На основе {subSkill.responses} оценок
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getScoreColor(subSkill.average_score)}`}>
                    {subSkill.average_score.toFixed(1)}
                  </div>
                  <p className="text-xs text-text-secondary">из 5.0</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <Progress value={(subSkill.average_score / 5) * 100} className="h-2" />
                
                {/* Сравнение оценок */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {selfScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                      <span className="text-blue-700">Само</span>
                      <span className="font-semibold text-blue-900">{selfScore.toFixed(1)}</span>
                    </div>
                  )}
                  {supervisorScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                      <span className="text-green-700">Руков.</span>
                      <span className="font-semibold text-green-900">{supervisorScore.toFixed(1)}</span>
                    </div>
                  )}
                  {colleagueScore !== undefined && (
                    <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
                      <span className="text-purple-700">Коллеги</span>
                      <span className="font-semibold text-purple-900">{colleagueScore.toFixed(1)}</span>
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
