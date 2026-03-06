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

    const { managerId, evaluatedUserId, evaluatedUserName, diagnosticStageId } = await req.json();

    console.log('Creating peer approval task for manager:', { 
      managerId, 
      evaluatedUserId, 
      evaluatedUserName,
      diagnosticStageId 
    });

    // Check if task already exists
    const { data: existingTask } = await supabaseClient
      .from('tasks')
      .select('id')
      .eq('user_id', managerId)
      .eq('diagnostic_stage_id', diagnosticStageId)
      .eq('task_type', 'peer_approval')
      .eq('assignment_id', evaluatedUserId) // Use evaluated user id as reference
      .maybeSingle();

    if (existingTask) {
      console.log('Task already exists, skipping creation');
      return new Response(
        JSON.stringify({ success: true, taskId: existingTask.id, created: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get deadline from parent_stages (use end_date as the hard deadline)
    const { data: stageData } = await supabaseClient
      .from('diagnostic_stages')
      .select('parent_id, parent_stages(end_date, reminder_date)')
      .eq('id', diagnosticStageId)
      .single();

    const deadline = stageData?.parent_stages?.end_date || null;
    const reminderDate = stageData?.parent_stages?.reminder_date || null;

    // Create peer approval task for manager
    const { data: task, error: insertError } = await supabaseClient
      .from('tasks')
      .insert({
        user_id: managerId,
        diagnostic_stage_id: diagnosticStageId,
        assignment_id: evaluatedUserId, // Reference to evaluated user
        title: `Утвердить список оценивающих для ${evaluatedUserName}`,
        description: `Согласуйте список коллег, предложенных сотрудником ${evaluatedUserName} для оценки 360. Напоминание: ${reminderDate || 'не указано'}. Срок: ${deadline || 'не указан'}`,
        status: 'pending',
        task_type: 'peer_approval',
        priority: 'urgent',
        category: 'assessment',
        deadline: deadline,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating task:', insertError);
      throw insertError;
    }

    console.log('Peer approval task created:', task);

    return new Response(
      JSON.stringify({ success: true, taskId: task.id, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-peer-approval-task:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
