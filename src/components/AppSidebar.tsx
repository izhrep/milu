import { LogOut, PanelLeftClose, PanelLeft } from 'lucide-react';
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
import logoExpanded from '@/assets/Logo_expanded.svg';
import iconHome from '@/assets/icons/icon-home.png';
import iconProfile from '@/assets/icons/icon-profile.png';
import iconTasks from '@/assets/icons/icon-tasks.png';
import iconCareer from '@/assets/icons/icon-career.png';
import iconFeedback360 from '@/assets/icons/icon-feedback360.png';
import iconMeetings from '@/assets/icons/icon-meetings.png';
import iconMeetingsMonitor from '@/assets/icons/icon-meetings-monitor.png';
import iconTeam from '@/assets/icons/icon-team.png';
import iconDiagnostics from '@/assets/icons/icon-diagnostics.png';
import iconReferences from '@/assets/icons/icon-references.png';
import iconSecurity from '@/assets/icons/icon-security.png';

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
    { title: 'Главная', url: '/', icon: iconHome, show: true, end: true, size: 'h-7 w-7' },
    { title: 'Профиль', url: '/profile', icon: iconProfile, show: true, end: false, size: 'h-7 w-7' },
    { title: 'Мои задачи', url: '/tasks', icon: iconTasks, show: true, end: false, size: 'h-7 w-7' },
    { title: 'Карьерный трек', url: '/development/career-track', icon: iconCareer, show: showCareerTrack && user?.role === 'admin', end: false, size: 'h-7 w-7' },
    { title: 'Обратная связь 360', url: '/questionnaires', icon: iconFeedback360, show: true, end: false, size: 'h-8 w-8' },
    { title: 'Встречи 1:1', url: '/meetings', icon: iconMeetings, show: showMeetings, end: false, size: 'h-7 w-7' },
    { title: 'Мониторинг встреч 1:1', url: '/meetings-monitoring', icon: iconMeetingsMonitor, show: canViewTeam, end: false, size: 'h-7 w-7' },
    { title: 'Моя команда', url: '/team', icon: iconTeam, show: canViewTeam, end: false, size: 'h-7 w-7' },
    { title: 'Мониторинг диагностики', url: '/diagnostic-monitoring', icon: iconDiagnostics, show: canViewAdminPanel || canManageParticipants || canViewDiagnosticsResults, end: false, size: 'h-7 w-7' },
    { title: 'Справочники', url: '/admin', icon: iconReferences, show: canViewAdminPanel, end: false, size: 'h-8 w-8' },
    { title: 'Безопасность', url: '/security', icon: iconSecurity, show: canViewSecurity, end: false, size: 'h-7 w-7' },
  ];

  const visibleMenuItems = allMenuItems.filter(item => item.show);

  return (
    <Sidebar className={`${state === 'collapsed' ? 'w-16' : 'w-64'} border-r-0 sidebar-brand-bg`}>
      {/* Header with Logo and Toggle */}
      <SidebarHeader className="border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center">
            {state === 'collapsed' ? (
              <span className="font-bold text-white tracking-wide text-sm">M</span>
            ) : (
              <img src={logoExpanded} alt="MILU" className="h-7 w-auto" />
            )}
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

      <SidebarContent className="sidebar-scrollbar relative z-10">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={state === 'collapsed' ? item.title : undefined}>
                    <NavLink to={item.url} end={item.end} className={getNavCls}>
                      <img src={item.icon} alt="" className={`${item.size} shrink-0 brightness-0 invert opacity-90`} />
                      {state !== 'collapsed' && <span className="ml-2">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 relative z-10">
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
