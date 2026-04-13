import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { isNotObserved } from '@/lib/diagnosticResultContract';
import { loadCyrillicFont } from '@/lib/pdfFontLoader';

interface RawScore {
  evaluating_user_id: string;
  evaluated_user_id: string;
  numeric_value: number;
  assignment_type?: string;
}

interface AggregatedRow {
  name: string;
  self: number | null;
  peers: number | null;
  manager: number | null;
  overall: number | null;
}

function aggregateScores(scores: RawScore[], evaluatedUserId: string) {
  const selfScores: number[] = [];
  const managerScores: number[] = [];
  const peerScores: number[] = [];

  scores.forEach(s => {
    if (isNotObserved(s.numeric_value)) return;
    const isSelf = s.evaluating_user_id === evaluatedUserId || s.assignment_type === 'self';
    const isManager = s.assignment_type === 'manager';
    if (isSelf) selfScores.push(s.numeric_value);
    else if (isManager) managerScores.push(s.numeric_value);
    else peerScores.push(s.numeric_value);
  });

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const all = [...selfScores, ...managerScores, ...peerScores];

  return {
    self: avg(selfScores),
    peers: avg(peerScores),
    manager: avg(managerScores),
    overall: avg(all),
  };
}

function fmt(v: number | null): string {
  return v !== null ? v.toFixed(2) : '—';
}

interface UseMeeting360AttachmentOptions {
  meetingId: string;
  employeeId: string;
  meetingStatus: string;
  isHistorical: boolean;
}

