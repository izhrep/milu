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

interface EntityReport {
  created: number;
  updated: number;
  reused: number;
  errors: string[];
}

interface ImportReport {
  categories: EntityReport;
  subCategories: EntityReport;
  skills: EntityReport;
  questions: EntityReport;
  answerCategories: EntityReport;
  answerOptions: EntityReport;
  totalErrors: number;
  success: boolean;
}

function newEntityReport(): EntityReport {
  return { created: 0, updated: 0, reused: 0, errors: [] };
}

function trimSafe(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { questions, answers } = await req.json() as {
      questions: QuestionRow[];
      answers: AnswerRow[];
    };

    // --- Structural validation ---
    if (!Array.isArray(questions) || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'Данные должны содержать массивы questions и answers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (questions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Массив вопросов пуст' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    if (answers.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Массив ответов пуст' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Starting incremental import: ${questions.length} questions, ${answers.length} answers`);

    const report: ImportReport = {
      categories: newEntityReport(),
      subCategories: newEntityReport(),
      skills: newEntityReport(),
      questions: newEntityReport(),
      answerCategories: newEntityReport(),
      answerOptions: newEntityReport(),
      totalErrors: 0,
      success: true,
    };

    // ========================================
    // STEP 1: Answer categories (from answer sheet)
    // Business key: (name, question_type)
    // ========================================
    const answerCategoryMap = new Map<string, string>(); // "type:name" -> id

    for (const a of answers) {
      const type = trimSafe(a.Тип).toLowerCase();
      const name = trimSafe(a['Название группы ответов']);
      if (!name || !type) continue;

      const cacheKey = `${type}:${name}`;
      if (answerCategoryMap.has(cacheKey)) continue;

      try {
        const description = a['Описание группы ответов'] != null ? String(a['Описание группы ответов']) : null;

        const { data: existing } = await supabaseAdmin
          .from('answer_categories')
          .select('id, description')
          .eq('name', name)
          .eq('question_type', type)
          .maybeSingle();

        if (existing) {
          // Update description if it was empty and now provided
          if (description && !existing.description) {
            await supabaseAdmin
              .from('answer_categories')
              .update({ description })
              .eq('id', existing.id);
            report.answerCategories.updated++;
          } else {
            report.answerCategories.reused++;
          }
          answerCategoryMap.set(cacheKey, existing.id);
        } else {
          const { data: created, error } = await supabaseAdmin
            .from('answer_categories')
            .insert({ name, description, question_type: type })
            .select('id')
            .single();

          if (error) throw error;
          answerCategoryMap.set(cacheKey, created.id);
          report.answerCategories.created++;
        }
      } catch (err: any) {
        report.answerCategories.errors.push(`Категория ответов "${name}" (${type}): ${err.message}`);
      }
    }

    // ========================================
    // STEP 2: Answer options
    // Business key: (answer_category_id, level_value)
    // ========================================
    for (const a of answers) {
      const type = trimSafe(a.Тип).toLowerCase();
      const catName = trimSafe(a['Название группы ответов']);
      const cacheKey = `${type}:${catName}`;
      const categoryId = answerCategoryMap.get(cacheKey);

      if (!categoryId) {
        report.answerOptions.errors.push(`Пропущен вариант ответа: категория "${catName}" (${type}) не найдена`);
        continue;
      }

      const answerTable = type === 'hard' ? 'hard_skill_answer_options' : 'soft_skill_answer_options';
      const levelValue = a['Уровень ответа'];
      // Preserve text as-is (multiline descriptions, no truncation)
      const title = a['Название ответа'] != null ? String(a['Название ответа']) : '';
      const description = a['Описание ответа'] != null ? String(a['Описание ответа']) : null;
      const orderIndex = a['Порядок ответа'] ?? 0;

      try {
        const { data: existing } = await supabaseAdmin
          .from(answerTable)
          .select('id')
          .eq('answer_category_id', categoryId)
          .eq('level_value', levelValue)
          .maybeSingle();

        if (existing) {
          const { error } = await supabaseAdmin
            .from(answerTable)
            .update({
              title,
              description,
              order_index: orderIndex,
              numeric_value: levelValue,
            })
            .eq('id', existing.id);

          if (error) throw error;
          report.answerOptions.updated++;
        } else {
          const { error } = await supabaseAdmin
            .from(answerTable)
            .insert({
              answer_category_id: categoryId,
              title,
              description,
              level_value: levelValue,
              numeric_value: levelValue,
              order_index: orderIndex,
            });

          if (error) throw error;
          report.answerOptions.created++;
        }
      } catch (err: any) {
        report.answerOptions.errors.push(
          `Вариант ответа "${title}" (уровень ${levelValue}, категория "${catName}"): ${err.message}`
        );
      }
    }

    // ========================================
    // STEP 3: Categories, subcategories, skills (from question sheet)
    // Business keys: name (within type table)
    // ========================================
    const categoryMap = new Map<string, string>(); // "type:name" -> id
    const subCategoryMap = new Map<string, string>(); // "type:catName:subName" -> id
    const skillMap = new Map<string, string>(); // "type:name" -> id

    for (let rowIdx = 0; rowIdx < questions.length; rowIdx++) {
      const q = questions[rowIdx];
      const type = trimSafe(q.Тип).toLowerCase();
      if (type !== 'hard' && type !== 'soft') {
        report.categories.errors.push(`Строка ${rowIdx + 2}: неизвестный тип "${q.Тип}"`);
        continue;
      }

      const categoryTable = type === 'hard' ? 'category_hard_skills' : 'category_soft_skills';
      const subCategoryTable = type === 'hard' ? 'sub_category_hard_skills' : 'sub_category_soft_skills';
      const skillTable = type === 'hard' ? 'hard_skills' : 'soft_skills';
      const foreignKeyField = type === 'hard' ? 'category_hard_skill_id' : 'category_soft_skill_id';

      const catName = trimSafe(q.Категория);
      const subCatName = trimSafe(q.Подкатегория);
      const skillName = trimSafe(q.Skill);

      if (!catName) {
        report.categories.errors.push(`Строка ${rowIdx + 2}: пустая категория`);
        continue;
      }
      if (!skillName) {
        report.skills.errors.push(`Строка ${rowIdx + 2}: пустое название навыка`);
        continue;
      }

      // --- Category ---
      const catKey = `${type}:${catName}`;
      if (!categoryMap.has(catKey)) {
        try {
          const { data: existing } = await supabaseAdmin
            .from(categoryTable)
            .select('id')
            .eq('name', catName)
            .maybeSingle();

          if (existing) {
            categoryMap.set(catKey, existing.id);
            report.categories.reused++;
          } else {
            const { data: created, error } = await supabaseAdmin
              .from(categoryTable)
              .insert({ name: catName })
              .select('id')
              .single();
            if (error) throw error;
            categoryMap.set(catKey, created.id);
            report.categories.created++;
          }
        } catch (err: any) {
          report.categories.errors.push(`Категория "${catName}": ${err.message}`);
          continue;
        }
      }
      const categoryId = categoryMap.get(catKey)!;

      // --- Subcategory ---
      let subCategoryId: string | null = null;
      if (subCatName) {
        const subKey = `${type}:${catName}:${subCatName}`;
        if (!subCategoryMap.has(subKey)) {
          try {
            const { data: existing } = await supabaseAdmin
              .from(subCategoryTable)
              .select('id')
              .eq('name', subCatName)
              .eq(foreignKeyField, categoryId)
              .maybeSingle();

            if (existing) {
              subCategoryMap.set(subKey, existing.id);
              report.subCategories.reused++;
            } else {
              const { data: created, error } = await supabaseAdmin
                .from(subCategoryTable)
                .insert({ name: subCatName, [foreignKeyField]: categoryId })
                .select('id')
                .single();
              if (error) throw error;
              subCategoryMap.set(subKey, created.id);
              report.subCategories.created++;
            }
          } catch (err: any) {
            report.subCategories.errors.push(`Подкатегория "${subCatName}": ${err.message}`);
          }
        }
        subCategoryId = subCategoryMap.get(subKey) ?? null;
      }

      // --- Skill ---
      const skillKey = `${type}:${skillName}`;
      if (!skillMap.has(skillKey)) {
        try {
          const { data: existing } = await supabaseAdmin
            .from(skillTable)
            .select('id')
            .eq('name', skillName)
            .maybeSingle();

          if (existing) {
            // Update description if provided and different
            const skillDescription = q['Описание навыка'] != null ? String(q['Описание навыка']) : null;
            if (skillDescription) {
              await supabaseAdmin
                .from(skillTable)
                .update({
                  description: skillDescription,
                  category_id: categoryId,
                  ...(subCategoryId ? { sub_category_id: subCategoryId } : {}),
                })
                .eq('id', existing.id);
              report.skills.updated++;
            } else {
              report.skills.reused++;
            }
            skillMap.set(skillKey, existing.id);
          } else {
            const skillData: Record<string, unknown> = {
              name: skillName,
              category_id: categoryId,
              description: q['Описание навыка'] != null ? String(q['Описание навыка']) : null,
            };
            if (subCategoryId) {
              skillData.sub_category_id = subCategoryId;
            }

            const { data: created, error } = await supabaseAdmin
              .from(skillTable)
              .insert(skillData)
              .select('id')
              .single();
            if (error) throw error;
            skillMap.set(skillKey, created.id);
            report.skills.created++;
          }
        } catch (err: any) {
          report.skills.errors.push(`Навык "${skillName}": ${err.message}`);
        }
      }
    }

    // ========================================
    // STEP 4: Questions
    // Business key: (skill_id/quality_id, question_text) within type table
    // ========================================
    for (let rowIdx = 0; rowIdx < questions.length; rowIdx++) {
      const q = questions[rowIdx];
      const type = trimSafe(q.Тип).toLowerCase();
      if (type !== 'hard' && type !== 'soft') continue;

      const questionTable = type === 'hard' ? 'hard_skill_questions' : 'soft_skill_questions';
      const skillKey = `${type}:${trimSafe(q.Skill)}`;
      const skillId = skillMap.get(skillKey);
      const questionText = q['Текст вопроса'] != null ? String(q['Текст вопроса']) : '';

      if (!skillId) {
        report.questions.errors.push(`Строка ${rowIdx + 2}: навык "${q.Skill}" не найден, вопрос пропущен`);
        continue;
      }
      if (!questionText) {
        report.questions.errors.push(`Строка ${rowIdx + 2}: пустой текст вопроса`);
        continue;
      }

      // Resolve answer category for this question
      const answerCatName = trimSafe(q['Название группы ответов']);
      const answerCatKey = `${type}:${answerCatName}`;
      const answerCategoryId = answerCategoryMap.get(answerCatKey) ?? null;

      // Visibility restriction
      let visibilityRestrictionEnabled = false;
      let visibilityRestrictionType: string | null = null;
      if (q['Ограничение видимости вопроса']) {
        const restriction = trimSafe(q['Ограничение видимости вопроса']).toLowerCase();
        if (restriction) {
          visibilityRestrictionEnabled = true;
          if (restriction === 'self' || restriction === 'самооценка') {
            visibilityRestrictionType = 'self';
          } else if (restriction === 'manager' || restriction === 'руководитель') {
            visibilityRestrictionType = 'manager';
          } else if (restriction === 'peer' || restriction === 'коллега') {
            visibilityRestrictionType = 'peer';
          }
        }
      }

      const skillField = type === 'hard' ? 'skill_id' : 'quality_id';

      try {
        // Look up by business key: (skill/quality + question_text)
        const { data: existing } = await supabaseAdmin
          .from(questionTable)
          .select('id')
          .eq(skillField, skillId)
          .eq('question_text', questionText)
          .maybeSingle();

        if (existing) {
          // Update mutable fields
          const { error } = await supabaseAdmin
            .from(questionTable)
            .update({
              order_index: q['Порядок вопроса'] ?? null,
              visibility_restriction_enabled: visibilityRestrictionEnabled,
              visibility_restriction_type: visibilityRestrictionType,
              answer_category_id: answerCategoryId,
            })
            .eq('id', existing.id);

          if (error) throw error;
          report.questions.updated++;
        } else {
          const questionData: Record<string, unknown> = {
            question_text: questionText,
            [skillField]: skillId,
            order_index: q['Порядок вопроса'] ?? null,
            visibility_restriction_enabled: visibilityRestrictionEnabled,
            visibility_restriction_type: visibilityRestrictionType,
            answer_category_id: answerCategoryId,
          };

          const { error } = await supabaseAdmin
            .from(questionTable)
            .insert(questionData);

          if (error) throw error;
          report.questions.created++;
        }
      } catch (err: any) {
        report.questions.errors.push(
          `Строка ${rowIdx + 2}, вопрос "${questionText.substring(0, 50)}…": ${err.message}`
        );
      }
    }

    // --- Finalize report ---
    report.totalErrors =
      report.categories.errors.length +
      report.subCategories.errors.length +
      report.skills.errors.length +
      report.questions.errors.length +
      report.answerCategories.errors.length +
      report.answerOptions.errors.length;

    report.success = report.totalErrors === 0;

    console.log(`Import completed. Errors: ${report.totalErrors}`);
    console.log(`Categories: +${report.categories.created} ↻${report.categories.reused}`);
    console.log(`Skills: +${report.skills.created} ↻${report.skills.reused} ⟳${report.skills.updated}`);
    console.log(`Questions: +${report.questions.created} ⟳${report.questions.updated}`);
    console.log(`AnswerCategories: +${report.answerCategories.created} ↻${report.answerCategories.reused} ⟳${report.answerCategories.updated}`);
    console.log(`AnswerOptions: +${report.answerOptions.created} ⟳${report.answerOptions.updated}`);

    return new Response(
      JSON.stringify({ success: true, report }),
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
