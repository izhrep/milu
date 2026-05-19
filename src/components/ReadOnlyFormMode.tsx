import React from 'react';
import { CheckCircle, Lock } from "@/components/icons";
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReadOnlyFormModeProps {
  isReadOnly: boolean;
  completedAt?: string;
  children: React.ReactNode;
}

/**
 * Компонент для отображения форм в read-only режиме
 * Используется для завершённых оценок
 */
export const ReadOnlyFormMode: React.FC<ReadOnlyFormModeProps> = ({
  isReadOnly,
  completedAt,
  children
}) => {
  if (!isReadOnly) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      {/* Read-only banner */}
      <Alert className="mb-6 bg-success/10 border-success/30">
        <CheckCircle className="h-5 w-5 text-success" />
        <AlertDescription className="text-success">
          <strong>Форма отправлена</strong>
          {completedAt && (
            <span className="ml-2 text-body-md">
              • {new Date(completedAt).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Read-only overlay */}
      <div className="relative">
        {/* Disabled overlay */}
        <div className="absolute inset-0 bg-muted/50 z-10 rounded-xl pointer-events-none" />
        
        {/* Lock indicator */}
        <div className="absolute top-4 right-4 z-20 bg-muted rounded-full p-2 shadow-sm">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Content with disabled styles */}
        <div className="pointer-events-none opacity-75">
          {children}
        </div>
      </div>

      {/* Info message */}
      <div className="mt-6 text-center text-body-md text-muted-foreground">
        Форма находится в режиме просмотра и не может быть изменена
      </div>
    </div>
  );
};