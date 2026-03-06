import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROMPT_VERSION = "2.3.0";
const AI_MODEL = "google/gemini-2.5-flash";

interface SkillMetrics {
  skill_id: string;
  skill_name: string;
  category?: string;
  subcategory?: string;
  zone: 'arena' | 'blind_spot' | 'hidden_strength' | 'unknown';
  self_avg: number | null;
  manager_avg: number | null;
  peers_avg: number | null;
  others_avg: number | null;
  delta: number;
  others_raters_cnt: number;
  grey_zone: boolean;
  is_polarized: boolean;
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

// Calculate SHA256 hash
async function calculateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Check authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { stage_id, evaluated_user_id, force_regenerate = false, respondent_scope = 'all' } = await req.json();
    
    if (!stage_id || !evaluated_user_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: stage_id, evaluated_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate respondent_scope
    const scope: RespondentScope = respondent_scope === 'external_only' ? 'external_only' : 'all';

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client with user's auth token for permission checks
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create admin client for database operations
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get current user's ID from auth token
    const { data: { user: currentUser }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !currentUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions - must be HR/admin OR manager of the evaluated user
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

    // 1. Get all soft skill results for this stage and user
    const { data: results, error: resultsError } = await supabaseAdmin
      .from('soft_skill_results')
      .select(`
        id,
        evaluating_user_id,
        question_id,
        answer_option_id,
        assignment_id,
        soft_skill_answer_options!inner(numeric_value),
        soft_skill_questions!inner(quality_id, soft_skills!fk_survey_360_questions_soft_skill(id, name, category_id, sub_category_id, category_soft_skills(name), sub_category_soft_skills(name)))
      `)
      .eq('diagnostic_stage_id', stage_id)
      .eq('evaluated_user_id', evaluated_user_id)
      .eq('is_draft', false)
      .or('is_skip.is.null,is_skip.eq.false');

    if (resultsError) {
      console.error('Error fetching results:', resultsError);
      throw resultsError;
    }

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'insufficient_data',
          message: 'Недостаточно данных для построения отчёта. Нет финальных ответов по soft skills для данного этапа.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get assignment types for each result
    const assignmentIds = [...new Set(results.filter(r => r.assignment_id).map(r => r.assignment_id))];
    const { data: assignments } = await supabaseAdmin
      .from('survey_360_assignments')
      .select('id, assignment_type, evaluating_user_id')
      .in('id', assignmentIds);

    const assignmentTypeMap = new Map(assignments?.map(a => [a.id, a.assignment_type]) || []);

    // 2b. Get position categories for all peer evaluators to determine "external"
    const peerEvaluatorIds = [...new Set(
      (assignments || [])
        .filter(a => a.assignment_type === 'peer')
        .map(a => a.evaluating_user_id)
        .filter(Boolean)
    )];

    const externalPeerIds = new Set<string>();
    if (peerEvaluatorIds.length > 0) {
      const { data: evaluatorUsers } = await supabaseAdmin
        .from('users')
        .select('id, position_id')
        .in('id', peerEvaluatorIds);

      const positionIds = [...new Set((evaluatorUsers || []).map(u => u.position_id).filter(Boolean))];
      
      if (positionIds.length > 0) {
        const { data: positions } = await supabaseAdmin
          .from('positions')
          .select('id, position_category_id')
          .in('id', positionIds);

        const categoryIds = [...new Set((positions || []).map(p => p.position_category_id).filter(Boolean))];
        
        if (categoryIds.length > 0) {
          const { data: categories } = await supabaseAdmin
            .from('position_categories')
            .select('id, name')
            .in('id', categoryIds);

          const externalCategoryIds = new Set(
            (categories || []).filter(c => c.name && c.name.toLowerCase().includes('(внешний)')).map(c => c.id)
          );

          const positionToCategoryMap = new Map((positions || []).map(p => [p.id, p.position_category_id]));
          const userToPositionMap = new Map((evaluatorUsers || []).map(u => [u.id, u.position_id]));

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

    console.log(`External peer evaluators: ${externalPeerIds.size} out of ${peerEvaluatorIds.length} peers`);

    // 3. Calculate scale from answer options
    const { data: scaleData } = await supabaseAdmin
      .from('soft_skill_answer_options')
      .select('numeric_value');

    const numericValues = scaleData?.map(s => s.numeric_value) || [0, 1, 2, 3, 4, 5];
    const scaleMin = Math.min(...numericValues);
    const scaleMax = Math.max(...numericValues);
    const scaleRange = scaleMax - scaleMin;

    // Thresholds as fractions of range
    const tArena = 0.125 * scaleRange;
    const tHi = 0.15 * scaleRange;

    // Polarization thresholds
    const lowerBucketThreshold = scaleMin + scaleRange * 0.33;
    const upperBucketThreshold = scaleMax - scaleRange * 0.33;

    // 4. Group results by skill and evaluator type
    type SkillGroup = {
      skillName: string;
      category?: string;
      subcategory?: string;
      selfScores: number[];
      managerScores: Map<string, number[]>;  // evaluator_id -> scores
      peerScores: Map<string, number[]>;     // evaluator_id -> scores (all peers)
      externalPeerScores: Map<string, number[]>; // evaluator_id -> scores (external peers only)
    };

    const skillGroups = new Map<string, SkillGroup>();

    for (const result of results) {
      const softSkill = (result.soft_skill_questions as any)?.soft_skills;
      if (!softSkill?.id) continue;

      const skillId = softSkill.id;
      const numericValue = (result.soft_skill_answer_options as any)?.numeric_value;
      if (numericValue === null || numericValue === undefined) continue;

      // Determine assignment type
      let assignmentType = 'peer';
      if (result.evaluating_user_id === evaluated_user_id) {
        assignmentType = 'self';
      } else if (result.assignment_id) {
        assignmentType = assignmentTypeMap.get(result.assignment_id) || 'peer';
      }

      if (!skillGroups.has(skillId)) {
        skillGroups.set(skillId, {
          skillName: softSkill.name,
          category: softSkill.category_soft_skills?.name,
          subcategory: softSkill.sub_category_soft_skills?.name,
          selfScores: [],
          managerScores: new Map(),
          peerScores: new Map(),
          externalPeerScores: new Map()
        });
      }

      const group = skillGroups.get(skillId)!;

      if (assignmentType === 'self') {
        group.selfScores.push(numericValue);
      } else if (assignmentType === 'manager') {
        const evaluatorId = result.evaluating_user_id!;
        if (!group.managerScores.has(evaluatorId)) {
          group.managerScores.set(evaluatorId, []);
        }
        group.managerScores.get(evaluatorId)!.push(numericValue);
      } else {
        const evaluatorId = result.evaluating_user_id!;
        if (!group.peerScores.has(evaluatorId)) {
          group.peerScores.set(evaluatorId, []);
        }
        group.peerScores.get(evaluatorId)!.push(numericValue);
        
        // Also track external peers separately
        if (externalPeerIds.has(evaluatorId)) {
          if (!group.externalPeerScores.has(evaluatorId)) {
            group.externalPeerScores.set(evaluatorId, []);
          }
          group.externalPeerScores.get(evaluatorId)!.push(numericValue);
        }
      }
    }

    // 5. Calculate metrics per skill — branching by scope
    const skills: SkillMetrics[] = [];
    const excludedSkills: ExcludedSkill[] = [];

    for (const [skillId, group] of skillGroups) {
      if (scope === 'external_only') {
        // For external_only: others = only external peers, no manager
        const externalRatersCnt = group.externalPeerScores.size;

        if (externalRatersCnt < 3) {
          excludedSkills.push({
            skill_id: skillId,
            skill_name: group.skillName,
            reason: `Недостаточно внешних респондентов (${externalRatersCnt} из 3 требуемых)`
          });
          continue;
        }

        // Self average
        const selfAvg = group.selfScores.length > 0
          ? group.selfScores.reduce((a, b) => a + b, 0) / group.selfScores.length
          : null;

        // External peers average (avg of avgs per evaluator)
        let externalAvg: number | null = null;
        if (group.externalPeerScores.size > 0) {
          const peerAvgs = Array.from(group.externalPeerScores.values()).map(
            scores => scores.reduce((a, b) => a + b, 0) / scores.length
          );
          externalAvg = peerAvgs.reduce((a, b) => a + b, 0) / peerAvgs.length;
        }

        // Delta = |self - external|
        const delta = (selfAvg !== null && externalAvg !== null)
          ? Math.abs(selfAvg - externalAvg)
          : 0;

        // Zone
        let zone: SkillMetrics['zone'] = 'unknown';
        let greyZone = false;

        if (selfAvg === null || externalAvg === null) {
          zone = 'unknown';
        } else if (delta < tArena) {
          zone = 'arena';
        } else if (delta < tHi) {
          zone = 'arena';
          greyZone = true;
        } else {
          zone = selfAvg > externalAvg ? 'blind_spot' : 'hidden_strength';
        }

        // Polarization — only among external peers
        let isPolarized = false;
        if (externalRatersCnt >= 3) {
          const extScores: number[] = [];
          for (const scores of group.externalPeerScores.values()) {
            extScores.push(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          const hasLower = extScores.some(s => s <= lowerBucketThreshold);
          const hasUpper = extScores.some(s => s >= upperBucketThreshold);
          isPolarized = hasLower && hasUpper;
        }

        skills.push({
          skill_id: skillId,
          skill_name: group.skillName,
          category: group.category,
          subcategory: group.subcategory,
          zone,
          self_avg: selfAvg !== null ? Math.round(selfAvg * 100) / 100 : null,
          manager_avg: null, // not used in external_only
          peers_avg: externalAvg !== null ? Math.round(externalAvg * 100) / 100 : null,
          others_avg: externalAvg !== null ? Math.round(externalAvg * 100) / 100 : null,
          delta: Math.round(delta * 100) / 100,
          others_raters_cnt: externalRatersCnt,
          grey_zone: greyZone,
          is_polarized: isPolarized
        });
      } else {
        // scope === 'all': original logic
        const othersRatersCnt = group.managerScores.size + group.peerScores.size;

        if (othersRatersCnt < 3) {
          excludedSkills.push({
            skill_id: skillId,
            skill_name: group.skillName,
            reason: `Недостаточно респондентов (${othersRatersCnt} из 3 требуемых)`
          });
          continue;
        }

        const selfAvg = group.selfScores.length > 0
          ? group.selfScores.reduce((a, b) => a + b, 0) / group.selfScores.length
          : null;

        let managerAvg: number | null = null;
        if (group.managerScores.size > 0) {
          const managerAvgs = Array.from(group.managerScores.values()).map(
            scores => scores.reduce((a, b) => a + b, 0) / scores.length
          );
          managerAvg = managerAvgs.reduce((a, b) => a + b, 0) / managerAvgs.length;
        }

        let peersAvg: number | null = null;
        if (group.externalPeerScores.size > 0) {
          const peerAvgs = Array.from(group.externalPeerScores.values()).map(
            scores => scores.reduce((a, b) => a + b, 0) / scores.length
          );
          peersAvg = peerAvgs.reduce((a, b) => a + b, 0) / peerAvgs.length;
        }

        let othersAvg: number | null = null;
        const allOthersAvgs: number[] = [];
        for (const scores of group.managerScores.values()) {
          allOthersAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
        for (const scores of group.peerScores.values()) {
          allOthersAvgs.push(scores.reduce((a, b) => a + b, 0) / scores.length);
        }
        if (allOthersAvgs.length > 0) {
          othersAvg = allOthersAvgs.reduce((a, b) => a + b, 0) / allOthersAvgs.length;
        }

        const delta = (selfAvg !== null && othersAvg !== null)
          ? Math.abs(selfAvg - othersAvg)
          : 0;

        let zone: SkillMetrics['zone'] = 'unknown';
        let greyZone = false;

        if (selfAvg === null || othersAvg === null) {
          zone = 'unknown';
        } else if (delta < tArena) {
          zone = 'arena';
        } else if (delta < tHi) {
          zone = 'arena';
          greyZone = true;
        } else {
          zone = selfAvg > othersAvg ? 'blind_spot' : 'hidden_strength';
        }

        let isPolarized = false;
        if (othersRatersCnt >= 3) {
          const allOthersScores: number[] = [];
          for (const scores of group.managerScores.values()) {
            allOthersScores.push(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          for (const scores of group.peerScores.values()) {
            allOthersScores.push(scores.reduce((a, b) => a + b, 0) / scores.length);
          }
          const hasLowerBucket = allOthersScores.some(s => s <= lowerBucketThreshold);
          const hasUpperBucket = allOthersScores.some(s => s >= upperBucketThreshold);
          isPolarized = hasLowerBucket && hasUpperBucket;
        }

        skills.push({
          skill_id: skillId,
          skill_name: group.skillName,
          category: group.category,
          subcategory: group.subcategory,
          zone,
          self_avg: selfAvg !== null ? Math.round(selfAvg * 100) / 100 : null,
          manager_avg: managerAvg !== null ? Math.round(managerAvg * 100) / 100 : null,
          peers_avg: peersAvg !== null ? Math.round(peersAvg * 100) / 100 : null,
          others_avg: othersAvg !== null ? Math.round(othersAvg * 100) / 100 : null,
          delta: Math.round(delta * 100) / 100,
          others_raters_cnt: othersRatersCnt,
          grey_zone: greyZone,
          is_polarized: isPolarized
        });
      }
    }

    // Check if we have enough data
    if (skills.length === 0) {
      const insufficientMsg = scope === 'external_only'
        ? 'Недостаточно внешних оценок для расчёта Окна Джохари. По всем навыкам менее 3 внешних респондентов.'
        : 'Недостаточно данных для построения отчёта. По всем навыкам менее 3 респондентов.';
      return new Response(
        JSON.stringify({ 
          error: 'insufficient_data',
          message: insufficientMsg,
          excluded_skills: excludedSkills
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Calculate data hash — scope-aware
    let canonicalString: string;
    if (scope === 'external_only') {
      // Hash only self + external peer answers
      const relevantResults = results.filter(r => {
        if (r.evaluating_user_id === evaluated_user_id) return true; // self
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
          const assignmentType = r.assignment_id ? (assignmentTypeMap.get(r.assignment_id) || 'peer') : 
            (r.evaluating_user_id === evaluated_user_id ? 'self' : 'peer');
          return `${r.evaluating_user_id}|${r.question_id}|${(r.soft_skill_answer_options as any).numeric_value}|${assignmentType}`;
        })
        .join('\n');
    } else {
      canonicalString = results
        .sort((a, b) => {
          const cmp1 = (a.evaluating_user_id || '').localeCompare(b.evaluating_user_id || '');
          if (cmp1 !== 0) return cmp1;
          return (a.question_id || '').localeCompare(b.question_id || '');
        })
        .map(r => {
          const assignmentType = r.assignment_id ? (assignmentTypeMap.get(r.assignment_id) || 'peer') : 
            (r.evaluating_user_id === evaluated_user_id ? 'self' : 'peer');
          return `${r.evaluating_user_id}|${r.question_id}|${(r.soft_skill_answer_options as any).numeric_value}|${assignmentType}`;
        })
        .join('\n');
    }

    const dataHash = await calculateHash(canonicalString);

    // 7. Check for existing snapshot — filtered by scope
    const { data: existingSnapshots } = await supabaseAdmin
      .from('johari_ai_snapshots')
      .select('*')
      .eq('stage_id', stage_id)
      .eq('evaluated_user_id', evaluated_user_id)
      .eq('respondent_scope', scope)
      .order('version', { ascending: false })
      .limit(1);

    const existingSnapshot = existingSnapshots?.[0];

    // If snapshot exists and hash matches and not force regenerate, return existing
    if (existingSnapshot && existingSnapshot.data_hash === dataHash && !force_regenerate) {
      return new Response(
        JSON.stringify({
          snapshot: existingSnapshot,
          data_changed: false
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If snapshot exists with different hash, indicate data changed
    const dataChanged = existingSnapshot && existingSnapshot.data_hash !== dataHash;

    // If not force regenerate and data changed, return existing with flag
    if (existingSnapshot && dataChanged && !force_regenerate) {
      return new Response(
        JSON.stringify({
          snapshot: existingSnapshot,
          data_changed: true,
          current_hash: dataHash
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Generate AI report
    const metricsForAI = {
      scale_min: scaleMin,
      scale_max: scaleMax,
      t_arena: tArena,
      t_hi: tHi,
      respondent_scope: scope,
      skills: skills.map(s => ({
        skill_name: s.skill_name,
        category: s.category,
        zone: s.zone,
        self_avg: s.self_avg,
        others_avg: s.others_avg,
        delta: s.delta,
        others_raters_cnt: s.others_raters_cnt,
        grey_zone: s.grey_zone,
        is_polarized: s.is_polarized
      })),
      excluded_skills_count: excludedSkills.length
    };

    // Scope-aware evaluator groups description
    const evaluatorGroupsDescription = scope === 'external_only'
      ? `ГРУППЫ ОЦЕНЩИКОВ:
- Self (От себя): самооценка сотрудника
- Others (Внешние): оценки только внешних коллег (без руководителя и внутренних сотрудников)

ВАЖНО: В режиме external_only данные руководителя и внутренних коллег НЕ учитываются. Все метрики рассчитаны исключительно по внешним оценщикам. Не упоминай руководителя, менеджера или внутренних коллег в анализе.`
      : `ГРУППЫ ОЦЕНЩИКОВ:
- Self (От себя): самооценка сотрудника
- Manager (Unit-lead): оценка руководителя
- Peers (Внешние): оценка только внешних коллег
- Others (Все кроме сотрудника): manager + все peers (внутренние + внешние)`;

    const systemPrompt = `Ты — эксперт по HR-аналитике. Твоя задача — интерпретировать результаты «Окна Джохари» на основе 360-градусной оценки soft skills.

ЦЕЛЕВАЯ АУДИТОРИЯ: Unit-lead (непосредственный руководитель сотрудника).
Весь текст адресован Unit-lead для подготовки и проведения 1:1 со сотрудником.
НЕ обращайся к сотруднику как к читателю. НЕ используй «Вам стоит…», «Вы можете…», «Как вы могли бы…».

ПРАВИЛА:
1. Используй только предоставленные метрики. Не добавляй новые факты или навыки.
2. Тон: нейтрально-деловой, без диагнозов и категоричных суждений.
3. При недостатке данных (excluded_skills) — укажи это явно.
4. Рекомендации — управленческие действия для подготовки и проведения 1:1.
5. Вопросы для 1:1 — открытые вопросы, которые задаются сотруднику. Нейтральный деловой тон, без оценочных и обвинительных формулировок.
6. Каждый пункт — 1 мысль, короткая формулировка.
7. НЕ используй английские коды зон (blind_spot, hidden_strength, arena, unknown, grey_zone). Используй русские названия: «Открытая зона», «Слепая зона», «Скрытая зона», «Чёрный ящик», «Серая зона».

СТИЛЬ РЕКОМЕНДАЦИЙ:
- НЕ начинай более двух пунктов подряд с одного и того же слова или фразы.
- Разнообразь формулировки. Допустимые варианты начала:
  «На 1:1 стоит уточнить…», «Полезно обсудить…», «Имеет смысл зафиксировать…», «В фокусе встречи — …», «Стоит обратить внимание на…», «Рекомендуется проговорить…», «Важно уточнить у сотрудника…».
- НЕ злоупотребляй префиксом «Unit-lead». Он уже подразумевается контекстом.

ФОРМАТ РЕЗЮМЕ (поле summary):
Используй СТРОГО следующую структуру с секциями-маркерами (заглавными буквами):

КЛЮЧЕВЫЕ ВЫВОДЫ:
тезис 1
тезис 2
тезис 3

ТОП-3 СЛЕПЫХ ЗОН:
1. Навык (Δ = X.XX)
2. Навык (Δ = X.XX)
3. Навык (Δ = X.XX)

ТОП-3 СКРЫТЫХ ЗОН:
1. Навык (Δ = X.XX)
2. Навык (Δ = X.XX)
3. Навык (Δ = X.XX)

Правила формата:
- Каждая секция начинается с заголовка ЗАГЛАВНЫМИ БУКВАМИ и двоеточием.
- Тезисы — без маркеров (без «-», «•», «—»). Маркеры добавит фронтенд.
- Нумерованные пункты — цифра с точкой: «1. ...»
- НЕ смешивай заголовок и первый пункт в одну строку.
- Если слепых или скрытых зон меньше 3 — указывай сколько есть.

${evaluatorGroupsDescription}

ЗОНЫ:
- arena: Открытая зона — взаимопонимание
- blind_spot: Слепая зона — возможная переоценка себя
- hidden_strength: Скрытая зона — возможная недооценка себя
- unknown: Чёрный ящик — нет данных

ВОПРОСЫ ДЛЯ 1:1 (discussion_questions):
Генерируй 4-5 вопросов строго привязанных к конкретным навыкам из предоставленных данных:
- 2 вопроса по навыкам из Слепой зоны (с максимальной Δ). Если слепых <2, добери из Скрытой.
- 2 вопроса по навыкам из Скрытой зоны (с максимальной Δ). Если скрытых <2, добери из Открытой зоны по max Δ.
- 1 вопрос по поляризованному навыку (is_polarized=true), ТОЛЬКО если такой есть.
Каждый вопрос — объект с полями zone (blind_spot / hidden_strength / arena / polarized), skill_name (точное название из данных), question (текст вопроса).
В тексте вопроса ОБЯЗАТЕЛЬНО упомяни конкретный навык по названию. Не дублируй один навык в нескольких вопросах (кроме случая нехватки данных).

СТРУКТУРА ОТВЕТА:
- summary: строго по формату выше (секции КЛЮЧЕВЫЕ ВЫВОДЫ + ТОП-3). Упомяни поляризацию если есть.
- recommendations: 3-5 пунктов, управленческие действия для подготовки 1:1. Разнообразный синтаксис.
- discussion_questions: 4-5 структурированных вопросов (объекты с zone, skill_name, question).`;

    const userPrompt = `Проанализируй результаты Окна Джохари и сгенерируй отчёт.
${scope === 'external_only' ? '\nРЕЖИМ: Только внешние оценщики. В анализе опирайся исключительно на данные внешних коллег.\n' : ''}
Метрики:
${JSON.stringify(metricsForAI, null, 2)}`;

    console.log('Calling AI for Johari report...');

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_johari_report",
              description: "Генерация отчёта Окна Джохари",
              parameters: {
                type: "object",
                properties: {
                  summary: { 
                    type: "string", 
                    description: "Резюме в строгом формате: секции КЛЮЧЕВЫЕ ВЫВОДЫ, ТОП-3 СЛЕПЫХ ЗОН, ТОП-3 СКРЫТЫХ ЗОН. Заголовки заглавными с двоеточием. Тезисы без маркеров. Нумерованные пункты с цифрой и точкой. Заголовок и первый пункт на разных строках." 
                  },
                  recommendations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3-5 управленческих рекомендаций для подготовки 1:1. Разнообразь начало фраз, не начинай более двух пунктов подряд одинаково. Не злоупотребляй словом «Unit-lead»." 
                  },
                  discussion_questions: { 
                    type: "array", 
                    items: { 
                      type: "object",
                      properties: {
                        zone: { type: "string", enum: ["blind_spot", "hidden_strength", "arena", "polarized"], description: "Зона навыка: blind_spot, hidden_strength, arena или polarized" },
                        skill_name: { type: "string", description: "Точное название навыка из предоставленных данных" },
                        question: { type: "string", description: "Открытый вопрос для сотрудника на 1:1, содержащий название навыка" }
                      },
                      required: ["zone", "skill_name", "question"],
                      additionalProperties: false
                    },
                    description: "4-5 вопросов для 1:1, каждый привязан к конкретному навыку и зоне из данных Джохари." 
                  }
                },
                required: ["summary", "recommendations"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_johari_report" } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Превышен лимит запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса Lovable AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];

    let aiText: any = { summary: '', recommendations: [], discussion_questions: [] };
    if (toolCall) {
      aiText = JSON.parse(toolCall.function.arguments);
    }

    // Calculate total unique others raters across INCLUDED skills only (scope-aware)
    const includedSkillIds = new Set(skills.map(s => s.skill_id));
    const allOthersRaterIds = new Set<string>();
    for (const [skillId, group] of skillGroups) {
      if (!includedSkillIds.has(skillId)) continue; // skip excluded skills
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
      total_others_raters_cnt: allOthersRaterIds.size
    };

    // ===== External Comments Review (only for external_only scope) =====
    let externalCommentsReview = null;
    
    if (scope === 'external_only' && externalPeerIds.size > 0) {
      console.log('Collecting external comments for case-based review...');
      
      // Fetch soft_skill_results with comments from external peers
      const { data: commentResults, error: commentError } = await supabaseAdmin
        .from('soft_skill_results')
        .select(`
          evaluating_user_id,
          comment,
          soft_skill_questions!inner(quality_id, soft_skills!fk_survey_360_questions_soft_skill(id, name))
        `)
        .eq('diagnostic_stage_id', stage_id)
        .eq('evaluated_user_id', evaluated_user_id)
        .eq('is_draft', false)
        .or('is_skip.is.null,is_skip.eq.false')
        .not('comment', 'is', null);

      if (commentError) {
        console.error('Error fetching comments:', commentError);
      } else {
        // Filter: only peer assignments from external peers, non-empty comments
        const externalComments: { skill_name: string; comment: string }[] = [];
        
        for (const cr of (commentResults || [])) {
          const trimmed = (cr.comment || '').trim();
          if (!trimmed) continue;
          if (!cr.evaluating_user_id) continue;
          if (!externalPeerIds.has(cr.evaluating_user_id)) continue;
          
          const matchingAssignment = (assignments || []).find(
            a => a.evaluating_user_id === cr.evaluating_user_id && a.assignment_type === 'peer'
          );
          if (!matchingAssignment) continue;
          
          const skillName = (cr.soft_skill_questions as any)?.soft_skills?.name;
          if (!skillName) continue;
          
          externalComments.push({ skill_name: skillName, comment: trimmed });
        }
        
        console.log(`Found ${externalComments.length} external comments`);
        
        if (externalComments.length >= 1) {
          const isSmallSample = externalComments.length <= 2;
          const languageGuide = isSmallSample
            ? `ВАЖНО: Выборка очень мала (${externalComments.length} комментариев). Используй нейтральный язык без обобщений. ЗАПРЕЩЕНЫ формулировки: «большинство», «системно», «в целом», «как правило», «преимущественно». Каждый вывод привязывай к конкретному наблюдению.`
            : `Выборка: ${externalComments.length} комментариев. Можно делать осторожные обобщения, но каждый кейс должен быть подтверждён комментариями.`;

          // Build zone info for skills (from computed metrics)
          const skillZoneMap: Record<string, string> = {};
          for (const s of skills) {
            skillZoneMap[s.skill_name] = s.zone;
          }
          
          const commentsPrompt = `Ты — HR-аналитик. Проанализируй комментарии внешних респондентов из 360-оценки и подготовь case-based обзор для Unit-lead.

ФОРМАТ: Каждый вывод — это КЕЙС (наблюдаемый паттерн/тема), а НЕ описание одного навыка.

ПРАВИЛА:
1. Основная сущность — кейс (наблюдение/тема), а не навык.
2. Каждый кейс подтверждён минимум 1 комментарием (evidence_count >= 1).
3. related_skills — только как ГИПОТЕЗА связи, не более 2 навыков на кейс. Если связь слабая — оставь пустой массив.
4. Вопросы для 1:1 формируй от кейсов и их сигналов, а не от skill-label.
5. Тон: нейтрально-деловой, без диагнозов личности.
6. Без деанонимизации, без цитирования, по которым можно идентифицировать автора.
7. ${languageGuide}

ЗОНЫ НАВЫКОВ (для related_zones):
${JSON.stringify(skillZoneMap, null, 2)}

ДАННЫЕ (навык → комментарий):
${JSON.stringify(externalComments.map(c => ({ skill_name: c.skill_name, comment: c.comment })), null, 2)}`;

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
                      name: "generate_case_review",
                      description: "Case-based ревью комментариев внешних респондентов",
                      parameters: {
                        type: "object",
                        properties: {
                          summary_cases: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: { type: "string", description: "Уникальный ID кейса, например case_1" },
                                type: { type: "string", enum: ["strength", "attention"], description: "Тип кейса: сильная сторона или зона внимания" },
                                title: { type: "string", description: "Краткий заголовок кейса (3-7 слов)" },
                                insight: { type: "string", description: "1-2 предложения по сути кейса" },
                                evidence_count: { type: "number", description: "Количество комментариев, подтверждающих кейс" },
                                example_signals: { type: "array", items: { type: "string" }, description: "1-2 сигнала из комментариев (перефразированные, без цитат)" },
                                related_zones: { type: "array", items: { type: "string", enum: ["open", "blind", "hidden", "unknown"] }, description: "Зоны Джохари, к которым может относиться кейс" },
                                related_skills: {
                                  type: "array",
                                  items: {
                                    type: "object",
                                    properties: {
                                      skill_name: { type: "string" },
                                      relation: { type: "string", enum: ["primary", "secondary"] }
                                    },
                                    required: ["skill_name", "relation"],
                                    additionalProperties: false
                                  },
                                  description: "0-2 навыка как гипотеза связи. Пустой массив если связь неочевидна."
                                }
                              },
                              required: ["id", "type", "title", "insight", "evidence_count", "example_signals", "related_zones", "related_skills"],
                              additionalProperties: false
                            },
                            description: "3-5 кейсов (strength или attention)"
                          },
                          one_to_one_questions: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                case_id: { type: "string", description: "ID связанного кейса" },
                                zone: { type: "string", enum: ["open", "blind", "hidden", "unknown"], description: "Зона Джохари" },
                                question: { type: "string", description: "Вопрос для обсуждения Unit-lead с сотрудником" }
                              },
                              required: ["case_id", "zone", "question"],
                              additionalProperties: false
                            },
                            description: "3-5 вопросов для 1:1, привязанных к кейсам"
                          }
                        },
                        required: ["summary_cases", "one_to_one_questions"],
                        additionalProperties: false
                      }
                    }
                  }
                ],
                tool_choice: { type: "function", function: { name: "generate_case_review" } }
              }),
            });

            if (commentsAiResponse.ok) {
              const commentsAiData = await commentsAiResponse.json();
              const commentsToolCall = commentsAiData.choices[0]?.message?.tool_calls?.[0];
              if (commentsToolCall) {
                const parsed = JSON.parse(commentsToolCall.function.arguments);
                externalCommentsReview = {
                  summary_cases: parsed.summary_cases || [],
                  one_to_one_questions: parsed.one_to_one_questions || [],
                  notes: {
                    comments_used: externalComments.length
                  }
                };
                console.log('External comments case-based review generated successfully');
              }
            } else {
              console.error('Comments AI call failed:', commentsAiResponse.status);
            }
          } catch (aiErr) {
            console.error('Error generating comments review:', aiErr);
          }
        }
      }
    }

    // 10. Insert new snapshot with safe version increment (scope-aware)
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
          ai_text: JSON.stringify(aiText),
          data_hash: dataHash,
          prompt_version: PROMPT_VERSION,
          model: AI_MODEL,
          external_comments_review: externalCommentsReview
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

    console.log(`Johari report generated successfully, version=${insertedSnapshot.version}, scope=${scope}`);

    return new Response(
      JSON.stringify({
        snapshot: insertedSnapshot,
        data_changed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in generate-johari-report:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
