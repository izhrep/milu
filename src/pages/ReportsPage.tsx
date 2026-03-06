import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { decryptUserData } from '@/lib/userDataDecryption';

const ReportsPage = () => {
  const [loading, setLoading] = useState(false);

  const exportHardSkillResults = async () => {
    setLoading(true);
    try {
      // Получаем все результаты hard skills
      const { data: results, error } = await supabase
        .from('hard_skill_results')
        .select(`
          *,
          evaluated_user:users!hard_skill_results_user_id_fkey(id, first_name, last_name, middle_name, email),
          evaluating_user:users!hard_skill_results_evaluating_user_id_fkey(id, first_name, last_name, middle_name, email),
          question:hard_skill_questions(question_text, skill_id, hard_skills(name, category_id, category_hard_skills(name))),
          answer:hard_skill_answer_options(title, numeric_value)
        `)
        .eq('is_draft', false);

      if (error) throw error;

      // Расшифровываем имена пользователей
      const decryptedResults = await Promise.all(
        results.map(async (result: any) => {
          let evaluatedUserName = 'Неизвестно';
          let evaluatingUserName = 'Неизвестно';

          if (result.evaluated_user) {
            const decrypted = await decryptUserData({
              first_name: result.evaluated_user.first_name,
              last_name: result.evaluated_user.last_name,
              middle_name: result.evaluated_user.middle_name || '',
              email: result.evaluated_user.email || '',
            });
            evaluatedUserName = `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name}`.trim();
          }

          if (result.evaluating_user) {
            const decrypted = await decryptUserData({
              first_name: result.evaluating_user.first_name,
              last_name: result.evaluating_user.last_name,
              middle_name: result.evaluating_user.middle_name || '',
              email: result.evaluating_user.email || '',
            });
            evaluatingUserName = `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name}`.trim();
          }

          return {
            'Категория': result.question?.hard_skills?.category_hard_skills?.name || 'Без категории',
            'Навык': result.question?.hard_skills?.name || 'Неизвестно',
            'Вопрос': result.question?.question_text || 'Неизвестно',
            'Оцениваемый сотрудник': evaluatedUserName,
            'Оценивающий сотрудник': evaluatingUserName,
            'Ответ': result.answer?.title || 'Неизвестно',
            'Балл': result.answer?.numeric_value || 0,
            'Комментарий': result.comment || '',
            'Дата оценки': new Date(result.created_at).toLocaleDateString('ru-RU'),
          };
        })
      );

      // Создаем Excel файл
      const ws = XLSX.utils.json_to_sheet(decryptedResults);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Результаты навыков');

      // Автоширина колонок
      const maxWidth = decryptedResults.reduce((w: any, r: any) => {
        Object.keys(r).forEach(key => {
          const value = r[key]?.toString() || '';
          w[key] = Math.max(w[key] || 10, value.length);
        });
        return w;
      }, {});

      ws['!cols'] = Object.keys(maxWidth).map(key => ({ wch: Math.min(maxWidth[key] + 2, 50) }));

      // Скачиваем файл
      XLSX.writeFile(wb, `Отчет_Навыки_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Отчет успешно выгружен');
    } catch (error) {
      console.error('Error exporting hard skills:', error);
      toast.error('Ошибка при выгрузке отчета');
    } finally {
      setLoading(false);
    }
  };

  const exportSoftSkillResults = async () => {
    setLoading(true);
    try {
      // Получаем все результаты soft skills
      const { data: results, error } = await supabase
        .from('soft_skill_results')
        .select(`
          *,
          evaluated_user:users!soft_skill_results_evaluated_user_id_fkey(id, first_name, last_name, middle_name, email),
          evaluating_user:users!soft_skill_results_evaluating_user_id_fkey(id, first_name, last_name, middle_name, email),
          question:soft_skill_questions(question_text, quality_id, soft_skills(name, category_id, category_soft_skills(name))),
          answer:soft_skill_answer_options(title, numeric_value)
        `)
        .eq('is_draft', false);

      if (error) throw error;

      // Расшифровываем имена пользователей
      const decryptedResults = await Promise.all(
        results.map(async (result: any) => {
          let evaluatedUserName = 'Неизвестно';
          let evaluatingUserName = 'Неизвестно';

          if (result.evaluated_user) {
            const decrypted = await decryptUserData({
              first_name: result.evaluated_user.first_name,
              last_name: result.evaluated_user.last_name,
              middle_name: result.evaluated_user.middle_name || '',
              email: result.evaluated_user.email || '',
            });
            evaluatedUserName = `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name}`.trim();
          }

          if (result.evaluating_user) {
            const decrypted = await decryptUserData({
              first_name: result.evaluating_user.first_name,
              last_name: result.evaluating_user.last_name,
              middle_name: result.evaluating_user.middle_name || '',
              email: result.evaluating_user.email || '',
            });
            evaluatingUserName = `${decrypted.last_name} ${decrypted.first_name} ${decrypted.middle_name}`.trim();
          }

          return {
            'Категория': result.question?.soft_skills?.category_soft_skills?.name || 'Без категории',
            'Качество': result.question?.soft_skills?.name || 'Неизвестно',
            'Вопрос': result.question?.question_text || 'Неизвестно',
            'Оцениваемый сотрудник': evaluatedUserName,
            'Оценивающий сотрудник': evaluatingUserName,
            'Ответ': result.answer?.title || 'Неизвестно',
            'Балл': result.answer?.numeric_value || 0,
            'Комментарий': result.comment || '',
            'Анонимный комментарий': result.is_anonymous_comment ? 'Да' : 'Нет',
            'Дата оценки': new Date(result.created_at).toLocaleDateString('ru-RU'),
          };
        })
      );

      // Создаем Excel файл
      const ws = XLSX.utils.json_to_sheet(decryptedResults);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Результаты качеств');

      // Автоширина колонок
      const maxWidth = decryptedResults.reduce((w: any, r: any) => {
        Object.keys(r).forEach(key => {
          const value = r[key]?.toString() || '';
          w[key] = Math.max(w[key] || 10, value.length);
        });
        return w;
      }, {});

      ws['!cols'] = Object.keys(maxWidth).map(key => ({ wch: Math.min(maxWidth[key] + 2, 50) }));

      // Скачиваем файл
      XLSX.writeFile(wb, `Отчет_Качества_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Отчет успешно выгружен');
    } catch (error) {
      console.error('Error exporting soft skills:', error);
      toast.error('Ошибка при выгрузке отчета');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Отчеты</h1>
        <p className="text-muted-foreground mt-2">
          Выгрузка результатов оценок в формате Excel
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle>Результаты оценки навыков</CardTitle>
            </div>
            <CardDescription>
              Выгрузить все результаты оценки хард скиллов (навыков) по всем сотрудникам
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={exportHardSkillResults} 
              disabled={loading}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {loading ? 'Формирование отчета...' : 'Выгрузить отчет по навыкам'}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Данные включают: категорию, навык, вопрос, оцениваемого сотрудника, 
              оценивающего сотрудника, ответ, балл и комментарий
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <CardTitle>Результаты оценки качеств</CardTitle>
            </div>
            <CardDescription>
              Выгрузить все результаты оценки софт скиллов (качеств) по всем сотрудникам
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={exportSoftSkillResults} 
              disabled={loading}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {loading ? 'Формирование отчета...' : 'Выгрузить отчет по качествам'}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Данные включают: качество, вопрос, оцениваемого сотрудника, 
              оценивающего сотрудника, ответ, балл и комментарий
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
