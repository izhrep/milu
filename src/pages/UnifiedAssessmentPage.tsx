import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { toast } from 'sonner';
import { CommentField } from '@/components/assessment/CommentField';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface UnifiedQuestion {
  id: string;
  questionText: string;
  type: 'quality' | 'skill';
  qualityId?: string;
  skillId?: string;
  qualityName?: string;
  skillName?: string;
  competencyDescription?: string;
  categoryName?: string;
  orderIndex: number;
  answerCategoryId?: string;
  commentRequired?: boolean;
}

interface QuestionGroup {
  categoryName: string;
  questions: UnifiedQuestion[];
}

interface AnswerOption {
  id: string;
  label?: string;
  title?: string;
  numeric_value?: number;
  description?: string;
  answer_category_id?: string;
}

interface OpenQuestion {
  id: string;
  question_text: string;
  order_index: number;
  is_required: boolean;
}

const UnifiedAssessmentPage = () => {
  const navigate = useNavigate();
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsLoadAttempted, setQuestionsLoadAttempted] = useState(false);
  const [questionsLoadError, setQuestionsLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [questions, setQuestions] = useState<UnifiedQuestion[]>([]);
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([]);
  const [qualityOptions, setQualityOptions] = useState<AnswerOption[]>([]);
  const [skillOptions, setSkillOptions] = useState<AnswerOption[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [skippedAnswers, setSkippedAnswers] = useState<Record<string, boolean>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [anonymousComments, setAnonymousComments] = useState<Record<string, boolean>>({});
  const [evaluatedUserId, setEvaluatedUserId] = useState<string | null>(null);
  const [assignmentType, setAssignmentType] = useState<'360' | 'skill' | null>(null);
  const [evaluatorType, setEvaluatorType] = useState<'self' | 'manager' | 'peer' | null>(null);
  const [diagnosticPeriod, setDiagnosticPeriod] = useState<{ start_date: string; end_date: string; reminder_date: string; period: string } | null>(null);
  
  // Open questions state
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [openAnswers, setOpenAnswers] = useState<Record<string, string>>({});
  const [showOpenQuestions, setShowOpenQuestions] = useState(false);
  const openAnswersRef = useRef<Record<string, string>>({});
  const openAutoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastAutoSaveRef = useRef<string>('');
  const questionTabsContainerRef = useRef<HTMLDivElement>(null);
  const questionTabRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const [pendingSaveQuestionId, setPendingSaveQuestionId] = useState<string | null>(null);
  
  // Флаг для блокировки автосохранений во время финализации
  const isFinalizingRef = useRef(false);
  // Promise для отслеживания текущей операции автосохранения
  const pendingSavePromiseRef = useRef<Promise<void> | null>(null);
  
  // Refs для актуальных значений состояния (чтобы избежать stale closure)
  const answersRef = useRef(answers);
  const commentsRef = useRef(comments);
  const skippedAnswersRef = useRef(skippedAnswers);
  const anonymousCommentsRef = useRef(anonymousComments);
  
  // Функции для синхронного обновления состояния И refs
  const updateAnswers = useCallback((questionId: string, value: string | undefined) => {
    if (value === undefined) {
      setAnswers(prev => {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        answersRef.current = newAnswers;
        return newAnswers;
      });
    } else {
      setAnswers(prev => {
        const newAnswers = { ...prev, [questionId]: value };
        answersRef.current = newAnswers;
        return newAnswers;
      });
    }
  }, []);

  const updateComments = useCallback((questionId: string, value: string) => {
    setComments(prev => {
      const newComments = { ...prev, [questionId]: value };
      commentsRef.current = newComments;
      return newComments;
    });
  }, []);

  const updateSkippedAnswers = useCallback((questionId: string, value: boolean | undefined) => {
    if (value === undefined) {
      setSkippedAnswers(prev => {
        const newSkipped = { ...prev };
        delete newSkipped[questionId];
        skippedAnswersRef.current = newSkipped;
        return newSkipped;
      });
    } else {
      setSkippedAnswers(prev => {
        const newSkipped = { ...prev, [questionId]: value };
        skippedAnswersRef.current = newSkipped;
        return newSkipped;
      });
    }
  }, []);

  const updateAnonymousComments = useCallback((questionId: string, value: boolean) => {
    setAnonymousComments(prev => {
      const newAnonymous = { ...prev, [questionId]: value };
      anonymousCommentsRef.current = newAnonymous;
      return newAnonymous;
    });
  }, []);

  const updateOpenAnswer = useCallback((questionId: string, value: string) => {
    setOpenAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: value };
      openAnswersRef.current = newAnswers;
      return newAnswers;
    });
  }, []);

  useEffect(() => {
    if (assignmentId && currentUser) {
      loadAssignmentAndQuestions();
    }
  }, [assignmentId, currentUser]);

  useEffect(() => {
    if (evaluatedUserId) {
      loadAllQuestions();
    }
  }, [evaluatedUserId]);

  // Автосохранение отдельного вопроса при изменении (читает из refs для актуальных данных)
  const autoSaveSingleQuestion = useCallback(async (questionId: string) => {
    // КРИТИЧНО: Блокируем автосохранения во время финализации
    if (isFinalizingRef.current) {
      console.log('autoSaveSingleQuestion blocked: finalization in progress');
      return;
    }
    
    console.log('autoSaveSingleQuestion called with questionId:', questionId);
    
    if (!evaluatedUserId || !currentUser || !assignmentId) {
      console.log('Early return: missing userId/currentUser/assignmentId');
      return;
    }
    
    const question = questions.find(q => q.id === questionId);
    if (!question) {
      console.log('Early return: question not found');
      return;
    }
    
    // Читаем из refs для получения самых актуальных значений
    const currentAnswers = answersRef.current;
    const currentSkipped = skippedAnswersRef.current;
    const currentComments = commentsRef.current;
    const currentAnonymous = anonymousCommentsRef.current;
    
    console.log('Current state from refs:', {
      answers: currentAnswers,
      comments: currentComments,
      skipped: currentSkipped
    });
    
    const isSkipped = currentSkipped[questionId] === true;
    const answerId = currentAnswers[questionId];
    
    // Пропускаем если нет ни ответа, ни skip
    if (!isSkipped && !answerId) {
      console.log('Early return: no answer and not skipped');
      return;
    }
    
    const comment = currentComments[questionId]?.trim() || null;
    console.log('Saving with comment:', comment);
    
    const saveOperation = async () => {
      try {
        setAutoSaving(true);
        
        // Повторная проверка — финализация могла начаться пока мы ждали
        if (isFinalizingRef.current) {
          console.log('autoSaveSingleQuestion aborted: finalization started');
          return;
        }
        
        const { data: assignment } = await supabase
          .from('survey_360_assignments')
          .select('diagnostic_stage_id')
          .eq('id', assignmentId)
          .maybeSingle();
        
        const diagnosticStageId = assignment?.diagnostic_stage_id || null;
        
        let isAnonymous = currentAnonymous[questionId] || false;
        if (evaluatorType === 'peer') {
          isAnonymous = true;
        }
        
        const tableName = question.type === 'quality' ? 'soft_skill_results' : 'hard_skill_results';
        
        // Используем upsert вместо delete + insert (unique constraint на evaluated_user_id, evaluating_user_id, question_id)
        const upsertData = {
          evaluated_user_id: evaluatedUserId,
          evaluating_user_id: currentUser.id,
          question_id: questionId,
          answer_option_id: isSkipped ? null : answerId,
          comment: comment,
          is_anonymous_comment: isAnonymous,
          diagnostic_stage_id: diagnosticStageId,
          assignment_id: assignmentId,
          is_draft: true,
          is_skip: isSkipped,
        };
        
        console.log('Upserting data:', upsertData);
        
        const upsertResult = await supabase
          .from(tableName)
          .upsert(upsertData, {
            onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
            ignoreDuplicates: false
          });
        
        console.log('Upsert result:', upsertResult);
      } catch (error) {
        console.error('Auto-save single question error:', error);
      } finally {
        setAutoSaving(false);
        pendingSavePromiseRef.current = null;
      }
    };
    
    // Сохраняем promise для возможности ожидания завершения
    pendingSavePromiseRef.current = saveOperation();
    await pendingSavePromiseRef.current;
  }, [evaluatedUserId, currentUser, assignmentId, questions, evaluatorType]);

  // Debounced автосохранение текущего вопроса
  useEffect(() => {
    console.log('Debounce effect triggered, pendingSaveQuestionId:', pendingSaveQuestionId);
    
    if (!pendingSaveQuestionId || !evaluatedUserId || !currentUser || questions.length === 0) {
      console.log('Debounce effect early return');
      return;
    }
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    console.log('Setting 800ms debounce timeout for question:', pendingSaveQuestionId);
    autoSaveTimeoutRef.current = setTimeout(async () => {
      console.log('Debounce timeout fired, calling autoSaveSingleQuestion');
      await autoSaveSingleQuestion(pendingSaveQuestionId);
      setPendingSaveQuestionId(null);
    }, 800);
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [pendingSaveQuestionId, answers, comments, skippedAnswers, autoSaveSingleQuestion, evaluatedUserId, currentUser, questions]);

  // Auto-scroll active question tab into view
  useEffect(() => {
    if (showOpenQuestions) return;
    const container = questionTabsContainerRef.current;
    const activeTab = questionTabRefs.current.get(currentQuestionIndex);
    if (container && activeTab) {
      const scrollLeft = activeTab.offsetLeft - container.offsetWidth / 2 + activeTab.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [currentQuestionIndex, showOpenQuestions]);

  // Autosave open question answers (debounced)
  const autoSaveOpenQuestion = useCallback(async (openQuestionId: string) => {
    if (isFinalizingRef.current || !evaluatedUserId || !currentUser || !assignmentId) return;
    
    try {
      const { data: assignment } = await supabase
        .from('survey_360_assignments')
        .select('diagnostic_stage_id')
        .eq('id', assignmentId)
        .maybeSingle();
      
      const diagnosticStageId = assignment?.diagnostic_stage_id;
      if (!diagnosticStageId) return;
      
      const answerText = openAnswersRef.current[openQuestionId] || '';
      
      await supabase
        .from('open_question_results')
        .upsert({
          open_question_id: openQuestionId,
          assignment_id: assignmentId,
          diagnostic_stage_id: diagnosticStageId,
          evaluating_user_id: currentUser.id,
          evaluated_user_id: evaluatedUserId,
          answer_text: answerText,
          is_draft: true,
        }, {
          onConflict: 'assignment_id,open_question_id',
          ignoreDuplicates: false
        });
    } catch (error) {
      console.error('Error auto-saving open question:', error);
    }
  }, [evaluatedUserId, currentUser, assignmentId]);

  const handleOpenAnswerChange = useCallback((questionId: string, value: string) => {
    updateOpenAnswer(questionId, value);
    
    if (openAutoSaveTimeoutRef.current) {
      clearTimeout(openAutoSaveTimeoutRef.current);
    }
    openAutoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveOpenQuestion(questionId);
    }, 1000);
  }, [updateOpenAnswer, autoSaveOpenQuestion]);

  const loadAssignmentAndQuestions = async () => {
    try {
      setLoading(true);

      // Load assignment from survey_360_assignments with parent_stages info
      const { data: assignment, error: assignmentError } = await supabase
        .from('survey_360_assignments')
        .select('*, diagnostic_stages(*, parent_stages(*))')
        .eq('id', assignmentId)
        .maybeSingle();

      if (assignmentError || !assignment) {
        toast.error('Задание не найдено');
        navigate('/my-assignments');
        return;
      }

      setAssignmentType('360');
      setEvaluatedUserId(assignment.evaluated_user_id);

      // Сохраняем информацию о периоде диагностики
      if (assignment.diagnostic_stages?.parent_stages) {
        const parentStage = assignment.diagnostic_stages.parent_stages;
        setDiagnosticPeriod({
          start_date: parentStage.start_date,
          end_date: parentStage.end_date,
          reminder_date: parentStage.reminder_date,
          period: parentStage.period
        });
      }

      // Определяем тип оценивающего
      const isSelf = assignment.evaluated_user_id === currentUser?.id;
      const isManager = assignment.assignment_type === 'manager' || assignment.is_manager_participant === true;
      setEvaluatorType(isSelf ? 'self' : isManager ? 'manager' : 'peer');

      // Загрузим вопросы после того как получили evaluatedUserId
      // (вызовется через useEffect выше)
    } catch (error) {
      console.error('Error loading assignment:', error);
      toast.error('Ошибка загрузки задания');
    } finally {
      setLoading(false);
    }
  };

  const loadAllQuestions = async () => {
    try {
      if (!evaluatedUserId) {
        console.log('UnifiedAssessment: No evaluatedUserId, skipping question load');
        return;
      }

      setQuestionsLoading(true);
      setQuestionsLoadAttempted(false);
      setQuestionsLoadError(null);

      console.log('UnifiedAssessment: Loading questions for user:', evaluatedUserId);

      // Получаем грейд оцениваемого пользователя через SECURITY DEFINER RPC
      const { data: gradeId, error: gradeError } = await supabase
        .rpc('get_evaluated_user_grade_id', {
          p_user_id: evaluatedUserId,
          p_assignment_id: assignmentId
        });

      if (gradeError) throw gradeError;
      if (!gradeId) {
        console.error('UnifiedAssessment: User has no grade_id');
        toast.error('У пользователя не указан грейд');
        return;
      }

      console.log('UnifiedAssessment: User grade_id:', gradeId);

      // Параллельно получаем навыки и качества грейда + открытые вопросы
      const [gradeSkillsResult, gradeQualitiesResult, openQuestionsResult] = await Promise.all([
        supabase
          .from('grade_skills')
          .select('skill_id')
          .eq('grade_id', gradeId),
        supabase
          .from('grade_qualities')
          .select('quality_id')
          .eq('grade_id', gradeId),
        supabase
          .from('open_questions')
          .select('id, question_text, order_index, is_required')
          .eq('is_active', true)
          .order('order_index', { ascending: true })
      ]);

      if (gradeSkillsResult.error) throw gradeSkillsResult.error;
      if (gradeQualitiesResult.error) throw gradeQualitiesResult.error;

      const skillIds = (gradeSkillsResult.data || []).map(gs => gs.skill_id);
      const qualityIds = (gradeQualitiesResult.data || []).map(gq => gq.quality_id);

      // Set open questions
      if (openQuestionsResult.data && openQuestionsResult.data.length > 0) {
        setOpenQuestions(openQuestionsResult.data as OpenQuestion[]);
      }

      console.log('UnifiedAssessment: skillIds:', skillIds);
      console.log('UnifiedAssessment: qualityIds:', qualityIds);

      // Проверяем, есть ли хоть какие-то навыки или качества
      if (skillIds.length === 0 && qualityIds.length === 0) {
        console.error('UnifiedAssessment: No skills or qualities found for grade:', gradeId);
        toast.error('Для данного грейда не настроены компетенции. Обратитесь к администратору.');
        return;
      }

      // Загружаем вопросы для качеств
      let qualityQuestions: any[] = [];
      if (qualityIds.length > 0) {
        const { data, error } = await supabase
          .from('soft_skill_questions')
          .select('id, question_text, quality_id, answer_category_id, order_index, visibility_restriction_enabled, visibility_restriction_type, comment_required_override');
        
        if (error) {
          console.error('Error loading quality questions:', error);
        } else if (data) {
          console.log('UnifiedAssessment: All quality questions loaded:', data.length);
          let filtered = data.filter((q: any) => qualityIds.includes(q.quality_id));
          
          // Применяем фильтрацию по типу респондента
          if (evaluatorType) {
            filtered = filtered.filter(q => {
              if (!q.visibility_restriction_enabled) return true;
              if (!q.visibility_restriction_type) return true;
              return q.visibility_restriction_type !== evaluatorType;
            });
          }
          
          qualityQuestions = filtered;
          console.log('UnifiedAssessment: Filtered quality questions:', qualityQuestions.length);
        }
      }
      
      // Загружаем вопросы для навыков
      let skillQuestions: any[] = [];
      if (skillIds.length > 0) {
        const { data, error } = await supabase
          .from('hard_skill_questions')
          .select('id, question_text, skill_id, answer_category_id, order_index, visibility_restriction_enabled, visibility_restriction_type, comment_required_override');
        
        if (error) {
          console.error('Error loading skill questions:', error);
        } else if (data) {
          console.log('UnifiedAssessment: All skill questions loaded:', data.length);
          let filtered = data.filter((q: any) => skillIds.includes(q.skill_id));
          
          // Применяем фильтрацию по типу респондента
          if (evaluatorType) {
            filtered = filtered.filter(q => {
              if (!q.visibility_restriction_enabled) return true;
              if (!q.visibility_restriction_type) return true;
              return q.visibility_restriction_type !== evaluatorType;
            });
          }
          
          skillQuestions = filtered;
          console.log('UnifiedAssessment: Filtered skill questions:', skillQuestions.length);
        }
      }
      
      // Загружаем информацию о навыках и качествах отдельно
      const allSkillIds = [...new Set(skillQuestions.map(q => q.skill_id).filter(Boolean))];
      const allQualityIds = [...new Set(qualityQuestions.map(q => q.quality_id).filter(Boolean))];
      
      let skillsData: any = {};
      let qualitiesData: any = {};
      
      if (allSkillIds.length > 0) {
        const { data, error } = await supabase
          .from('hard_skills')
          .select('id, name, description, category_id, sub_category_id')
          .in('id', allSkillIds);
        
        if (!error && data) {
          skillsData = Object.fromEntries(data.map(s => [s.id, s]));
        }
      }
      
      if (allQualityIds.length > 0) {
        const { data } = await supabase
          .from('soft_skills')
          .select('id, name, description, category_id, sub_category_id')
          .in('id', allQualityIds);
        
        if (data) {
          qualitiesData = Object.fromEntries(data.map(q => [q.id, q]));
        }
      }
      
      // Загружаем категории
      const categoryHardSkillIds = [...new Set(Object.values(skillsData).map((s: any) => s.category_id).filter(Boolean))];
      const categorySoftSkillIds = [...new Set(Object.values(qualitiesData).map((q: any) => q.category_id).filter(Boolean))];
      const subCategoryHardSkillIds = [...new Set(Object.values(skillsData).map((s: any) => s.sub_category_id).filter(Boolean))];
      const subCategorySoftSkillIds = [...new Set(Object.values(qualitiesData).map((q: any) => q.sub_category_id).filter(Boolean))];
      
      let categoriesHard: any = {};
      let categoriesSoft: any = {};
      let subCategoriesHard: any = {};
      let subCategoriesSoft: any = {};
      
      if (categoryHardSkillIds.length > 0) {
        const { data } = await supabase
          .from('category_hard_skills')
          .select('id, name')
          .in('id', categoryHardSkillIds);
        if (data) categoriesHard = Object.fromEntries(data.map(c => [c.id, c]));
      }
      
      if (categorySoftSkillIds.length > 0) {
        const { data } = await supabase
          .from('category_soft_skills')
          .select('id, name')
          .in('id', categorySoftSkillIds);
        if (data) categoriesSoft = Object.fromEntries(data.map(c => [c.id, c]));
      }
      
      if (subCategoryHardSkillIds.length > 0) {
        const { data } = await supabase
          .from('sub_category_hard_skills')
          .select('id, name')
          .in('id', subCategoryHardSkillIds);
        if (data) subCategoriesHard = Object.fromEntries(data.map(c => [c.id, c]));
      }
      
      if (subCategorySoftSkillIds.length > 0) {
        const { data } = await supabase
          .from('sub_category_soft_skills')
          .select('id, name')
          .in('id', subCategorySoftSkillIds);
        if (data) subCategoriesSoft = Object.fromEntries(data.map(c => [c.id, c]));
      }

      // Собираем уникальные category_id из вопросов
      const qualityCategoryIds = [...new Set(qualityQuestions.map(q => q.answer_category_id).filter(Boolean))];
      const skillCategoryIds = [...new Set(skillQuestions.map(q => q.answer_category_id).filter(Boolean))];
      const allAnswerCategoryIds = [...new Set([...qualityCategoryIds, ...skillCategoryIds])];

      // Загружаем comment_required из answer_categories
      let answerCategoriesMap: Record<string, boolean> = {};
      if (allAnswerCategoryIds.length > 0) {
        const { data: acData } = await supabase
          .from('answer_categories')
          .select('id, comment_required')
          .in('id', allAnswerCategoryIds);
        if (acData) {
          answerCategoriesMap = Object.fromEntries(acData.map(ac => [ac.id, ac.comment_required]));
        }
      }

      // Параллельно загружаем варианты ответов
      let qualityOpts: any[] = [];
      let skillOpts: any[] = [];
      
      if (qualityCategoryIds.length > 0) {
        const { data } = await supabase
          .from('soft_skill_answer_options')
          .select('*')
          .in('answer_category_id', qualityCategoryIds)
          .order('order_index', { ascending: true });
        qualityOpts = data || [];
      }

      
      if (skillCategoryIds.length > 0) {
        const { data } = await supabase
          .from('hard_skill_answer_options')
          .select('*')
          .in('answer_category_id', skillCategoryIds)
          .order('order_index', { ascending: true });
        skillOpts = data || [];
      }

      setQualityOptions(qualityOpts);
      setSkillOptions(skillOpts);

      // Combine questions with metadata
      const unified: UnifiedQuestion[] = [
        ...skillQuestions.map((q) => {
          const skill = skillsData[q.skill_id];
          const skillName = skill?.name || 'Без названия';
          const skillDescription = skill?.description || null;
          const category = skill?.category_id ? categoriesHard[skill.category_id]?.name || 'Без категории' : 'Без категории';
          const subCategory = skill?.sub_category_id ? subCategoriesHard[skill.sub_category_id]?.name : null;
          const categoryPath = subCategory ? `${category} → ${subCategory}` : category;
          
          const effectiveCommentRequired = q.comment_required_override ?? (q.answer_category_id ? answerCategoriesMap[q.answer_category_id] : false) ?? false;
          
          return {
            id: q.id,
            questionText: q.question_text,
            type: 'skill' as const,
            skillId: q.skill_id,
            skillName: skillName,
            competencyDescription: skillDescription,
            categoryName: categoryPath,
            orderIndex: q.order_index || 0,
            answerCategoryId: q.answer_category_id,
            commentRequired: effectiveCommentRequired,
          };
        }),
        ...qualityQuestions.map((q) => {
          const quality = qualitiesData[q.quality_id];
          const qualityName = quality?.name || 'Без названия';
          const qualityDescription = quality?.description || null;
          const category = quality?.category_id ? categoriesSoft[quality.category_id]?.name || 'Без категории' : 'Без категории';
          const subCategory = quality?.sub_category_id ? subCategoriesSoft[quality.sub_category_id]?.name : null;
          const categoryPath = subCategory ? `${category} → ${subCategory}` : category;
          
          const effectiveCommentRequired = q.comment_required_override ?? (q.answer_category_id ? answerCategoriesMap[q.answer_category_id] : false) ?? false;
          
          return {
            id: q.id,
            questionText: q.question_text,
            type: 'quality' as const,
            qualityId: q.quality_id,
            qualityName: qualityName,
            competencyDescription: qualityDescription,
            categoryName: categoryPath,
            orderIndex: q.order_index || 0,
            answerCategoryId: q.answer_category_id,
            commentRequired: effectiveCommentRequired,
          };
        }),
      ].sort((a, b) => a.orderIndex - b.orderIndex);

      console.log('UnifiedAssessment: Created unified questions:', unified.length);

      setQuestions(unified);

      // Group questions by category for navigation
      const grouped = unified.reduce((acc, question) => {
        const category = question.categoryName;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(question);
        return acc;
      }, {} as Record<string, UnifiedQuestion[]>);

      const groups: QuestionGroup[] = Object.entries(grouped).map(([categoryName, questions]) => ({
        categoryName,
        questions,
      }));

      setQuestionGroups(groups);
      
      // Восстанавливаем черновики после загрузки вопросов
      await loadDraftAnswers();
    } catch (error) {
      console.error('Error loading questions:', error);
      setQuestionsLoadError('Ошибка загрузки вопросов');
      toast.error('Ошибка загрузки вопросов');
    } finally {
      setQuestionsLoading(false);
      setQuestionsLoadAttempted(true);
    }
  };
  
  // Загрузка черновиков из базы данных
  const loadDraftAnswers = async () => {
    try {
      if (!evaluatedUserId || !currentUser || !assignmentId) return;
      
      // Загружаем черновики soft skills
      const { data: softDrafts } = await supabase
        .from('soft_skill_results')
        .select('question_id, answer_option_id, comment, is_anonymous_comment, is_skip')
        .eq('evaluated_user_id', evaluatedUserId)
        .eq('evaluating_user_id', currentUser.id)
        .eq('assignment_id', assignmentId)
        .eq('is_draft', true);
      
      // Загружаем черновики hard skills
      const { data: hardDrafts } = await supabase
        .from('hard_skill_results')
        .select('question_id, answer_option_id, comment, is_anonymous_comment, is_skip')
        .eq('evaluated_user_id', evaluatedUserId)
        .eq('evaluating_user_id', currentUser.id)
        .eq('assignment_id', assignmentId)
        .eq('is_draft', true);
      
      // Загружаем черновики открытых вопросов
      const { data: openDrafts } = await supabase
        .from('open_question_results')
        .select('open_question_id, answer_text')
        .eq('assignment_id', assignmentId)
        .eq('evaluating_user_id', currentUser.id)
        .eq('is_draft', true);
      
      const allDrafts = [...(softDrafts || []), ...(hardDrafts || [])];
      
      if (allDrafts.length > 0) {
        const draftAnswers: Record<string, string> = {};
        const draftComments: Record<string, string> = {};
        const draftAnonymous: Record<string, boolean> = {};
        const draftSkipped: Record<string, boolean> = {};
        
        allDrafts.forEach((draft: any) => {
          if (draft.is_skip) {
            draftSkipped[draft.question_id] = true;
          } else if (draft.answer_option_id) {
            draftAnswers[draft.question_id] = draft.answer_option_id;
          }
          if (draft.comment) {
            draftComments[draft.question_id] = draft.comment;
          }
          draftAnonymous[draft.question_id] = draft.is_anonymous_comment || false;
        });
        
        // Обновляем состояние И refs синхронно
        answersRef.current = draftAnswers;
        commentsRef.current = draftComments;
        skippedAnswersRef.current = draftSkipped;
        anonymousCommentsRef.current = draftAnonymous;
        
        setAnswers(draftAnswers);
        setSkippedAnswers(draftSkipped);
        setComments(draftComments);
        setAnonymousComments(draftAnonymous);
        
        toast.info(`Восстановлен черновик (${allDrafts.length} ответов)`);
      }
      
      // Восстанавливаем черновики открытых вопросов
      if (openDrafts && openDrafts.length > 0) {
        const draftOpenAnswers: Record<string, string> = {};
        openDrafts.forEach((draft: any) => {
          if (draft.answer_text) {
            draftOpenAnswers[draft.open_question_id] = draft.answer_text;
          }
        });
        openAnswersRef.current = draftOpenAnswers;
        setOpenAnswers(draftOpenAnswers);
      }
    } catch (error) {
      console.error('Error loading draft answers:', error);
    }
  };
  
  // Автосохранение текущего прогресса
  const autoSaveCurrentProgress = async () => {
    // Блокируем если идёт финализация
    if (isFinalizingRef.current) {
      console.log('autoSaveCurrentProgress blocked: finalization in progress');
      return;
    }
    
    try {
      if (!evaluatedUserId || !currentUser || !assignmentId) return;
      
      setAutoSaving(true);
      
      const { data: assignment } = await supabase
        .from('survey_360_assignments')
        .select('diagnostic_stage_id')
        .eq('id', assignmentId)
        .maybeSingle();
      
      const diagnosticStageId = assignment?.diagnostic_stage_id || null;
      
      // Собираем все вопросы, на которые есть ответ или skip
      const answeredQuestionIds = new Set([...Object.keys(answers), ...Object.keys(skippedAnswers)]);
      
      for (const questionId of answeredQuestionIds) {
        // Повторная проверка на каждой итерации
        if (isFinalizingRef.current) {
          console.log('autoSaveCurrentProgress aborted: finalization started');
          return;
        }
        
        const question = questions.find(q => q.id === questionId);
        if (!question) continue;
        
        const isSkipped = skippedAnswers[questionId] === true;
        const answerId = answers[questionId];
        
        // Пропускаем если нет ни ответа, ни skip
        if (!isSkipped && !answerId) continue;
        
        const comment = comments[questionId]?.trim() || null;
        
        // Определяем is_anonymous_comment
        let isAnonymous = anonymousComments[questionId] || false;
        if (evaluatorType === 'peer') {
          isAnonymous = true;
        }
        
        // Используем UPSERT для сохранения (unique constraint на evaluated_user_id, evaluating_user_id, question_id)
        const upsertData = {
          evaluated_user_id: evaluatedUserId,
          evaluating_user_id: currentUser.id,
          question_id: questionId,
          answer_option_id: isSkipped ? null : answerId,
          comment: comment,
          is_anonymous_comment: isAnonymous,
          diagnostic_stage_id: diagnosticStageId,
          assignment_id: assignmentId,
          is_draft: true,
          is_skip: isSkipped,
        };
        
        if (question.type === 'quality') {
          const { error } = await supabase
            .from('soft_skill_results')
            .upsert(upsertData, {
              onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error('Auto-save soft skill error:', error);
          }
        } else {
          const { error } = await supabase
            .from('hard_skill_results')
            .upsert(upsertData, {
              onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
              ignoreDuplicates: false
            });
            
          if (error) {
            console.error('Auto-save hard skill error:', error);
          }
        }
      }
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleAnswer = (answerId: string) => {
    const questionId = questions[currentQuestionIndex].id;
    setPendingSaveQuestionId(questionId);
    // При выборе ответа убираем skip
    updateSkippedAnswers(questionId, undefined);
    updateAnswers(questionId, answerId);
  };

  const handleSkip = () => {
    const questionId = questions[currentQuestionIndex].id;
    setPendingSaveQuestionId(questionId);
    // При skip убираем обычный ответ
    updateAnswers(questionId, undefined);
    updateSkippedAnswers(questionId, true);
  };

  const handleNext = () => {
    if (navigating) return;
    setNavigating(true);
    
    try {
      // Сохраняем текущий вопрос асинхронно (не ждём завершения)
      const questionId = pendingSaveQuestionId || questions[currentQuestionIndex]?.id;
      if (questionId) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveSingleQuestion(questionId);
        setPendingSaveQuestionId(null);
      }
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else if (openQuestions.length > 0) {
        // Last regular question → show open questions
        setShowOpenQuestions(true);
      }
    } finally {
      setNavigating(false);
    }
  };

  const handlePrevious = () => {
    if (navigating) return;
    setNavigating(true);
    
    try {
      if (showOpenQuestions) {
        setShowOpenQuestions(false);
        setCurrentQuestionIndex(questions.length - 1);
      } else {
        // Сохраняем текущий вопрос асинхронно (не ждём завершения)
        const questionId = pendingSaveQuestionId || questions[currentQuestionIndex]?.id;
        if (questionId) {
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
          }
          autoSaveSingleQuestion(questionId);
          setPendingSaveQuestionId(null);
        }
        
        if (currentQuestionIndex > 0) {
          setCurrentQuestionIndex(prev => prev - 1);
        }
      }
    } finally {
      setNavigating(false);
    }
  };

  const goToQuestion = (idx: number) => {
    if (navigating || (idx === currentQuestionIndex && !showOpenQuestions)) return;
    setNavigating(true);
    
    try {
      if (showOpenQuestions) {
        setShowOpenQuestions(false);
      }
      
      // Сохраняем текущий вопрос асинхронно (не ждём завершения)
      if (!showOpenQuestions) {
        const questionId = pendingSaveQuestionId || questions[currentQuestionIndex]?.id;
        if (questionId) {
          if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
          }
          autoSaveSingleQuestion(questionId);
          setPendingSaveQuestionId(null);
        }
      }
      
      setCurrentQuestionIndex(idx);
    } finally {
      setNavigating(false);
    }
  };

  // Эта функция больше не используется для навигации, только для финального сохранения
  const saveAnswer = async (question: UnifiedQuestion, answerId: string) => {
    try {
      setSaving(true);

      // Get assignment details for diagnostic_stage_id
      const { data: assignment } = await supabase
        .from('survey_360_assignments')
        .select('diagnostic_stage_id')
        .eq('id', assignmentId)
        .maybeSingle();

      const diagnosticStageId = assignment?.diagnostic_stage_id || null;

      // Определяем is_anonymous_comment в зависимости от evaluatorType
      let isAnonymous = false;
      if (evaluatorType === 'peer') {
        isAnonymous = true;
      }

      if (question.type === 'quality') {
        // Удаляем все существующие записи для этого вопроса
        await supabase
          .from('soft_skill_results')
          .delete()
          .eq('evaluated_user_id', evaluatedUserId)
          .eq('evaluating_user_id', currentUser?.id)
          .eq('question_id', question.id)
          .eq('assignment_id', assignmentId);

        // Вставляем новый ответ
        const { error } = await supabase
          .from('soft_skill_results')
          .insert({
            evaluated_user_id: evaluatedUserId,
            evaluating_user_id: currentUser?.id,
            question_id: question.id,
            answer_option_id: answerId,
            comment: comments[question.id] || null,
            is_anonymous_comment: isAnonymous,
            diagnostic_stage_id: diagnosticStageId,
            assignment_id: assignmentId,
            is_draft: true,
          });

        if (error) throw error;
      } else {
        // Удаляем все существующие записи для этого вопроса
        await supabase
          .from('hard_skill_results')
          .delete()
          .eq('evaluated_user_id', evaluatedUserId)
          .eq('evaluating_user_id', currentUser?.id)
          .eq('question_id', question.id)
          .eq('assignment_id', assignmentId);

        // Вставляем новый ответ
        const { error } = await supabase
          .from('hard_skill_results')
          .insert({
            evaluated_user_id: evaluatedUserId,
            evaluating_user_id: currentUser?.id,
            question_id: question.id,
            answer_option_id: answerId,
            comment: comments[question.id] || null,
            is_anonymous_comment: isAnonymous,
            diagnostic_stage_id: diagnosticStageId,
            assignment_id: assignmentId,
            is_draft: true,
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving answer:', error);
      toast.error('Ошибка сохранения ответа');
    } finally {
      setSaving(false);
    }
  };

  const completeAssessment = async () => {
    // Валидация обязательных комментариев
    const missingComments = questions.filter(q => 
      q.commentRequired && answers[q.id] && !(comments[q.id]?.trim())
    );
    if (missingComments.length > 0) {
      toast.error(`Необходимо заполнить обязательные комментарии (${missingComments.length} вопросов)`);
      // Navigate to first missing comment
      if (showOpenQuestions) setShowOpenQuestions(false);
      const firstIdx = questions.findIndex(q => q.id === missingComments[0].id);
      if (firstIdx >= 0) setCurrentQuestionIndex(firstIdx);
      return;
    }

    // Валидация обязательных открытых вопросов
    const missingOpenAnswers = openQuestions.filter(q => 
      q.is_required && !(openAnswers[q.id]?.trim())
    );
    if (missingOpenAnswers.length > 0) {
      toast.error(`Необходимо ответить на обязательные открытые вопросы (${missingOpenAnswers.length})`);
      if (!showOpenQuestions) setShowOpenQuestions(true);
      return;
    }

    setSaving(true);
    
    try {
      // 1. КРИТИЧНО: Устанавливаем флаг финализации ПЕРЕД любыми операциями
      isFinalizingRef.current = true;
      
      // 2. Отменяем pending debounce таймеры
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = undefined;
      }
      if (openAutoSaveTimeoutRef.current) {
        clearTimeout(openAutoSaveTimeoutRef.current);
        openAutoSaveTimeoutRef.current = undefined;
      }
      
      // 3. Ждём завершения текущей операции автосохранения (если есть)
      if (pendingSavePromiseRef.current) {
        console.log('Waiting for pending auto-save to complete...');
        await pendingSavePromiseRef.current;
        console.log('Pending auto-save completed');
      }
      
      // 4. Сохраняем текущий вопрос если есть несохранённые изменения (синхронно, не через autosave)
      if (!showOpenQuestions) {
        const currentQuestionId = questions[currentQuestionIndex]?.id;
        if (currentQuestionId && (answers[currentQuestionId] || skippedAnswers[currentQuestionId])) {
          const question = questions[currentQuestionIndex];
          const isSkipped = skippedAnswers[currentQuestionId] === true;
          const answerId = answers[currentQuestionId];
          const comment = comments[currentQuestionId]?.trim() || null;
          
          let isAnonymous = anonymousComments[currentQuestionId] || false;
          if (evaluatorType === 'peer') {
            isAnonymous = true;
          }
          
          const { data: assignment } = await supabase
            .from('survey_360_assignments')
            .select('diagnostic_stage_id')
            .eq('id', assignmentId)
            .maybeSingle();
          
          const diagnosticStageId = assignment?.diagnostic_stage_id || null;
          const tableName = question.type === 'quality' ? 'soft_skill_results' : 'hard_skill_results';
          
          await supabase
            .from(tableName)
            .upsert({
              evaluated_user_id: evaluatedUserId,
              evaluating_user_id: currentUser?.id,
              question_id: currentQuestionId,
              answer_option_id: isSkipped ? null : answerId,
              comment: comment,
              is_anonymous_comment: isAnonymous,
              diagnostic_stage_id: diagnosticStageId,
              assignment_id: assignmentId,
              is_draft: true,
              is_skip: isSkipped,
            }, {
              onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
              ignoreDuplicates: false
            });
        }
      }

      // 4b. Save/finalize open question results
      if (openQuestions.length > 0) {
        const { data: assignment } = await supabase
          .from('survey_360_assignments')
          .select('diagnostic_stage_id')
          .eq('id', assignmentId)
          .maybeSingle();
        
        const diagnosticStageId = assignment?.diagnostic_stage_id;
        
        if (diagnosticStageId) {
          for (const oq of openQuestions) {
            const answerText = openAnswers[oq.id]?.trim() || '';
            // Only save if there's text or it was previously saved
            if (answerText || oq.is_required) {
              await supabase
                .from('open_question_results')
                .upsert({
                  open_question_id: oq.id,
                  assignment_id: assignmentId,
                  diagnostic_stage_id: diagnosticStageId,
                  evaluating_user_id: currentUser?.id,
                  evaluated_user_id: evaluatedUserId,
                  answer_text: answerText,
                  is_draft: false,
                }, {
                  onConflict: 'assignment_id,open_question_id',
                  ignoreDuplicates: false
                });
            }
          }
        }
      }
      
      // 5. КРИТИЧНО: Финализируем ВСЕ ответы этого assignment (is_draft → false)
      const isAnonymous = evaluatorType === 'peer';
      
      // Финализируем soft_skill_results
      const { error: softError, count: softCount } = await supabase
        .from('soft_skill_results')
        .update({ 
          is_draft: false,
          is_anonymous_comment: isAnonymous
        })
        .eq('assignment_id', assignmentId)
        .eq('is_draft', true);

      if (softError) {
        console.error('Error finalizing soft skill results:', softError);
      } else {
        console.log(`Finalized ${softCount} soft skill results`);
      }

      // Финализируем hard_skill_results
      const { error: hardError, count: hardCount } = await supabase
        .from('hard_skill_results')
        .update({ 
          is_draft: false,
          is_anonymous_comment: isAnonymous
        })
        .eq('assignment_id', assignmentId)
        .eq('is_draft', true);

      if (hardError) {
        console.error('Error finalizing hard skill results:', hardError);
      } else {
        console.log(`Finalized ${hardCount} hard skill results`);
      }

      // 6. Обновляем статус assignment
      const { error: assignmentError } = await supabase
        .from('survey_360_assignments')
        .update({ status: 'completed' })
        .eq('id', assignmentId);

      if (assignmentError) {
        console.error('Error updating assignment status:', assignmentError);
      }

      // 7. Обновляем статус связанной задачи
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('user_id', currentUser?.id)
        .in('status', ['pending', 'in_progress']);

      if (tasks && tasks.length > 0) {
        await supabase
          .from('tasks')
          .update({ status: 'completed' })
          .in('id', tasks.map(t => t.id));
      }

      // 8. Переходим на страницу успеха
      toast.success('Результаты успешно сохранены');
      navigate('/assessment/completed');
    } catch (error) {
      console.error('Error completing assessment:', error);
      toast.error('Ошибка сохранения результатов');
    } finally {
      isFinalizingRef.current = false;
      setSaving(false);
    }
  };

if (loading || questionsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-32 w-32 border-b-4 border-t-4 border-primary mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/20 animate-pulse"></div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Загрузка формы обратной связи…</p>
            <p className="text-sm text-muted-foreground">Подготавливаем вопросы для вас</p>
          </div>
        </div>
      </div>
    );
  }

  if (questionsLoadError && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Ошибка загрузки вопросов</p>
            <p className="text-sm text-muted-foreground">
              {questionsLoadError}. Обратитесь к администратору.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  if (questionsLoadAttempted && !questionsLoadError && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold text-foreground">Вопросы для оценки не найдены</p>
            <p className="text-sm text-muted-foreground">
              Возможные причины: у оцениваемого сотрудника не указан грейд, для грейда не настроены компетенции, 
              или нет вопросов, доступных для вашего типа оценки. Обратитесь к администратору.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Вернуться назад
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const allOptions = currentQuestion?.type === 'quality' ? qualityOptions : skillOptions;
  const currentOptions = currentQuestion?.answerCategoryId 
    ? allOptions.filter(opt => opt.answer_category_id === currentQuestion.answerCategoryId)
    : allOptions;
  // Учитываем и ответы и skip
  const answeredCount = Object.keys(answers).length + Object.keys(skippedAnswers).length;
  const totalSteps = questions.length + (openQuestions.length > 0 ? 1 : 0);
  const currentStep = showOpenQuestions ? questions.length + 1 : currentQuestionIndex + 1;
  const progress = (answeredCount / questions.length) * 100;
  
  // Определяем, последний ли это вопрос (если нет открытых вопросов)
  const isLastRegularQuestion = currentQuestionIndex === questions.length - 1;
  const hasOpenQuestions = openQuestions.length > 0;
  const isLastQuestion = showOpenQuestions || (isLastRegularQuestion && !hasOpenQuestions);
  
  // Определяем, есть ли ответ или skip на текущий вопрос
  const hasCurrentAnswer = !!answers[currentQuestion?.id] || !!skippedAnswers[currentQuestion?.id];
  const isCurrentSkipped = !!skippedAnswers[currentQuestion?.id];
  
  // Проверяем, все ли вопросы отвечены (для кнопки "Завершить")
  const allQuestionsAnswered = questions.every(q => answers[q.id] || skippedAnswers[q.id]);

  // Render open questions page
  if (showOpenQuestions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto p-4 max-w-4xl">
          <Breadcrumbs />

          {/* Progress bar */}
          <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-card to-card/80 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Прогресс прохождения</span>
                <span className="text-sm font-bold text-primary">
                  {answeredCount} / {questions.length} вопросов
                </span>
              </div>
              <div className="relative">
                <Progress value={progress} className="h-3" />
              </div>
              {answeredCount === questions.length && (
                <div className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Все вопросы отвечены
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open questions */}
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border border-muted/40 shadow-2xl bg-gradient-to-br from-card via-card to-card/80 backdrop-blur overflow-hidden relative">
              <div className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300" />
              
              <CardHeader className="space-y-3 pb-4">
                <div className="inline-flex items-center">
                  <span className="px-4 py-2 rounded-full text-sm font-bold tracking-wide shadow-lg bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-700 dark:text-amber-300 border-2 border-amber-400/40">
                    <MessageSquare className="h-4 w-4 inline mr-2" />
                    Открытые вопросы
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Пожалуйста, ответьте на дополнительные вопросы в свободной форме.
                </p>
              </CardHeader>
              
              <CardContent className="space-y-8">
                {openQuestions.map((oq, idx) => (
                  <div key={oq.id} className="space-y-3">
                    <Label className="text-base font-semibold text-foreground">
                      {idx + 1}. {oq.question_text}
                      {oq.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Textarea
                      value={openAnswers[oq.id] || ''}
                      onChange={(e) => handleOpenAnswerChange(oq.id, e.target.value)}
                      placeholder="Введите ваш ответ..."
                      className="min-h-[120px] resize-y"
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {(openAnswers[oq.id] || '').length} символов
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={navigating}
                className="gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 order-2 sm:order-1"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5" />
                Предыдущий
              </Button>

              <Button
                onClick={completeAssessment}
                disabled={!allQuestionsAnswered || saving || navigating}
                className="gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 order-1 sm:order-2 w-full sm:w-auto min-w-[200px] bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                size="lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Завершить фидбек
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 max-w-4xl">
        <Breadcrumbs />

        {/* Diagnostic period info */}
        {diagnosticPeriod && (
          <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-primary">
                  Диагностика
                </span>
                <span className="text-sm text-muted-foreground">
                  до {new Date(diagnosticPeriod.end_date).toLocaleDateString('ru-RU')}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress bar */}
        <Card className="mb-6 border-none shadow-lg bg-gradient-to-br from-card to-card/80 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-foreground">Прогресс прохождения</span>
              <span className="text-sm font-bold text-primary">
                {answeredCount} / {questions.length}
              </span>
            </div>
            <div className="relative">
              <Progress value={progress} className="h-3" />
              <div className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-primary/20 to-primary/5 w-full pointer-events-none" />
            </div>
            {answeredCount === questions.length && (
              <div className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Все вопросы отвечены
              </div>
            )}
          </CardContent>
        </Card>

        {/* Question navigation tabs */}
        <div className="mb-8 overflow-x-auto scrollbar-thin" ref={questionTabsContainerRef}>
          <div className="flex gap-2 pb-2 min-w-max">
            {questions.map((question, idx) => {
              const isAnswered = !!answers[question.id];
              const isSkipped = !!skippedAnswers[question.id];
              const isCurrent = idx === currentQuestionIndex;
              
              return (
                <button
                  key={question.id}
                  ref={(el) => {
                    if (el) questionTabRefs.current.set(idx, el);
                    else questionTabRefs.current.delete(idx);
                  }}
                  onClick={() => goToQuestion(idx)}
                  className={`
                    relative flex-shrink-0 px-3 py-2 rounded-lg text-sm font-semibold 
                    transition-all duration-300 border min-w-[48px]
                    transform hover:scale-105
                    ${isCurrent 
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary shadow-lg scale-105' 
                      : (isAnswered || isSkipped)
                      ? 'bg-gradient-to-br from-green-500/20 to-green-600/10 text-green-700 dark:text-green-300 border-green-400/50 dark:border-green-600/50'
                      : 'bg-muted/30 hover:bg-muted/50 border-muted/40 text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {isAnswered && !isCurrent && (
                      <CheckCircle className="h-3.5 w-3.5 animate-in fade-in zoom-in duration-300" />
                    )}
                    {isSkipped && !isCurrent && (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-green-500 dark:border-green-400 flex items-center justify-center animate-in fade-in zoom-in duration-300">
                        <span className="text-[10px] font-bold leading-none">–</span>
                      </div>
                    )}
                    <span className="font-bold">{idx + 1}</span>
                  </div>
                  {isCurrent && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary-foreground rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
            {/* Open questions tab */}
            {hasOpenQuestions && (
              <button
                onClick={() => {
                  // Save current question first
                  const questionId = pendingSaveQuestionId || questions[currentQuestionIndex]?.id;
                  if (questionId) {
                    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
                    autoSaveSingleQuestion(questionId);
                    setPendingSaveQuestionId(null);
                  }
                  setShowOpenQuestions(true);
                }}
                className={`
                  relative flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold 
                  transition-all duration-300 border
                  transform hover:scale-105
                  bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-700 dark:text-amber-300 border-amber-400/50 dark:border-amber-600/50
                  hover:shadow-md
                `}
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="font-bold">Доп.</span>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Current question */}
        {currentQuestion && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border border-muted/40 shadow-2xl bg-gradient-to-br from-card via-card to-card/80 backdrop-blur overflow-hidden relative">
              {/* Decorative gradient border effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-muted/10 via-muted/5 to-transparent pointer-events-none rounded-lg" />
              <div className="h-1.5 bg-gradient-to-r from-primary via-primary/60 to-primary/30" />
              
              <CardHeader className="space-y-4 pb-4">
                {/* Category and competency header */}
                <div className="space-y-3">
                  <div className="space-y-3">
                    {/* Category path badge */}
                    <div className="inline-flex items-center">
                      <span className={`
                        px-4 py-2 rounded-full text-sm font-bold tracking-wide
                        shadow-lg transform transition-transform hover:scale-105
                        ${currentQuestion.type === 'quality' 
                          ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/10 text-purple-700 dark:text-purple-300 border-2 border-purple-400/40' 
                          : 'bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-blue-700 dark:text-blue-300 border-2 border-blue-400/40'
                        }
                      `}>
                        {currentQuestion.categoryName}
                      </span>
                    </div>
                    
                    {/* Competency name */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                        {currentQuestion.type === 'skill' ? currentQuestion.skillName : currentQuestion.qualityName}
                      </h3>
                      {currentQuestion.competencyDescription && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {currentQuestion.competencyDescription}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
                    <span className="text-xs text-muted-foreground font-medium px-3 py-1 bg-muted/50 rounded-full">
                      Вопрос {currentQuestionIndex + 1} из {questions.length}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-l from-border via-border/50 to-transparent" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground px-2.5 py-1 bg-muted/60 rounded-md">
                    {currentQuestion.type === 'quality' ? 'Soft-навык' : 'Hard-навык'}
                  </span>
                </div>
                <CardTitle className="text-lg leading-snug text-foreground">
                  {currentQuestion.questionText}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-3 pt-2">
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={handleAnswer}
                  className="space-y-3"
                >
                  {currentOptions.map((option) => {
                    const isSelected = answers[currentQuestion.id] === option.id;
                    const optionContent = (
                      <div
                        key={option.id}
                        onClick={() => handleAnswer(option.id)}
                        className={`
                          group relative flex items-start space-x-4 border rounded-xl p-5 
                          cursor-pointer transition-all duration-300
                          transform hover:scale-[1.02] hover:shadow-xl
                          ${isSelected 
                            ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary shadow-lg' 
                            : 'bg-card/50 border-muted/40 hover:border-primary/50 hover:bg-muted/30'
                          }
                        `}
                      >
                        <RadioGroupItem 
                          value={option.id} 
                          id={option.id}
                          className="mt-1 ring-offset-2 pointer-events-none"
                        />
                        <Label
                          htmlFor={option.id}
                          className="flex-1 cursor-pointer pointer-events-none"
                        >
                          <div className={`font-semibold text-base transition-colors ${
                            isSelected ? 'text-primary' : 'text-foreground group-hover:text-foreground'
                          }`}>
                            {option.title}
                          </div>
                          {option.description && (
                            <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {option.description}
                            </div>
                          )}
                        </Label>
                        {isSelected && (
                          <div className="absolute top-3 right-3 pointer-events-none">
                            <CheckCircle className="h-5 w-5 text-primary animate-in zoom-in duration-300" />
                          </div>
                        )}
                      </div>
                    );

                    return optionContent;
                  })}
                </RadioGroup>
                
                {/* Skip button - Не могу ответить (скрыт, логика сохранена) */}
                <div className="hidden mt-4 pt-4 border-t border-muted/30">
                  <button
                    onClick={handleSkip}
                    className={`
                      w-full flex items-center justify-center gap-2 py-4 px-5 rounded-xl 
                      border-2 border-dashed transition-all duration-300
                      ${isCurrentSkipped
                        ? 'bg-amber-500/10 border-amber-400 text-amber-700 dark:text-amber-300'
                        : 'border-muted/40 text-muted-foreground hover:border-amber-400/50 hover:bg-amber-500/5 hover:text-amber-600 dark:hover:text-amber-400'
                      }
                    `}
                  >
                    {isCurrentSkipped && (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    <span className="font-medium">Не могу ответить</span>
                  </button>
                </div>
                
                {/* Comment Field */}
                {answers[currentQuestion.id] && evaluatorType && (
                  <div className="mt-6">
                    <CommentField
                      questionId={currentQuestion.id}
                      comment={comments[currentQuestion.id] || ''}
                      isAnonymous={anonymousComments[currentQuestion.id] ?? false}
                      evaluatorType={evaluatorType}
                      required={currentQuestion.commentRequired}
                      onCommentChange={(value) => {
                        setPendingSaveQuestionId(currentQuestion.id);
                        updateComments(currentQuestion.id, value);
                      }}
                      onAnonymousChange={(value) => {
                        setPendingSaveQuestionId(currentQuestion.id);
                        updateAnonymousComments(currentQuestion.id, value);
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0 || navigating}
                className="gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 order-2 sm:order-1"
                size="lg"
              >
                <ChevronLeft className="w-5 h-5" />
                Предыдущий
              </Button>

              <Button
                onClick={isLastQuestion ? completeAssessment : handleNext}
                disabled={isLastQuestion ? (!allQuestionsAnswered || saving || navigating) : (!hasCurrentAnswer || saving || navigating)}
                className={`
                  gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50
                  order-1 sm:order-2 w-full sm:w-auto min-w-[200px]
                  ${isLastQuestion 
                    ? 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary' 
                    : 'bg-primary hover:bg-primary/90'
                  }
                `}
                size="lg"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                    Сохранение...
                  </>
                ) : isLastQuestion ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Завершить фидбек
                  </>
                ) : (
                  <>
                    Следующий
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UnifiedAssessmentPage;
