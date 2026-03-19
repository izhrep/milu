import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, FileSpreadsheet, Search, Loader2, Users, User, Eye, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getFullName } from '@/hooks/useUsers';
import { loadSnapshotForStage } from '@/utils/loadSnapshotForStage';
import type { SnapshotContext } from '@/hooks/useSnapshotContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface UserData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  email?: string | null;
  positions?: { name: string } | null;
  manager_id?: string | null;
}

interface OfflineSurveyManagerProps {
  stageId: string | null;
  stagePeriod: string;
  stageStatus?: string;
  users: UserData[];
  participantUserIds: string[];
}

interface QuestionData {
  id: string;
  question_text: string;
  skill_id: string | null;
  skill_name: string;
  type: 'hard' | 'soft';
  answer_options: { id: string; title: string; description: string | null; numeric_value: number }[];
  visibility_restriction_enabled: boolean | null;
  visibility_restriction_type: string | null;
}

interface Assignment {
  id: string;
  evaluated_user_id: string;
  evaluating_user_id: string;
  assignment_type: string;
  status: string;
}

interface PreviewRow {
  questionText: string;
  competency: string;
  answerNumber: number;
  answerText: string;
  comment: string;
  questionId: string;
  answerOptionId: string;
  numericValue: number | null;
  questionType: 'hard' | 'soft';
  isValid: boolean;
}

interface PreviewData {
  assignmentId: string;
  evaluatedUserId: string;
  evaluatingUserId: string;
  evaluatedUserName: string;
  evaluatingUserName: string;
  assignmentType: string;
  stageId: string;
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
}

