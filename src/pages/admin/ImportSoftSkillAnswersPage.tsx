import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { importSoftSkillAnswers } from '@/scripts/importSoftSkillAnswers';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle2 } from 'lucide-react';

export default function ImportSoftSkillAnswersPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setIsCompleted(false);
    
    try {
      await importSoftSkillAnswers();
      toast.success('Импорт успешно завершен!');
      setIsCompleted(true);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Ошибка при импорте данных');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Импорт категорий и вариантов ответов для Soft Skills</CardTitle>
          <CardDescription>
            Этот инструмент создаст 3 недостающие категории ответов с описаниями и добавит варианты ответов (уровни 0-4) для каждой категории.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">Категории для импорта:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Управление ожиданиями и рисками</li>
              <li>Адаптивность и гибкость</li>
              <li>Инициативность и проактивность</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Категория "Четкость и ясность коммуникации" уже существует в базе данных.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Button
              onClick={handleImport}
              disabled={isImporting || isCompleted}
              size="lg"
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Импорт данных...
                </>
              ) : isCompleted ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Импорт завершен
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Начать импорт
                </>
              )}
            </Button>

            {isCompleted && (
              <p className="text-sm text-center text-muted-foreground">
                Данные успешно импортированы. Вы можете проверить результат на странице управления категориями ответов.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
