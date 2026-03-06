import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAnswerCategories } from '@/hooks/useAnswerCategories';

interface AnswerOption {
  id: string;
  answer_category_id: string;
  level_value: number;
  title: string;
  description: string | null;
  order_index: number;
}

interface AnswerOptionsManagementProps {
  categoryId: string;
}

export const AnswerOptionsManagement = ({ categoryId }: AnswerOptionsManagementProps) => {
  const { categories } = useAnswerCategories();
  const [activeTab, setActiveTab] = useState<'hard' | 'soft'>('hard');
  const [hardOptions, setHardOptions] = useState<AnswerOption[]>([]);
  const [softOptions, setSoftOptions] = useState<AnswerOption[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<AnswerOption | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    level_value: 0,
    title: '',
    description: '',
    order_index: 1
  });

  React.useEffect(() => {
    fetchOptions();
  }, [categoryId]);

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const { data: hardData, error: hardError } = await supabase
        .from('hard_skill_answer_options')
        .select('*')
        .eq('answer_category_id', categoryId)
        .order('order_index');
      
      const { data: softData, error: softError } = await supabase
        .from('soft_skill_answer_options')
        .select('*')
        .eq('answer_category_id', categoryId)
        .order('order_index');

      if (hardError) throw hardError;
      if (softError) throw softError;

      setHardOptions(hardData || []);
      setSoftOptions(softData || []);
    } catch (error) {
      console.error('Error fetching options:', error);
      toast.error('Ошибка загрузки вариантов ответов');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const table = activeTab === 'hard' ? 'hard_skill_answer_options' : 'soft_skill_answer_options';
      
      const data = {
        answer_category_id: categoryId,
        level_value: formData.level_value,
        title: formData.title,
        description: formData.description || null,
        order_index: formData.order_index,
        numeric_value: formData.level_value,
      };

      if (editingOption) {
        await supabase.from(table).update(data).eq('id', editingOption.id);
        toast.success('Вариант ответа обновлён');
      } else {
        await supabase.from(table).insert(data);
        toast.success('Вариант ответа добавлен');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchOptions();
    } catch (error: any) {
      console.error('Error saving option:', error);
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error(`Вариант с таким уровнем (${activeTab === 'hard' ? '0-4' : '0-5'}) уже существует в этой категории`);
      } else {
        toast.error('Ошибка сохранения варианта ответа');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить вариант ответа?')) return;

    try {
      const table = activeTab === 'hard' ? 'hard_skill_answer_options' : 'soft_skill_answer_options';
      await supabase.from(table).delete().eq('id', id);
      toast.success('Вариант ответа удалён');
      fetchOptions();
    } catch (error) {
      console.error('Error deleting option:', error);
      toast.error('Ошибка удаления варианта ответа');
    }
  };

  const handleEdit = (option: AnswerOption) => {
    setEditingOption(option);
    setFormData({
      level_value: option.level_value,
      title: option.title,
      description: option.description || '',
      order_index: option.order_index,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingOption(null);
    setFormData({
      level_value: 0,
      title: '',
      description: '',
      order_index: 1
    });
  };

  const currentOptions = activeTab === 'hard' ? hardOptions : softOptions;
  const categoryName = categories.find(c => c.id === categoryId)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'hard' ? 'default' : 'outline'}
            onClick={() => setActiveTab('hard')}
          >
            Hard Skills
          </Button>
          <Button
            variant={activeTab === 'soft' ? 'default' : 'outline'}
            onClick={() => setActiveTab('soft')}
          >
            Soft Skills
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить вариант
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingOption ? 'Редактировать вариант' : 'Добавить вариант'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Уровень ({activeTab === 'hard' ? '0-4' : '0-5'}) *</Label>
                <Input
                  type="number"
                  value={formData.level_value}
                  onChange={(e) => setFormData({ ...formData, level_value: parseInt(e.target.value) })}
                  min="0"
                  max={activeTab === 'hard' ? '4' : '5'}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Уникален внутри категории
                </p>
              </div>

              <div>
                <Label>Название *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Например: Не владею"
                  required
                />
              </div>

              <div>
                <Label>Описание</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Подробное описание уровня"
                  rows={3}
                />
              </div>

              <div>
                <Label>Порядок отображения *</Label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                  min="1"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Определяет порядок отображения в списке
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Уровень</TableHead>
              <TableHead className="w-20">Порядок</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Описание</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Загрузка...
                </TableCell>
              </TableRow>
            ) : currentOptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Нет вариантов ответов в этой категории
                </TableCell>
              </TableRow>
            ) : (
              currentOptions.map((option) => (
                <TableRow key={option.id}>
                  <TableCell className="font-semibold">
                    {option.level_value}
                  </TableCell>
                  <TableCell>
                    {option.order_index}
                  </TableCell>
                  <TableCell>
                    {option.title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {option.description || '—'}
                  </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(option)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(option.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};