import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SIGNED_URL_TTL = 300; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify identity
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin permission
    const { data: hasPermission, error: permError } = await supabase
      .rpc('has_permission', { _user_id: user.id, _permission_name: 'system.admin' });

    if (permError || !hasPermission) {
      console.error('User lacks admin permission:', user.id);
      await supabase.from('access_denied_logs').insert({
        user_id: user.id,
        permission_name: 'system.admin',
        action_attempted: 'create_database_dump',
        resource_type: 'system'
      });
      return new Response(
        JSON.stringify({ error: 'Доступ запрещен. Только администраторы могут создавать дампы базы данных.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting database dump...');

    const sqlDump = await generateDump(supabase, supabaseUrl);

    // Upload to PRIVATE backups bucket
    const date = new Date().toISOString().split('T')[0];
    const filename = `supabase_dump_${date}_${Date.now()}.sql`;

    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(filename, new Blob([sqlDump], { type: 'text/plain' }), {
        contentType: 'text/plain',
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ошибка сохранения дампа. Обратитесь к администратору.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create signed URL (5 min TTL) instead of public URL
    const { data: signedData, error: signedError } = await supabase.storage
      .from('backups')
      .createSignedUrl(filename, SIGNED_URL_TTL);

    if (signedError || !signedData?.signedUrl) {
      console.error('Signed URL error:', signedError);
      return new Response(
        JSON.stringify({
          success: true,
          message: `✅ Дамп сохранён: ${filename}. Не удалось сгенерировать ссылку.`,
          filename
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Dump created successfully:', filename);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Дамп готов: ${filename}`,
        filename,
        url: signedData.signedUrl,
        expiresInSeconds: SIGNED_URL_TTL,
        size: new Blob([sqlDump]).size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Database dump error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Ошибка создания дампа базы данных. Обратитесь к администратору.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function generateDump(supabase: any, supabaseUrl: string): Promise<string> {
  const knownTables = [
    'users', 'user_roles', 'permissions', 'role_permissions',
    'departments', 'positions', 'position_categories', 'grades',
    'skills', 'category_skills', 'qualities', 'grade_skills', 'grade_qualities',
    'user_skills', 'user_qualities', 'certifications', 'manufacturers',
    'diagnostic_stages', 'diagnostic_stage_participants',
    'meeting_stages', 'meeting_stage_participants', 'one_on_one_meetings', 'meeting_decisions',
    'survey_360_assignments', 'soft_skill_results', 'soft_skill_questions', 'soft_skill_answer_options',
    'hard_skill_results', 'hard_skill_questions', 'hard_skill_answer_options',
    'tasks', 'development_plans', 'development_tasks',
    'career_tracks', 'career_track_steps', 'track_types',
    'user_assessment_results', 'admin_sessions', 'admin_activity_logs', 'audit_log',
    'auth_users', 'competency_levels', 'trade_points', 'survey_assignments', 'user_achievements'
  ];

  let sqlDump = `-- Supabase Database DDL Dump\n-- Generated: ${new Date().toISOString()}\n-- Database: ${supabaseUrl}\n\nSET statement_timeout = 0;\nSET lock_timeout = 0;\nSET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\nSET check_function_bodies = false;\n\n`;

  for (const tableName of knownTables) {
    console.log(`Processing table: ${tableName}`);
    try {
      const { data: rows, error: sampleError } = await supabase
        .from(tableName).select('*').limit(1);

      if (sampleError) {
        console.warn(`Skipping table ${tableName}:`, sampleError.message);
        sqlDump += `-- Table ${tableName} skipped: ${sampleError.message}\n\n`;
        continue;
      }

      if (rows && rows.length > 0) {
        const firstRow = rows[0];
        const columnDefs = Object.keys(firstRow).map(col => {
          const value = firstRow[col];
          let type = 'TEXT';
          if (typeof value === 'number') type = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
          else if (typeof value === 'boolean') type = 'BOOLEAN';
          else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) type = 'TIMESTAMP WITH TIME ZONE';
          else if (typeof value === 'object' && value !== null) type = 'JSONB';
          return `  ${col} ${type}`;
        }).join(',\n');
        sqlDump += `-- Table: ${tableName}\nCREATE TABLE IF NOT EXISTS public.${tableName} (\n${columnDefs}\n);\n\n`;
      } else {
        sqlDump += `-- Table: ${tableName} (empty)\nCREATE TABLE IF NOT EXISTS public.${tableName} (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid()\n);\n\n`;
      }

      // Fetch data in chunks
      let offset = 0;
      const limit = 500;
      let hasMore = true;

      while (hasMore) {
        const { data: dataRows, error: dataError } = await supabase
          .from(tableName).select('*').range(offset, offset + limit - 1);

        if (dataError || !dataRows || dataRows.length === 0) {
          hasMore = false;
          break;
        }

        const columns = Object.keys(dataRows[0]);
        const columnsList = columns.join(', ');

        for (const row of dataRows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? 'true' : 'false';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
            return value;
          }).join(', ');
          sqlDump += `INSERT INTO public.${tableName} (${columnsList}) VALUES (${values});\n`;
        }

        hasMore = dataRows.length >= limit;
        offset += limit;
      }

      sqlDump += '\n';
    } catch (tableError) {
      console.error(`Error processing table ${tableName}:`, tableError);
      sqlDump += `-- Error processing table ${tableName}\n\n`;
    }
  }

  return sqlDump;
}
