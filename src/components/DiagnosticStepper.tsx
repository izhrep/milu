import React from 'react';
import { Check, User, ClipboardList, BarChart3 } from 'lucide-react';
import { useDiagnosticStages } from '@/hooks/useDiagnosticStages';

interface DiagnosticStepperProps {
  userId?: string;
}

export const DiagnosticStepper: React.FC<DiagnosticStepperProps> = ({ userId }) => {
  const { activeStage, isLoading } = useDiagnosticStages();

  const steps = [
    { id: 'setup', label: 'Выбор оценивающих', icon: User },
    { id: 'assessment', label: 'Прохождение оценки', icon: ClipboardList },
    { id: 'completed', label: 'Завершено', icon: BarChart3 }
  ];

  if (isLoading) {
    return (
      <div className="bg-background rounded-xl p-6 border border-border mb-6">
        <div className="flex items-center justify-center">
          <span className="text-muted-foreground">Загрузка...</span>
        </div>
      </div>
    );
  }

  const currentStep = activeStage?.status || 'setup';
  const completionPercentage = Number(activeStage?.progress_percent || 0);

  const getStepIndex = (step: string) => steps.findIndex(s => s.id === step);
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="bg-background rounded-xl p-6 border border-border mb-6">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isFuture = index > currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isCompleted
                      ? 'bg-success/20 border-2 border-success'
                      : isActive
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-muted border-2 border-border'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-success" />
                  ) : (
                    <StepIcon
                      className={`w-6 h-6 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`text-sm font-medium text-center ${
                    isActive
                      ? 'text-primary'
                      : isCompleted
                      ? 'text-success'
                      : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 mb-8">
                  <div
                    className={`h-full transition-all ${
                      index < currentIndex ? 'bg-success' : 'bg-border'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {currentStep === 'assessment' && completionPercentage > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Прогресс выполнения</span>
            <span className="font-medium">{Math.round(completionPercentage)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};