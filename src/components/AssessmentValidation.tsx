import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
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
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Все обязательные требования выполнены
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-yellow-50 border-yellow-200">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-yellow-800">
        <strong>Обязательные требования для начала оценки:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li className={hasSupervisor ? 'text-green-700' : ''}>
            {hasSupervisor ? '✓' : '✗'} Руководитель должен быть назначен оценивающим
          </li>
          <li className={colleaguesCount >= minColleagues ? 'text-green-700' : ''}>
            {colleaguesCount >= minColleagues ? '✓' : '✗'} Минимум {minColleagues} коллега
            {colleaguesCount > 0 && ` (выбрано: ${colleaguesCount})`}
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
};