export const OfflineSurveyManager: React.FC<OfflineSurveyManagerProps> = ({
  stageId,
  stagePeriod,
  stageStatus,
  users,
  participantUserIds,
}) => {
  const [participantSearch, setParticipantSearch] = useState('');
  const [respondentSearch, setRespondentSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [respondents, setRespondents] = useState<Assignment[]>([]);
  const [loadingRespondents, setLoadingRespondents] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const participants = users.filter(u => participantUserIds.includes(u.id));
  
  const filteredParticipants = participants.filter(user => {
    const fullName = getFullName(user)?.toLowerCase() || '';
    const email = user.email?.toLowerCase() || '';
    const search = participantSearch.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const [respondentsWithCompletedResults, setRespondentsWithCompletedResults] = useState<Set<string>>(new Set());
  const [respondentsWithAnyResults, setRespondentsWithAnyResults] = useState<Set<string>>(new Set());

  // Load respondents when participant is selected
  useEffect(() => {
    if (!selectedParticipant || !stageId) {
      setRespondents([]);
      setRespondentsWithCompletedResults(new Set());
      setRespondentsWithAnyResults(new Set());
      return;
    }

    const fetchRespondents = async () => {
      setLoadingRespondents(true);
      try {
        const { data, error } = await supabase
          .from('survey_360_assignments')
          .select('id, evaluated_user_id, evaluating_user_id, assignment_type, status')
          .eq('evaluated_user_id', selectedParticipant)
          .eq('diagnostic_stage_id', stageId)
          .in('status', ['approved', 'pending', 'completed']);

        if (error) throw error;
        setRespondents(data || []);

        // Check which respondents have results
        if (data && data.length > 0) {
          const assignmentIds = data.map(a => a.id);
          
          // Check for completed hard skill results (is_draft=false)
          const { data: hardResultsCompleted } = await supabase
            .from('hard_skill_results')
            .select('assignment_id')
            .in('assignment_id', assignmentIds)
            .eq('is_draft', false);

          // Check for completed soft skill results (is_draft=false)
          const { data: softResultsCompleted } = await supabase
            .from('soft_skill_results')
            .select('assignment_id')
            .in('assignment_id', assignmentIds)
            .eq('is_draft', false);

          // Check for ANY hard skill results (including drafts)
          const { data: hardResultsAny } = await supabase
            .from('hard_skill_results')
            .select('assignment_id')
            .in('assignment_id', assignmentIds);

          // Check for ANY soft skill results (including drafts)
          const { data: softResultsAny } = await supabase
            .from('soft_skill_results')
            .select('assignment_id')
            .in('assignment_id', assignmentIds);

          const completedResults = new Set<string>();
          hardResultsCompleted?.forEach(r => r.assignment_id && completedResults.add(r.assignment_id));
          softResultsCompleted?.forEach(r => r.assignment_id && completedResults.add(r.assignment_id));
          setRespondentsWithCompletedResults(completedResults);

          const anyResults = new Set<string>();
          hardResultsAny?.forEach(r => r.assignment_id && anyResults.add(r.assignment_id));
          softResultsAny?.forEach(r => r.assignment_id && anyResults.add(r.assignment_id));
          setRespondentsWithAnyResults(anyResults);
        }
      } catch (error) {
        console.error('Error fetching respondents:', error);
        toast.error('Ошибка загрузки респондентов');
      } finally {
        setLoadingRespondents(false);
      }
    };

    fetchRespondents();
  }, [selectedParticipant, stageId]);

  const filteredRespondents = respondents.filter(assignment => {
    const user = users.find(u => u.id === assignment.evaluating_user_id);
    if (!user) return false;
    const fullName = getFullName(user)?.toLowerCase() || '';
    const email = user.email?.toLowerCase() || '';
    const search = respondentSearch.toLowerCase();
    return fullName.includes(search) || email.includes(search);
  });

  const isQuestionVisibleForRole = (
    restrictionEnabled: boolean | null,
    restrictionType: string | null,
    assignmentType: string
  ): boolean => {
    if (!restrictionEnabled) return true;
    const roleMap: Record<string, string> = {
      self: 'self',
      manager: 'manager',
      peer: 'peer',
    };
    return restrictionType !== roleMap[assignmentType];
  };

  const fetchQuestionsForRole = async (assignmentType: string): Promise<QuestionData[]> => {
    const isCompleted = stageStatus === 'completed';

    // For completed stages, use snapshot data
    if (isCompleted && stageId) {
      return fetchQuestionsFromSnapshot(assignmentType);
    }

    return fetchQuestionsFromLive(assignmentType);
  };

  const fetchQuestionsFromSnapshot = async (assignmentType: string): Promise<QuestionData[]> => {
    if (!stageId) return [];
    const snapshot = await loadSnapshotForStage(stageId);
    if (!snapshot) {
      console.warn('No snapshot found for completed stage, falling back to live');
      return fetchQuestionsFromLive(assignmentType);
    }
    return buildQuestionsFromSnapshot(snapshot, assignmentType);
  };

  const buildQuestionsFromSnapshot = (snapshot: SnapshotContext, assignmentType: string): QuestionData[] => {
    const questions: QuestionData[] = [];

    // Group answer options by answer_category_id
    const hardOptionsByCategory = new Map<string, { id: string; title: string; description: string | null; numeric_value: number }[]>();
    snapshot.hardAnswerOptionsMap.forEach((opt, entityId) => {
      if (!opt.answerCategoryId) return;
      if (!hardOptionsByCategory.has(opt.answerCategoryId)) hardOptionsByCategory.set(opt.answerCategoryId, []);
      hardOptionsByCategory.get(opt.answerCategoryId)!.push({
        id: entityId, title: opt.title, description: opt.description, numeric_value: opt.numericValue,
      });
    });

    const softOptionsByCategory = new Map<string, { id: string; title: string; description: string | null; numeric_value: number }[]>();
    snapshot.softAnswerOptionsMap.forEach((opt, entityId) => {
      if (!opt.answerCategoryId) return;
      if (!softOptionsByCategory.has(opt.answerCategoryId)) softOptionsByCategory.set(opt.answerCategoryId, []);
      softOptionsByCategory.get(opt.answerCategoryId)!.push({
        id: entityId, title: opt.title, description: opt.description, numeric_value: opt.numericValue,
      });
    });

    // Sort options by orderIndex or numeric_value
    const sortOptions = (arr: any[]) => arr.sort((a: any, b: any) => (a.order_index ?? a.numeric_value) - (b.order_index ?? b.numeric_value));

    // Hard questions from snapshot
    const hardQuestionsArr = Array.from(snapshot.hardQuestionsMap.entries())
      .sort((a, b) => (a[1].orderIndex ?? 0) - (b[1].orderIndex ?? 0));

    for (const [qId, q] of hardQuestionsArr) {
      if (!isQuestionVisibleForRole(q.visibilityRestrictionEnabled, q.visibilityRestrictionType, assignmentType)) continue;
      const skill = q.skillId ? snapshot.hardSkillsMap.get(q.skillId) : null;
      const options = hardOptionsByCategory.get(q.answerCategoryId || '') || [];
      if (options.length > 0) {
        questions.push({
          id: qId,
          question_text: q.questionText,
          skill_id: q.skillId,
          skill_name: skill?.name || 'Не указано',
          type: 'hard',
          answer_options: sortOptions([...options]),
          visibility_restriction_enabled: q.visibilityRestrictionEnabled,
          visibility_restriction_type: q.visibilityRestrictionType,
        });
      }
    }

    // Soft questions from snapshot
    const softQuestionsArr = Array.from(snapshot.softQuestionsMap.entries())
      .sort((a, b) => (a[1].orderIndex ?? 0) - (b[1].orderIndex ?? 0));

    for (const [qId, q] of softQuestionsArr) {
      if (!isQuestionVisibleForRole(q.visibilityRestrictionEnabled, q.visibilityRestrictionType, assignmentType)) continue;
      const quality = q.qualityId ? snapshot.softSkillsMap.get(q.qualityId) : null;
      const options = softOptionsByCategory.get(q.answerCategoryId || '') || [];
      if (options.length > 0) {
        questions.push({
          id: qId,
          question_text: q.questionText,
          skill_id: q.qualityId || null,
          skill_name: quality?.name || 'Не указано',
          type: 'soft',
          answer_options: sortOptions([...options]),
          visibility_restriction_enabled: q.visibilityRestrictionEnabled,
          visibility_restriction_type: q.visibilityRestrictionType,
        });
      }
    }

    return questions;
  };

  const fetchQuestionsFromLive = async (assignmentType: string): Promise<QuestionData[]> => {
    const questions: QuestionData[] = [];

    // Fetch hard skill questions
    const { data: hardQuestions, error: hardQuestionsError } = await supabase
      .from('hard_skill_questions')
      .select(`
        id,
        question_text,
        skill_id,
        visibility_restriction_enabled,
        visibility_restriction_type,
        answer_category_id,
        hard_skills (name)
      `)
      .order('order_index', { ascending: true });

    // Fetch soft skill questions without join (to avoid FK hint issues)
    const { data: softQuestions, error: softQuestionsError } = await supabase
      .from('soft_skill_questions')
      .select(`
        id,
        question_text,
        quality_id,
        visibility_restriction_enabled,
        visibility_restriction_type,
        answer_category_id
      `)
      .order('order_index', { ascending: true });

    // Fetch soft skills names separately
    const { data: softSkills } = await supabase
      .from('soft_skills')
      .select('id, name');

    const softSkillsMap = new Map((softSkills || []).map(s => [s.id, s.name]));

    // Fetch hard skill answer options
    const { data: hardAnswerOptions, error: hardOptionsError } = await supabase
      .from('hard_skill_answer_options')
      .select('id, title, description, numeric_value, answer_category_id')
      .order('order_index', { ascending: true });

    // Fetch soft skill answer options
    const { data: softAnswerOptions, error: softOptionsError } = await supabase
      .from('soft_skill_answer_options')
      .select('id, title, description, numeric_value, answer_category_id')
      .order('order_index', { ascending: true });

    // Process hard skill questions
    if (hardQuestions && hardAnswerOptions) {
      for (const q of hardQuestions) {
        if (!isQuestionVisibleForRole(q.visibility_restriction_enabled, q.visibility_restriction_type, assignmentType)) {
          continue;
        }
        const skill = q.hard_skills as { name: string } | null;
        const options = hardAnswerOptions
          .filter(o => o.answer_category_id === q.answer_category_id)
          .map(o => ({ id: o.id, title: o.title, description: o.description, numeric_value: o.numeric_value }));

        if (options.length > 0) {
          questions.push({
            id: q.id,
            question_text: q.question_text,
            skill_id: q.skill_id,
            skill_name: skill?.name || 'Не указано',
            type: 'hard',
            answer_options: options,
            visibility_restriction_enabled: q.visibility_restriction_enabled,
            visibility_restriction_type: q.visibility_restriction_type,
          });
        }
      }
    }

    // Process soft skill questions
    if (softQuestions && softAnswerOptions) {
      for (const q of softQuestions) {
        const isVisible = isQuestionVisibleForRole(q.visibility_restriction_enabled, q.visibility_restriction_type, assignmentType);
        
        if (!isVisible) {
          continue;
        }
        
        const skillName = q.quality_id ? softSkillsMap.get(q.quality_id) : null;
        const options = softAnswerOptions
          .filter(o => o.answer_category_id === q.answer_category_id)
          .map(o => ({ id: o.id, title: o.title, description: o.description, numeric_value: o.numeric_value }));

        if (options.length > 0) {
          questions.push({
            id: q.id,
            question_text: q.question_text,
            skill_id: q.quality_id,
            skill_name: skillName || 'Не указано',
            type: 'soft',
            answer_options: options,
            visibility_restriction_enabled: q.visibility_restriction_enabled,
            visibility_restriction_type: q.visibility_restriction_type,
          });
        }
      }
    }

    return questions;
  };

  // Download questionnaire for ONE assignment (one evaluating user for one evaluated user)
  const downloadQuestionnaire = async (assignment: Assignment) => {
    if (!stageId) {
      toast.error('Этап не выбран');
      return;
    }

    setDownloading(assignment.id);

    try {
      const evaluatingUser = users.find(u => u.id === assignment.evaluating_user_id);
      const evaluatedUser = users.find(u => u.id === assignment.evaluated_user_id);
      const evaluatingUserName = getFullName(evaluatingUser) || 'Респондент';
      const evaluatedUserName = getFullName(evaluatedUser) || 'Участник';

      const questions = await fetchQuestionsForRole(assignment.assignment_type);

      if (questions.length === 0) {
        toast.error('Нет вопросов для анкеты');
        setDownloading(null);
        return;
      }

      const workbook = XLSX.utils.book_new();
      const dataRows: any[][] = [];

      // Header row - removed "Тип" column
      dataRows.push([
        'Компетенция', 
        'Вопрос', 
        'Варианты ответов',
        'Ваш ответ (номер)', 
        'Комментарий', 
        'question_id', 
        '__answer_options_map', 
        '__question_type'
      ]);

      // Question rows
      for (const q of questions) {
        // Format answer options with numbers: "1. Title - Description"
        const answerOptionsDisplay = q.answer_options
          .map((o, idx) => {
            const num = idx + 1;
            return o.description ? `${num}. ${o.title} - ${o.description}` : `${num}. ${o.title}`;
          })
          .join('\n');
        
        // Map numbers to option IDs and numeric values for import: "1:optionId1:numVal|2:optionId2:numVal|..."
        const answerOptionsMap = q.answer_options
          .map((o, idx) => `${idx + 1}:${o.id}:${o.numeric_value}`)
          .join('|');

        dataRows.push([
          q.skill_name,
          q.question_text,
          answerOptionsDisplay,
          '', // Empty for user to fill with number
          '', // Comment
          q.id,
          answerOptionsMap,
          q.type,
        ]);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(dataRows);

      // Add metadata in hidden area
      XLSX.utils.sheet_add_aoa(worksheet, [
        ['__META__', 'assignment_id', 'evaluated_user_id', 'evaluating_user_id', 'assignment_type', 'stage_id'],
        ['__DATA__', assignment.id, assignment.evaluated_user_id, assignment.evaluating_user_id, assignment.assignment_type, stageId]
      ], { origin: 'A1000' });

      // Set column widths - updated without "Тип" column
      worksheet['!cols'] = [
        { wch: 25 },  // Компетенция
        { wch: 60 },  // Вопрос
        { wch: 60 },  // Варианты ответов
        { wch: 20 },  // Ваш ответ
        { wch: 40 },  // Комментарий
        { hidden: true, wch: 0 },   // question_id
        { hidden: true, wch: 0 },   // __answer_options_map
        { hidden: true, wch: 0 },   // __question_type
      ];

      const sheetName = `Фидбэк для ${evaluatedUserName}`.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const fileName = `Анкета_${evaluatingUserName}_для_${evaluatedUserName}_${stagePeriod}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success('Анкета успешно скачана');
    } catch (error) {
      console.error('Error downloading questionnaire:', error);
      toast.error('Ошибка при формировании анкеты');
    } finally {
      setDownloading(null);
    }
  };

  const parseFileForPreview = async (file: File): Promise<PreviewData | null> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Process only first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return null;

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

      let assignmentId: string | null = null;
      let evaluatedUserId: string | null = null;
      let evaluatingUserId: string | null = null;
      let assignmentType: string | null = null;
      let stageIdFromFile: string | null = null;

      // Find metadata
      for (let i = 998; i < Math.min(data.length, 1010); i++) {
        const row = data[i];
        if (row && row[0] === '__DATA__') {
          assignmentId = row[1];
          evaluatedUserId = row[2];
          evaluatingUserId = row[3];
          assignmentType = row[4];
          stageIdFromFile = row[5];
          break;
        }
      }

      if (!assignmentId || !evaluatedUserId || !evaluatingUserId || !stageIdFromFile) {
        toast.error('Файл не содержит необходимых метаданных');
        return null;
      }

      const evaluatedUser = users.find(u => u.id === evaluatedUserId);
      const evaluatingUser = users.find(u => u.id === evaluatingUserId);

      const rows: PreviewRow[] = [];
      let validCount = 0;
      let errorCount = 0;

      // Process data rows - updated column indices without "Тип"
      // Columns: [Компетенция, Вопрос, Варианты ответов, Ваш ответ (номер), Комментарий, question_id, __answer_options_map, __question_type]
      for (let i = 1; i < 999; i++) {
        const row = data[i];
        if (!row || row.length < 8) continue;

        const competency = row[0];    // Column A - Компетенция
        const questionText = row[1];   // Column B - Вопрос
        const answerNumber = row[3];   // Column D - Ваш ответ (номер)
        const comment = row[4] || '';  // Column E - Комментарий  
        const questionId = row[5];     // Column F - question_id
        const answerOptionsMap = row[6]; // Column G - __answer_options_map
        const questionType = row[7];   // Column H - __question_type
        
        if (!questionId || questionId === 'question_id') continue;
        if (answerNumber === '' || answerNumber === undefined) continue;

        // Parse answer number and find option ID
        const answerNum = parseInt(String(answerNumber).trim(), 10);
        let answerOptionId = '';
        let answerText = '';
        let isValid = true;
        let resolvedNumericValue: number | null = null;

        if (isNaN(answerNum)) {
          isValid = false;
          answerText = `Некорректный ответ: ${answerNumber}`;
        } else {
          // Parse answer options map
          const optionsMapStr = String(answerOptionsMap || '');
          const optionsMapEntries = optionsMapStr.split('|').map(entry => {
            const parts = entry.split(':');
            return { num: parseInt(parts[0], 10), optionId: parts[1], numericValue: parts[2] ? parseInt(parts[2], 10) : null };
          });

          const matchingOption = optionsMapEntries.find(e => e.num === answerNum);
          if (!matchingOption || !matchingOption.optionId) {
            isValid = false;
            answerText = `Вариант ${answerNum} не найден`;
          } else {
            answerOptionId = matchingOption.optionId;
            answerText = `Вариант ${answerNum}`;
            resolvedNumericValue = matchingOption.numericValue;
          }
        }

        if (isValid) {
          validCount++;
        } else {
          errorCount++;
        }

        rows.push({
          questionText: String(questionText || '').substring(0, 100) + (String(questionText || '').length > 100 ? '...' : ''),
          competency: String(competency || ''),
          answerNumber: answerNum,
          answerText,
          comment: String(comment),
          questionId,
          answerOptionId,
          numericValue: resolvedNumericValue,
          questionType: questionType === 'hard' ? 'hard' : 'soft',
          isValid,
        });
      }

      return {
        assignmentId,
        evaluatedUserId,
        evaluatingUserId,
        evaluatedUserName: getFullName(evaluatedUser) || 'Неизвестный',
        evaluatingUserName: getFullName(evaluatingUser) || 'Неизвестный',
        assignmentType: assignmentType || 'unknown',
        stageId: stageIdFromFile,
        rows,
        validCount,
        errorCount,
      };
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Ошибка при чтении файла');
      return null;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const preview = await parseFileForPreview(file);
    setUploading(false);

    if (preview) {
      setPreviewData(preview);
      setShowPreview(true);
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData) return;

    setImporting(true);

    try {
      let totalImported = 0;
      let totalErrors = 0;

      for (const row of previewData.rows) {
        if (!row.isValid || !row.answerOptionId) {
          totalErrors++;
          continue;
        }

        const resultData = {
          evaluated_user_id: previewData.evaluatedUserId,
          evaluating_user_id: previewData.evaluatingUserId,
          question_id: row.questionId,
          answer_option_id: row.answerOptionId,
          raw_numeric_value: row.numericValue,
          diagnostic_stage_id: previewData.stageId,
          assignment_id: previewData.assignmentId,
          comment: row.comment || null,
          is_draft: false,
          is_skip: false,
        };

        if (row.questionType === 'hard') {
          const { error } = await supabase
            .from('hard_skill_results')
            .upsert(resultData, {
              onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
            });

          if (error) {
            console.error('Error inserting hard skill result:', error);
            totalErrors++;
          } else {
            totalImported++;
          }
        } else {
          const { error } = await supabase
            .from('soft_skill_results')
            .upsert(resultData, {
              onConflict: 'evaluated_user_id,evaluating_user_id,question_id',
            });

          if (error) {
            console.error('Error inserting soft skill result:', error);
            totalErrors++;
          } else {
            totalImported++;
          }
        }
      }

      if (totalImported > 0) {
        // Update assignment status to completed
        await supabase
          .from('survey_360_assignments')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', previewData.assignmentId);

        // Complete related task for this assignment
        await supabase
          .from('tasks')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('assignment_id', previewData.assignmentId)
          .neq('status', 'completed');

        toast.success(`Импортировано ${totalImported} ответов` + (totalErrors > 0 ? `, ${totalErrors} ошибок` : ''));
        
        // Refresh respondents list and results status
        if (selectedParticipant && stageId) {
          const { data } = await supabase
            .from('survey_360_assignments')
            .select('id, evaluated_user_id, evaluating_user_id, assignment_type, status')
            .eq('evaluated_user_id', selectedParticipant)
            .eq('diagnostic_stage_id', stageId)
            .in('status', ['approved', 'pending', 'completed']);
          setRespondents(data || []);

          // Update results status
          if (data && data.length > 0) {
            const assignmentIds = data.map(a => a.id);
            
            // Check completed results
            const { data: hardResultsCompleted } = await supabase
              .from('hard_skill_results')
              .select('assignment_id')
              .in('assignment_id', assignmentIds)
              .eq('is_draft', false);
            const { data: softResultsCompleted } = await supabase
              .from('soft_skill_results')
              .select('assignment_id')
              .in('assignment_id', assignmentIds)
              .eq('is_draft', false);

            // Check any results (including drafts)
            const { data: hardResultsAny } = await supabase
              .from('hard_skill_results')
              .select('assignment_id')
              .in('assignment_id', assignmentIds);
            const { data: softResultsAny } = await supabase
              .from('soft_skill_results')
              .select('assignment_id')
              .in('assignment_id', assignmentIds);

            const completedResults = new Set<string>();
            hardResultsCompleted?.forEach(r => r.assignment_id && completedResults.add(r.assignment_id));
            softResultsCompleted?.forEach(r => r.assignment_id && completedResults.add(r.assignment_id));
            setRespondentsWithCompletedResults(completedResults);

            const anyResults = new Set<string>();
            hardResultsAny?.forEach(r => r.assignment_id && anyResults.add(r.assignment_id));
            softResultsAny?.forEach(r => r.assignment_id && anyResults.add(r.assignment_id));
            setRespondentsWithAnyResults(anyResults);
          }
        }
      } else if (totalErrors > 0) {
        toast.error(`Ошибка импорта: ${totalErrors} ответов не удалось загрузить`);
      } else {
        toast.warning('Не найдено данных для импорта');
      }
    } catch (error) {
      console.error('Error importing results:', error);
      toast.error('Ошибка при импорте результатов');
    } finally {
      setImporting(false);
      setShowPreview(false);
      setPreviewData(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCancelImport = () => {
    setShowPreview(false);
    setPreviewData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getAssignmentTypeLabel = (type: string) => {
    switch (type) {
      case 'self': return 'Самооценка';
      case 'manager': return 'Руководитель';
      case 'peer': return 'Коллега';
      default: return type;
    }
  };

  const selectedParticipantUser = users.find(u => u.id === selectedParticipant);

  if (!stageId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Выберите этап для работы с офлайн-анкетами
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Загрузка заполненных анкет
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={uploading}
              className="max-w-sm"
            />
            {uploading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка...
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Загрузите заполненный Excel-файл. В столбце "Ваш ответ" укажите номер выбранного варианта.
          </p>
        </CardContent>
      </Card>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Panel - Participants (Evaluated Users) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Участники (оцениваемые)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по ФИО или email..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {filteredParticipants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ФИО</TableHead>
                      <TableHead>Должность</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.map((user) => (
                      <TableRow 
                        key={user.id}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedParticipant === user.id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSelectedParticipant(user.id)}
                      >
                        <TableCell className="font-medium">{getFullName(user)}</TableCell>
                        <TableCell>{user.positions?.name || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {participantSearch ? 'Нет результатов' : 'Нет участников'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Respondents for Selected Participant */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Респонденты
              {selectedParticipantUser && (
                <span className="text-sm font-normal text-muted-foreground">
                  для {getFullName(selectedParticipantUser)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedParticipant ? (
              <div className="text-center py-8 text-muted-foreground">
                Выберите участника слева
              </div>
            ) : loadingRespondents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск респондента..."
                    value={respondentSearch}
                    onChange={(e) => setRespondentSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                  {filteredRespondents.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ФИО</TableHead>
                          <TableHead>Тип</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead className="text-right">Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRespondents.map((assignment) => {
                          const respondentUser = users.find(u => u.id === assignment.evaluating_user_id);
                          const hasCompletedResults = respondentsWithCompletedResults.has(assignment.id);
                          const hasAnyResults = respondentsWithAnyResults.has(assignment.id);
                          const isCompleted = assignment.status === 'completed' || hasCompletedResults;
                          const isInProgress = !isCompleted && hasAnyResults;
                          const isNew = !isCompleted && !hasAnyResults;
                          
                          const getStatusBadge = () => {
                            if (isCompleted) return <Badge variant="success">Выполнено</Badge>;
                            if (isInProgress) return <Badge variant="warning">Выполняется</Badge>;
                            return <Badge variant="secondary">Новый</Badge>;
                          };
                          
                          const isDownloadDisabled = downloading === assignment.id || hasCompletedResults || hasAnyResults;
                          const getButtonText = () => {
                            if (hasCompletedResults) return 'Есть результаты';
                            if (hasAnyResults) return 'В процессе';
                            return 'Скачать';
                          };
                          
                          return (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">
                                {getFullName(respondentUser)}
                              </TableCell>
                              <TableCell>{getAssignmentTypeLabel(assignment.assignment_type)}</TableCell>
                              <TableCell>
                                {getStatusBadge()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant={isNew ? 'default' : 'outline'}
                                  onClick={() => downloadQuestionnaire(assignment)}
                                  disabled={isDownloadDisabled}
                                  className="gap-2"
                                >
                                  {downloading === assignment.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                  {getButtonText()}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {respondentSearch ? 'Нет результатов' : 'Нет респондентов'}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && handleCancelImport()}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Предварительный просмотр импорта
            </DialogTitle>
          </DialogHeader>

          {previewData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Оцениваемый</p>
                  <p className="font-medium">{previewData.evaluatedUserName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Респондент</p>
                  <p className="font-medium">{previewData.evaluatingUserName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Тип оценки</p>
                  <p className="font-medium">{getAssignmentTypeLabel(previewData.assignmentType)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Всего ответов</p>
                  <div className="flex gap-2">
                    <Badge variant="success">{previewData.validCount} корректных</Badge>
                    {previewData.errorCount > 0 && (
                      <Badge variant="destructive">{previewData.errorCount} ошибок</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <ScrollArea className="h-[400px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">№</TableHead>
                      <TableHead>Компетенция</TableHead>
                      <TableHead>Вопрос</TableHead>
                      <TableHead>Ответ</TableHead>
                      <TableHead>Комментарий</TableHead>
                      <TableHead className="w-10">Статус</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.map((row, idx) => (
                      <TableRow key={idx} className={!row.isValid ? 'bg-destructive/10' : ''}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="text-sm">{row.competency}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{row.questionText}</TableCell>
                        <TableCell>{row.answerText}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                          {row.comment || '—'}
                        </TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelImport} disabled={importing}>
              Отмена
            </Button>
            <Button 
              onClick={handleConfirmImport} 
              disabled={importing || !previewData || previewData.validCount === 0}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Импорт...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Импортировать {previewData?.validCount} ответов
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
