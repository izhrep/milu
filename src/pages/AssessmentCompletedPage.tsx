import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

/**
 * Страница успешного завершения оценки.
 * 
 * ВАЖНО: Вся логика финализации ответов (is_draft → false) теперь выполняется
 * в UnifiedAssessmentPage.completeAssessment() ДО навигации на эту страницу.
 * Это гарантирует, что ответы всегда будут финализированы, даже если пользователь
 * обновит страницу или потеряет location.state.
 */
const AssessmentCompletedPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              Благодарим за предоставленную обратную связь
            </h1>
            <p className="text-sm text-muted-foreground">
              Ваши ответы успешно сохранены и будут учтены в результатах диагностики.
            </p>
          </div>

          <Button 
            onClick={() => navigate('/')}
            className="w-full"
          >
            Вернуться на главную
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssessmentCompletedPage;
