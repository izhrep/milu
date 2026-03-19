import { Home, User, BookOpen, Trophy, TrendingUp, MapPin, Calendar, Target, LogOut, Shield, Users, BarChart3, CheckSquare, ClipboardList, PanelLeftClose, PanelLeft } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useMenuVisibility } from '@/hooks/useMenuVisibility';
import { Button } from '@/components/ui/button';
import miluLogo from '@/assets/milu-logo.png';

export const AppSidebar = () => {
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Вы успешно вышли из системы');
    navigate('/auth');
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? 'bg-sidebar-accent text-white font-medium' 
      : 'text-white/80 hover:bg-sidebar-accent hover:text-white transition-colors';

  // Проверяем видимость пунктов меню
  const { showCareerTrack, showMeetings, loading: menuLoading } = useMenuVisibility(user?.id, user?.role);

  const { hasPermission: canViewTeam } = usePermission('team.view');
  const { hasPermission: canViewAdminPanel } = usePermission('security.view_admin_panel');
  const { hasPermission: canViewSecurity } = usePermission('security.manage');
  const { hasPermission: canManageParticipants } = usePermission('diagnostics.manage_participants');
  const { hasPermission: canViewDiagnosticsResults } = usePermission('diagnostics.view_results');
  
  // Собираем все пункты меню в один массив с условиями видимости
  const allMenuItems = [
    { title: 'Главная', url: '/', icon: Home, show: true, end: true },
    { title: 'Профиль', url: '/profile', icon: User, show: canViewTeam || canViewAdminPanel, end: false },
    { title: 'Мои задачи', url: '/tasks', icon: CheckSquare, show: true, end: false },
    { title: 'Карьерный трек', url: '/development/career-track', icon: Target, show: showCareerTrack, end: false },
    { title: 'Обратная связь 360', url: '/questionnaires', icon: ClipboardList, show: true, end: false },
    { title: 'Встречи', url: '/meetings', icon: Calendar, show: showMeetings, end: false },
    { title: 'Мониторинг встреч', url: '/meetings-monitoring', icon: BarChart3, show: canViewTeam, end: false },
    { title: 'Моя команда', url: '/team', icon: Users, show: canViewTeam, end: false },
    { title: 'Мониторинг диагностики', url: '/diagnostic-monitoring', icon: BarChart3, show: canViewAdminPanel || canManageParticipants || canViewDiagnosticsResults, end: false },
    { title: 'Справочники', url: '/admin', icon: MapPin, show: canViewAdminPanel, end: false },
    { title: 'Безопасность', url: '/security', icon: Shield, show: canViewSecurity, end: false },
  ];

  const visibleMenuItems = allMenuItems.filter(item => item.show);

  return (
    <Sidebar className={`${state === 'collapsed' ? 'w-16' : 'w-64'} bg-sidebar border-r-0`}>
      {/* Header with Logo and Toggle */}
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center">
            <span className={`font-bold text-white tracking-wide ${state === 'collapsed' ? 'text-sm' : 'text-lg'}`}>
              {state === 'collapsed' ? 'M' : 'MILU'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-sidebar-accent"
          >
            {state === 'collapsed' ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="sidebar-scrollbar">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={state === 'collapsed' ? item.title : undefined}>
                    <NavLink to={item.url} end={item.end} className={getNavCls}>
                      <item.icon className={`${state === 'collapsed' ? 'h-5 w-5' : 'h-4 w-4'} shrink-0`} />
                      {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout} 
              tooltip={state === 'collapsed' ? 'Выйти' : undefined}
              className="text-white/60 hover:text-red-400 hover:bg-sidebar-accent"
            >
              <LogOut className={`${state === 'collapsed' ? 'h-5 w-5' : 'h-4 w-4'} shrink-0`} />
              {state !== 'collapsed' && <span className="ml-2">Выйти</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
