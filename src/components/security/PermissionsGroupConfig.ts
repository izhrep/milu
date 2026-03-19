import { 
  Home, User, BookOpen, Trophy, TrendingUp, MapPin, Calendar, Target, 
  Shield, Users, BarChart3, CheckSquare, ClipboardList, Settings, Key,
  Briefcase, Building2, GraduationCap, FileBarChart
} from 'lucide-react';

// Группировка ресурсов по разделам меню приложения
export const permissionGroups = [
  {
    id: 'security',
    label: 'Безопасность',
    icon: Shield,
    description: 'Управление безопасностью системы',
    resources: ['security', 'permissions', 'roles', 'audit', 'sessions']
  },
  {
    id: 'users',
    label: 'Пользователи',
    icon: Users,
    description: 'Управление пользователями и командой',
    resources: ['users', 'user', 'team']
  },
  {
    id: 'diagnostics',
    label: 'Диагностика (360)',
    icon: ClipboardList,
    description: 'Обратная связь 360 и диагностика',
    resources: ['diagnostics', 'surveys', 'survey_questions', 'assessment_results']
  },
  {
    id: 'competencies',
    label: 'Компетенции',
    icon: Target,
    description: 'Навыки, качества и уровни',
    resources: ['skills', 'qualities', 'competency_levels', 'categories']
  },
  {
    id: 'organization',
    label: 'Организация',
    icon: Building2,
    description: 'Структура организации',
    resources: ['departments', 'positions', 'grades', 'certifications']
  },
  {
    id: 'development',
    label: 'Развитие',
    icon: GraduationCap,
    description: 'Планы развития и карьерные треки',
    resources: ['career', 'track_types', 'development', 'development_tasks']
  },
  {
    id: 'meetings',
    label: 'Встречи one-to-one',
    icon: Calendar,
    description: 'Управление встречами',
    resources: ['meetings']
  },
  {
    id: 'tasks',
    label: 'Задачи',
    icon: CheckSquare,
    description: 'Управление задачами',
    resources: ['tasks']
  },
  {
    id: 'reports',
    label: 'Отчёты',
    icon: FileBarChart,
    description: 'Формирование отчётов',
    resources: ['reports']
  },
  {
    id: 'other',
    label: 'Прочее',
    icon: Settings,
    description: 'Системные настройки',
    resources: ['settings', 'manufacturers', 'trade_points', 'system']
  }
];

// Переводы ресурсов
export const resourceNames: Record<string, string> = {
  'assessment_results': 'Результаты оценки',
  'audit': 'Журнал аудита',
  'career': 'Карьерные треки',
  'categories': 'Категории навыков',
  'certifications': 'Сертификации',
  'competency_levels': 'Уровни компетенций',
  'departments': 'Подразделения',
  'development': 'Развитие',
  'development_tasks': 'Задачи развития',
  'diagnostics': 'Диагностика',
  'grades': 'Грейды',
  'manufacturers': 'Производители',
  'meetings': 'Встречи one-to-one',
  'permissions': 'Права доступа',
  'positions': 'Должности',
  'qualities': 'Качества',
  'reports': 'Отчёты',
  'roles': 'Роли',
  'security': 'Безопасность',
  'sessions': 'Сессии',
  'settings': 'Настройки',
  'skills': 'Навыки',
  'survey_questions': 'Вопросы опросов',
  'surveys': 'Опросы',
  'tasks': 'Задачи',
  'team': 'Команда',
  'track_types': 'Типы треков',
  'trade_points': 'Торговые точки',
  'users': 'Пользователи',
  'user': 'Личные данные',
  'system': 'Система'
};

// Роли с описаниями
export const roles = [
  { 
    value: 'admin', 
    label: 'Администратор', 
    variant: 'destructive' as const, 
    description: 'Полный доступ ко всем функциям системы.', 
    color: 'border-destructive',
    icon: '👑'
  },
  { 
    value: 'hr_bp', 
    label: 'HR BP', 
    variant: 'default' as const, 
    description: 'Управление персоналом и HR-процессами.', 
    color: 'border-primary',
    icon: '👔'
  },
  { 
    value: 'manager', 
    label: 'Руководитель', 
    variant: 'secondary' as const, 
    description: 'Управление командой и встречи one-to-one.', 
    color: 'border-secondary',
    icon: '👨‍💼'
  },
  { 
    value: 'employee', 
    label: 'Сотрудник', 
    variant: 'outline' as const, 
    description: 'Базовый доступ к системе.', 
    color: 'border-muted',
    icon: '👤'
  }
];

// Функция для определения группы ресурса
export const getResourceGroup = (resource: string): string | null => {
  for (const group of permissionGroups) {
    if (group.resources.includes(resource)) {
      return group.id;
    }
  }
  return 'other';
};
