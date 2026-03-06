import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { importSoftSkillQuestions } from '@/scripts/importSoftSkillQuestions';
import { toast } from 'sonner';
import { Loader2, Upload, CheckCircle2 } from 'lucide-react';

export default function ImportSoftSkillQuestionsPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setIsCompleted(false);
    
    try {
      await importSoftSkillQuestions();
      toast.success('Импорт вопросов успешно завершен!');
      setIsCompleted(true);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Ошибка при импорте вопросов');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Импорт вопросов Soft Skills</CardTitle>
          <CardDescription>
            Этот инструмент создаст 4 вопроса для оценки Soft Skills и свяжет их с соответствующими категориями ответов.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">Вопросы для импорта:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Четкость и ясность коммуникации</li>
              <li>Управление ожиданиями и рисками</li>
              <li>Аргументация и защита решений</li>
              <li>Предотвращение и разрешение недопониманий</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              Все вопросы будут связаны с соответствующими категориями ответов.
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
                  Импорт вопросов...
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
                Вопросы успешно импортированы. Вы можете проверить результат на странице управления вопросами.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
