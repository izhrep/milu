import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnswerOption {
  id: string;
  answer_category_id: string;
  level_value: number;
  title: string;
  description: string | null;
  order_index: number;
}

export interface TemplateContext {
  id: string;
  name: string;
  version: number;
  hard_scale_min: number;
  hard_scale_max: number;
  soft_scale_min: number;
  soft_scale_max: number;
  hard_skills_enabled: boolean;
}

interface QuestionAnswerOptionsManagerProps {
  categoryId: string | null;
  questionType: 'hard' | 'soft';
  templateContext?: TemplateContext | null;
}

export const QuestionAnswerOptionsManager = ({ 
  categoryId, 
  questionType,
  templateContext,
}: QuestionAnswerOptionsManagerProps) => {
  const [options, setOptions] = useState<AnswerOption[]>([]);
  const [editingOption, setEditingOption] = useState<AnswerOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    level_value: 0,
    title: '',
    description: '',
    order_index: 1
  });

  useEffect(() => {
    if (categoryId) {
      fetchOptions();
    } else {
      setOptions([]);
    }
  }, [categoryId, questionType]);

  const fetchOptions = async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const table = questionType === 'hard' 
        ? 'hard_skill_answer_options' 
        : 'soft_skill_answer_options';
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('answer_category_id', categoryId)
        .order('order_index');
      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      toast.error('Ошибка загрузки вариантов ответов');
    } finally {
      setLoading(false);
    }
  };

  // Determine range from template
  const rangeMin = templateContext
    ? (questionType === 'hard' ? templateContext.hard_scale_min : templateContext.soft_scale_min)
    : undefined;
  const rangeMax = templateContext
    ? (questionType === 'hard' ? templateContext.hard_scale_max : templateContext.soft_scale_max)
    : undefined;

  const isInRange = (level: number) => {
    if (rangeMin === undefined || rangeMax === undefined) return true;
    return level >= rangeMin && level <= rangeMax;
  };

  const inRangeOptions = options.filter(o => isInRange(o.level_value));
  const outOfRangeOptions = options.filter(o => !isInRange(o.level_value));
  const hasOutOfRange = outOfRangeOptions.length > 0;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!categoryId) return;
    setLoading(true);
    try {
      const table = questionType === 'hard' 
        ? 'hard_skill_answer_options' 
        : 'soft_skill_answer_options';
      const data = {
        answer_category_id: categoryId,
        level_value: formData.level_value,
        title: formData.title,
        description: formData.description || null,
        order_index: formData.order_index,
        numeric_value: formData.level_value,
      };
      if (editingOption) {
        const { error } = await supabase.from(table).update(data).eq('id', editingOption.id);
        if (error) throw error;
        toast.success('Вариант обновлён');
      } else {
        const { error } = await supabase.from(table).insert(data);
        if (error) throw error;
        toast.success('Вариант добавлен');
      }
      resetForm();
      fetchOptions();
    } catch (error: any) {
      console.error('Error saving option:', error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('Вариант с таким уровнем уже существует');
      } else {
        toast.error('Ошибка сохранения варианта');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить вариант ответа?')) return;
    try {
      const table = questionType === 'hard' 
        ? 'hard_skill_answer_options' 
        : 'soft_skill_answer_options';
      await supabase.from(table).delete().eq('id', id);
      toast.success('Вариант удалён');
      fetchOptions();
    } catch (error) {
      console.error('Error deleting option:', error);
      toast.error('Ошибка удаления варианта');
    }
  };

  const handleEdit = (option: AnswerOption) => {
    setEditingOption(option);
    setFormData({
      level_value: option.level_value,
      title: option.title || '',
      description: option.description || '',
      order_index: option.order_index
    });
  };

  const resetForm = () => {
    setEditingOption(null);
    setFormData({ level_value: 0, title: '', description: '', order_index: 1 });
  };

  if (!categoryId) {
    return (
      <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/5">
        Выберите группу ответов, чтобы управлять вариантами
      </div>
    );
  }

  const renderOptionRow = (option: AnswerOption, readOnly = false) => (
    <TableRow key={option.id} className={readOnly ? 'opacity-50' : ''}>
      <TableCell className="font-semibold">
        <div className="flex items-center gap-2">
          {option.level_value}
          {!isInRange(option.level_value) && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300">
              Вне диапазона
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{option.order_index}</TableCell>
      <TableCell>{option.title}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {option.description || '—'}
      </TableCell>
      <TableCell>
        {readOnly ? (
          <span className="text-xs text-muted-foreground">только чтение</span>
        ) : (
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(option)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(option.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/5">
      <div>
        <h3 className="font-semibold mb-1">Варианты ответов</h3>
        <p className="text-sm text-muted-foreground">
          Управление вариантами ответов для выбранной группы
        </p>
      </div>

      {hasOutOfRange && templateContext && (
        <Alert className="border-amber-300 bg-amber-50/50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            У вопроса больше вариантов ответа, чем заложено в шаблоне «{templateContext.name}» 
            (диапазон {questionType === 'hard' ? 'Hard' : 'Soft'}: [{rangeMin}..{rangeMax}]).
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-3">
        <div>
          <Label className="text-xs">Уровень *</Label>
          <Input
            type="number"
            value={formData.level_value}
            onChange={(e) => setFormData({ ...formData, level_value: parseInt(e.target.value) })}
            min="0"
            placeholder="0"
            required
          />
        </div>
        <div>
          <Label className="text-xs">Порядок *</Label>
          <Input
            type="number"
            value={formData.order_index}
            onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
            min="1"
            placeholder="1"
            required
          />
        </div>
        <div className="col-span-4">
          <Label className="text-xs">Название *</Label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Например: Не владею"
            required
          />
        </div>
        <div className="col-span-4">
          <Label className="text-xs">Описание</Label>
          <Input
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Описание варианта ответа"
          />
        </div>
        <div className="col-span-2 flex items-end gap-2">
          <Button type="button" onClick={handleSubmit} disabled={loading} size="sm" className="flex-1">
            {editingOption ? 'Обновить' : 'Добавить'}
          </Button>
          {editingOption && (
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>
              Отмена
            </Button>
          )}
        </div>
      </form>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Уровень</TableHead>
              <TableHead className="w-16">Порядок</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-28">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Загрузка...</TableCell>
              </TableRow>
            ) : inRangeOptions.length === 0 && outOfRangeOptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Нет вариантов ответов</TableCell>
              </TableRow>
            ) : (
              <>
                {inRangeOptions.map(o => renderOptionRow(o, false))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {outOfRangeOptions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Вне диапазона текущего шаблона (только чтение)
          </h4>
          <div className="border rounded-lg overflow-hidden opacity-60">
            <Table>
              <TableBody>
                {outOfRangeOptions.map(o => renderOptionRow(o, true))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
