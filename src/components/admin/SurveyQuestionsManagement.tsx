import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, GripVertical, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useSkills } from '@/hooks/useSkills';
import { useCategorySkills } from '@/hooks/useCategorySkills';
import { useQualities } from '@/hooks/useQualities';
import { useAnswerCategories } from '@/hooks/useAnswerCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateAnswerCategoryDialog } from './CreateAnswerCategoryDialog';
import { QuestionAnswerOptionsManager, TemplateContext } from './QuestionAnswerOptionsManager';
import { OpenQuestionsManagement } from './OpenQuestionsManagement';
import { buildTemplateSummary } from '@/lib/templateViewModel';
import type { DiagnosticConfigTemplate } from '@/hooks/useDiagnosticConfigTemplates';

interface Question {
  id: string;
  question_text: string;
  order_index: number;
  skill_id?: string;
  quality_id?: string;
  behavioral_indicators?: string;
  answer_category_id?: string;
  visibility_restriction_enabled?: boolean;
  visibility_restriction_type?: string;
  comment_required_override?: boolean | null;
}

export const SurveyQuestionsManagement = () => {
  const [activeTab, setActiveTab] = useState<'skill' | '360' | 'open'>('skill');
  const [skillQuestions, setSkillQuestions] = useState<Question[]>([]);
  const [survey360Questions, setSurvey360Questions] = useState<Question[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Фильтры
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [skillFilter, setSkillFilter] = useState<string>('');

  const { skills } = useSkills();
  const { categories } = useCategorySkills();
  const { qualities } = useQualities();
  const { categories: answerCategories, updateCategory } = useAnswerCategories();

  // Фильтруем категории ответов по типу вопроса
  const filteredAnswerCategories = React.useMemo(() => {
    if (!answerCategories) return [];
    const questionType = activeTab === 'skill' ? 'hard' : 'soft';
    return answerCategories.filter((cat: any) => 
      cat.question_type === questionType || cat.question_type === 'both'
    );
  }, [answerCategories, activeTab]);

  const [formData, setFormData] = useState({
    question_text: '',
    order_index: 0,
    skill_id: '',
    quality_id: '',
    answer_category_id: '',
    visibility_restriction_enabled: false,
    visibility_restriction_type: '',
    comment_required_override: null as boolean | null,
  });

  React.useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data: skillData, error: skillError } = await supabase
        .from('hard_skill_questions')
        .select(`
          *,
          hard_skills!hard_skill_questions_hard_skill_id_fkey(
            name, 
            category_hard_skills(name),
            sub_category_hard_skills(name)
          ),
          answer_categories!hard_skill_questions_answer_category_id_fkey(name)
        `)
        .order('order_index');
      
      const { data: survey360Data, error: survey360Error } = await supabase
        .from('soft_skill_questions')
        .select(`
          *,
          soft_skills!soft_skill_questions_soft_skill_id_fkey(
            name,
            category_soft_skills(name),
            sub_category_soft_skills(name)
          ),
          answer_categories!soft_skill_questions_answer_category_id_fkey(name)
        `)
        .order('order_index');

      if (skillError) throw skillError;
      if (survey360Error) throw survey360Error;

      // Map data to include skill/quality names and answer category names
      const mappedSkillData = skillData?.map((q: any) => ({
        ...q,
        skill_name: q.hard_skills?.name,
        category_name: q.hard_skills?.category_hard_skills?.name,
        sub_category_name: q.hard_skills?.sub_category_hard_skills?.name,
        answer_category_name: q.answer_categories?.name
      })) || [];

      const mappedSurvey360Data = survey360Data?.map((q: any) => ({
        ...q,
        quality_name: q.soft_skills?.name,
        category_name: q.soft_skills?.category_soft_skills?.name,
        sub_category_name: q.soft_skills?.sub_category_soft_skills?.name,
        answer_category_name: q.answer_categories?.name
      })) || [];

      setSkillQuestions(mappedSkillData);
      setSurvey360Questions(mappedSurvey360Data);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Ошибка загрузки вопросов');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const table = activeTab === 'skill' ? 'hard_skill_questions' : 'soft_skill_questions';
      const data = activeTab === 'skill' 
        ? {
            question_text: formData.question_text,
            order_index: formData.order_index,
            skill_id: formData.skill_id || null,
            answer_category_id: formData.answer_category_id || null,
            visibility_restriction_enabled: formData.visibility_restriction_enabled,
            visibility_restriction_type: formData.visibility_restriction_enabled ? (formData.visibility_restriction_type || null) : null,
            comment_required_override: formData.comment_required_override,
          }
        : {
            question_text: formData.question_text,
            order_index: formData.order_index,
            quality_id: formData.quality_id || null,
            answer_category_id: formData.answer_category_id || null,
            visibility_restriction_enabled: formData.visibility_restriction_enabled,
            visibility_restriction_type: formData.visibility_restriction_enabled ? (formData.visibility_restriction_type || null) : null,
            comment_required_override: formData.comment_required_override,
          };

      if (editingQuestion) {
        await supabase.from(table).update(data).eq('id', editingQuestion.id);
        toast.success('Вопрос обновлён');
      } else {
        await supabase.from(table).insert(data);
        toast.success('Вопрос добавлен');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      toast.error('Ошибка сохранения вопроса');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить вопрос?')) return;

    try {
      const table = activeTab === 'skill' ? 'hard_skill_questions' : 'soft_skill_questions';
      await supabase.from(table).delete().eq('id', id);
      toast.success('Вопрос удалён');
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Ошибка удаления вопроса');
    }
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      order_index: question.order_index,
      skill_id: question.skill_id || '',
      quality_id: question.quality_id || '',
      answer_category_id: question.answer_category_id || '',
      visibility_restriction_enabled: question.visibility_restriction_enabled || false,
      visibility_restriction_type: question.visibility_restriction_type || '',
      comment_required_override: question.comment_required_override ?? null,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingQuestion(null);
    setFormData({
      question_text: '',
      order_index: 0,
      skill_id: '',
      quality_id: '',
      answer_category_id: '',
      visibility_restriction_enabled: false,
      visibility_restriction_type: '',
      comment_required_override: null,
    });
  };

  const updateOrder = async (id: string, newOrder: number) => {
    try {
      const table = activeTab === 'skill' ? 'hard_skill_questions' : 'soft_skill_questions';
      await supabase.from(table).update({ order_index: newOrder }).eq('id', id);
      fetchQuestions();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Ошибка изменения порядка');
    }
  };

  // Фильтрация вопросов
  const filteredQuestions = React.useMemo(() => {
    const questions = activeTab === 'skill' ? skillQuestions : survey360Questions;
    
    if (activeTab === 'skill') {
      return questions.filter((q: any) => {
        const skill = q.skills || skills?.find(s => s.id === q.skill_id);
        const categoryId = skill?.category_id || skill?.category_skills?.id;
        if (categoryFilter && categoryId !== categoryFilter) return false;
        if (skillFilter && q.skill_id !== skillFilter) return false;
        return true;
      });
    }
    
    return questions;
  }, [activeTab, skillQuestions, survey360Questions, categoryFilter, skillFilter, skills]);

  const currentQuestions = filteredQuestions;

  // Read template context: prefer sessionStorage (from CTA), fallback to fetching approved template
  const [templateContext, setTemplateContext] = useState<TemplateContext | null>(() => {
    try {
      const raw = sessionStorage.getItem('activeTemplateContext');
      if (raw) {
        sessionStorage.removeItem('activeTemplateContext');
        return JSON.parse(raw) as TemplateContext;
      }
    } catch { /* ignore */ }
    return null;
  });

  React.useEffect(() => {
    if (templateContext) return;
    const fetchApprovedTemplate = async () => {
      try {
        const { data } = await supabase
          .from('diagnostic_config_templates')
          .select('id, name, version, hard_scale_min, hard_scale_max, soft_scale_min, soft_scale_max, hard_skills_enabled, hard_scale_reversed, soft_scale_reversed')
          .eq('status', 'approved')
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setTemplateContext(data as TemplateContext);
      } catch { /* ignore */ }
    };
    fetchApprovedTemplate();
  }, [templateContext]);

  return (
    <div className="space-y-6">
      {/* Template context header */}
      {templateContext ? (() => {
        const summary = buildTemplateSummary({
          ...templateContext,
          hard_scale_reversed: (templateContext as any).hard_scale_reversed ?? false,
          soft_scale_reversed: (templateContext as any).soft_scale_reversed ?? false,
          comment_rules: (templateContext as any).comment_rules ?? {},
          open_questions_config: (templateContext as any).open_questions_config ?? [],
          status: (templateContext as any).status ?? 'approved',
          version: templateContext.version ?? 1,
          created_by: '', created_at: '', updated_at: '', id: (templateContext as any).id ?? '',
        } as DiagnosticConfigTemplate);

        return (
          <Alert className="border-primary/30 bg-primary/5">
            <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <AlertDescription className="text-sm ml-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Действующий шаблон опросника: <strong>{templateContext.name}</strong> v{templateContext.version}</span>
                {templateContext.hard_skills_enabled ? (
                  <span className="text-muted-foreground">Шкала Hard: {summary.hardScaleLabel}</span>
                ) : (
                  <span className="text-muted-foreground">Hard-навыки: выключены</span>
                )}
                <span className="text-muted-foreground">Шкала Soft: {summary.softScaleLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Все изменения вопросов и вариантов ответа сейчас проверяются относительно этого шаблона.
              </p>
            </AlertDescription>
          </Alert>
        );
      })() : (
        <Alert className="border-border bg-muted/40">
          <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <AlertDescription className="text-sm text-muted-foreground ml-2">
            Шаблон опросника не выбран. Проверка диапазонов и правил отключена.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'skill' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('skill');
              setCategoryFilter('');
              setSkillFilter('');
            }}
          >
            Вопросы Hard Skills
          </Button>
          <Button
            variant={activeTab === '360' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('360');
              setCategoryFilter('');
              setSkillFilter('');
            }}
          >
            Вопросы Soft Skills
          </Button>
          <Button
            variant={activeTab === 'open' ? 'default' : 'outline'}
            onClick={() => {
              setActiveTab('open');
              setCategoryFilter('');
              setSkillFilter('');
            }}
          >
            Открытые вопросы
          </Button>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Добавить вопрос
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Редактировать вопрос' : 'Добавить вопрос'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Текст вопроса</Label>
                <Input
                  value={formData.question_text}
                  onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                  placeholder="Введите текст вопроса"
                  required
                />
              </div>

              <div>
                <Label>Порядок</Label>
                <Input
                  type="number"
                  value={formData.order_index}
                  onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) })}
                  min="0"
                />
              </div>

              {activeTab === 'skill' ? (
                <>
                  <div>
                    <Label>Hard Skill</Label>
                    <Select
                      value={formData.skill_id}
                      onValueChange={(value) => setFormData({ ...formData, skill_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите Hard Skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {skills?.map((skill) => (
                          <SelectItem key={skill.id} value={skill.id}>
                            {skill.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                     </Select>
                   </div>
                 </>
               ) : (
                <>
                  <div>
                    <Label>Soft Skill</Label>
                    <Select
                      value={formData.quality_id}
                      onValueChange={(value) => setFormData({ ...formData, quality_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите Soft Skill" />
                      </SelectTrigger>
                      <SelectContent>
                        {qualities?.map((quality) => (
                          <SelectItem key={quality.id} value={quality.id}>
                            {quality.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Группа ответов *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateCategoryOpen(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Создать группу ответов
                  </Button>
                </div>
                <Select
                  value={formData.answer_category_id}
                  onValueChange={(value) => setFormData({ ...formData, answer_category_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите группу ответов" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAnswerCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Определяет набор вариантов ответов для этого вопроса
                </p>
              </div>

              {/* Управление вариантами ответов */}
              <QuestionAnswerOptionsManager 
                categoryId={formData.answer_category_id || null}
                questionType={activeTab === 'skill' ? 'hard' : 'soft'}
                templateContext={templateContext}
              />

              {/* Управление видимостью вопроса */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="visibility_restriction_enabled"
                    checked={formData.visibility_restriction_enabled}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      visibility_restriction_enabled: e.target.checked,
                      visibility_restriction_type: e.target.checked ? formData.visibility_restriction_type : ''
                    })}
                    className="rounded border-input"
                  />
                  <Label htmlFor="visibility_restriction_enabled" className="cursor-pointer">
                    Включить ограничение видимости вопроса
                  </Label>
                </div>

                {formData.visibility_restriction_enabled && (
                  <div>
                    <Label>Ограничение видимости вопроса для</Label>
                    <Select
                      value={formData.visibility_restriction_type}
                      onValueChange={(value) => setFormData({ ...formData, visibility_restriction_type: value })}
                      required={formData.visibility_restriction_enabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип респондента" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Самооценка</SelectItem>
                        <SelectItem value="manager">Оценка руководителем</SelectItem>
                        <SelectItem value="peer">Оценка коллегой</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Вопрос будет виден только выбранному типу респондента
                    </p>
                  </div>
                )}
              </div>

              {/* Обязательный комментарий (override) */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="comment_required_override"
                    checked={formData.comment_required_override === true || (formData.comment_required_override === null && answerCategories?.find(c => c.id === formData.answer_category_id)?.comment_required === true)}
                    onCheckedChange={(checked) => setFormData({ ...formData, comment_required_override: checked === true })}
                  />
                  <Label htmlFor="comment_required_override" className="cursor-pointer text-sm">
                    Обязательный комментарий
                  </Label>
                  {formData.comment_required_override === null && (
                    <span className="text-xs text-muted-foreground">(наследуется от группы)</span>
                  )}
                </div>
                {formData.comment_required_override !== null && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setFormData({ ...formData, comment_required_override: null })}
                  >
                    Сбросить (наследовать от группы)
                  </button>
                )}
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

        <CreateAnswerCategoryDialog
          open={isCreateCategoryOpen}
          onOpenChange={setIsCreateCategoryOpen}
          questionType={activeTab === 'skill' ? 'hard' : 'soft'}
          onSuccess={(categoryId) => {
            setFormData({ ...formData, answer_category_id: categoryId });
            toast.success('Категория создана и выбрана');
          }}
        />
      </div>

      {activeTab === 'open' ? (
        <OpenQuestionsManagement />
      ) : (
        <>
          {/* Фильтры для вопросов навыков */}
          {activeTab === 'skill' && (
            <div className="flex gap-4">
              <div className="w-64">
                <Label>Фильтр по категории</Label>
                <Select value={categoryFilter || undefined} onValueChange={(value) => setCategoryFilter(value || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все категории" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-64">
                <Label>Фильтр по навыку</Label>
                <Select value={skillFilter || undefined} onValueChange={(value) => setSkillFilter(value || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Все навыки" />
                  </SelectTrigger>
                  <SelectContent>
                    {skills
                      ?.filter(s => !categoryFilter || s.category_id === categoryFilter)
                      .map((skill) => (
                        <SelectItem key={skill.id} value={skill.id}>
                          {skill.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">№</TableHead>
                  <TableHead>Вопрос</TableHead>
                  {activeTab === 'skill' ? (
                    <>
                      <TableHead>Категория</TableHead>
                      <TableHead>Навык</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Категория</TableHead>
                      <TableHead>Soft Skills</TableHead>
                    </>
                  )}
                  <TableHead className="w-48">Группа ответов</TableHead>
                  <TableHead className="w-40">Ограничение видимости</TableHead>
                  <TableHead className="w-36">Обяз. комм.</TableHead>
                  <TableHead className="w-24">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentQuestions.map((question: any, index) => {
                  const skill = question.skills || skills?.find(s => s.id === question.skill_id);
                  const category = skill?.category_skills || categories?.find(c => c.id === skill?.category_id);
                  
                  // Check for mixed-state badge
                  const answerCat = answerCategories?.find(c => c.id === question.answer_category_id);
                  const hasMixedOverrides = (() => {
                    if (!question.answer_category_id || !answerCat) return false;
                    const questionsInCategory = currentQuestions.filter((q: any) => q.answer_category_id === question.answer_category_id);
                    return questionsInCategory.some((q: any) => 
                      q.comment_required_override !== null && q.comment_required_override !== undefined && 
                      q.comment_required_override !== answerCat.comment_required
                    );
                  })();
                  
                  return (
                    <TableRow key={question.id}>
                    <TableCell>
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                    </TableCell>
                    <TableCell>{question.order_index}</TableCell>
                    <TableCell>{question.question_text}</TableCell>
                    {activeTab === 'skill' ? (
                      <>
                        <TableCell>
                          {(question as any).category_name || '-'}
                          {(question as any).sub_category_name && (
                            <span className="text-muted-foreground"> → {(question as any).sub_category_name}</span>
                          )}
                        </TableCell>
                        <TableCell>{question.skill_name || '-'}</TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          {(question as any).category_name || '-'}
                          {(question as any).sub_category_name && (
                            <span className="text-muted-foreground"> → {(question as any).sub_category_name}</span>
                          )}
                        </TableCell>
                        <TableCell>{question.quality_name || '-'}</TableCell>
                      </>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {question.answer_category_name || '—'}
                        </span>
                        {hasMixedOverrides && (
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            Частично настроено
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {question.visibility_restriction_enabled ? (
                        <span className="text-sm">
                          {question.visibility_restriction_type === 'self' && 'Самооценка'}
                          {question.visibility_restriction_type === 'manager' && 'Руководитель'}
                          {question.visibility_restriction_type === 'peer' && 'Коллега'}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Все</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {answerCat && (
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={answerCat.comment_required}
                            onCheckedChange={(checked) => {
                              updateCategory.mutate({ id: answerCat.id, comment_required: checked === true });
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs text-muted-foreground">
                            {answerCat.comment_required ? 'Да' : 'Нет'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(question)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(question.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
                {currentQuestions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Нет вопросов
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};