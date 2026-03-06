import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, diagnosticStageId } = await req.json();

    console.log('Creating peer selection task for user:', { userId, diagnosticStageId });

    // Check if task already exists
    const { data: existingTask } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('diagnostic_stage_id', diagnosticStageId)
      .eq('task_type', 'peer_selection')
      .maybeSingle();

    if (existingTask) {
      console.log('Task already exists, skipping creation');
      return new Response(
        JSON.stringify({ success: true, taskId: existingTask.id, created: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create peer selection task
    const { data: task, error: insertError } = await supabaseClient
      .from('tasks')
      .insert({
        user_id: userId,
        diagnostic_stage_id: diagnosticStageId,
        title: 'Выбрать респондентов',
        description: 'Выберите респондентов для прохождения формы "Обратная связь 360"',
        status: 'pending',
        task_type: 'peer_selection',
        priority: 'urgent',
        category: 'assessment'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating task:', insertError);
      throw insertError;
    }

    console.log('Peer selection task created:', task);

    return new Response(
      JSON.stringify({ success: true, taskId: task.id, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-peer-selection-task-on-participant-add:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
