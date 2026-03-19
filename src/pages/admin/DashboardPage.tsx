import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Users, Briefcase, Building2, Trophy, BookOpen, Target, 
  MapPin, Package, Zap, FileText, Settings, GraduationCap,
  Calendar, Shield, Search, TrendingUp, MessageSquare, ListChecks,
  FolderTree, ClipboardList, Star, Tags, Factory, Award, Pin, PinOff
} from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AdminSection {
  id: string;
  title: string;
  description: string;
  icon: any;
  path: string;
  category: string;
}

const PINNED_KEY = 'admin-dashboard-pinned';

function loadPinned(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePinned(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

const sections: AdminSection[] = [
  { id: 'users', title: 'Пользователи', description: 'Управление пользователями системы', icon: Users, path: '/admin/users', category: 'Управление' },
  { id: 'stages', title: 'Этапы', description: 'Управление этапами встреч one-to-one и диагностики', icon: Calendar, path: '/admin/stages', category: 'Управление этапами' },
  { id: 'companies', title: 'Компании', description: 'Справочник компаний', icon: Building2, path: '/admin/companies', category: 'Справочники структура' },
  { id: 'departments', title: 'Подразделения', description: 'Управление структурными подразделениями', icon: Building2, path: '/admin/departments', category: 'Справочники структура' },
  { id: 'positions', title: 'Должности', description: 'Справочник должностей', icon: Briefcase, path: '/admin/positions', category: 'Справочники структура' },
  { id: 'position-categories', title: 'Категории должностей', description: 'Справочник категорий должностей', icon: Tags, path: '/admin/position-categories', category: 'Справочники структура' },
  { id: 'trade-points', title: 'Торговые точки', description: 'Справочник торговых точек', icon: MapPin, path: '/admin/trade-points', category: 'Справочники структура' },
  { id: 'manufacturers', title: 'Производители', description: 'Справочник производителей', icon: Factory, path: '/admin/manufacturers', category: 'Справочники структура' },
  { id: 'grades', title: 'Грейды', description: 'Управление грейдами сотрудников', icon: GraduationCap, path: '/admin/grades', category: 'Справочники карьерный рост' },
  { id: 'career-tracks', title: 'Карьерные треки', description: 'Управление карьерными треками', icon: TrendingUp, path: '/admin/career-tracks', category: 'Справочники карьерный рост' },
  { id: 'track-types', title: 'Типы треков', description: 'Справочник типов карьерных треков', icon: FolderTree, path: '/admin/track-types', category: 'Справочники карьерный рост' },
  { id: 'certifications', title: 'Сертификаты', description: 'Справочник сертификатов', icon: Award, path: '/admin/certifications', category: 'Справочники карьерный рост' },
  { id: 'diagnostics', title: 'Справочники диагностики', description: 'Управление навыками, качествами, категориями и вопросами', icon: BookOpen, path: '/admin/diagnostics', category: 'Справочники диагностика' },
  { id: 'sprint-types', title: 'Типы спринтов', description: 'Справочник типов спринтов', icon: Zap, path: '/admin/sprint-types', category: 'KPI' },
];

const sectionsMap = new Map(sections.map(s => [s.id, s]));

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedIds, setPinnedIds] = useState<string[]>(loadPinned);
  
  const { hasPermission: canViewAdminPanel, isLoading } = usePermission('security.view_admin_panel');
  
  const togglePin = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      savePinned(next);
      return next;
    });
  }, []);

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

  const filteredSections = sections.filter(section =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedSections = filteredSections.reduce((acc, section) => {
    if (!acc[section.category]) acc[section.category] = [];
    acc[section.category].push(section);
    return acc;
  }, {} as Record<string, AdminSection[]>);

  const pinnedSections = pinnedIds
    .map(id => sectionsMap.get(id))
    .filter((s): s is AdminSection =>
      !!s && (
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

  const renderCard = (section: AdminSection) => {
    const Icon = section.icon;
    const isPinned = pinnedIds.includes(section.id);
    return (
      <Card 
        key={section.id} 
        className="hover:shadow-lg transition-shadow cursor-pointer group relative"
        onClick={() => navigate(section.path)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <Icon className="h-8 w-8 text-primary" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => togglePin(section.id, e)}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  {isPinned 
                    ? <PinOff className="h-4 w-4 text-muted-foreground" />
                    : <Pin className="h-4 w-4 text-muted-foreground" />
                  }
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {isPinned ? 'Открепить' : 'Закрепить наверху'}
              </TooltipContent>
            </Tooltip>
          </div>
          <CardTitle className="mt-4">{section.title}</CardTitle>
          <CardDescription>{section.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="ghost" className="w-full group-hover:bg-accent">
            Перейти
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Панель администратора</h1>
          <p className="text-muted-foreground mt-2">
            Управление справочниками и настройками системы
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по разделам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Pinned section */}
      {pinnedSections.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Pin className="h-5 w-5 text-primary" />
            Закреплённые
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedSections.map(renderCard)}
          </div>
        </div>
      )}

      {Object.entries(groupedSections).map(([category, categorySections]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xl font-semibold">{category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySections.map(renderCard)}
          </div>
        </div>
      ))}

      {filteredSections.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Ничего не найдено по запросу "{searchQuery}"
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
