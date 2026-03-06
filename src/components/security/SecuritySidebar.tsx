import { Key, History, Shield, ArrowLeft } from 'lucide-react';
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

interface SecuritySidebarProps {
  activeSection: string;
  onSectionSelect: (section: string) => void;
}

export const SecuritySidebar = ({ activeSection, onSectionSelect }: SecuritySidebarProps) => {
  const { state } = useSidebar();
  const navigate = useNavigate();

  const sections = [
    { id: 'roles', name: 'Роли и права', icon: Key, description: 'Назначение прав ролям' },
    { id: 'audit', name: 'История изменений', icon: History, description: 'Журнал аудита' },
  ];

  return (
    <Sidebar className={state === 'collapsed' ? 'w-16' : 'w-64'}>
      <SidebarContent>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className={`font-semibold ${state === 'collapsed' ? 'hidden' : 'text-lg'}`}>
              Безопасность
            </h2>
          </div>
          {state !== 'collapsed' && (
            <button
              onClick={() => navigate('/')}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-accent rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Вернуться в портал
            </button>
          )}
        </div>

        <SidebarGroup>
          {state !== 'collapsed' && <SidebarGroupLabel>Управление</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {sections.map((section) => (
                <SidebarMenuItem key={section.id}>
                  <SidebarMenuButton
                    isActive={activeSection === section.id}
                    onClick={() => onSectionSelect(section.id)}
                    tooltip={state === 'collapsed' ? section.name : undefined}
                  >
                    <section.icon className={state === 'collapsed' ? 'h-5 w-5' : 'h-4 w-4'} />
                    {state !== 'collapsed' && <span>{section.name}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default SecuritySidebar;
