import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { isUUID, unauthorized, forbidden, badRequest, serverError, jsonOk } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return unauthorized();

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized();

    // --- Permission check ---
    const { data: hasPermission, error: permError } = await supabase
      .rpc('has_permission', { _user_id: user.id, _permission_name: 'system.admin' });

    if (permError || !hasPermission) {
      console.error('Permission denied for bulk snapshot:', user.id);
      await supabase.from('access_denied_logs').insert({
        user_id: user.id,
        permission_name: 'system.admin',
        action_attempted: 'admin_build_stage_snapshots',
        resource_type: 'system',
      });
      return forbidden('Доступ запрещен. Требуется право system.admin.');
    }

    // --- Parse body ---
    const body = await req.json();
    const stageId = body?.stage_id;
    if (!isUUID(stageId)) return badRequest('Invalid stage_id');

    // --- Verify stage exists and is completed (parent is_active = false) ---
    const { data: stage, error: stageError } = await supabase
      .from('diagnostic_stages')
      .select('id, is_active, parent_id, parent:parent_stages(is_active)')
      .eq('id', stageId)
      .single();

    if (stageError || !stage) return badRequest('Этап не найден');

    const parentActive = (stage as any).parent?.is_active;
    if (parentActive === true || stage.is_active === true) {
      return badRequest('Снапшот можно создать только для завершённого этапа');
    }

    // --- Check no running run ---
    const { data: existingRun } = await supabase
      .from('diagnostic_snapshot_runs')
      .select('id')
      .eq('stage_id', stageId)
      .eq('status', 'running')
      .maybeSingle();

    if (existingRun) {
      return badRequest('Уже выполняется запуск для этого этапа');
    }

    // --- Get subjects from survey_360_assignments ---
    const { data: assignments, error: assignError } = await supabase
      .from('survey_360_assignments')
      .select('evaluated_user_id')
      .eq('diagnostic_stage_id', stageId);

    if (assignError) {
      console.error('Error fetching assignments:', assignError);
      return serverError('Ошибка получения списка участников');
    }

    const uniqueUserIds = [...new Set((assignments || []).map((a: any) => a.evaluated_user_id).filter(Boolean))];
    const totalSubjects = uniqueUserIds.length;

    if (totalSubjects === 0) {
      return badRequest('Нет оцениваемых пользователей для этого этапа');
    }

    // --- Create run record ---
    const { data: run, error: runError } = await supabase
      .from('diagnostic_snapshot_runs')
      .insert({
        stage_id: stageId,
        status: 'running',
        started_by: user.id,
        total_subjects: totalSubjects,
      })
      .select('id')
      .single();

    if (runError) {
      console.error('Error creating run:', runError);
      if (runError.code === '23505') {
        return badRequest('Уже выполняется запуск для этого этапа');
      }
      return serverError('Ошибка создания записи запуска');
    }

    const runId = run.id;

    // --- Process subjects ---
    let inserted = 0, skipped = 0, versioned = 0, errors = 0;
    const errorDetails: { user_id: string; error: string }[] = [];

    for (let i = 0; i < uniqueUserIds.length; i++) {
      const userId = uniqueUserIds[i];
      try {
        // Check existing snapshot
        const { data: existing } = await supabase
          .from('diagnostic_result_snapshots')
          .select('id, data_hash, is_current')
          .eq('stage_id', stageId)
          .eq('evaluated_user_id', userId)
          .eq('is_current', true)
          .maybeSingle();

        // Call the existing PL/pgSQL function
        const { error: snapError } = await supabase
          .rpc('create_or_refresh_diagnostic_snapshot', {
            p_stage_id: stageId,
            p_evaluated_user_id: userId,
            p_reason: 'admin_bulk',
          });

        if (snapError) {
          console.error(`Snapshot error for user ${userId}:`, snapError);
          errors++;
          errorDetails.push({ user_id: userId, error: snapError.message });
        } else {
          // Determine action by checking what happened
          const { data: after } = await supabase
            .from('diagnostic_result_snapshots')
            .select('id, data_hash, version')
            .eq('stage_id', stageId)
            .eq('evaluated_user_id', userId)
            .eq('is_current', true)
            .maybeSingle();

          if (!existing && after) {
            inserted++;
          } else if (existing && after && existing.id === after.id) {
            skipped++;
          } else if (existing && after && existing.id !== after.id) {
            versioned++;
          } else {
            skipped++;
          }
        }
      } catch (e) {
        console.error(`Exception for user ${userId}:`, e);
        errors++;
        errorDetails.push({ user_id: userId, error: String(e) });
      }

      // Update progress every 5 subjects or on last
      if ((i + 1) % 5 === 0 || i === uniqueUserIds.length - 1) {
        const processed = i + 1;
        const percent = Math.round((processed / totalSubjects) * 100);
        await supabase
          .from('diagnostic_snapshot_runs')
          .update({
            processed_subjects: processed,
            progress_percent: percent,
            inserted_count: inserted,
            skipped_count: skipped,
            versioned_count: versioned,
            error_count: errors,
          })
          .eq('id', runId);
      }
    }

    // --- Finalize ---
    const finalStatus = errors > 0 && inserted === 0 && versioned === 0 ? 'failed' : 'completed';
    const summaryJson = {
      inserted,
      skipped,
      versioned,
      errors,
      error_details: errorDetails.length > 0 ? errorDetails.slice(0, 50) : undefined,
    };

    await supabase
      .from('diagnostic_snapshot_runs')
      .update({
        status: finalStatus,
        finished_at: new Date().toISOString(),
        processed_subjects: totalSubjects,
        progress_percent: 100,
        inserted_count: inserted,
        skipped_count: skipped,
        versioned_count: versioned,
        error_count: errors,
        summary_json: summaryJson,
        error_message: errors > 0 ? `${errors} ошибок при обработке` : null,
      })
      .eq('id', runId);

    // --- Audit log ---
    try {
      await supabase.rpc('log_admin_action', {
        _admin_id: user.id,
        _target_user_id: null,
        _action_type: 'bulk_snapshot_run',
        _field: 'stage_id',
        _old_value: null,
        _new_value: stageId,
        _details: { run_id: runId, ...summaryJson },
      });
    } catch (auditErr) {
      console.error('Audit log error (non-critical):', auditErr);
    }

    return jsonOk({ run_id: runId, status: finalStatus });
  } catch (error) {
    console.error('Admin bulk snapshot error:', error);
    return serverError('Внутренняя ошибка сервера');
  }
});
