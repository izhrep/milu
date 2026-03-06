import { ChevronRight, Key } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { permissionGroups } from './PermissionsGroupConfig';

interface Permission {
  id: string;
  resource: string;
}

interface PermissionsGroupSidebarProps {
  selectedGroup: string;
  onGroupSelect: (groupId: string) => void;
  permissions: Permission[];
}

export const PermissionsGroupSidebar = ({ 
  selectedGroup, 
  onGroupSelect,
  permissions 
}: PermissionsGroupSidebarProps) => {
  
  // Подсчёт прав по группам
  const getGroupPermissionsCount = (groupResources: string[]) => {
    return permissions.filter(p => groupResources.includes(p.resource)).length;
  };

  const totalPermissions = permissions.length;

  // Фильтруем группы, у которых есть права
  const visibleGroups = permissionGroups.filter(group => 
    getGroupPermissionsCount(group.resources) > 0
  );

  return (
    <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Разделы меню
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Все права */}
          <button
            onClick={() => onGroupSelect('all')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
              selectedGroup === 'all' 
                ? "bg-primary text-primary-foreground" 
                : "hover:bg-accent text-foreground"
            )}
          >
            <Key className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left font-medium">Все права</span>
            <Badge variant={selectedGroup === 'all' ? "secondary" : "outline"} className="text-xs">
              {totalPermissions}
            </Badge>
          </button>

          <div className="h-px bg-border my-2" />

          {/* Группы по разделам меню */}
          {visibleGroups.map(group => {
            const count = getGroupPermissionsCount(group.resources);
            const Icon = group.icon;
            
            return (
              <button
                key={group.id}
                onClick={() => onGroupSelect(group.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  selectedGroup === group.id 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-accent text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{group.label}</div>
                  {selectedGroup !== group.id && (
                    <div className="text-xs text-muted-foreground">
                      {group.description}
                    </div>
                  )}
                </div>
                <Badge 
                  variant={selectedGroup === group.id ? "secondary" : "outline"} 
                  className="text-xs shrink-0"
                >
                  {count}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PermissionsGroupSidebar;
