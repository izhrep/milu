import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type RespondentScope = 'all' | 'external_only';

export interface SkillMetrics {
  skill_id: string;
  skill_name: string;
  skill_description?: string;
  category?: string;
  subcategory?: string;
  zone: 'arena' | 'blind_spot' | 'hidden_strength' | 'unknown';
  self_avg: number | null;
  manager_avg: number | null;
  peers_avg: number | null;
  others_avg: number | null;
  delta: number;
  signed_delta: number;
  others_raters_cnt: number;
  grey_zone: boolean;
  is_polarized: boolean;
  is_contradictory: boolean;
  confidence_tier: 'insufficient' | 'preliminary' | 'confident';
  manager_scores: number[];
  peer_scores: number[];
  external_scores: number[];
  others_individual_scores: number[];
}

export interface ExcludedSkill {
  skill_id: string;
  skill_name: string;
  reason: string;
}

export interface JohariMetrics {
  scale_min: number;
  scale_max: number;
  t_arena: number;
  t_hi: number;
  skills: SkillMetrics[];
  excluded_skills: ExcludedSkill[];
  generated_at: string;
  total_others_raters_cnt?: number;
}

// === Comments Classification Types ===

export interface ReassignmentSuggestion {
  suggested_skill_name: string;
  suggested_zone: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ClassifiedComment {
  comment_id: string;
  comment_text: string;
  source_skill_name: string;
  reassignment_suggestion: ReassignmentSuggestion | null;
  hidden?: boolean;
  override_skill?: string;
  override_zone?: string;
}

export interface ZoneSkillComments {
  skill_name: string;
  comments: ClassifiedComment[];
}

export interface ZoneCommentGroup {
  zone: 'arena' | 'blind_spot' | 'hidden_strength' | 'unknown' | 'grey';
  zone_summary: string;
  skills: ZoneSkillComments[];
}

export interface OutOfMatrixComment {
  comment_id: string;
  comment_text: string;
  source_skill_name: string;
  inferred_topic: string;
  suggested_skill_theme: string;
}

export interface GratitudeComment {
  comment_id: string;
  comment_text: string;
  source_skill_name: string;
  reason: string;
}

export interface ProblemComment {
  comment_id: string;
  comment_text: string;
  source_skill_name: string;
  reason: string;
}

export interface CommentsClassification {
  zone_comment_groups: ZoneCommentGroup[];
  out_of_matrix_comments: OutOfMatrixComment[];
  gratitude_comments: GratitudeComment[];
  problem_comments: ProblemComment[];
  notes: { comments_used: number };
}

export interface JohariSnapshot {
  id: string;
  stage_id: string;
  evaluated_user_id: string;
  version: number;
  created_at: string;
  created_by: string | null;
  metrics_json: JohariMetrics;
  ai_text: string | null;
  data_hash: string;
  prompt_version: string | null;
  model: string | null;
  is_reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  respondent_scope?: RespondentScope;
  comments_classification?: CommentsClassification | null;
}

interface UseJohariReportResult {
  snapshot: JohariSnapshot | null;
  loading: boolean;
  error: string | null;
  dataChanged: boolean;
  insufficientData: boolean;
  insufficientDataMessage: string | null;
  excludedSkills: ExcludedSkill[];
  currentScope: RespondentScope;
  fetchReport: (stageId: string, evaluatedUserId: string, scope?: RespondentScope) => Promise<void>;
  regenerateReport: (stageId: string, evaluatedUserId: string, scope?: RespondentScope) => Promise<void>;
  reviewSnapshot: (snapshotId: string) => Promise<void>;
  isReviewing: boolean;
}

export function useJohariReport(): UseJohariReportResult {
  const [snapshot, setSnapshot] = useState<JohariSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataChanged, setDataChanged] = useState(false);
  const [insufficientData, setInsufficientData] = useState(false);
  const [insufficientDataMessage, setInsufficientDataMessage] = useState<string | null>(null);
  const [excludedSkills, setExcludedSkills] = useState<ExcludedSkill[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [currentScope, setCurrentScope] = useState<RespondentScope>('all');

  const parseSnapshot = (snapshotData: any): JohariSnapshot => ({
    ...snapshotData,
    metrics_json: typeof snapshotData.metrics_json === 'string' 
      ? JSON.parse(snapshotData.metrics_json) 
      : snapshotData.metrics_json
  });

  const fetchReport = useCallback(async (stageId: string, evaluatedUserId: string, scope: RespondentScope = 'all') => {
    setLoading(true);
    setError(null);
    setDataChanged(false);
    setInsufficientData(false);
    setInsufficientDataMessage(null);
    setExcludedSkills([]);
    setCurrentScope(scope);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-johari-report', {
        body: { 
          stage_id: stageId, 
          evaluated_user_id: evaluatedUserId,
          force_regenerate: false,
          respondent_scope: scope
        }
      });

      if (invokeError) throw invokeError;

      if (data.error === 'insufficient_data') {
        setInsufficientData(true);
        setInsufficientDataMessage(data.message);
        setExcludedSkills(data.excluded_skills || []);
        setSnapshot(null);
        return;
      }

      if (data.error) throw new Error(data.error);

      const parsedSnapshot = parseSnapshot(data.snapshot);
      setSnapshot(parsedSnapshot);
      setDataChanged(data.data_changed || false);
      setExcludedSkills(parsedSnapshot.metrics_json.excluded_skills || []);
    } catch (err) {
      console.error('Error fetching Johari report:', err);
      const message = err instanceof Error ? err.message : 'Ошибка загрузки отчёта';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const regenerateReport = useCallback(async (stageId: string, evaluatedUserId: string, scope: RespondentScope = 'all') => {
    setLoading(true);
    setError(null);
    setCurrentScope(scope);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-johari-report', {
        body: { 
          stage_id: stageId, 
          evaluated_user_id: evaluatedUserId,
          force_regenerate: true,
          respondent_scope: scope
        }
      });

      if (invokeError) throw invokeError;

      if (data.error === 'insufficient_data') {
        setInsufficientData(true);
        setInsufficientDataMessage(data.message);
        setExcludedSkills(data.excluded_skills || []);
        setSnapshot(null);
        return;
      }

      if (data.error) throw new Error(data.error);

      const parsedSnapshot = parseSnapshot(data.snapshot);
      setSnapshot(parsedSnapshot);
      setDataChanged(false);
      setExcludedSkills(parsedSnapshot.metrics_json.excluded_skills || []);
      toast.success('Отчёт успешно обновлён');
    } catch (err) {
      console.error('Error regenerating Johari report:', err);
      const message = err instanceof Error ? err.message : 'Ошибка обновления отчёта';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reviewSnapshot = useCallback(async (snapshotId: string) => {
    setIsReviewing(true);
    
    try {
      const { error: rpcError } = await supabase.rpc('review_johari_snapshot', {
        p_snapshot_id: snapshotId
      });

      if (rpcError) throw rpcError;

      if (snapshot && snapshot.id === snapshotId) {
        setSnapshot({
          ...snapshot,
          is_reviewed: true,
          reviewed_at: new Date().toISOString()
        });
      }

      toast.success('Отчёт утверждён');
    } catch (err) {
      console.error('Error reviewing snapshot:', err);
      const message = err instanceof Error ? err.message : 'Ошибка утверждения отчёта';
      toast.error(message);
    } finally {
      setIsReviewing(false);
    }
  }, [snapshot]);

  return {
    snapshot,
    loading,
    error,
    dataChanged,
    insufficientData,
    insufficientDataMessage,
    excludedSkills,
    currentScope,
    fetchReport,
    regenerateReport,
    reviewSnapshot,
    isReviewing
  };
}
