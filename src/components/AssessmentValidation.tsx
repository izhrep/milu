import React from 'react';
import { AlertCircle, CheckCircle } from "@/components/icons";
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AssessmentValidationProps {
  hasSupervisor: boolean;
  colleaguesCount: number;
  minColleagues?: number;
}

export const AssessmentValidation: React.FC<AssessmentValidationProps> = ({
  hasSupervisor,
  colleaguesCount,
  minColleagues = 1
}) => {
  const isValid = hasSupervisor && colleaguesCount >= minColleagues;

  if (isValid) {
    return (
      <Alert className="bg-success/10 border-success/30">
        <CheckCircle className="h-4 w-4 text-success" />
        <AlertDescription className="text-success">
          Все обязательные требования выполнены
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-warning/10 border-warning/30">
      <AlertCircle className="h-4 w-4 text-warning" />
      <AlertDescription className="text-warning">
        <strong>Обязательные требования для начала оценки:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li className={hasSupervisor ? 'text-success' : ''}>
            {hasSupervisor ? '✓' : '✗'} Руководитель должен быть назначен оценивающим
          </li>
          <li className={colleaguesCount >= minColleagues ? 'text-success' : ''}>
            {colleaguesCount >= minColleagues ? '✓' : '✗'} Минимум {minColleagues} коллега
            {colleaguesCount > 0 && ` (выбрано: ${colleaguesCount})`}
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
};