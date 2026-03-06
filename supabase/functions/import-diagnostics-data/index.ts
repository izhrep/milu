import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuestionRow {
  Тип: string;
  Категория: string;
  Подкатегория: string;
  Skill: string;
  'Описание навыка': string;
  'Текст вопроса': string;
  'Порядок вопроса': number;
  'Название группы ответов': string;
  'Ограничение видимости вопроса'?: string;
}

interface AnswerRow {
  Тип: string;
  'Название группы ответов': string;
  'Описание группы ответов': string;
  'Название ответа': string;
  'Описание ответа': string;
  'Уровень ответа': number;
  'Порядок ответа': number;
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

    const { questions, answers } = await req.json() as {
      questions: QuestionRow[];
      answers: AnswerRow[];
    };

    console.log(`Starting import: ${questions.length} questions, ${answers.length} answers`);

    // Step 1: Process categories, subcategories, and skills
    const categoryMap = new Map<string, { id: string; type: string }>();
    const subCategoryMap = new Map<string, { id: string; type: string; categoryId: string }>();
    const skillMap = new Map<string, { id: string; type: string }>();

    for (const q of questions) {
      const type = q.Тип.toLowerCase();
      const categoryTable = type === 'hard' ? 'category_hard_skills' : 'category_soft_skills';
      const subCategoryTable = type === 'hard' ? 'sub_category_hard_skills' : 'sub_category_soft_skills';
      const skillTable = type === 'hard' ? 'hard_skills' : 'soft_skills';

      // Process category
      const categoryKey = `${type}:${q.Категория}`;
      if (!categoryMap.has(categoryKey)) {
        const { data: existingCategory } = await supabaseAdmin
          .from(categoryTable)
          .select('id')
          .eq('name', q.Категория)
          .single();

        if (existingCategory) {
          categoryMap.set(categoryKey, { id: existingCategory.id, type });
        } else {
          const { data: newCategory, error } = await supabaseAdmin
            .from(categoryTable)
            .insert({ name: q.Категория })
            .select('id')
            .single();

          if (error) throw new Error(`Failed to create category: ${error.message}`);
          categoryMap.set(categoryKey, { id: newCategory.id, type });
        }
      }

      // Process subcategory (if exists)
      if (q.Подкатегория) {
        const subCategoryKey = `${type}:${q.Категория}:${q.Подкатегория}`;
        if (!subCategoryMap.has(subCategoryKey)) {
          const categoryId = categoryMap.get(categoryKey)!.id;
          const foreignKeyField = type === 'hard' ? 'category_hard_skill_id' : 'category_soft_skill_id';

          const { data: existingSubCategory } = await supabaseAdmin
            .from(subCategoryTable)
            .select('id')
            .eq('name', q.Подкатегория)
            .eq(foreignKeyField, categoryId)
            .single();

          if (existingSubCategory) {
            subCategoryMap.set(subCategoryKey, { id: existingSubCategory.id, type, categoryId });
          } else {
            const { data: newSubCategory, error } = await supabaseAdmin
              .from(subCategoryTable)
              .insert({ name: q.Подкатегория, [foreignKeyField]: categoryId })
              .select('id')
              .single();

            if (error) throw new Error(`Failed to create subcategory: ${error.message}`);
            subCategoryMap.set(subCategoryKey, { id: newSubCategory.id, type, categoryId });
          }
        }
      }

      // Process skill
      const skillKey = `${type}:${q.Skill}`;
      if (!skillMap.has(skillKey)) {
        const categoryId = categoryMap.get(categoryKey)!.id;
        const subCategoryKey = q.Подкатегория ? `${type}:${q.Категория}:${q.Подкатегория}` : null;
        const subCategoryId = subCategoryKey ? subCategoryMap.get(subCategoryKey)?.id : null;

        const { data: existingSkill } = await supabaseAdmin
          .from(skillTable)
          .select('id')
          .eq('name', q.Skill)
          .single();

        if (existingSkill) {
          skillMap.set(skillKey, { id: existingSkill.id, type });
        } else {
          const skillData: any = {
            name: q.Skill,
            category_id: categoryId,
            description: q['Описание навыка'] || null,
          };

          if (subCategoryId) {
            skillData.sub_category_id = subCategoryId;
          }

          const { data: newSkill, error } = await supabaseAdmin
            .from(skillTable)
            .insert(skillData)
            .select('id')
            .single();

          if (error) throw new Error(`Failed to create skill: ${error.message}`);
          skillMap.set(skillKey, { id: newSkill.id, type });
        }
      }
    }

    // Step 2: Create questions (without answer_category_id)
    const questionMap = new Map<string, { id: string; type: string; answerCategoryName: string }>();

