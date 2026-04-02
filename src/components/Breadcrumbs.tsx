import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const routeNames: Record<string, string> = {
  '/': 'Главная',
  '/profile': 'Профиль',
  '/development/career-track': 'Карьерный трек',
  '/questionnaires': 'Обратная связь 360',
  '/development/career-track/recommendations': 'Рекомендации',
  '/tasks': 'Мои задачи',
  '/training': 'Обучение',
  '/meetings': 'Встречи one-to-one',
  '/meetings-monitoring': 'Мониторинг встреч one-to-one',
  '/team': 'Моя команда',
  '/feed': 'Лента',
  '/skill-survey': 'Опросник Hard Skills',
  '/skill-survey/questions': 'Вопросы Hard Skills',
  '/skill-survey/results': 'Результаты опроса Hard Skills',
  '/survey-360': 'Оценка 360°',
  '/survey-360/questions': 'Вопросы оценки 360°',
  '/survey-360/results': 'Результаты оценки 360°',
  '/assessment': 'Комплексная оценка',
  '/assessment/results': 'Результаты оценки',
  '/unified-assessment': 'Прохождение опросника Обратная связь 360',
  '/users': 'Пользователи',
  '/users/create': 'Добавить пользователя',
  '/users/migration': 'Миграция пользователей',
  '/my-assignments': 'Мои назначения',
  '/manager-reports': 'Отчёты по подчинённым',
  '/manager/comparison': 'Сравнение подчинённых',
  '/hr-analytics': 'HR Аналитика',
  '/diagnostic-monitoring': 'Мониторинг диагностики',
  '/admin': 'Администрирование',
  '/admin/dashboard': 'Панель управления',
  '/admin/users': 'Пользователи',
  '/admin/stages': 'Управление этапами',
  '/admin/diagnostics': 'Справочники диагностики',
  '/admin/reports': 'Отчёты',
  '/admin/companies': 'Компании',
  '/admin/departments': 'Подразделения',
  '/admin/positions': 'Должности',
  '/admin/position-categories': 'Категории должностей',
  '/admin/grades': 'Грейды',
  '/admin/skills': 'Hard Skills',
  '/admin/qualities': 'Soft Skills',
  '/admin/competency-levels': 'Уровни компетенций',
  '/admin/hard-skill-questions': 'Вопросы Hard Skills',
  '/admin/hard-skill-answers': 'Варианты ответов (Hard Skills)',
  '/admin/soft-skill-questions': 'Вопросы Soft Skills',
  '/admin/soft-skill-answers': 'Варианты ответов (360°)',
  '/admin/career-tracks': 'Карьерные треки',
  '/admin/track-types': 'Типы треков',
  '/admin/meeting-stages': 'Этапы встреч',
  '/admin/trade-points': 'Торговые точки',
  '/admin/manufacturers': 'Производители',
  '/admin/certifications': 'Сертификаты',
  '/admin/sprint-types': 'Типы спринтов',
  '/admin/import-soft-skill-answers': 'Импорт ответов Soft Skills',
  '/admin/import-soft-skill-questions': 'Импорт вопросов Soft Skills',
  '/admin/reference-tables': 'Справочники',
  '/admin/roles': 'Роли',
  '/security': 'Управление безопасностью',
  '/achievements': 'Достижения',
  '/gamification': 'Геймификация',
};

// Human-readable names for dynamic /admin/:tableId routes
const adminTableNames: Record<string, string> = {
  'users': 'Пользователи',
  'companies': 'Компании',
  'departments': 'Подразделения',
  'positions': 'Должности',
  'position-categories': 'Категории должностей',
  'competency-levels': 'Уровни компетенций',
  'trade-points': 'Торговые точки',
  'manufacturers': 'Производители',
  'grades': 'Грейды',
  'career-tracks': 'Карьерные треки',
  'track-types': 'Типы треков',
  'certifications': 'Сертификаты',
  'skills': 'Hard Skills',
  'qualities': 'Soft Skills',
  'hard-skill-questions': 'Вопросы Hard Skills',
  'hard-skill-answers': 'Варианты ответов (Hard Skills)',
  'soft-skill-questions': 'Вопросы Soft Skills',
  'soft-skill-answers': 'Варианты ответов (360°)',
  'sprint-types': 'Типы спринтов',
  'stages': 'Управление этапами',
  'diagnostics': 'Справочники диагностики',
  'reports': 'Отчёты',
  'import-soft-skill-answers': 'Импорт ответов Soft Skills',
  'import-soft-skill-questions': 'Импорт вопросов Soft Skills',
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  
  const referrer = location.state?.from;

  if (pathnames.length === 0) return null;

  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Special case: /assessment/results/:userId from /team
  if (referrer === '/team' && 
      pathnames[0] === 'assessment' && 
      pathnames[1] === 'results' && 
      pathnames.length === 3 && 
      isUUID(pathnames[2])) {
    return (
      <nav className="flex items-center space-x-2 text-sm text-text-secondary mb-4">
        <Link to="/" className="flex items-center hover:text-text-primary transition-colors">
          <Home className="h-4 w-4" />
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/team" className="hover:text-text-primary transition-colors">
          Моя команда
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-text-primary font-medium">Результаты</span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-text-secondary mb-4">
      <Link to="/" className="flex items-center hover:text-text-primary transition-colors">
        <Home className="h-4 w-4" />
      </Link>
      
      {pathnames.map((_, index) => {
        const segment = pathnames[index];
        
        if (isUUID(segment)) return null;
        if (segment === 'development') return null;
        
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1 || 
          (index < pathnames.length - 1 && isUUID(pathnames[index + 1]));
        
        // Resolve route name: static map → dynamic admin table → raw segment
        let routeName = routeNames[routeTo];
        if (!routeName && pathnames[0] === 'admin' && index === 1) {
          routeName = adminTableNames[segment];
        }
        if (!routeName) {
          routeName = segment;
        }

        return (
          <div key={routeTo} className="flex items-center space-x-2">
            <ChevronRight className="h-4 w-4" />
            {isLast ? (
              <span className="text-text-primary font-medium">{routeName}</span>
            ) : (
              <Link to={routeTo} className="hover:text-text-primary transition-colors">
                {routeName}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
