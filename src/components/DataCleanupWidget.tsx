import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLogger } from '@/lib/adminLogger';
import { toast } from 'sonner';
import { Loader2, Trash2, CheckCircle2 } from 'lucide-react';

interface DeleteResult {
  table: string;
  count: number;
  success: boolean;
}

export const DataCleanupWidget = () => {
  const { user } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResults, setDeleteResults] = useState<DeleteResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showReloadLoader, setShowReloadLoader] = useState(false);

  const tables = [
    'meeting_decisions',
    'one_on_one_meetings',
    'meeting_stage_participants',
    'meeting_stages',
    'development_tasks',
    'tasks',
    'user_assessment_results',
    'hard_skill_results',
    'soft_skill_results',
    'survey_360_assignments',
    'diagnostic_stage_participants',
    'diagnostic_stages',
    'user_qualities',
    'user_skills'
  ];

  const handleCleanup = async () => {
    if (!user) return;

    setIsDeleting(true);
    setDeleteResults([]);
    setShowResults(true);

    try {
      // Вызываем функцию для удаления всех данных в правильном порядке
      const { data, error: deleteError } = await supabase
        .rpc('admin_cleanup_all_data');

      if (deleteError) {
        console.error('Error during cleanup:', deleteError);
        toast.error('Ошибка при очистке данных', {
          description: deleteError.message
        });
        setIsDeleting(false);
        return;
      }

      // Преобразуем результат в нужный формат
      const results: DeleteResult[] = (data as any[]).map((item: any) => ({
        table: item.table,
        count: item.count,
        success: true
      }));

      setDeleteResults(results);

      // Логируем действие
      await AdminLogger.log({
        user_id: user.id,
        user_name: user.email,
        action: 'system_cleanup',
        entity_type: 'system',
        entity_name: 'Массовое удаление данных',
        details: {
          tables: tables,
          results: results,
          total_deleted: results.reduce((sum, r) => sum + r.count, 0)
        }
      });

      toast.success('Очистка выполнена успешно', {
        description: `Удалено записей: ${results.reduce((sum, r) => sum + r.count, 0)}`
      });

      // Показываем лоадер перед перезагрузкой
      setShowReloadLoader(true);
      
      // Перезагружаем страницу после успешного удаления
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('Ошибка при очистке данных');
    } finally {
      setIsDeleting(false);
    }
  };

  if (showReloadLoader) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-center">
            Подождите, удаление данных завершено.<br />
            Страница перезагрузится автоматически...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Удаление данных
        </CardTitle>
        <CardDescription>
          Удаление всех данных из системы (необратимая операция)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="destructive" 
              disabled={isDeleting}
              className="w-full"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Удаление...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Удалить
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Подтверждение удаления</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p className="mb-2">
                    Вы уверены, что хотите удалить все данные из системы? 
                    Это действие нельзя отменить. Будут удалены данные из следующих таблиц:
                  </p>
                  <ul className="list-disc list-inside text-sm">
                    {tables.map(table => (
                      <li key={table}>{table}</li>
                    ))}
                  </ul>
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
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium">Результаты удаления:</h4>
            <div className="space-y-1">
              {deleteResults.map((result) => (
                <div key={result.table} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 ${result.success ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={result.success ? 'text-text-primary' : 'text-red-500'}>
                    ✅ {result.table} — {result.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
