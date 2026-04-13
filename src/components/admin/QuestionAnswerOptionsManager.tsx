import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, AlertTriangle, Info } from 'lucide-react';
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
  hard_scale_reversed?: boolean;
  soft_scale_reversed?: boolean;
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

  const isReversed = templateContext
    ? (questionType === 'hard' ? !!templateContext.hard_scale_reversed : !!templateContext.soft_scale_reversed)
    : false;
  const showReversedCol = isReversed && rangeMin !== undefined && rangeMax !== undefined && rangeMax > rangeMin;

  const isInRange = (level: number) => {
    if (rangeMin === undefined || rangeMax === undefined) return true;
    return level >= rangeMin && level <= rangeMax;
  };

  // Compute coverage analysis
  const rangeAnalysis = useMemo(() => {
    if (rangeMin === undefined || rangeMax === undefined) return null;

    const requiredLevels: number[] = [];
    for (let i = rangeMin; i <= rangeMax; i++) requiredLevels.push(i);

    const existingLevels = new Set(options.map(o => o.level_value));
    const missingLevels = requiredLevels.filter(l => !existingLevels.has(l));
    const extraLevels = options
      .map(o => o.level_value)
      .filter(l => l < rangeMin || l > rangeMax)
      .sort((a, b) => a - b);
    const uniqueExtra = [...new Set(extraLevels)];

    return { missingLevels, extraLevels: uniqueExtra, hasGaps: missingLevels.length > 0, hasExtra: uniqueExtra.length > 0 };
  }, [options, rangeMin, rangeMax]);

  const inRangeOptions = options.filter(o => isInRange(o.level_value));
  const outOfRangeOptions = options.filter(o => !isInRange(o.level_value));

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

  const colSpanAll = showReversedCol ? 6 : 5;

  const renderOptionRow = (option: AnswerOption, isOutOfRange = false) => (
    <TableRow 
      key={option.id} 
      className={isOutOfRange ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}
    >
      <TableCell className="font-semibold">
        <div className="flex items-center gap-2">
          {option.level_value}
          {isOutOfRange && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300 whitespace-nowrap">
              Вне диапазона
            </Badge>
          )}
        </div>
      </TableCell>
      {showReversedCol && (
        <TableCell className="bg-muted/40 font-mono text-center font-semibold">
          {rangeMin! + rangeMax! - option.level_value}
        </TableCell>
      )}
      <TableCell>{option.order_index}</TableCell>
      <TableCell>{option.title}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {option.description || '—'}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => handleEdit(option)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(option.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/5">
      <div>
        <h3 className="font-semibold mb-1">Варианты ответов</h3>
        <p className="text-sm text-muted-foreground">
          Управление вариантами ответов для выбранной группы
        </p>
      </div>

      {/* Template context header */}
      {templateContext && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 rounded px-3 py-2 border border-border/50">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            Шаблон: <span className="font-medium text-foreground">{templateContext.name} v{templateContext.version}</span>
            {' · '}
            Диапазон {questionType === 'hard' ? 'Hard' : 'Soft'}: <span className="font-medium text-foreground">[{rangeMin}..{rangeMax}]</span>
          </span>
        </div>
      )}

      {/* Range analysis warnings */}
      {rangeAnalysis && (rangeAnalysis.hasGaps || rangeAnalysis.hasExtra) && (
        <Alert className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm space-y-1">
            {rangeAnalysis.hasExtra && (
              <p className="text-amber-800 dark:text-amber-200">
                У вопроса больше вариантов ответа, чем заложено в шаблоне. Лишние уровни: <span className="font-medium">{rangeAnalysis.extraLevels.join(', ')}</span>
              </p>
            )}
            {rangeAnalysis.hasGaps && (
              <p className="text-destructive font-medium">
                Для диапазона [{rangeMin}..{rangeMax}] отсутствуют уровни: {rangeAnalysis.missingLevels.join(', ')}
              </p>
            )}
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
              {showReversedCol && (
                <TableHead className="w-28 bg-muted/40 text-center">Балл после реверса</TableHead>
              )}
              <TableHead className="w-16">Порядок</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-28">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colSpanAll} className="text-center text-muted-foreground">Загрузка...</TableCell>
              </TableRow>
            ) : options.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpanAll} className="text-center text-muted-foreground">Нет вариантов ответов</TableCell>
              </TableRow>
            ) : (
              <>
                {inRangeOptions.map(o => renderOptionRow(o, false))}
                {outOfRangeOptions.map(o => renderOptionRow(o, true))}
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
