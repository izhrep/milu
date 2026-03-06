import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeleteResult {
  table: string;
  count: number;
  success: boolean;
  error?: string;
}

export const CleanupDiagnosticsData = () => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<DeleteResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const tables = [
    'hard_skill_results',
    'soft_skill_results',
    'hard_skill_questions',
    'soft_skill_questions',
    'hard_skill_answer_options',
    'soft_skill_answer_options',
    'answer_categories',
    'hard_skills',
    'soft_skills',
    'sub_category_hard_skills',
    'sub_category_soft_skills',
    'category_hard_skills',
    'category_soft_skills'
  ];

  const handleCleanup = async () => {
    if (!user) return;

    setIsDeleting(true);
    setDeleteResults([]);
    setShowResults(true);

    const results: DeleteResult[] = [];

    try {
      // Выполняем последовательное удаление в правильном порядке
      for (const table of tables) {
        try {
          const { error, count } = await supabase
            .from(table as any)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи

          if (error) {
            console.error(`Error deleting from ${table}:`, error);
            results.push({
              table,
              count: 0,
              success: false,
              error: error.message
            });
            // Прерываем процесс при ошибке
            break;
          } else {
            results.push({
              table,
              count: count || 0,
              success: true
            });
          }
        } catch (err: any) {
          console.error(`Exception deleting from ${table}:`, err);
          results.push({
            table,
            count: 0,
            success: false,
            error: err.message
          });
          // Прерываем процесс при ошибке
          break;
        }
      }

      setDeleteResults(results);

      const hasErrors = results.some(r => !r.success);
      if (hasErrors) {
        toast.error('Ошибка при очистке данных', {
          description: 'Некоторые таблицы не были очищены'
        });
      } else {
        const totalDeleted = results.reduce((sum, r) => sum + r.count, 0);
        toast.success('Очистка выполнена успешно', {
          description: `Удалено записей: ${totalDeleted}`
        });

        // Перезагружаем страницу после успешного удаления
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Ошибка при очистке данных');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="p-6 mt-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-2">
            <Trash2 className="h-6 w-6" />
            Очистка импортированных данных
          </h2>
          <p className="text-text-secondary">
            Полное удаление всех импортированных вопросов, ответов, навыков и категорий (необратимая операция)
          </p>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Внимание!</strong> Эта операция удалит все данные диагностики, включая категории, навыки, вопросы и варианты ответов. 
            Это действие нельзя отменить. Убедитесь, что у вас есть резервная копия данных.
          </AlertDescription>
        </Alert>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              disabled={isDeleting}
              size="lg"
              className="w-full"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-5 w-5" />
                  Очистить все импортированные данные
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p>
                    Вы уверены, что хотите удалить все импортированные данные диагностики? 
                    Это действие нельзя отменить.
                  </p>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="font-medium mb-2">Будут удалены данные из следующих таблиц:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {tables.map(table => (
                        <li key={table}>{table}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCleanup}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Подтвердить удаление
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {showResults && deleteResults.length > 0 && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium">Результаты удаления:</h4>
            <div className="space-y-2">
              {deleteResults.map((result) => (
                <div key={result.table} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <span className={result.success ? 'text-text-primary' : 'text-destructive'}>
                      {result.table}
                    </span>
                    <span className="text-text-secondary ml-2">
                      — {result.success ? `${result.count} записей удалено` : `Ошибка: ${result.error}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-sm font-medium">
                Всего удалено: {deleteResults.filter(r => r.success).reduce((sum, r) => sum + r.count, 0)} записей
              </p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
