import { supabase } from '@/integrations/supabase/client';

const questions = [
  {
    question_text: 'Насколько четко, структурированно и понятно сотрудник излагает информацию (устно и письменно) в общении с заказчиком?',
    category: 'Коммуникация и взаимодействие',
    soft_skill_name: 'Четкость и ясность коммуникации',
    order_index: 1,
    answer_category_name: 'Четкость и ясность коммуникации'
  },
  {
    question_text: 'Насколько проактивно и своевременно сотрудник сообщает заказчику о возникающих рисках, проблемах или изменениях в сроках/функционале?',
    category: 'Коммуникация и взаимодействие',
    soft_skill_name: 'Управление ожиданиями и рисками',
    order_index: 2,
    answer_category_name: 'Управление ожиданиями и рисками'
  },
  {
    question_text: 'Насколько убедительно и аргументированно сотрудник объясняет и защищает предложенные решения и подходы перед заказчиком?',
    category: 'Коммуникация и взаимодействие',
    soft_skill_name: 'Адаптивность и гибкость',
    order_index: 3,
    answer_category_name: 'Адаптивность и гибкость'
  },
  {
    question_text: 'Насколько часто в работе возникают ситуации недопонимания с заказчиком или необходимости переспрашивать из-за неточной или неполной информации от сотрудника?',
    category: 'Коммуникация и взаимодействие',
    soft_skill_name: 'Инициативность и проактивность',
    order_index: 4,
    answer_category_name: 'Инициативность и проактивность'
  }
];

export async function importSoftSkillQuestions() {
  console.log('Starting import of soft skill questions...');

  // First, get all answer categories
  const { data: answerCategories, error: categoriesError } = await supabase
    .from('answer_categories')
    .select('id, name');

  if (categoriesError) {
    console.error('Error fetching answer categories:', categoriesError);
    return;
  }

  console.log('Found answer categories:', answerCategories);

  // Create a map for quick lookup
  const categoryMap = new Map(
    answerCategories?.map(cat => [cat.name, cat.id]) || []
  );

  // Get all soft skills
  const { data: softSkills, error: skillsError } = await supabase
    .from('soft_skills')
    .select('id, name');

  if (skillsError) {
    console.error('Error fetching soft skills:', skillsError);
    return;
  }

  console.log('Found soft skills:', softSkills);

  // Create a map for soft skills
  const skillsMap = new Map(
    softSkills?.map(skill => [skill.name, skill.id]) || []
  );

  for (const question of questions) {
    try {
      const answerCategoryId = categoryMap.get(question.answer_category_name);
      const qualityId = skillsMap.get(question.soft_skill_name);

      if (!answerCategoryId) {
        console.warn(`Answer category not found: ${question.answer_category_name}`);
        continue;
      }

      // Check if question already exists
      const { data: existing } = await supabase
        .from('soft_skill_questions')
        .select('id')
        .eq('question_text', question.question_text)
        .maybeSingle();

      if (existing) {
        console.log(`Question already exists: ${question.question_text.substring(0, 50)}...`);
        continue;
      }

      const { error: insertError } = await supabase
        .from('soft_skill_questions')
        .insert({
          question_text: question.question_text,
          category: question.category,
          quality_id: qualityId || null,
          order_index: question.order_index,
          answer_category_id: answerCategoryId
        });

      if (insertError) {
        console.error(`Error inserting question "${question.question_text.substring(0, 50)}...":`, insertError);
      } else {
        console.log(`Created question: ${question.question_text.substring(0, 50)}...`);
      }

    } catch (error) {
      console.error(`Unexpected error processing question:`, error);
    }
  }

  console.log('Import completed!');
}
