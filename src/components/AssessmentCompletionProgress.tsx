import React from 'react';
import { CheckCircle, Circle, Clock } from "@/components/icons";
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isCompleted } from '@/lib/statusMapper';

interface Respondent {
  id: string;
  name: string;
  type: 'self' | 'supervisor' | 'colleague';
  status: string;
  completed_at?: string;
}

interface AssessmentCompletionProgressProps {
  respondents: Respondent[];
  isComplete: boolean;
}

export const AssessmentCompletionProgress: React.FC<AssessmentCompletionProgressProps> = ({ 
  respondents, 
  isComplete 
}) => {
  const totalCount = respondents.length;
  const completedCount = respondents.filter(r => isCompleted(r.status)).length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const hasSelfAssessment = respondents.some(r => r.type === 'self' && isCompleted(r.status));
  const hasSupervisorAssessment = respondents.some(r => r.type === 'supervisor' && isCompleted(r.status));
  const colleagueCount = respondents.filter(r => r.type === 'colleague' && isCompleted(r.status)).length;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'self': return 'Самооценка';
      case 'supervisor': return 'Руководитель';
      case 'colleague': return 'Коллега';
      default: return type;
    }
  };

  const getStatusIcon = (status: string) => {
    if (isCompleted(status)) {
      return <CheckCircle className="w-5 h-5 text-success" />;
    }
    return <Circle className="w-5 h-5 text-muted-foreground/70" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Прогресс сбора оценок
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-body-md">
            <span className="text-muted-foreground">Завершено</span>
            <span className="font-medium">{completedCount} из {totalCount}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {!isComplete && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <p className="text-body-md text-warning">
              <strong>Требования для просмотра отчёта:</strong>
            </p>
            <ul className="text-body-md text-warning mt-2 space-y-1">
              <li className="flex items-center gap-2">
                {hasSelfAssessment ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                Самооценка
              </li>
              <li className="flex items-center gap-2">
                {hasSupervisorAssessment ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                Оценка руководителя
              </li>
              <li className="flex items-center gap-2">
                {colleagueCount >= 1 ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
                Оценка от минимум 1 коллеги
              </li>
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-body-md font-semibold">Статусы респондентов</h4>
          <div className="space-y-2">
            {respondents.map((respondent) => (
              <div
                key={respondent.id}
                className="flex items-center justify-between p-2 bg-muted rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(respondent.status)}
                  <div>
                    <p className="text-body-md font-medium">{respondent.name}</p>
                    <p className="text-caption-sm text-muted-foreground">
                      {getTypeLabel(respondent.type)}
                    </p>
                  </div>
                </div>
                {respondent.completed_at && (
                  <span className="text-caption-sm text-muted-foreground">
                    {new Date(respondent.completed_at).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};