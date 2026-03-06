// Foreign key mappings for all tables
export const foreignKeyMappings: Record<string, Record<string, { table: string; display: string; filter?: { column: string; value: string } }>> = {
  users: { 
    position_id: { table: 'positions', display: 'name' }, 
    department_id: { table: 'departments', display: 'name' },
    manager_id: { table: 'users', display: 'last_name' },
    hr_bp_id: { table: 'users', display: 'last_name' }
  },
  companies: {},
  departments: {
    company_id: { table: 'companies', display: 'name' }
  },
  positions: { position_category_id: { table: 'position_categories', display: 'name' } },
  grades: { 
    position_id: { table: 'positions', display: 'name' }, 
    position_category_id: { table: 'position_categories', display: 'name' },
    parent_grade_id: { table: 'grades', display: 'name' },
    certification_id: { table: 'certifications', display: 'name' }
  },
  career_tracks: { 
    track_type_id: { table: 'track_types', display: 'name' }, 
    target_position_id: { table: 'positions', display: 'name' } 
  },
  career_track_steps: { 
    career_track_id: { table: 'career_tracks', display: 'name' }, 
    grade_id: { table: 'grades', display: 'name' } 
  },
  grade_skills: { 
    grade_id: { table: 'grades', display: 'name' }, 
    skill_id: { table: 'hard_skills', display: 'name' } 
  },
  grade_qualities: { 
    grade_id: { table: 'grades', display: 'name' }, 
    quality_id: { table: 'soft_skills', display: 'name' } 
  },
  hard_skills: { 
    category_id: { table: 'category_hard_skills', display: 'name' } 
  },
  hard_skill_questions: { 
    skill_id: { table: 'hard_skills', display: 'name' } 
  },
  soft_skill_questions: { 
    quality_id: { table: 'soft_skills', display: 'name' } 
  },
};

// Column display names in Russian
export const columnDisplayNames: Record<string, Record<string, string>> = {
  users: {
    last_name: 'Фамилия',
    first_name: 'Имя',
    middle_name: 'Отчество',
    employee_number: 'Табельный номер',
    email: 'Email',
    position_id: 'Должность',
    department_id: 'Подразделение',
    manager_id: 'Руководитель',
    hr_bp_id: 'HR BP',
    start_date: 'Дата начала работы',
    status: 'Статус'
  },
  companies: {
    name: 'Название',
    description: 'Описание'
  },
  departments: {
    name: 'Название',
    company_id: 'Компания',
    description: 'Описание'
  },
  positions: {
    name: 'Название',
    position_category_id: 'Категория должности'
  },
  position_categories: {
    name: 'Название',
    description: 'Описание'
  },
  grades: {
    name: 'Название',
    level: 'Уровень',
    position_id: 'Должность',
    position_category_id: 'Категория должности',
    parent_grade_id: 'Родительский грейд',
    description: 'Описание',
    key_tasks: 'Ключевые задачи',
    certification_id: 'Сертификация',
    min_salary: 'Минимальная зарплата',
    max_salary: 'Максимальная зарплата'
  },
  hard_skills: {
    name: 'Название',
    description: 'Описание',
    category_id: 'Категория'
  },
  category_hard_skills: {
    name: 'Название',
    description: 'Описание'
  },
  soft_skills: {
    name: 'Название',
    description: 'Описание'
  },
  competency_levels: {
    level: 'Уровень',
    name: 'Название',
    description: 'Описание'
  },
  hard_skill_questions: {
    question_text: 'Текст вопроса',
    skill_id: 'Навык',
    order_index: 'Порядковый номер'
  },
  hard_skill_answer_options: {
    title: 'Название',
    description: 'Описание',
    step: 'Шаг'
  },
  soft_skill_questions: {
    question_text: 'Текст вопроса',
    quality_id: 'Качество',
    category: 'Категория',
    order_index: 'Порядковый номер'
  },
  soft_skill_answer_options: {
    label: 'Название',
    description: 'Описание',
    value: 'Значение'
  },
  career_tracks: {
    name: 'Название',
    description: 'Описание',
    track_type_id: 'Тип трека',
    target_position_id: 'Целевая должность',
    duration_months: 'Длительность (месяцы)'
  },
  track_types: {
    name: 'Название',
    description: 'Описание'
  },
  trade_points: {
    name: 'Название',
    address: 'Адрес',
    latitude: 'Широта',
    longitude: 'Долгота',
    status: 'Статус'
  },
  products: {
    name: 'Название',
    manufacturer_id: 'Производитель'
  },
  sprint_types: {
    type_name: 'Название типа',
    target_influence: 'Целевое влияние',
    target_audience: 'Целевая аудитория',
    achievement_tools: 'Инструменты достижения',
    prize_fund: 'Призовой фонд'
  },
  manufacturers: {
    name: 'Название',
    brand: 'Бренд'
  },
  certifications: {
    name: 'Название',
    description: 'Описание',
    provider: 'Провайдер',
    validity_period_months: 'Срок действия (месяцы)',
    cost: 'Стоимость'
  }
};

export const hiddenColumns = ['id', 'created_at', 'updated_at', 'last_login_at'];