    for (const q of questions) {
      const type = q.Тип.toLowerCase();
      const questionTable = type === 'hard' ? 'hard_skill_questions' : 'soft_skill_questions';
      const skillKey = `${type}:${q.Skill}`;
      const skillId = skillMap.get(skillKey)?.id;

      if (!skillId) {
        console.error(`Skill not found: ${skillKey}`);
        continue;
      }

      // Map visibility restriction
      let visibilityRestrictionEnabled = false;
      let visibilityRestrictionType = null;
      
      if (q['Ограничение видимости вопроса']) {
        const restriction = q['Ограничение видимости вопроса'].toLowerCase();
        visibilityRestrictionEnabled = true;
        if (restriction === 'self' || restriction === 'самооценка') {
          visibilityRestrictionType = 'self';
        } else if (restriction === 'manager' || restriction === 'руководитель') {
          visibilityRestrictionType = 'manager';
        } else if (restriction === 'peer' || restriction === 'коллега') {
          visibilityRestrictionType = 'peer';
        }
      }

      const questionData: any = {
        question_text: q['Текст вопроса'],
        skill_id: type === 'hard' ? skillId : undefined,
        quality_id: type === 'soft' ? skillId : undefined,
        order_index: q['Порядок вопроса'],
        visibility_restriction_enabled: visibilityRestrictionEnabled,
        visibility_restriction_type: visibilityRestrictionType,
      };

      const { data: newQuestion, error } = await supabaseAdmin
        .from(questionTable)
        .insert(questionData)
        .select('id')
        .single();

      if (error) throw new Error(`Failed to create question: ${error.message}`);

      const questionKey = `${type}:${q.Skill}:${q['Текст вопроса']}`;
      questionMap.set(questionKey, {
        id: newQuestion.id,
        type,
        answerCategoryName: q['Название группы ответов'],
      });
    }

    // Step 3: Create answer categories
    const answerCategoryMap = new Map<string, string>();

    for (const a of answers) {
      const type = a.Тип.toLowerCase();
      const categoryKey = `${type}:${a['Название группы ответов']}`;

      if (!answerCategoryMap.has(categoryKey)) {
        const { data: existingCategory } = await supabaseAdmin
          .from('answer_categories')
          .select('id')
          .eq('name', a['Название группы ответов'])
          .eq('question_type', type)
          .single();

        if (existingCategory) {
          answerCategoryMap.set(categoryKey, existingCategory.id);
        } else {
          const { data: newCategory, error } = await supabaseAdmin
            .from('answer_categories')
            .insert({
              name: a['Название группы ответов'],
              description: a['Описание группы ответов'] || null,
              question_type: type,
            })
            .select('id')
            .single();

          if (error) throw new Error(`Failed to create answer category: ${error.message}`);
          answerCategoryMap.set(categoryKey, newCategory.id);
        }
      }
    }

    // Step 4: Create answer options
    for (const a of answers) {
      const type = a.Тип.toLowerCase();
      const answerTable = type === 'hard' ? 'hard_skill_answer_options' : 'soft_skill_answer_options';
      const categoryKey = `${type}:${a['Название группы ответов']}`;
      const categoryId = answerCategoryMap.get(categoryKey);

      if (!categoryId) {
        console.error(`Answer category not found: ${categoryKey}`);
        continue;
      }

      const answerData: any = {
        answer_category_id: categoryId,
        title: a['Название ответа'],
        description: a['Описание ответа'] || null,
        level_value: a['Уровень ответа'],
        numeric_value: a['Уровень ответа'],
        order_index: a['Порядок ответа'],
      };

      const { error } = await supabaseAdmin
        .from(answerTable)
        .insert(answerData);

      if (error) throw new Error(`Failed to create answer option: ${error.message}`);
    }

    // Step 5: Link questions to answer categories
    for (const [questionKey, questionData] of questionMap.entries()) {
      const type = questionData.type;
      const questionTable = type === 'hard' ? 'hard_skill_questions' : 'soft_skill_questions';
      const categoryKey = `${type}:${questionData.answerCategoryName}`;
      const categoryId = answerCategoryMap.get(categoryKey);

      if (!categoryId) {
        console.error(`Answer category not found for question: ${questionKey}`);
        continue;
      }

      const { error } = await supabaseAdmin
        .from(questionTable)
        .update({ answer_category_id: categoryId })
        .eq('id', questionData.id);

      if (error) throw new Error(`Failed to link question to answer category: ${error.message}`);
    }

    console.log('Import completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Данные успешно импортированы' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Ошибка импорта' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
