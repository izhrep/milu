import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OpenQuestion {
  id: string;
  question_text: string;
  order_index: number;
  is_active: boolean;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export const OpenQuestionsManagement = () => {
  const [questions, setQuestions] = useState<OpenQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<OpenQuestion | null>(null);
  const [formData, setFormData] = useState({
    question_text: '',
    order_index: 0,
    is_active: true,
    is_required: false,
  });

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('open_questions')
        .select('*')
        .order('order_index');
      if (error) throw error;
      setQuestions(data || []);
    } catch (error: any) {
      toast.error('Ошибка загрузки открытых вопросов: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingQuestion) {
        const { error } = await supabase
          .from('open_questions')
          .update(formData)
          .eq('id', editingQuestion.id);
        if (error) throw error;
        toast.success('Вопрос обновлён');
      } else {
        const { error } = await supabase
          .from('open_questions')
          .insert([formData]);
        if (error) throw error;
        toast.success('Вопрос создан');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchQuestions();
    } catch (error: any) {
      toast.error('Ошибка сохранения: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить открытый вопрос?')) return;
    try {
      const { error } = await supabase.from('open_questions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Вопрос удалён');
      fetchQuestions();
    } catch (error: any) {
      toast.error('Ошибка удаления: ' + error.message);
    }
  };

  const handleEdit = (q: OpenQuestion) => {
    setEditingQuestion(q);
    setFormData({
      question_text: q.question_text,
      order_index: q.order_index,
      is_active: q.is_active,
      is_required: q.is_required,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingQuestion(null);
    setFormData({ question_text: '', order_index: 0, is_active: true, is_required: false });
  };

  const toggleActive = async (q: OpenQuestion) => {
    const { error } = await supabase
      .from('open_questions')
      .update({ is_active: !q.is_active })
      .eq('id', q.id);
    if (error) {
      toast.error('Ошибка обновления');
    } else {
      fetchQuestions();
    }
  };

  const toggleRequired = async (q: OpenQuestion) => {
    const { error } = await supabase
      .from('open_questions')
      .update({ is_required: !q.is_required })
      .eq('id', q.id);
    if (error) {
      toast.error('Ошибка обновления');
    } else {
      fetchQuestions();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Открытые вопросы</h3>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить вопрос
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Редактировать вопрос' : 'Создать вопрос'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Текст вопроса *</Label>
              <Textarea
                value={formData.question_text}
                onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                placeholder="Введите текст открытого вопроса"
                required
                rows={3}
              />
            </div>
            <div>
              <Label>Порядок</Label>
              <Input
                type="number"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="open_q_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked === true })}
              />
              <Label htmlFor="open_q_active" className="cursor-pointer text-sm">Активен</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="open_q_required"
                checked={formData.is_required}
                onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked === true })}
              />
              <Label htmlFor="open_q_required" className="cursor-pointer text-sm">Обязательный</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">№</TableHead>
              <TableHead>Вопрос</TableHead>
              <TableHead className="w-24">Активен</TableHead>
              <TableHead className="w-32">Обязательный</TableHead>
              <TableHead className="w-24">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.map((q) => (
              <TableRow key={q.id}>
                <TableCell>{q.order_index}</TableCell>
                <TableCell>{q.question_text}</TableCell>
                <TableCell>
                  <Switch checked={q.is_active} onCheckedChange={() => toggleActive(q)} />
                </TableCell>
                <TableCell>
                  <Switch checked={q.is_required} onCheckedChange={() => toggleRequired(q)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(q)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {questions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Нет открытых вопросов
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
