import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GradeRow {
  'Название грейда': string;
  'Уровень грейда': number;
  'Должность': string;
  'Тип навыка': string;
  'Skill': string;
  'Уровень навыка': number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { grades } = await req.json() as { grades: GradeRow[] };

    console.log(`Starting grades import: ${grades.length} rows`);

    // Maps to track created entities
    const gradeMap = new Map<string, string>();
    const positionMap = new Map<string, string>();
    let gradesCreated = 0;
    let gradeSkillsCreated = 0;
    let gradeQualitiesCreated = 0;

    // Step 1: Create or find positions
    const uniquePositions = new Set(grades.map(g => g['Должность']));
    
    for (const positionName of uniquePositions) {
      const { data: existingPosition } = await supabaseAdmin
        .from('positions')
        .select('id')
        .eq('name', positionName)
        .single();

      if (existingPosition) {
        positionMap.set(positionName, existingPosition.id);
      } else {
        // Get or create default position category
        const { data: defaultCategory } = await supabaseAdmin
          .from('position_categories')
          .select('id')
          .eq('name', 'Общая')
          .single();

        let categoryId = defaultCategory?.id;
        
        if (!categoryId) {
          const { data: newCategory, error: catError } = await supabaseAdmin
            .from('position_categories')
            .insert({ name: 'Общая', description: 'Категория по умолчанию' })
            .select('id')
            .single();
          
          if (catError) throw new Error(`Failed to create position category: ${catError.message}`);
          categoryId = newCategory.id;
        }

        const { data: newPosition, error } = await supabaseAdmin
          .from('positions')
          .insert({ name: positionName, position_category_id: categoryId })
          .select('id')
          .single();

        if (error) throw new Error(`Failed to create position: ${error.message}`);
        positionMap.set(positionName, newPosition.id);
      }
    }

    // Step 2: Create or update grades
    const uniqueGrades = new Map<string, { name: string; level: number; position: string }>();
    
    for (const row of grades) {
      const gradeKey = `${row['Название грейда']}:${row['Уровень грейда']}`;
      if (!uniqueGrades.has(gradeKey)) {
        uniqueGrades.set(gradeKey, {
          name: row['Название грейда'],
          level: row['Уровень грейда'],
          position: row['Должность']
        });
      }
    }

    for (const [gradeKey, gradeInfo] of uniqueGrades.entries()) {
      const positionId = positionMap.get(gradeInfo.position);
      
      const { data: existingGrade } = await supabaseAdmin
        .from('grades')
        .select('id')
        .eq('name', gradeInfo.name)
        .eq('level', gradeInfo.level)
        .single();

      if (existingGrade) {
        gradeMap.set(gradeKey, existingGrade.id);
        
        // Update position if different
        await supabaseAdmin
          .from('grades')
          .update({ position_id: positionId })
          .eq('id', existingGrade.id);
      } else {
        const { data: newGrade, error } = await supabaseAdmin
          .from('grades')
          .insert({
            name: gradeInfo.name,
            level: gradeInfo.level,
            position_id: positionId
          })
          .select('id')
          .single();

        if (error) throw new Error(`Failed to create grade: ${error.message}`);
        gradeMap.set(gradeKey, newGrade.id);
        gradesCreated++;
      }
    }

    // Step 3: Create grade_skills and grade_qualities
    for (const row of grades) {
      const gradeKey = `${row['Название грейда']}:${row['Уровень грейда']}`;
      const gradeId = gradeMap.get(gradeKey);
      
      if (!gradeId) {
        console.error(`Grade not found: ${gradeKey}`);
        continue;
      }

      const type = row['Тип навыка'].toLowerCase();
      const skillName = row['Skill'];
      const targetLevel = row['Уровень навыка'];

      if (type === 'hard') {
        // Find hard skill
        const { data: skill } = await supabaseAdmin
          .from('hard_skills')
          .select('id')
          .eq('name', skillName)
          .single();

        if (!skill) {
          console.warn(`Hard skill not found: ${skillName} - skipping`);
          continue;
        }

        // Upsert grade_skill
        const { error } = await supabaseAdmin
          .from('grade_skills')
          .upsert({
            grade_id: gradeId,
            skill_id: skill.id,
            target_level: targetLevel
          }, {
            onConflict: 'grade_id,skill_id'
          });

        if (error) {
          console.error(`Failed to create grade_skill: ${error.message}`);
        } else {
          gradeSkillsCreated++;
        }
      } else if (type === 'soft') {
        // Find soft skill
        const { data: quality } = await supabaseAdmin
          .from('soft_skills')
          .select('id')
          .eq('name', skillName)
          .single();

        if (!quality) {
          console.warn(`Soft skill not found: ${skillName} - skipping`);
          continue;
        }

        // Upsert grade_quality
        const { error } = await supabaseAdmin
          .from('grade_qualities')
          .upsert({
            grade_id: gradeId,
            quality_id: quality.id,
            target_level: targetLevel
          }, {
            onConflict: 'grade_id,quality_id'
          });

        if (error) {
          console.error(`Failed to create grade_quality: ${error.message}`);
        } else {
          gradeQualitiesCreated++;
        }
      }
    }

    console.log('Grades import completed successfully');
    console.log(`Created: ${gradesCreated} grades, ${gradeSkillsCreated} grade_skills, ${gradeQualitiesCreated} grade_qualities`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Грейды успешно импортированы',
        created: {
          grades: gradesCreated,
          grade_skills: gradeSkillsCreated,
          grade_qualities: gradeQualitiesCreated
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Grades import error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ошибка импорта грейдов' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
