import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Search, Info, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissionsStats } from './RolePermissionsStats';
import { PermissionsGroupSidebar } from './PermissionsGroupSidebar';
import { PermissionsTable } from './PermissionsTable';
import { permissionGroups, roles } from './PermissionsGroupConfig';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface RolePermission {
  role: string;
  permission_id: string;
}

const RolesPermissionsManager = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userRoleStats, setUserRoleStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [newPermissionDialog, setNewPermissionDialog] = useState(false);
  const [newPermissionData, setNewPermissionData] = useState({
    name: '',
    description: '',
    resource: '',
    action: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [permsRes, rolePermsRes, userRolesRes] = await Promise.all([
        supabase.rpc('get_all_permissions'),
        supabase.rpc('get_role_permissions'),
        supabase.from('user_roles').select('role')
      ]);

      if (permsRes.error) throw permsRes.error;
      if (rolePermsRes.error) throw rolePermsRes.error;

      setPermissions(permsRes.data || []);
      setRolePermissions(rolePermsRes.data || []);
      
      const roleCounts: Record<string, number> = {};
      (userRolesRes.data || []).forEach(ur => {
        roleCounts[ur.role] = (roleCounts[ur.role] || 0) + 1;
      });
      setUserRoleStats(roleCounts);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // Подсчёт прав для каждой роли
  const rolePermissionsCount = useMemo(() => {
    return roles.reduce((acc, role) => {
      if (role.value === 'admin') {
        acc[role.value] = permissions.length;
      } else {
        acc[role.value] = rolePermissions.filter(rp => rp.role === role.value).length;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [rolePermissions, permissions]);

  const logAuditAction = async (roleValue: string, permissionId: string, action: 'grant' | 'revoke', permissionName: string) => {
    if (!user?.id) return;

    try {
      const role = roles.find(r => r.value === roleValue);
      await supabase.rpc('log_admin_action', {
        _admin_id: user.id,
        _target_user_id: null,
        _action_type: action === 'grant' ? 'permission_granted' : 'permission_revoked',
        _field: 'role_permissions',
        _old_value: action === 'grant' ? null : permissionName,
        _new_value: action === 'grant' ? permissionName : null,
        _details: {
          role: role?.label,
          permission_id: permissionId,
          permission_name: permissionName
        }
      });
    } catch (error) {
      console.error('Error logging audit action:', error);
    }
  };

  const togglePermission = async (role: string, permissionId: string, checked: boolean) => {
    if (role === 'admin') {
      toast.error('Администратор автоматически имеет все права');
      return;
    }

    try {
      const permission = permissions.find(p => p.id === permissionId);
      
      if (checked) {
        const { error } = await supabase
          .from('role_permissions')
          .insert({ role: role as any, permission_id: permissionId });

        if (error) throw error;

        setRolePermissions([...rolePermissions, { role, permission_id: permissionId }]);
        await logAuditAction(role, permissionId, 'grant', permission?.name || '');
        toast.success('Право добавлено');
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role', role as any)
          .eq('permission_id', permissionId);

        if (error) throw error;

        setRolePermissions(
          rolePermissions.filter(rp => !(rp.role === role && rp.permission_id === permissionId))
        );
        await logAuditAction(role, permissionId, 'revoke', permission?.name || '');
        toast.success('Право удалено');
      }
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast.error('Ошибка при сохранении изменений');
    }
  };

  const handleCreatePermission = async () => {
    if (!newPermissionData.name || !newPermissionData.resource || !newPermissionData.action) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('permissions')
        .insert(newPermissionData)
        .select()
        .single();

      if (error) throw error;

      setPermissions([...permissions, data]);
      setNewPermissionDialog(false);
      setNewPermissionData({ name: '', description: '', resource: '', action: '' });
      
      if (user?.id) {
        await supabase.rpc('log_admin_action', {
          _admin_id: user.id,
          _target_user_id: null,
          _action_type: 'permission_created',
          _field: 'permissions',
          _old_value: null,
          _new_value: data.name,
          _details: { permission_id: data.id, ...newPermissionData }
        });
      }
      
      toast.success('Право успешно создано');
    } catch (error) {
      console.error('Error creating permission:', error);
      toast.error('Ошибка при создании права');
    }
  };

  // Фильтрация прав по выбранной группе и поиску
  const filteredPermissions = useMemo(() => {
    let filtered = permissions;

    // Фильтр по группе
    if (selectedGroup !== 'all') {
      const group = permissionGroups.find(g => g.id === selectedGroup);
      if (group) {
        filtered = filtered.filter(p => group.resources.includes(p.resource));
      }
    }

    // Фильтр по поиску
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.resource.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [permissions, selectedGroup, searchQuery]);

  const totalPermissions = permissions.length;

  const roleStatsData = roles.map(role => ({
    role: role.value,
    label: role.label,
    icon: role.icon,
    userCount: userRoleStats[role.value] || 0,
    permissionsCount: rolePermissionsCount[role.value] || 0,
    totalPermissions,
    variant: role.variant,
    color: role.color
  }));

  const currentGroup = permissionGroups.find(g => g.id === selectedGroup);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="permissions">Права доступа</TabsTrigger>
          <TabsTrigger value="stats">Статистика</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="mt-6">
          <RolePermissionsStats roleStats={roleStatsData} />
        </TabsContent>

        <TabsContent value="permissions" className="mt-6">
          <div className="flex gap-6 min-h-[600px]">
            {/* Сайдбар с группами */}
            <PermissionsGroupSidebar
              selectedGroup={selectedGroup}
              onGroupSelect={setSelectedGroup}
              permissions={permissions}
            />

            {/* Основной контент */}
            <div className="flex-1 space-y-4">
              {/* Заголовок и поиск */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {currentGroup && <currentGroup.icon className="h-5 w-5" />}
                        {selectedGroup === 'all' ? 'Все права доступа' : currentGroup?.label}
                      </CardTitle>
                      <CardDescription>
                        {selectedGroup === 'all' 
                          ? 'Полный список прав для всех ролей' 
                          : currentGroup?.description}
                      </CardDescription>
                    </div>
                    <Dialog open={newPermissionDialog} onOpenChange={setNewPermissionDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Добавить
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Создать новое право</DialogTitle>
                          <DialogDescription>
                            Добавьте новое право доступа в систему
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Код права *</Label>
                            <Input
                              id="name"
                              placeholder="users.create"
                              value={newPermissionData.name}
                              onChange={(e) => setNewPermissionData({ ...newPermissionData, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">Описание</Label>
                            <Textarea
                              id="description"
                              placeholder="Создание пользователей"
                              value={newPermissionData.description}
                              onChange={(e) => setNewPermissionData({ ...newPermissionData, description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="resource">Ресурс *</Label>
                            <Input
                              id="resource"
                              placeholder="users"
                              value={newPermissionData.resource}
                              onChange={(e) => setNewPermissionData({ ...newPermissionData, resource: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="action">Действие *</Label>
                            <Input
                              id="action"
                              placeholder="create"
                              value={newPermissionData.action}
                              onChange={(e) => setNewPermissionData({ ...newPermissionData, action: e.target.value })}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setNewPermissionDialog(false)}>
                            Отмена
                          </Button>
                          <Button onClick={handleCreatePermission}>
                            Создать
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="flex gap-4 mt-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Поиск по правам..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Badge variant="outline" className="h-10 px-4 flex items-center">
                      {filteredPermissions.length} из {totalPermissions} прав
                    </Badge>
                  </div>

                  {/* Карточки ролей */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {roles.map(role => (
                      <div 
                        key={role.value} 
                        className={`p-3 rounded-lg border-l-4 ${role.color} bg-muted/30`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{role.icon}</span>
                          <Badge variant={role.variant} className="text-xs">
                            {role.label}
                          </Badge>
                        </div>
                        <div className="text-xl font-bold">
                          {rolePermissionsCount[role.value] || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {role.value === 'admin' ? 'все права' : `из ${totalPermissions}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardHeader>
              </Card>

              {/* Таблица прав */}
              <PermissionsTable
                permissions={filteredPermissions}
                rolePermissions={rolePermissions}
                onTogglePermission={togglePermission}
              />

              {filteredPermissions.length > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Администраторы имеют все права по умолчанию и не могут быть изменены
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RolesPermissionsManager;