export function useMeeting360Attachment({ meetingId, employeeId, meetingStatus, isHistorical }: UseMeeting360AttachmentOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission: hasMeetingsManage } = usePermission('meetings.manage');

  // Query existing 360 artifact
  const { data: existingArtifact, isLoading } = useQuery({
    queryKey: ['meeting-360-artifact', meetingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('meeting_artifacts')
        .select('*')
        .eq('meeting_id', meetingId)
        .eq('source_type', '360_snapshot')
        .eq('is_deleted', false)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
    enabled: !!meetingId,
  });

  const canAttach = hasMeetingsManage && meetingStatus !== 'approved' && !isHistorical;

  // Get signed URL for viewing
  const getSignedUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('meeting-artifacts')
      .createSignedUrl(storagePath, 300);
    if (error) {
      toast({ title: 'Ошибка получения ссылки', description: error.message, variant: 'destructive' });
      return null;
    }
    return data.signedUrl;
  }, []);

  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Не авторизован');

      // 1. Find latest diagnostic stage for employee
      const { data: participations, error: partErr } = await supabase
        .from('diagnostic_stage_participants')
        .select('stage_id, diagnostic_stages!diagnostic_stage_participants_stage_id_fkey(id, created_at, evaluation_period)')
        .eq('user_id', employeeId)
        .order('created_at', { ascending: false, referencedTable: 'diagnostic_stages' });

      if (partErr) throw partErr;
      if (!participations || participations.length === 0) {
        throw new Error('У сотрудника нет диагностик 360');
      }

      const sorted = participations
        .filter((p: any) => p.diagnostic_stages)
        .sort((a: any, b: any) => new Date(b.diagnostic_stages.created_at).getTime() - new Date(a.diagnostic_stages.created_at).getTime());

      if (sorted.length === 0) throw new Error('У сотрудника нет диагностик 360');

      const latestStage = (sorted[0] as any).diagnostic_stages;
      const stageId = latestStage.id;

      // 2. Get employee info
      const { data: empData } = await supabase
        .from('users')
        .select('first_name, last_name, grade_id')
        .eq('id', employeeId)
        .single();

      const employeeName = empData ? `${empData.last_name || ''} ${empData.first_name || ''}`.trim() : 'Сотрудник';
      const gradeId = empData?.grade_id;

      // 3. Fetch hard skill results
      let hardRows: AggregatedRow[] = [];
      if (gradeId) {
        const { data: gradeSkills } = await supabase
          .from('grade_skills')
          .select('skill_id, hard_skills(id, name)')
          .eq('grade_id', gradeId);

        if (gradeSkills && gradeSkills.length > 0) {
          const skillIds = gradeSkills.map((gs: any) => gs.hard_skills.id);

          const { data: hardResults } = await supabase
            .from('hard_skill_results')
            .select(`
              evaluated_user_id, evaluating_user_id, assignment_id,
              hard_skill_questions!inner(skill_id),
              hard_skill_answer_options(numeric_value)
            `)
            .eq('evaluated_user_id', employeeId)
            .eq('diagnostic_stage_id', stageId)
            .eq('is_draft', false)
            .or('is_skip.is.null,is_skip.eq.false')
            .in('hard_skill_questions.skill_id', skillIds);

          const assignmentIds = [...new Set((hardResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
          const assignmentsMap = new Map<string, string>();
          if (assignmentIds.length > 0) {
            const { data: assignments } = await supabase
              .from('survey_360_assignments')
              .select('id, assignment_type')
              .in('id', assignmentIds);
            (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
          }

          for (const gs of gradeSkills) {
            const skill = (gs as any).hard_skills;
            const scores: RawScore[] = (hardResults || [])
              .filter((r: any) => r.hard_skill_questions?.skill_id === skill.id)
              .map((r: any) => ({
                evaluating_user_id: r.evaluating_user_id,
                evaluated_user_id: r.evaluated_user_id,
                numeric_value: (r as any).raw_numeric_value ?? r.hard_skill_answer_options?.numeric_value ?? 0,
                assignment_type: r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined,
              }));

            if (scores.length > 0) {
              const agg = aggregateScores(scores, employeeId);
              hardRows.push({ name: skill.name, ...agg });
            }
          }
        }
      }

      // 4. Fetch soft skill results
      let softRows: AggregatedRow[] = [];
      if (gradeId) {
        const { data: gradeQualities } = await supabase
          .from('grade_qualities')
          .select('quality_id, soft_skills(id, name)')
          .eq('grade_id', gradeId);

        if (gradeQualities && gradeQualities.length > 0) {
          const qualityIds = gradeQualities.map((gq: any) => gq.soft_skills.id);

          const { data: softResults } = await supabase
            .from('soft_skill_results')
            .select(`
              evaluated_user_id, evaluating_user_id, assignment_id,
              soft_skill_questions!inner(quality_id),
              soft_skill_answer_options(numeric_value)
            `)
            .eq('evaluated_user_id', employeeId)
            .eq('diagnostic_stage_id', stageId)
            .eq('is_draft', false)
            .or('is_skip.is.null,is_skip.eq.false')
            .in('soft_skill_questions.quality_id', qualityIds);

          const assignmentIds = [...new Set((softResults || []).map((r: any) => r.assignment_id).filter(Boolean))];
          const assignmentsMap = new Map<string, string>();
          if (assignmentIds.length > 0) {
            const { data: assignments } = await supabase
              .from('survey_360_assignments')
              .select('id, assignment_type')
              .in('id', assignmentIds);
            (assignments || []).forEach((a: any) => assignmentsMap.set(a.id, a.assignment_type));
          }

          for (const gq of gradeQualities) {
            const quality = (gq as any).soft_skills;
            const scores: RawScore[] = (softResults || [])
              .filter((r: any) => r.soft_skill_questions?.quality_id === quality.id)
              .map((r: any) => ({
                evaluating_user_id: r.evaluating_user_id,
                evaluated_user_id: r.evaluated_user_id,
                numeric_value: (r as any).raw_numeric_value ?? r.soft_skill_answer_options?.numeric_value ?? 0,
                assignment_type: r.assignment_id ? assignmentsMap.get(r.assignment_id) : undefined,
              }));

            if (scores.length > 0) {
              const agg = aggregateScores(scores, employeeId);
              softRows.push({ name: quality.name, ...agg });
            }
          }
        }
      }

      if (hardRows.length === 0 && softRows.length === 0) {
        throw new Error('В последней диагностике нет финальных данных');
      }

      // 5. Generate PDF with Cyrillic font
      const doc = new jsPDF();
      await loadCyrillicFont(doc);

      const now = new Date();
      const timestamp = now.toLocaleString('ru-RU');

      doc.setFontSize(14);
      doc.text(`Результаты ОС 360 \u2014 ${employeeName}`, 14, 20);

      doc.setFontSize(10);
      doc.text(`Период: ${latestStage.evaluation_period || '\u2014'}`, 14, 28);
      doc.text(`Сформировано: ${timestamp}`, 14, 34);

      let yPos = 42;

      const tableFont = { font: 'Roboto' as const };

      if (hardRows.length > 0) {
        doc.setFontSize(12);
        doc.text('Hard Skills (Навыки)', 14, yPos);
        yPos += 4;

        autoTable(doc, {
          startY: yPos,
          head: [['Навык', 'Самооценка', 'Коллеги', 'Unit-лид', 'Общая']],
          body: hardRows.map(r => [r.name, fmt(r.self), fmt(r.peers), fmt(r.manager), fmt(r.overall)]),
          styles: { fontSize: 9, font: 'Roboto' },
          headStyles: { fillColor: [66, 66, 66], font: 'Roboto' },
        });

        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (softRows.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(12);
        doc.text('Soft Skills (Качества)', 14, yPos);
        yPos += 4;

        autoTable(doc, {
          startY: yPos,
          head: [['Качество', 'Самооценка', 'Коллеги', 'Unit-лид', 'Общая']],
          body: softRows.map(r => [r.name, fmt(r.self), fmt(r.peers), fmt(r.manager), fmt(r.overall)]),
          styles: { fontSize: 9, font: 'Roboto' },
          headStyles: { fillColor: [66, 66, 66], font: 'Roboto' },
        });
      }

      const pdfBlob = doc.output('blob');

      // 6. Soft-delete previous 360 artifact if exists
      if (existingArtifact) {
        await (supabase as any)
          .from('meeting_artifacts')
          .update({ is_deleted: true })
          .eq('id', existingArtifact.id);

        await supabase.storage.from('meeting-artifacts').remove([existingArtifact.storage_path]).catch(() => {});
      }

      // 7. Upload PDF
      const fileId = crypto.randomUUID();
      const safeName = employeeName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_') || 'employee';
      const fileName = `360_snapshot_${safeName}_${now.toISOString().slice(0, 10)}.pdf`;
      const storagePath = `${meetingId}/${fileId}.pdf`;

      const { error: storageError } = await supabase.storage
        .from('meeting-artifacts')
        .upload(storagePath, pdfBlob, { contentType: 'application/pdf' });

      if (storageError) throw storageError;

      // 8. Insert artifact record
      const { error: dbError } = await (supabase as any)
        .from('meeting_artifacts')
        .insert({
          meeting_id: meetingId,
          file_name: fileName,
          storage_path: storagePath,
          mime_type: 'application/pdf',
          file_size: pdfBlob.size,
          uploaded_by: user.id,
          source_type: '360_snapshot',
          source_stage_id: stageId,
        });

      if (dbError) {
        await supabase.storage.from('meeting-artifacts').remove([storagePath]);
        throw dbError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-360-artifact', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meeting-artifacts', meetingId] });
      toast({ title: 'Данные ОС 360 прикреплены' });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  return {
    existingArtifact,
    isLoading,
    canAttach,
    attach: attachMutation.mutate,
    isAttaching: attachMutation.isPending,
    getSignedUrl,
  };
}
