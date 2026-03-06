import { supabase } from '@/integrations/supabase/client';

const answerCategories = [
  {
    name: 'Управление ожиданиями и рисками',
    description: 'Насколько проактивно и своевременно сотрудник сообщает заказчику о возникающих рисках, проблемах или изменениях в сроках/функционале?',
    options: [
      { level: 0, order: 1, title: 'Уровень 0', description: 'Не идентифицирует риски' },
      { level: 1, order: 2, title: 'Уровень 1', description: 'Сообщает о возникших проблемах руководителю, но не клиенту' },
      { level: 2, order: 3, title: 'Уровень 2', description: 'Сообщает клиенту о уже наступивших проблемах или известных рисках, но не всегда заранее.' },
      { level: 3, order: 4, title: 'Уровень 3', description: 'Всегда заранее и проактивно информирует клиента о возможных рисках и проблемах, управляя ожиданиями.' },
      { level: 4, order: 5, title: 'Уровень 4', description: 'Разрабатывает и внедряет в команде процессы по управлению рисками (например, стандартный реестр рисков, регламент коммуникации с клиентом при изменении сроков). Консультирует команды по сложным случаям управления ожиданиями.' }
    ]
  },
  {
    name: 'Адаптивность и гибкость',
    description: 'Насколько эффективно сотрудник реагирует на изменения требований, новые задачи, корректировки со стороны заказчика или команды?',
    options: [
      { level: 0, order: 1, title: 'Уровень 0', description: 'Сопротивляется изменениям, затрудняется перестроиться' },
      { level: 1, order: 2, title: 'Уровень 1', description: 'Принимает изменения, но требуется дополнительная поддержка для адаптации' },
      { level: 2, order: 3, title: 'Уровень 2', description: 'Реагирует спокойно и быстро адаптируется к изменениям, при необходимости обращается за помощью.' },
      { level: 3, order: 4, title: 'Уровень 3', description: 'Легко и проактивно адаптируется, самостоятельно предлагает варианты решения.' },
      { level: 4, order: 5, title: 'Уровень 4', description: 'Помогает всей команде или заказчику гибко реагировать на изменения, выстраивает процессы, которые делают команду более адаптивной (например, вводит гибкий формат документации, обучает гибким методологиям работы).' }
    ]
  },
  {
    name: 'Инициативность и проактивность',
    description: 'В какой степени сотрудник проявляет инициативу в улучшении процессов, предлагает идеи, берется за новые задачи без напоминаний?',
    options: [
      { level: 0, order: 1, title: 'Уровень 0', description: 'Ждет указаний, не проявляет инициативу' },
      { level: 1, order: 2, title: 'Уровень 1', description: 'Иногда предлагает идеи после наводящих вопросов или побуждения' },
      { level: 2, order: 3, title: 'Уровень 2', description: 'Предлагает идеи и улучшения по своим задачам, но не всегда активно их продвигает.' },
      { level: 3, order: 4, title: 'Уровень 3', description: 'Регулярно и проактивно предлагает улучшения и новые решения, берется за реализацию инициатив.' },
      { level: 4, order: 5, title: 'Уровень 4', description: 'Создает культуру инициативности в команде, запускает пилоты новых подходов, менторит других в проактивном мышлении. Предлагает стратегические инициативы, влияющие на процессы компании или продукта.' }
    ]
  }
];

export async function importSoftSkillAnswers() {
  console.log('Starting import of soft skill answer categories and options...');

  for (const category of answerCategories) {
    try {
      // Create category
      const { data: categoryData, error: categoryError } = await supabase
        .from('answer_categories')
        .insert({
          name: category.name,
          description: category.description
        })
        .select()
        .single();

      if (categoryError) {
        console.error(`Error creating category "${category.name}":`, categoryError);
        continue;
      }

      console.log(`Created category: ${category.name}`);

      // Create answer options for this category
      const optionsToInsert = category.options.map(option => ({
        answer_category_id: categoryData.id,
        level_value: option.level,
        numeric_value: option.level,
        order_index: option.order,
        title: option.title,
        description: option.description
      }));

      const { error: optionsError } = await supabase
        .from('soft_skill_answer_options')
        .insert(optionsToInsert);

      if (optionsError) {
        console.error(`Error creating options for category "${category.name}":`, optionsError);
      } else {
        console.log(`Created ${category.options.length} options for category: ${category.name}`);
      }

    } catch (error) {
      console.error(`Unexpected error processing category "${category.name}":`, error);
    }
  }

  console.log('Import completed!');
}
