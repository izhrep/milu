import { 
  Users, Briefcase, Building2, Trophy, BookOpen, Target, 
  MapPin, Package, Zap, FileText, Settings, GraduationCap, ArrowLeft,
  Calendar, Users2, MessageSquare, CheckSquare, FileBarChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

export interface ReferenceTable {
  id: string;
  name: string;
  icon: any;
  table: string;
}

interface AdminSidebarProps {
  activeTable: string;
  onTableSelect: (tableId: string) => void;
}

export const AdminSidebar = ({ activeTable, onTableSelect }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const navigate = useNavigate();

  const tableGroups = [
    {
      label: 'Управление',
      items: [
        { id: 'users', name: 'Пользователи', icon: Users, table: 'users' },
      ]
    },
    {
      label: 'Организационная структура',
      items: [
        { id: 'companies', name: 'Компании', icon: Building2, table: 'companies' },
        { id: 'departments', name: 'Подразделения', icon: Building2, table: 'departments' },
        { id: 'positions', name: 'Должности', icon: Briefcase, table: 'positions' },
        { id: 'position_categories', name: 'Категории должностей', icon: FileText, table: 'position_categories' },
        { id: 'grades', name: 'Грейды', icon: Target, table: 'grades' },
      ]
    },
    {
      label: 'Справочники диагностика',
      items: [
        { id: 'diagnostics', name: 'Hard Skills', icon: BookOpen, table: 'diagnostics', route: '/admin/diagnostics' },
      ]
    },
    {
      label: 'Компетенции',
      items: [
        { id: 'competency_levels', name: 'Уровни компетенций', icon: GraduationCap, table: 'competency_levels' },
      ]
    },
    {
      label: 'Опросники',
      items: [
        { id: 'hard_skill_questions', name: 'Вопросы Hard Skills', icon: BookOpen, table: 'hard_skill_questions' },
        { id: 'hard_skill_answer_options', name: 'Варианты ответов {Hard Skills}', icon: BookOpen, table: 'hard_skill_answer_options' },
        { id: 'soft_skill_questions', name: 'Вопросы Soft Skills', icon: Trophy, table: 'soft_skill_questions' },
        { id: 'soft_skill_answer_options', name: 'Варианты ответов {360}', icon: Trophy, table: 'soft_skill_answer_options' },
      ]
    },
    {
      label: 'Карьерное развитие',
      items: [
        { id: 'career_tracks', name: 'Карьерные треки', icon: MapPin, table: 'career_tracks' },
        { id: 'track_types', name: 'Типы треков', icon: FileText, table: 'track_types' },
        { id: 'development_plans', name: 'Планы развития', icon: Target, table: 'development_plans' },
        { id: 'development_tasks', name: 'Задачи развития', icon: CheckSquare, table: 'development_tasks' },
      ]
    },
    {
      label: 'Встречи 1:1',
      items: [
        { id: 'meeting_stages', name: 'Этапы встреч', icon: Calendar, table: 'meeting_stages' },
        { id: 'meeting_stage_participants', name: 'Участники этапов', icon: Users2, table: 'meeting_stage_participants' },
        { id: 'one_on_one_meetings', name: 'Встречи', icon: MessageSquare, table: 'one_on_one_meetings' },
        { id: 'meeting_decisions', name: 'Решения встреч', icon: CheckSquare, table: 'meeting_decisions' },
      ]
    },
    {
      label: 'Торговля',
      items: [
        { id: 'trade_points', name: 'Торговые точки', icon: MapPin, table: 'trade_points' },
      ]
    },
    {
      label: 'Отчеты',
      items: [
        { id: 'reports', name: 'Отчеты', icon: FileBarChart, table: 'reports', route: '/admin/reports' },
      ]
    },
  ];

  return (
    <Sidebar className={state === 'collapsed' ? 'w-16' : 'w-64'}>
      <SidebarContent>
        <div className="p-4 border-b">
          <h2 className={`font-semibold ${state === 'collapsed' ? 'text-xs text-center' : 'text-lg'}`}>
            {state === 'collapsed' ? 'Справ.' : 'Справочники'}
          </h2>
          {state !== 'collapsed' && (
            <button
              onClick={() => navigate('/')}
              className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Вернуться в портал
            </button>
          )}
        </div>

        {tableGroups.map((group) => (
          <SidebarGroup key={group.label}>
            {state !== 'collapsed' && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeTable === item.id}
                      onClick={() => onTableSelect(item.id)}
                      tooltip={state === 'collapsed' ? item.name : undefined}
                    >
                      <item.icon className={state === 'collapsed' ? 'h-5 w-5' : 'h-4 w-4'} />
                      {state !== 'collapsed' && <span>{item.name}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
