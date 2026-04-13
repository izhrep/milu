/** Single source of truth for the project dropdown across Team Profiles module. */
export const PROJECT_LIST = [
  'Останкино казна',
  'X5 Опт',
  'X5 Деликатесы',
  'Ригла',
  'Бинергия Челнок',
  'Черноголовка Челнок',
  'Бристоль',
  'Дикси',
  'Останкино Бюджет',
  'Хендерсон',
  'Шамса',
] as const;

export type ProjectName = (typeof PROJECT_LIST)[number];
