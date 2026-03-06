import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAnswerCategories } from '@/hooks/useAnswerCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnswerOption {
  level_value: number;
  title: string;
  description: string;
  order_index: number;
}

interface CreateAnswerCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (categoryId: string) => void;
  questionType: 'hard' | 'soft';
}

export const CreateAnswerCategoryDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess,
  questionType 
}: CreateAnswerCategoryDialogProps) => {
  const { createCategory } = useAnswerCategories();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    comment_required: false
  });

  const [options, setOptions] = useState<AnswerOption[]>([
    { level_value: 0, title: '', description: '', order_index: 1 }
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Создаем категорию
      const { data: category, error: categoryError } = await supabase
        .from('answer_categories')
        .insert([{ 
          name: formData.name, 
          description: formData.description,
          question_type: questionType,
          comment_required: formData.comment_required
        }])
        .select()
        .single();
      
      if (categoryError) throw categoryError;

      // Создаем варианты ответов
      const table = questionType === 'hard' 
        ? 'hard_skill_answer_options' 
        : 'soft_skill_answer_options';
      
      const optionsData = options.map(opt => ({
        answer_category_id: category.id,
        level_value: opt.level_value,
        title: opt.title,
        description: opt.description || null,
        order_index: opt.order_index,
        numeric_value: opt.level_value,
      }));

      const { error: optionsError } = await supabase
        .from(table)
        .insert(optionsData);

      if (optionsError) throw optionsError;

      toast.success('Группа ответов создана');
      onSuccess?.(category.id);
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast.error('Ошибка создания группы ответов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', comment_required: false });
    setOptions([{ level_value: 0, title: '', description: '', order_index: 1 }]);
  };

  const addOption = () => {
    const maxLevel = Math.max(...options.map(o => o.level_value), -1);
    setOptions([...options, {
      level_value: maxLevel + 1,
      title: '',
      description: '',
      order_index: options.length + 1
    }]);
  };

  const removeOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, field: keyof AnswerOption, value: string | number) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetForm();
    }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать группу ответов</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Название группы ответов *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Оценка Hard Skills"
                required
              />
            </div>

            <div>
              <Label>Описание</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Краткое описание группы"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="comment_required"
                checked={formData.comment_required}
                onCheckedChange={(checked) => setFormData({ ...formData, comment_required: checked === true })}
              />
              <Label htmlFor="comment_required" className="cursor-pointer text-sm">
                Обязательный комментарий
              </Label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Варианты ответов</Label>
              <Button type="button" size="sm" onClick={addOption}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить вариант
              </Button>
            </div>

            <div className="space-y-3">
              {options.map((option, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Вариант {index + 1}</span>
                    {options.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                    <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs">Уровень ({questionType === 'hard' ? '0-4' : '0-5'}) *</Label>
                                      <Input
                                        type="number"
                                        value={option.level_value}
                                        onChange={(e) => updateOption(index, 'level_value', parseInt(e.target.value))}
                                        min="0"
                                        max={questionType === 'hard' ? '4' : '5'}
                                        required
                                      />
                    </div>
                    <div>
                      <Label className="text-xs">Порядок *</Label>
                      <Input
                        type="number"
                        value={option.order_index}
                        onChange={(e) => updateOption(index, 'order_index', parseInt(e.target.value))}
                        min="1"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Название *</Label>
                    <Input
                      value={option.title}
                      onChange={(e) => updateOption(index, 'title', e.target.value)}
                      placeholder="Например: Не владею"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Описание</Label>
                    <Textarea
                      value={option.description}
                      onChange={(e) => updateOption(index, 'description', e.target.value)}
                      placeholder="Описание уровня"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Создание...' : 'Создать группу'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
