import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApprovedAssignment {
  id: string;
  evaluating_user_id: string;
  evaluated_user_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check for authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { approvedAssignments, diagnosticStageId, evaluatedUserName, deadline } = await req.json();

    console.log('Creating tasks for approved assignments:', {
      count: approvedAssignments.length,
      diagnosticStageId,
      evaluatedUserName,
      deadline,
    });

    // Create tasks for each approved assignment
    const tasksToCreate = [];
    for (const assignment of approvedAssignments as ApprovedAssignment[]) {
      // Check if task already exists
      const { data: existingTask } = await supabaseClient
        .from('tasks')
        .select('id')
        .eq('user_id', assignment.evaluating_user_id)
        .eq('assignment_id', assignment.id)
        .maybeSingle();

      if (!existingTask) {
        tasksToCreate.push({
          user_id: assignment.evaluating_user_id,
          diagnostic_stage_id: diagnosticStageId,
          assignment_id: assignment.id,
          assignment_type: 'peer',
          title: `Обратная связь для коллеги: ${evaluatedUserName}`,
          description: `Необходимо заполнить форму обратной связи для ${evaluatedUserName}${deadline ? `. Срок: ${deadline}` : ''}`,
          status: 'pending',
          deadline: deadline,
          task_type: 'survey_360_evaluation',
          category: 'assessment',
        });
      }
    }

    if (tasksToCreate.length > 0) {
      const { data: createdTasks, error: insertError } = await supabaseClient
        .from('tasks')
        .insert(tasksToCreate)
        .select();

      if (insertError) {
        console.error('Error creating tasks:', insertError);
        throw insertError;
      }

      console.log('Created tasks:', createdTasks);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksCreated: tasksToCreate.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-peer-evaluation-tasks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
