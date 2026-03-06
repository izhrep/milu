import React from 'react';
import { CheckCircle, Lock } from 'lucide-react';
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
      <Alert className="mb-6 bg-green-50 border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Форма отправлена</strong>
          {completedAt && (
            <span className="ml-2 text-sm">
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
        <div className="absolute inset-0 bg-gray-50/50 z-10 rounded-xl pointer-events-none" />
        
        {/* Lock indicator */}
        <div className="absolute top-4 right-4 z-20 bg-gray-100 rounded-full p-2 shadow-sm">
          <Lock className="w-5 h-5 text-gray-600" />
        </div>

        {/* Content with disabled styles */}
        <div className="pointer-events-none opacity-75">
          {children}
        </div>
      </div>

      {/* Info message */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Форма находится в режиме просмотра и не может быть изменена
      </div>
    </div>
  );
};