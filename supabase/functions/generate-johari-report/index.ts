import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, badRequest, unauthorized, serverError } from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT_VERSION = "4.0.0";
const AI_MODEL = "google/gemini-2.5-flash";

interface SkillMetrics {
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

interface ExcludedSkill {
  skill_id: string;
  skill_name: string;
  reason: string;
}

interface JohariMetrics {
  scale_min: number;
  scale_max: number;
  t_arena: number;
  t_hi: number;
  skills: SkillMetrics[];
  excluded_skills: ExcludedSkill[];
  generated_at: string;
  total_others_raters_cnt: number;
}

type RespondentScope = 'all' | 'external_only';

async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Snapshot context loading ──
interface SnapshotContext {
  diagnosticId: string;
  questionToSkillMap: Map<string, string>; // question entity_id → skill entity_id
  skillMetaMap: Map<string, { name: string; description?: string; category?: string; subcategory?: string }>;
  assignmentTypeMap: Map<string, string>; // assignment entity_id → assignment_type
  externalPeerIds: Set<string>; // evaluating_user_ids that are external
}

async function loadSnapshotContext(
  supabaseAdmin: any,
  stageId: string,
  evaluatedUserId: string
): Promise<SnapshotContext | null> {
  // Check if a current snapshot exists
  const { data: snapshotHeader } = await supabaseAdmin
    .from('diagnostic_result_snapshots')
    .select('id')
    .eq('stage_id', stageId)
    .eq('evaluated_user_id', evaluatedUserId)
    .eq('is_current', true)
    .maybeSingle();

  if (!snapshotHeader) return null;

  const diagnosticId = snapshotHeader.id;

  // Load all snapshot data in parallel
  const [questionsRes, skillsRes, assignmentsRes] = await Promise.all([
    supabaseAdmin
      .from('soft_skill_question_snapshots')
      .select('entity_id, quality_id')
      .eq('diagnostic_id', diagnosticId),
    supabaseAdmin
      .from('soft_skill_snapshots')
      .select('entity_id, name, description, category_name, subcategory_name')
      .eq('diagnostic_id', diagnosticId),
    supabaseAdmin
      .from('survey_assignment_snapshots')
      .select('entity_id, assignment_type, evaluating_user_id, evaluator_position_category_name')
      .eq('diagnostic_id', diagnosticId),
  ]);

  const questionToSkillMap = new Map<string, string>();
  for (const q of (questionsRes.data || [])) {
    if (q.quality_id) {
      questionToSkillMap.set(q.entity_id, q.quality_id);
    }
  }

  const skillMetaMap = new Map<string, { name: string; description?: string; category?: string; subcategory?: string }>();
  for (const s of (skillsRes.data || [])) {
    skillMetaMap.set(s.entity_id, {
      name: s.name,
      description: s.description || undefined,
      category: s.category_name || undefined,
      subcategory: s.subcategory_name || undefined,
    });
  }

  const assignmentTypeMap = new Map<string, string>();
  const externalPeerIds = new Set<string>();
  for (const a of (assignmentsRes.data || [])) {
    if (a.assignment_type) {
      assignmentTypeMap.set(a.entity_id, a.assignment_type);
    }
    // Detect external peers from snapshot
    if (a.assignment_type === 'peer' && a.evaluating_user_id && a.evaluator_position_category_name) {
      if (a.evaluator_position_category_name.toLowerCase().includes('(внешний)')) {
        externalPeerIds.add(a.evaluating_user_id);
      }
    }
  }

  return { diagnosticId, questionToSkillMap, skillMetaMap, assignmentTypeMap, externalPeerIds };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { stage_id, evaluated_user_id, force_regenerate = false, respondent_scope = 'all' } = await req.json();
    
    if (!isUUID(stage_id)) {
      console.error("Invalid stage_id format");
      return badRequest("Invalid input");
    }
    if (!isUUID(evaluated_user_id)) {
      console.error("Invalid evaluated_user_id format");
      return badRequest("Invalid input");
    }

    const scope: RespondentScope = respondent_scope === 'external_only' ? 'external_only' : 'all';

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user: currentUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !currentUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission checks
    const { data: hasViewAll, error: permError1 } = await supabaseUser.rpc('has_permission', {
      _permission_name: 'assessment_results.view_all'
    });
    const { data: hasViewTeam, error: permError2 } = await supabaseUser.rpc('has_permission', {
      _permission_name: 'assessment_results.view_team'
    });

    console.log('Permission check results:', { hasViewAll, hasViewTeam, permError1, permError2 });

    const { data: evaluatedUser } = await supabaseAdmin
      .from('users')
      .select('manager_id')
      .eq('id', evaluated_user_id)
      .single();

    const isManager = evaluatedUser?.manager_id === currentUser.id;
    const hasPermission = hasViewAll || hasViewTeam || isManager;
    
    console.log('Access check:', { hasViewAll, hasViewTeam, isManager, hasPermission, currentUserId: currentUser.id, evaluatedManagerId: evaluatedUser?.manager_id });
    
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating Johari report for stage=${stage_id}, user=${evaluated_user_id}, force=${force_regenerate}, scope=${scope}`);

    // ── Load snapshot context (null if no snapshot exists = live mode) ──
    const snapshotCtx = await loadSnapshotContext(supabaseAdmin, stage_id, evaluated_user_id);
    const isHistorical = snapshotCtx !== null;
    console.log(`Data mode: ${isHistorical ? 'SNAPSHOT (historical)' : 'LIVE'}`);

    // ── 1. Get results ──
    let rawResults: any[];

    if (isHistorical) {
      // Historical mode: read results without JOINs, use raw_numeric_value
      const { data, error: resultsError } = await supabaseAdmin
        .from('soft_skill_results')
        .select('id, evaluating_user_id, question_id, assignment_id, comment, raw_numeric_value, is_skip')
        .eq('diagnostic_stage_id', stage_id)
        .eq('evaluated_user_id', evaluated_user_id)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false');

      if (resultsError) {
        console.error('Error fetching results (historical):', resultsError);
        throw resultsError;
      }
      rawResults = data || [];
    } else {
      // Live mode: use JOINs to reference tables
      const { data, error: resultsError } = await supabaseAdmin
        .from('soft_skill_results')
        .select(`
          id,
          evaluating_user_id,
          question_id,
          answer_option_id,
          assignment_id,
          comment,
          raw_numeric_value,
          is_skip,
          soft_skill_answer_options!inner(numeric_value),
          soft_skill_questions!inner(quality_id, soft_skills!fk_survey_360_questions_soft_skill(id, name, description, category_id, sub_category_id, category_soft_skills(name), sub_category_soft_skills(name)))
        `)
        .eq('diagnostic_stage_id', stage_id)
        .eq('evaluated_user_id', evaluated_user_id)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false');

      if (resultsError) {
        console.error('Error fetching results (live):', resultsError);
        throw resultsError;
      }
      rawResults = data || [];
    }

    if (!rawResults || rawResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'insufficient_data',
          message: 'Недостаточно данных для построения отчёта. Нет финальных ответов по soft skills для данного этапа.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Build assignment type map & external peer IDs ──
    let assignmentTypeMap: Map<string, string>;
    let externalPeerIds: Set<string>;

    if (isHistorical) {
      assignmentTypeMap = snapshotCtx!.assignmentTypeMap;
      externalPeerIds = snapshotCtx!.externalPeerIds;
      console.log(`Historical: ${assignmentTypeMap.size} assignments from snapshot, ${externalPeerIds.size} external peers`);
    } else {
      // Live: fetch from live tables
      const assignmentIds = [...new Set(rawResults.filter(r => r.assignment_id).map(r => r.assignment_id))];
      const { data: assignments } = await supabaseAdmin
        .from('survey_360_assignments')
        .select('id, assignment_type, evaluating_user_id')
        .in('id', assignmentIds);

      assignmentTypeMap = new Map(assignments?.map((a: any) => [a.id, a.assignment_type]) || []);

      // Detect external peers from live tables
      const peerEvaluatorIds = [...new Set(
        (assignments || [])
          .filter((a: any) => a.assignment_type === 'peer')
          .map((a: any) => a.evaluating_user_id)
          .filter(Boolean)
      )];

      externalPeerIds = new Set<string>();
      if (peerEvaluatorIds.length > 0) {
        const { data: evaluatorUsers } = await supabaseAdmin
          .from('users')
          .select('id, position_id')
          .in('id', peerEvaluatorIds);

        const positionIds = [...new Set((evaluatorUsers || []).map((u: any) => u.position_id).filter(Boolean))];
        
        if (positionIds.length > 0) {
          const { data: positions } = await supabaseAdmin
            .from('positions')
            .select('id, position_category_id')
            .in('id', positionIds);

          const categoryIds = [...new Set((positions || []).map((p: any) => p.position_category_id).filter(Boolean))];
          
          if (categoryIds.length > 0) {
            const { data: categories } = await supabaseAdmin
              .from('position_categories')
              .select('id, name')
              .in('id', categoryIds);

            const externalCategoryIds = new Set(
              (categories || []).filter((c: any) => c.name && c.name.toLowerCase().includes('(внешний)')).map((c: any) => c.id)
            );

            const positionToCategoryMap = new Map((positions || []).map((p: any) => [p.id, p.position_category_id]));
            const userToPositionMap = new Map((evaluatorUsers || []).map((u: any) => [u.id, u.position_id]));

            for (const userId of peerEvaluatorIds) {
              const posId = userToPositionMap.get(userId);
              if (posId) {
                const catId = positionToCategoryMap.get(posId);
                if (catId && externalCategoryIds.has(catId)) {
                  externalPeerIds.add(userId);
                }
              }
            }
          }
        }
      }
    }

    console.log(`External peer evaluators: ${externalPeerIds.size}`);

    // ── 3. Calculate scale from frozen_config ──
    const { data: stageData } = await supabaseAdmin
      .from('diagnostic_stages')
      .select('frozen_config')
      .eq('id', stage_id)
      .single();

    const frozenConfig = (stageData as any)?.frozen_config;
    const hasJohariRules = frozenConfig?.johari_rules && frozenConfig.johari_rules.open_delta_pct !== undefined;
    const softScaleReversed = frozenConfig?.soft_scale_reversed ?? false;

    let scaleMin: number;
    let scaleMax: number;

    if (frozenConfig && frozenConfig.soft_scale_min !== undefined) {
      scaleMin = frozenConfig.soft_scale_min;
      scaleMax = frozenConfig.soft_scale_max;
      console.log(`Using frozen_config scale: ${scaleMin}–${scaleMax}, reversed: ${softScaleReversed}`);
    } else {
      const { data: scaleData } = await supabaseAdmin
        .from('soft_skill_answer_options')
        .select('numeric_value');

      const numericValues = scaleData?.map((s: any) => s.numeric_value) || [0, 1, 2, 3, 4, 5];
      scaleMin = Math.min(...numericValues);
      scaleMax = Math.max(...numericValues);
      console.log(`Using legacy answer options scale: ${scaleMin}–${scaleMax}`);
    }

    const scaleRange = scaleMax - scaleMin;

    // Zone thresholds
    let OPEN_DELTA_PCT: number;
    let BLIND_HIDDEN_DELTA_PCT: number;

    if (hasJohariRules) {
      OPEN_DELTA_PCT = frozenConfig.johari_rules.open_delta_pct;
      BLIND_HIDDEN_DELTA_PCT = frozenConfig.johari_rules.blind_hidden_delta_pct;
      console.log(`Using frozen johari_rules: open=${OPEN_DELTA_PCT}, bh=${BLIND_HIDDEN_DELTA_PCT}`);
    } else {
      OPEN_DELTA_PCT = 0.20;
      BLIND_HIDDEN_DELTA_PCT = 0.25;
      console.log('Using legacy hardcoded thresholds (no frozen johari_rules)');
    }

    const tArena = OPEN_DELTA_PCT * scaleRange;
    const tHi = BLIND_HIDDEN_DELTA_PCT * scaleRange;

    const NOT_OBSERVED_VALUE = 0;
    const CONFIDENT_MIN = 5;
    const PRELIMINARY_MIN = 3;

    function getConfidenceTier(cnt: number): 'insufficient' | 'preliminary' | 'confident' {
      if (cnt >= CONFIDENT_MIN) return 'confident';
      if (cnt >= PRELIMINARY_MIN) return 'preliminary';
      return 'insufficient';
    }

    const lowerBucketThreshold = scaleMin + scaleRange * 0.33;
    const upperBucketThreshold = scaleMax - scaleRange * 0.33;

    // ── 4. Group results by skill ──
    type SkillGroup = {
      skillName: string;
      skillDescription?: string;
      category?: string;
      subcategory?: string;
      selfScores: number[];
      managerScores: Map<string, number[]>;
      peerScores: Map<string, number[]>;
      externalPeerScores: Map<string, number[]>;
      internalPeerScores: Map<string, number[]>;
    };

    const skillGroups = new Map<string, SkillGroup>();

    for (const result of rawResults) {
      let skillId: string;
      let skillName: string;
      let skillDescription: string | undefined;
      let categoryName: string | undefined;
      let subcategoryName: string | undefined;
      let numericValue: number | null;

      if (isHistorical) {
        // Historical: resolve from snapshot maps
        skillId = snapshotCtx!.questionToSkillMap.get(result.question_id) || '';
        if (!skillId) continue;
        
        const skillMeta = snapshotCtx!.skillMetaMap.get(skillId);
        if (!skillMeta) continue;
        
        skillName = skillMeta.name;
        skillDescription = skillMeta.description;
        categoryName = skillMeta.category;
        subcategoryName = skillMeta.subcategory;
        numericValue = result.raw_numeric_value;
      } else {
        // Live: resolve from JOINed data
        const softSkill = (result.soft_skill_questions as any)?.soft_skills;
        if (!softSkill?.id) continue;
        
        skillId = softSkill.id;
        skillName = softSkill.name;
        skillDescription = softSkill.description || undefined;
        categoryName = softSkill.category_soft_skills?.name;
        subcategoryName = softSkill.sub_category_soft_skills?.name;
        numericValue = (result.soft_skill_answer_options as any)?.numeric_value ?? result.raw_numeric_value;
      }

      if (numericValue === null || numericValue === undefined) continue;

      // Apply reverse if needed
      if (softScaleReversed) {
        numericValue = scaleMax + scaleMin - numericValue;
      }

      // Determine assignment type
      let assignmentType = 'peer';
      if (result.evaluating_user_id === evaluated_user_id) {
        assignmentType = 'self';
      } else if (result.assignment_id) {
        assignmentType = assignmentTypeMap.get(result.assignment_id) || 'peer';
      }

      if (!skillGroups.has(skillId)) {
        skillGroups.set(skillId, {
          skillName,
          skillDescription,
          category: categoryName,
          subcategory: subcategoryName,
          selfScores: [],
          managerScores: new Map(),
          peerScores: new Map(),
          externalPeerScores: new Map(),
          internalPeerScores: new Map()
        });
      }

      const group = skillGroups.get(skillId)!;

      if (assignmentType === 'self') {
        group.selfScores.push(numericValue);
      } else if (assignmentType === 'manager') {
        const evaluatorId = result.evaluating_user_id!;
        if (!group.managerScores.has(evaluatorId)) group.managerScores.set(evaluatorId, []);
        group.managerScores.get(evaluatorId)!.push(numericValue);
      } else {
        const evaluatorId = result.evaluating_user_id!;
        if (!group.peerScores.has(evaluatorId)) group.peerScores.set(evaluatorId, []);
        group.peerScores.get(evaluatorId)!.push(numericValue);
        
        if (externalPeerIds.has(evaluatorId)) {
          if (!group.externalPeerScores.has(evaluatorId)) group.externalPeerScores.set(evaluatorId, []);
          group.externalPeerScores.get(evaluatorId)!.push(numericValue);
        } else {
          if (!group.internalPeerScores.has(evaluatorId)) group.internalPeerScores.set(evaluatorId, []);
          group.internalPeerScores.get(evaluatorId)!.push(numericValue);
        }
      }
    }

    // Helpers
    function avgExcludingZeros(scores: number[]): number | null {
      const nonZero = scores.filter(s => s !== NOT_OBSERVED_VALUE);
      if (nonZero.length === 0) return null;
      return nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    }

    function flattenEvaluatorScores(evalMap: Map<string, number[]>): number[] {
      const result: number[] = [];
      for (const scores of evalMap.values()) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        result.push(avg);
      }
      return result;
    }

    function flattenEvaluatorAvgsNoZero(evalMap: Map<string, number[]>): number[] {
      const result: number[] = [];
      for (const scores of evalMap.values()) {
        const nonZero = scores.filter(s => s !== NOT_OBSERVED_VALUE);
        if (nonZero.length > 0) {
          result.push(nonZero.reduce((a, b) => a + b, 0) / nonZero.length);
        }
      }
      return result;
    }

    // ── 5. Calculate metrics per skill ──
    const skills: SkillMetrics[] = [];
    const excludedSkills: ExcludedSkill[] = [];

    for (const [skillId, group] of skillGroups) {
      if (scope === 'external_only') {
        const nonZeroExternalRaters = flattenEvaluatorAvgsNoZero(group.externalPeerScores).length;
        const externalRatersCnt = group.externalPeerScores.size;
        const confidenceTier = getConfidenceTier(nonZeroExternalRaters);

        if (externalRatersCnt === 0) {
          excludedSkills.push({ skill_id: skillId, skill_name: group.skillName, reason: `Нет внешних респондентов` });
          continue;
        }

        const selfAvg = avgExcludingZeros(group.selfScores);
        const externalAvgsNoZero = flattenEvaluatorAvgsNoZero(group.externalPeerScores);
        const externalAvg = externalAvgsNoZero.length > 0
          ? externalAvgsNoZero.reduce((a, b) => a + b, 0) / externalAvgsNoZero.length
          : null;

        const externalRawScores = flattenEvaluatorScores(group.externalPeerScores);
        const signedDelta = (selfAvg !== null && externalAvg !== null) ? selfAvg - externalAvg : 0;
        const delta = Math.abs(signedDelta);

        let zone: SkillMetrics['zone'] = 'unknown';
        let greyZone = false;

        if (confidenceTier === 'insufficient') {
          zone = 'unknown';
        } else if (selfAvg === null || externalAvg === null) {
          zone = 'unknown';
        } else if (delta <= tArena) {
          zone = 'arena';
        } else if (delta <= tHi) {
          zone = 'arena';
          greyZone = true;
        } else {
          zone = signedDelta > 0 ? 'blind_spot' : 'hidden_strength';
        }

        let isContradictory = false;
        if (nonZeroExternalRaters >= 3) {
          const hasLower = externalRawScores.some(s => s <= lowerBucketThreshold);
          const hasUpper = externalRawScores.some(s => s >= upperBucketThreshold);
          isContradictory = hasLower && hasUpper;
        }

        skills.push({
          skill_id: skillId,
          skill_name: group.skillName,
          skill_description: group.skillDescription,
          category: group.category,
          subcategory: group.subcategory,
          zone,
          self_avg: selfAvg !== null ? Math.round(selfAvg * 100) / 100 : null,
          manager_avg: null,
          peers_avg: externalAvg !== null ? Math.round(externalAvg * 100) / 100 : null,
          others_avg: externalAvg !== null ? Math.round(externalAvg * 100) / 100 : null,
          delta: Math.round(delta * 100) / 100,
          signed_delta: Math.round(signedDelta * 100) / 100,
          others_raters_cnt: externalRatersCnt,
          grey_zone: greyZone,
          is_polarized: isContradictory,
          is_contradictory: isContradictory,
          confidence_tier: confidenceTier,
          manager_scores: [],
          peer_scores: [],
          external_scores: externalRawScores,
          others_individual_scores: externalRawScores,
        });
      } else {
        // scope === 'all'
        const nonZeroManagerRaters = flattenEvaluatorAvgsNoZero(group.managerScores).length;
        const nonZeroPeerRaters = flattenEvaluatorAvgsNoZero(group.peerScores).length;
        const nonZeroOthersRatersCnt = nonZeroManagerRaters + nonZeroPeerRaters;
        const confidenceTier = getConfidenceTier(nonZeroOthersRatersCnt);
        const othersRatersCnt = group.managerScores.size + group.peerScores.size;

        if (othersRatersCnt === 0) {
          excludedSkills.push({ skill_id: skillId, skill_name: group.skillName, reason: `Нет респондентов` });
          continue;
        }

        const selfAvg = avgExcludingZeros(group.selfScores);
        const managerAvgsNoZero = flattenEvaluatorAvgsNoZero(group.managerScores);
        const managerAvg = managerAvgsNoZero.length > 0
          ? managerAvgsNoZero.reduce((a, b) => a + b, 0) / managerAvgsNoZero.length
          : null;

        const peerAvgsNoZero = flattenEvaluatorAvgsNoZero(group.peerScores);
        const peersAvg = peerAvgsNoZero.length > 0
          ? peerAvgsNoZero.reduce((a, b) => a + b, 0) / peerAvgsNoZero.length
          : null;

        const allOthersAvgsNoZero = [...managerAvgsNoZero, ...peerAvgsNoZero];
        const othersAvg = allOthersAvgsNoZero.length > 0
          ? allOthersAvgsNoZero.reduce((a, b) => a + b, 0) / allOthersAvgsNoZero.length
          : null;

        const managerRawScores = flattenEvaluatorScores(group.managerScores);
        const internalPeerRawScores = flattenEvaluatorScores(group.internalPeerScores);
        const externalRawScores = flattenEvaluatorScores(group.externalPeerScores);
        const allPeerRawScores = flattenEvaluatorScores(group.peerScores);
        const allOthersRawScores = [...managerRawScores, ...allPeerRawScores];

        const signedDelta = (selfAvg !== null && othersAvg !== null) ? selfAvg - othersAvg : 0;
        const delta = Math.abs(signedDelta);

        let zone: SkillMetrics['zone'] = 'unknown';
        let greyZone = false;

        if (confidenceTier === 'insufficient') {
          zone = 'unknown';
        } else if (selfAvg === null || othersAvg === null) {
          zone = 'unknown';
        } else if (delta <= tArena) {
          zone = 'arena';
        } else if (delta <= tHi) {
          zone = 'arena';
          greyZone = true;
        } else {
          zone = signedDelta > 0 ? 'blind_spot' : 'hidden_strength';
        }

        let isContradictory = false;
        if (nonZeroOthersRatersCnt >= 3) {
          const hasLowerBucket = allOthersRawScores.some(s => s <= lowerBucketThreshold);
          const hasUpperBucket = allOthersRawScores.some(s => s >= upperBucketThreshold);
          isContradictory = hasLowerBucket && hasUpperBucket;
        }

        skills.push({
          skill_id: skillId,
          skill_name: group.skillName,
          skill_description: group.skillDescription,
          category: group.category,
          subcategory: group.subcategory,
          zone,
          self_avg: selfAvg !== null ? Math.round(selfAvg * 100) / 100 : null,
          manager_avg: managerAvg !== null ? Math.round(managerAvg * 100) / 100 : null,
          peers_avg: peersAvg !== null ? Math.round(peersAvg * 100) / 100 : null,
          others_avg: othersAvg !== null ? Math.round(othersAvg * 100) / 100 : null,
          delta: Math.round(delta * 100) / 100,
          signed_delta: Math.round(signedDelta * 100) / 100,
          others_raters_cnt: othersRatersCnt,
          grey_zone: greyZone,
          is_polarized: isContradictory,
          is_contradictory: isContradictory,
          confidence_tier: confidenceTier,
          manager_scores: managerRawScores,
          peer_scores: internalPeerRawScores,
          external_scores: externalRawScores,
          others_individual_scores: allOthersRawScores,
        });
      }
    }

    // ── Server-side borderline rounding ──
    const borderlinePolicy = hasJohariRules && frozenConfig.johari_rules.borderline_rounding_enabled
      ? {
          enabled: true,
          threshold: frozenConfig.johari_rules.borderline_threshold_delta,
          round_down: frozenConfig.johari_rules.borderline_round_down_to,
          round_up: frozenConfig.johari_rules.borderline_round_up_to,
        }
      : { enabled: false, threshold: 0, round_down: 0, round_up: 0 };

    if (borderlinePolicy.enabled) {
      for (const skill of skills) {
        if (skill.confidence_tier === 'insufficient' || skill.zone === 'unknown') continue;
        const absDelta = Math.abs(skill.signed_delta);
        if (absDelta < borderlinePolicy.round_down || absDelta >= borderlinePolicy.round_up) continue;
        
        if (absDelta >= borderlinePolicy.threshold) {
          const sign = skill.signed_delta >= 0 ? 1 : -1;
          skill.delta = Math.round(borderlinePolicy.round_up * 100) / 100;
          skill.signed_delta = Math.round(sign * borderlinePolicy.round_up * 100) / 100;
          if (skill.zone === 'arena') {
            skill.zone = sign > 0 ? 'blind_spot' : 'hidden_strength';
            skill.grey_zone = false;
          }
        } else {
          const sign = skill.signed_delta >= 0 ? 1 : -1;
          skill.delta = Math.round(borderlinePolicy.round_down * 100) / 100;
          skill.signed_delta = Math.round(sign * borderlinePolicy.round_down * 100) / 100;
        }
      }
      console.log(`Applied borderline rounding: threshold=${borderlinePolicy.threshold}, down=${borderlinePolicy.round_down}, up=${borderlinePolicy.round_up}`);
    }

    // Check if we have enough data
    if (skills.length === 0) {
      const insufficientMsg = scope === 'external_only'
        ? 'Недостаточно внешних оценок для расчёта Окна Джохари. Ни по одному навыку нет внешних респондентов.'
        : 'Недостаточно данных для построения отчёта. Ни по одному навыку нет респондентов.';
      return new Response(
        JSON.stringify({ 
          error: 'insufficient_data',
          message: insufficientMsg,
          excluded_skills: excludedSkills
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Calculate data hash ──
    let canonicalString: string;
    if (scope === 'external_only') {
      const relevantResults = rawResults.filter(r => {
        if (r.evaluating_user_id === evaluated_user_id) return true;
        if (!r.assignment_id) return false;
        const aType = assignmentTypeMap.get(r.assignment_id);
        return aType === 'peer' && externalPeerIds.has(r.evaluating_user_id!);
      });
      canonicalString = relevantResults
        .sort((a, b) => {
          const cmp1 = (a.evaluating_user_id || '').localeCompare(b.evaluating_user_id || '');
          if (cmp1 !== 0) return cmp1;
          return (a.question_id || '').localeCompare(b.question_id || '');
        })
        .map(r => {
          const numVal = isHistorical
            ? r.raw_numeric_value
            : ((r.soft_skill_answer_options as any)?.numeric_value ?? r.raw_numeric_value);
          const assignmentType = r.assignment_id ? (assignmentTypeMap.get(r.assignment_id) || 'peer') : 
            (r.evaluating_user_id === evaluated_user_id ? 'self' : 'peer');
          return `${r.evaluating_user_id}|${r.question_id}|${numVal}|${assignmentType}`;
        })
        .join('\n');
    } else {
      canonicalString = rawResults
        .sort((a, b) => {
          const cmp1 = (a.evaluating_user_id || '').localeCompare(b.evaluating_user_id || '');
          if (cmp1 !== 0) return cmp1;
          return (a.question_id || '').localeCompare(b.question_id || '');
        })
        .map(r => {
          const numVal = isHistorical
            ? r.raw_numeric_value
            : ((r.soft_skill_answer_options as any)?.numeric_value ?? r.raw_numeric_value);
          const assignmentType = r.assignment_id ? (assignmentTypeMap.get(r.assignment_id) || 'peer') : 
            (r.evaluating_user_id === evaluated_user_id ? 'self' : 'peer');
          return `${r.evaluating_user_id}|${r.question_id}|${numVal}|${assignmentType}`;
        })
        .join('\n');
    }

    const dataHash = await calculateHash(canonicalString);

    // ── 7. Check for existing snapshot ──
    const { data: existingSnapshots } = await supabaseAdmin
      .from('johari_ai_snapshots')
      .select('*')
      .eq('stage_id', stage_id)
      .eq('evaluated_user_id', evaluated_user_id)
      .eq('respondent_scope', scope)
      .order('version', { ascending: false })
      .limit(1);

    const existingSnapshot = existingSnapshots?.[0];

    if (existingSnapshot && existingSnapshot.data_hash === dataHash && !force_regenerate) {
      return new Response(
        JSON.stringify({ snapshot: existingSnapshot, data_changed: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataChanged = existingSnapshot && existingSnapshot.data_hash !== dataHash;

    if (existingSnapshot && dataChanged && !force_regenerate) {
      return new Response(
        JSON.stringify({ snapshot: existingSnapshot, data_changed: true, current_hash: dataHash }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate total unique others raters across INCLUDED skills only
    const includedSkillIds = new Set(skills.map(s => s.skill_id));
    const allOthersRaterIds = new Set<string>();
    for (const [skillId, group] of skillGroups) {
      if (!includedSkillIds.has(skillId)) continue;
      if (scope === 'external_only') {
        for (const evaluatorId of group.externalPeerScores.keys()) {
          allOthersRaterIds.add(evaluatorId);
        }
      } else {
        for (const evaluatorId of group.managerScores.keys()) {
          allOthersRaterIds.add(evaluatorId);
        }
        for (const evaluatorId of group.peerScores.keys()) {
          allOthersRaterIds.add(evaluatorId);
        }
      }
    }

    const metricsJson: JohariMetrics = {
      scale_min: scaleMin,
      scale_max: scaleMax,
      t_arena: tArena,
      t_hi: tHi,
      skills,
      excluded_skills: excludedSkills,
      generated_at: new Date().toISOString(),
      total_others_raters_cnt: allOthersRaterIds.size,
      ...(hasJohariRules ? { johari_rules: frozenConfig.johari_rules } : {}),
      borderline_policy: borderlinePolicy,
      soft_scale_reversed: softScaleReversed,
    } as JohariMetrics;

    // ── 8. Comments Classification ──
    let commentsClassification = null;

    const commentEvaluatorFilter = scope === 'external_only' ? externalPeerIds : null;

    console.log('Collecting comments for zone-based classification...');
    
    // For comments, we need skill_name per result. In historical mode we resolve from snapshot.
    // Fetch comments from soft_skill_results
    let commentResults: any[];
    
    if (isHistorical) {
      const { data: cData, error: commentError } = await supabaseAdmin
        .from('soft_skill_results')
        .select('id, evaluating_user_id, question_id, assignment_id, comment')
        .eq('diagnostic_stage_id', stage_id)
        .eq('evaluated_user_id', evaluated_user_id)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .not('comment', 'is', null);
      
      if (commentError) {
        console.error('Error fetching comments (historical):', commentError);
        commentResults = [];
      } else {
        commentResults = cData || [];
      }
    } else {
      const { data: cData, error: commentError } = await supabaseAdmin
        .from('soft_skill_results')
        .select(`
          id,
          evaluating_user_id,
          comment,
          assignment_id,
          soft_skill_questions!inner(quality_id, soft_skills!fk_survey_360_questions_soft_skill(id, name))
        `)
        .eq('diagnostic_stage_id', stage_id)
        .eq('evaluated_user_id', evaluated_user_id)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .not('comment', 'is', null);
      
      if (commentError) {
        console.error('Error fetching comments:', commentError);
        commentResults = [];
      } else {
        commentResults = cData || [];
      }
    }

    // Filter and resolve skill names for comments
    const filteredComments: { comment_id: string; skill_name: string; comment: string }[] = [];
    
    for (const cr of commentResults) {
      const trimmed = (cr.comment || '').trim();
      if (!trimmed) continue;
      if (!cr.evaluating_user_id) continue;
      if (cr.evaluating_user_id === evaluated_user_id) continue;
      
      if (commentEvaluatorFilter && !commentEvaluatorFilter.has(cr.evaluating_user_id)) continue;
      
      if (!commentEvaluatorFilter) {
        // For 'all' scope, verify assignment exists
        if (isHistorical) {
          if (!cr.assignment_id || !assignmentTypeMap.has(cr.assignment_id)) continue;
        } else {
          // Live: check in live assignments array (already loaded above for live mode)
          // We need the assignments array - reconstruct it
          if (!cr.assignment_id || !assignmentTypeMap.has(cr.assignment_id)) continue;
        }
      } else {
        // For external_only scope, verify peer assignment
        if (!cr.assignment_id) continue;
        const aType = assignmentTypeMap.get(cr.assignment_id);
        if (aType !== 'peer') continue;
      }
      
      let skillName: string | undefined;
      if (isHistorical) {
        const skillId = snapshotCtx!.questionToSkillMap.get(cr.question_id);
        if (skillId) {
          skillName = snapshotCtx!.skillMetaMap.get(skillId)?.name;
        }
      } else {
        skillName = (cr.soft_skill_questions as any)?.soft_skills?.name;
      }
      
      if (!skillName) continue;
      
      filteredComments.push({ comment_id: cr.id, skill_name: skillName, comment: trimmed });
    }
    
    console.log(`Found ${filteredComments.length} comments for classification (scope: ${scope})`);
    
    if (filteredComments.length >= 1) {
      const isSmallSample = filteredComments.length <= 2;
      const languageGuide = isSmallSample
        ? `ВАЖНО: Выборка очень мала (${filteredComments.length} комментариев). Используй нейтральный язык без обобщений. ЗАПРЕЩЕНЫ формулировки: «большинство», «системно», «в целом», «как правило», «преимущественно». Каждый вывод привязывай к конкретному наблюдению.`
        : `Выборка: ${filteredComments.length} комментариев. Можно делать осторожные обобщения.`;

      const skillsMatrix = skills.map(s => ({
        skill_name: s.skill_name,
        skill_description: s.skill_description || '',
        zone: s.zone
      }));

      const respondentDescription = scope === 'external_only'
        ? 'внешних респондентов'
        : 'всех респондентов (руководитель, внутренние и внешние коллеги)';
      
      const commentsPrompt = `Ты — HR-аналитик. Классифицируй комментарии ${respondentDescription} из 360-оценки по зонам Окна Джохари.

ЗАДАЧА: Каждый комментарий размещается в зоне навыка, под которым он был оставлен (source_skill_name). Если считаешь, что комментарий больше относится к другому навыку — заполни reassignment_suggestion, но НЕ перемещай комментарий.

ПРАВИЛА:
1. Комментарий остаётся под source_skill_name в зоне этого навыка. reassignment_suggestion — только рекомендация, не влияет на размещение.
2. Конструктивная обратная связь (включая жёсткую, но содержательную) → размещай в зоне навыка. НЕ в problem_comments.
3. problem_comments — ТОЛЬКО для неконструктивного контента (оскорбления без сути, пустые жалобы).
4. gratitude_comments — чистые благодарности без содержательной обратной связи по навыку.
5. out_of_matrix_comments — комментарий не связан ни с одним навыком из матрицы.
6. НЕ создавай пустых зон или групп навыков в выходных данных.
7. Без деанонимизации, без цитирования позволяющего идентифицировать автора.
8. Работай с комментариями целиком, не сегментируй.
9. zone_summary: строго 1-2 коротких предложения, синтезирующих доминирующий паттерн зоны. НЕ пересказывай отдельные комментарии.
10. ${languageGuide}

МАТРИЦА НАВЫКОВ И ЗОН:
${JSON.stringify(skillsMatrix, null, 2)}

КОММЕНТАРИИ:
${JSON.stringify(filteredComments.map(c => ({ comment_id: c.comment_id, source_skill_name: c.skill_name, comment: c.comment })), null, 2)}`;

      try {
        const commentsAiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: AI_MODEL,
            messages: [
              { role: "system", content: commentsPrompt }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify_comments",
                  description: "Классификация комментариев по зонам Окна Джохари",
                  parameters: {
                    type: "object",
                    properties: {
                      zone_comment_groups: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            zone: { type: "string", enum: ["arena", "blind_spot", "hidden_strength", "unknown", "grey"], description: "Зона Джохари" },
                            zone_summary: { type: "string", description: "1-2 коротких предложения о доминирующем паттерне зоны, без пересказа комментариев" },
                            skills: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  skill_name: { type: "string" },
                                  comments: {
                                    type: "array",
                                    items: {
                                      type: "object",
                                      properties: {
                                        comment_id: { type: "string" },
                                        comment_text: { type: "string" },
                                        source_skill_name: { type: "string" },
                                        reassignment_suggestion: {
                                          type: ["object", "null"],
                                          properties: {
                                            suggested_skill_name: { type: "string" },
                                            suggested_zone: { type: "string" },
                                            confidence: { type: "string", enum: ["high", "medium", "low"] },
                                            reason: { type: "string" }
                                          },
                                          required: ["suggested_skill_name", "suggested_zone", "confidence", "reason"],
                                          additionalProperties: false
                                        }
                                      },
                                      required: ["comment_id", "comment_text", "source_skill_name"],
                                      additionalProperties: false
                                    }
                                  }
                                },
                                required: ["skill_name", "comments"],
                                additionalProperties: false
                              }
                            }
                          },
                          required: ["zone", "zone_summary", "skills"],
                          additionalProperties: false
                        }
                      },
                      out_of_matrix_comments: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            comment_id: { type: "string" },
                            comment_text: { type: "string" },
                            source_skill_name: { type: "string" },
                            inferred_topic: { type: "string" },
                            suggested_skill_theme: { type: "string" }
                          },
                          required: ["comment_id", "comment_text", "source_skill_name", "inferred_topic", "suggested_skill_theme"],
                          additionalProperties: false
                        }
                      },
                      gratitude_comments: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            comment_id: { type: "string" },
                            comment_text: { type: "string" },
                            source_skill_name: { type: "string" },
                            reason: { type: "string" }
                          },
                          required: ["comment_id", "comment_text", "source_skill_name", "reason"],
                          additionalProperties: false
                        }
                      },
                      problem_comments: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            comment_id: { type: "string" },
                            comment_text: { type: "string" },
                            source_skill_name: { type: "string" },
                            reason: { type: "string" }
                          },
                          required: ["comment_id", "comment_text", "source_skill_name", "reason"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["zone_comment_groups", "out_of_matrix_comments", "gratitude_comments", "problem_comments"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "classify_comments" } }
          }),
        });

        if (commentsAiResponse.ok) {
          const commentsAiData = await commentsAiResponse.json();
          const commentsToolCall = commentsAiData.choices[0]?.message?.tool_calls?.[0];
          if (commentsToolCall) {
            const parsed = JSON.parse(commentsToolCall.function.arguments);
            commentsClassification = {
              zone_comment_groups: parsed.zone_comment_groups || [],
              out_of_matrix_comments: parsed.out_of_matrix_comments || [],
              gratitude_comments: parsed.gratitude_comments || [],
              problem_comments: parsed.problem_comments || [],
              notes: {
                comments_used: filteredComments.length
              }
            };
            console.log('Comments zone-based classification generated successfully');
          }
        } else {
          console.error('Comments AI call failed:', commentsAiResponse.status);
        }
      } catch (aiErr) {
        console.error('Error generating comments classification:', aiErr);
      }
    }

    // ── 10. Insert new snapshot ──
    const newVersion = existingSnapshot ? existingSnapshot.version + 1 : 1;

    let insertedSnapshot = null;
    let retries = 3;
    let currentVersion = newVersion;

    while (retries > 0 && !insertedSnapshot) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('johari_ai_snapshots')
        .insert({
          stage_id,
          evaluated_user_id,
          respondent_scope: scope,
          version: currentVersion,
          created_by: currentUser.id,
          metrics_json: metricsJson,
          ai_text: null,
          data_hash: dataHash,
          prompt_version: PROMPT_VERSION,
          model: AI_MODEL,
          comments_classification: commentsClassification
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          const { data: latestSnapshots } = await supabaseAdmin
            .from('johari_ai_snapshots')
            .select('version')
            .eq('stage_id', stage_id)
            .eq('evaluated_user_id', evaluated_user_id)
            .eq('respondent_scope', scope)
            .order('version', { ascending: false })
            .limit(1);
          
          currentVersion = (latestSnapshots?.[0]?.version || 0) + 1;
          retries--;
          continue;
        }
        throw insertError;
      }

      insertedSnapshot = inserted;
    }

    if (!insertedSnapshot) {
      throw new Error('Failed to insert snapshot after retries');
    }

    console.log(`Johari report generated successfully, version=${insertedSnapshot.version}, scope=${scope}, mode=${isHistorical ? 'snapshot' : 'live'}`);

    return new Response(
      JSON.stringify({
        snapshot: insertedSnapshot,
        data_changed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in generate-johari-report:", error);
    return serverError("Внутренняя ошибка сервера");
  }
});
