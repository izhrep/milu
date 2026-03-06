import { useParams, Navigate } from 'react-router-dom';
import { ReferenceTableLayout } from '@/components/admin/ReferenceTableLayout';
import { ReferenceTableView } from '@/components/admin/ReferenceTableView';
import { 
  Users, Briefcase, Building2, Trophy, BookOpen, Target, 
  MapPin, Package, Zap, FileText, GraduationCap, Factory, Award
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

import { CareerTracksManager } from '@/components/admin/CareerTracksManager';
import { GradesManager } from '@/components/admin/GradesManager';

const tableConfig: Record<string, { title: string; description: string; icon: any; table?: string; component?: any }> = {
  'users': { title: 'Пользователи', description: 'Управление пользователями системы', icon: Users, table: 'users' },
  'companies': { title: 'Компании', description: 'Справочник компаний', icon: Building2, table: 'companies' },
  'departments': { title: 'Подразделения', description: 'Справочник подразделений', icon: Building2, table: 'departments' },
  'positions': { title: 'Должности', description: 'Справочник должностей', icon: Briefcase, table: 'positions' },
  'position-categories': { title: 'Категории должностей', description: 'Категории должностей', icon: FileText, table: 'position_categories' },
  'competency-levels': { title: 'Уровни компетенций', description: 'Уровни владения компетенциями', icon: GraduationCap, table: 'competency_levels' },
  'trade-points': { title: 'Торговые точки', description: 'Справочник торговых точек', icon: MapPin, table: 'trade_points' },
  'manufacturers': { title: 'Производители', description: 'Справочник производителей', icon: Factory, table: 'manufacturers' },
  'grades': { title: 'Грейды', description: 'Справочник грейдов', icon: Target, component: GradesManager },
  'career-tracks': { title: 'Карьерные треки', description: 'Справочник карьерных треков', icon: MapPin, component: CareerTracksManager },
  'track-types': { title: 'Типы треков', description: 'Типы карьерных треков', icon: FileText, table: 'track_types' },
  'certifications': { title: 'Сертификаты', description: 'Справочник сертификатов', icon: Award, table: 'certifications' },
  'skills': { title: 'Навыки', description: 'Справочник навыков', icon: BookOpen, table: 'skills' },
  'qualities': { title: 'Качества', description: 'Справочник качеств', icon: Trophy, table: 'qualities' },
  'hard-skill-questions': { title: 'Вопросы по навыкам', description: 'Вопросы опросника навыков', icon: BookOpen, table: 'hard_skill_questions' },
  'hard-skill-answers': { title: 'Варианты ответов (навыки)', description: 'Варианты ответов опросника навыков', icon: BookOpen, table: 'hard_skill_answer_options' },
  'soft-skill-questions': { title: 'Вопросы по качествам', description: 'Вопросы оценки 360', icon: Trophy, table: 'soft_skill_questions' },
  'soft-skill-answers': { title: 'Варианты ответов (360)', description: 'Варианты ответов оценки 360', icon: Trophy, table: 'soft_skill_answer_options' },
  'sprint-types': { title: 'Типы спринтов', description: 'Типы торговых спринтов', icon: Zap, table: 'sprint_types' },
  'stages': { title: 'Этапы', description: 'Управление этапами встреч и диагностики', icon: Building2 },
};

export default function ReferenceTablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  
  // Check admin panel access permission - must be called before any conditional returns
  const { hasPermission: canViewAdminPanel, isLoading } = usePermission('security.view_admin_panel');
  
  // Permission check - after all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }
  
  if (!canViewAdminPanel) {
    return <Navigate to="/" replace />;
  }
  
  if (!tableId || !tableConfig[tableId]) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive">Таблица не найдена</h1>
          <p className="text-muted-foreground mt-2">Запрошенная таблица не существует</p>
        </div>
      </div>
    );
  }

  const config = tableConfig[tableId];
  const Icon = config.icon;

  // If component is specified, use it instead of ReferenceTableView
  if (config.component) {
    const CustomComponent = config.component;
    return (
      <ReferenceTableLayout 
        title={config.title}
        description={config.description}
        icon={<Icon className="h-8 w-8" />}
      >
        <CustomComponent />
      </ReferenceTableLayout>
    );
  }

  return (
    <ReferenceTableLayout 
      title={config.title}
      description={config.description}
      icon={<Icon className="h-8 w-8" />}
    >
      <ReferenceTableView 
        tableName={config.table!}
        displayName={config.title}
        icon={Icon}
      />
    </ReferenceTableLayout>
  );
}