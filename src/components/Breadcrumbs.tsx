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
  '/admin/reference-tables': 'Справочники',
  '/admin/diagnostics': 'Диагностика',
  '/admin/users': 'Пользователи',
  '/admin/roles': 'Роли',
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
  '/admin/stages': 'Управление этапами',
  '/admin/trade-points': 'Торговые точки',
  '/admin/products': 'Товары',
  '/admin/sprint-types': 'Типы спринтов',
  '/security': 'Управление безопасностью',
  '/achievements': 'Достижения',
  '/gamification': 'Геймификация',
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  
  // Проверяем, пришли ли со страницы команды
  const referrer = location.state?.from;

  if (pathnames.length === 0) return null;

  // Helper function to check if a string is a UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Специальная обработка для /assessment/results/:userId с referrer /team
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
        
        // Skip UUID segments in breadcrumbs
        if (isUUID(segment)) {
          return null;
        }
        
        // Skip 'development' segment as it's not a standalone page
        if (segment === 'development') {
          return null;
        }
        
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1 || 
          (index < pathnames.length - 1 && isUUID(pathnames[index + 1]));
        
        // Get route name
        let routeName = routeNames[routeTo] || segment;

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
