import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Download, Power, History, Edit, UserPlus, Trash2, Eye, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import UserAuditSheet from './UserAuditSheet';
import ImportUsersDialog from './ImportUsersDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface UserRow {
  id: string;
  email: string;
  status: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role: string;
  position_name?: string;
  position_id?: string;
  position_category_name?: string;
  department_name?: string;
  department_id?: string;
  company_name?: string;
  grade_name?: string;
  career_track_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  employee_number?: string;
  manager_name?: string;
  bitrix_bot_enabled?: boolean;
  bitrix_user_id?: string;
}

const UsersManagementTable = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [positionCategoryFilter, setPositionCategoryFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [userTypeFilter, setUserTypeFilter] = useState<string>('internal');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [auditSheetOpen, setAuditSheetOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; userId: string; action: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; userId: string; userEmail: string } | null>(null);
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState(false);
  const [viewUserDialog, setViewUserDialog] = useState(false);
  const [viewUserData, setViewUserData] = useState<UserRow | null>(null);
  const [importUsersDialog, setImportUsersDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: 'test123',
    first_name: '',
    last_name: '',
    middle_name: '',
    role: 'employee' as 'admin' | 'hr_bp' | 'manager' | 'employee',
    manager_id: '' as string,
    position_id: '' as string,
    department_id: '' as string,
    grade_id: '' as string
  });
  const [editUser, setEditUser] = useState<any>(null);
  const [managersList, setManagersList] = useState<Array<{id: string; full_name: string; department_id: string | null}>>([]);
  const [allManagersList, setAllManagersList] = useState<Array<{id: string; full_name: string; department_id: string | null}>>([]);
  const [positionsList, setPositionsList] = useState<Array<{id: string; name: string; position_category_id: string | null}>>([]);
  const [positionCategoriesList, setPositionCategoriesList] = useState<Array<{id: string; name: string}>>([]);
  const [departmentsList, setDepartmentsList] = useState<Array<{id: string; name: string}>>([]);
  const [gradesList, setGradesList] = useState<Array<{id: string; name: string; position_id: string | null; level: number}>>([]);
  const [filteredGrades, setFilteredGrades] = useState<Array<{id: string; name: string; level: number}>>([]);

  useEffect(() => {
    fetchUsers();
    fetchManagers();
    fetchPositions();
    fetchPositionCategories();
    fetchDepartments();
    fetchGrades();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter, positionFilter, positionCategoryFilter, departmentFilter, userTypeFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users with extended data - company through departments
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select(`
          *,
          positions(name, position_category_id, position_categories(name)),
          departments(name, companies(name)),
          grades(name),
          user_career_progress(
            career_tracks(name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (usersError) throw usersError;

      // Fetch roles directly from user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      if (rolesError) throw rolesError;

      // Create roles map
      const rolesMap = new Map(rolesData?.map((r: any) => [r.user_id, r.role]) || []);

      // Transform user data (data is now stored unencrypted)
      const transformedUsers = await Promise.all((usersData || []).map(async (u: any) => {
        // Fetch manager name if exists
        let managerName = '';
        if (u.manager_id) {
          const { data: managerData } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', u.manager_id)
            .single();
          
          if (managerData) {
            managerName = `${managerData.last_name || ''} ${managerData.first_name || ''}`.trim();
          }
        }

        return {
          id: u.id,
          email: u.email || '',
          first_name: u.first_name || '',
          last_name: u.last_name || '',
          middle_name: u.middle_name || '',
          employee_number: u.employee_number || '',
          status: u.status || false,
          last_login_at: u.last_login_at,
          created_at: u.created_at,
          updated_at: u.updated_at || u.created_at,
          role: rolesMap.get(u.id) || 'employee',
          position_name: u.positions?.name || '',
          position_category_name: u.positions?.position_categories?.name || '',
          department_name: u.departments?.name || '',
          company_name: u.departments?.companies?.name || '',
          grade_name: u.grades?.name || '',
          career_track_name: u.user_career_progress?.[0]?.career_tracks?.name || '',
          manager_name: managerName,
          position_id: u.position_id,
          department_id: u.department_id,
          grade_id: u.grade_id,
          manager_id: u.manager_id,
          bitrix_bot_enabled: u.bitrix_bot_enabled || false,
          bitrix_user_id: u.bitrix_user_id || ''
        };
      }));

      setUsers(transformedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Ошибка загрузки пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      // Fetch users with 'manager' role only (not 'admin')
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');
      
      if (rolesError) throw rolesError;

      const managerIds = (userRoles || []).map(r => r.user_id);

      if (managerIds.length === 0) {
        setManagersList([]);
        setAllManagersList([]);
        return;
      }

      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name, middle_name, department_id')
        .eq('status', true)
        .in('id', managerIds);
      
      if (usersError) throw usersError;

      // Transform manager data (data is now stored unencrypted)
      const managers = (usersData || []).map((u) => ({
        id: u.id,
        full_name: [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' '),
        department_id: u.department_id
      }));
      
      setAllManagersList(managers);
      setManagersList(managers);
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('positions')
        .select('id, name, position_category_id')
        .order('name');
      
      if (error) throw error;
      setPositionsList(data || []);
    } catch (error) {
      console.error('Error fetching positions:', error);
    }
  };

  const fetchPositionCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('position_categories')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setPositionCategoriesList(data || []);
    } catch (error) {
      console.error('Error fetching position categories:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setDepartmentsList(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchGrades = async () => {
    try {
      const { data, error } = await supabase
        .from('grades')
        .select('id, name, position_id, level')
        .order('level');
      
      if (error) throw error;
      setGradesList(data || []);
    } catch (error) {
      console.error('Error fetching grades:', error);
    }
  };

  const isExternalUser = (u: UserRow) => {
    return u.position_category_name?.includes('(внешний)') ?? false;
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(u => {
        const fullName = [u.last_name, u.first_name, u.middle_name].filter(Boolean).join(' ').toLowerCase();
        return (
          u.email.toLowerCase().includes(query) ||
          (u.first_name || '').toLowerCase().includes(query) ||
          (u.last_name || '').toLowerCase().includes(query) ||
          (u.middle_name || '').toLowerCase().includes(query) ||
          fullName.includes(query)
        );
      });
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (statusFilter === 'active') {
      filtered = filtered.filter(u => u.status);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(u => !u.status);
    }

    if (positionFilter !== 'all') {
      filtered = filtered.filter(u => u.position_id === positionFilter);
    }

    if (positionCategoryFilter !== 'all') {
      const posIdsInCategory = positionsList
        .filter(p => p.position_category_id === positionCategoryFilter)
        .map(p => p.id);
      filtered = filtered.filter(u => u.position_id && posIdsInCategory.includes(u.position_id));
    }

    if (departmentFilter !== 'all') {
      filtered = filtered.filter(u => u.department_id === departmentFilter);
    }

    if (userTypeFilter === 'internal') {
      filtered = filtered.filter(u => !isExternalUser(u));
    } else if (userTypeFilter === 'external') {
      filtered = filtered.filter(u => isExternalUser(u));
    }

    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const oldRole = users.find(u => u.id === userId)?.role;

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole as any })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: newRole as any
          });
        
        if (error) throw error;
      }

      // Clear manager_id if role changed to admin or hr_bp (employees and managers can have managers)
      if ((oldRole === 'employee' || oldRole === 'manager') && newRole !== 'employee' && newRole !== 'manager') {
        await supabase
          .from('users')
          .update({ manager_id: null })
          .eq('id', userId);
      }

      // Log the action
      await supabase.rpc('log_admin_action', {
        _admin_id: currentUser?.id,
        _target_user_id: userId,
        _action_type: 'role_changed',
        _field: 'role',
        _old_value: oldRole,
        _new_value: newRole
      });

      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Роль успешно изменена');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Ошибка изменения роли');
    }
  };

  const handleStatusToggle = async (userId: string, newStatus: boolean) => {
    setConfirmDialog({
      open: true,
      userId,
      action: newStatus ? 'activate' : 'deactivate'
    });
  };

  const confirmStatusChange = async () => {
    if (!confirmDialog) return;

    const { userId, action } = confirmDialog;
    const newStatus = action === 'activate';

    try {
      // Persist status change to database
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log the action
      await supabase.rpc('log_admin_action', {
        _admin_id: currentUser?.id,
        _target_user_id: userId,
        _action_type: 'status_changed',
        _field: 'status',
        _old_value: (!newStatus).toString(),
        _new_value: newStatus.toString()
      });

      setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      toast.success(`Пользователь ${newStatus ? 'активирован' : 'деактивирован'}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Ошибка изменения статуса');
    } finally {
      setConfirmDialog(null);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    setDeleteDialog({
      open: true,
      userId,
      userEmail
    });
  };

  const confirmDeleteUser = async () => {
    if (!deleteDialog) return;

    const { userId } = deleteDialog;

    try {
      console.log('Deleting user:', userId);

      // Call edge function to delete user
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Ошибка удаления пользователя');
      }

      if (!data?.success) {
        console.error('Delete failed:', data);
        throw new Error(data?.error || 'Ошибка удаления пользователя');
      }

      toast.success('Пользователь успешно удален');
      setDeleteDialog(null);
      
      // Refresh user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Ошибка удаления пользователя');
    }
  };

  const exportToCSV = () => {
    const headers = ['Email', 'Роль', 'Статус', 'Последний вход', 'Дата создания', 'Дата изменения'];
    const rows = filteredUsers.map(u => [
      u.email,
      u.role,
      u.status ? 'Активен' : 'Деактивирован',
      u.last_login_at ? format(new Date(u.last_login_at), 'dd.MM.yyyy HH:mm', { locale: ru }) : '-',
      format(new Date(u.created_at), 'dd.MM.yyyy HH:mm', { locale: ru }),
      format(new Date(u.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const isRecentlyUpdated = (updatedAt: string) => {
    const diff = Date.now() - new Date(updatedAt).getTime();
    return diff < 24 * 60 * 60 * 1000; // Last 24 hours
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'hr_bp': return 'default';
      case 'manager': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Администратор';
      case 'hr_bp': return 'HR BP';
      case 'manager': return 'Руководитель';
      case 'employee': return 'Сотрудник';
      default: return role;
    }
  };

  const openEditDialog = async (user: UserRow) => {
    try {
      // Fetch full user data from database first
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Data is stored unencrypted, use directly
      setEditUser({
        ...userData,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        middle_name: userData.middle_name || '',
        email: userData.email || '',
        role: user.role // Use role from UserRow which has the correct role
      });
      
      setEditUserDialog(true);
    } catch (error) {
      console.error('Error loading user data:', error);
      toast.error('Ошибка загрузки данных пользователя');
    }
  };

  const saveEditedUser = async () => {
    if (!editUser) return;

    try {
      // Validate required fields
      if (!editUser.first_name || !editUser.last_name || !editUser.email) {
        toast.error('Заполните все обязательные поля');
        return;
      }

      // Update user in database directly (no encryption)
      const { error } = await supabase
        .from('users')
        .update({
          first_name: editUser.first_name,
          last_name: editUser.last_name,
          middle_name: editUser.middle_name || '',
          email: editUser.email,
          manager_id: editUser.manager_id || null,
          position_id: editUser.position_id || null,
          department_id: editUser.department_id || null,
          grade_id: editUser.grade_id || null,
          status: editUser.status,
          bitrix_user_id: editUser.bitrix_user_id || null,
          bitrix_bot_enabled: editUser.bitrix_bot_enabled || false
        })
        .eq('id', editUser.id);

      if (error) throw error;

      toast.success('Данные пользователя обновлены');
      setEditUserDialog(false);
      setEditUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Ошибка обновления данных');
    }
  };

  const handleCreateUser = async () => {
    try {
      // Validate input
      if (!newUser.email || !newUser.first_name || !newUser.last_name) {
        toast.error('Заполните все обязательные поля (Email, Имя, Фамилия)');
        return;
      }

      console.log('Starting user creation with data:', {
        email: newUser.email,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        middle_name: newUser.middle_name,
        role: newUser.role
      });

      // Check and refresh session before making the edge function call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('Session error:', sessionError);
        toast.error('Сессия истекла. Пожалуйста, обновите страницу и войдите снова.');
        return;
      }

      // Refresh the session to get a fresh token for edge function call
      console.log('Refreshing session to get fresh token...');
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh error:', refreshError);
        toast.error('Не удалось обновить сессию. Пожалуйста, войдите снова.');
        return;
      }

      if (!refreshedSession) {
        console.error('No session after refresh');
        toast.error('Не удалось обновить сессию. Пожалуйста, войдите снова.');
        return;
      }

      console.log('Session refreshed successfully, token is fresh');

      // Send plain (unencrypted) data to edge function
      // Edge function will handle encryption internally
      const createPayload = {
        email: newUser.email, // Plain email - edge function will encrypt
        password: newUser.password,
        first_name: newUser.first_name, // Plain text - edge function will encrypt
        last_name: newUser.last_name, // Plain text - edge function will encrypt
        middle_name: newUser.middle_name || '',
        role: newUser.role,
        manager_id: newUser.manager_id || null,
        position_id: newUser.position_id || null,
        department_id: newUser.department_id || null,
        grade_id: newUser.grade_id || null
      };
      
      console.log('Sending plain data to create-user edge function (will be encrypted server-side)');

      // Check if session is still valid
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('Сессия истекла. Пожалуйста, войдите заново.');
      }

      console.log('Session is valid, calling edge function...');

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: createPayload
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error details:', {
          name: error.name,
          message: error.message,
          context: error.context,
          stack: error.stack
        });
        
        // Provide more user-friendly error messages
        if (error.message.includes('Failed to fetch') || error.message.includes('Failed to send')) {
          throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
        }
        
        throw new Error(error.message || 'Ошибка создания пользователя');
      }

      if (!data?.success) {
        console.error('Edge function returned unsuccessful response:', data);
        throw new Error(data?.error || 'Ошибка создания пользователя');
      }

      console.log('User created successfully:', data);

      toast.success('Пользователь успешно создан');
      setCreateUserDialog(false);
      setNewUser({ 
        email: '', 
        password: 'test123', 
        first_name: '', 
        last_name: '', 
        middle_name: '', 
        role: 'employee', 
        manager_id: '', 
        position_id: '', 
        department_id: '',
        grade_id: ''
      });
      
      // Refresh user list
      await fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Ошибка создания пользователя');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Загрузка...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-wrap gap-3 items-center sticky top-0 bg-background p-4 border-b z-10">
        <div className="flex-1 min-w-[250px]">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ФИО или email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="internal">Внутренние</SelectItem>
            <SelectItem value="external">Внешние</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Роль" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все роли</SelectItem>
            <SelectItem value="admin">Администратор</SelectItem>
            <SelectItem value="hr_bp">HR BP</SelectItem>
            <SelectItem value="manager">Руководитель</SelectItem>
            <SelectItem value="employee">Сотрудник</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="active">Активные</SelectItem>
            <SelectItem value="inactive">Деактивированные</SelectItem>
          </SelectContent>
        </Select>

        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Подразделение" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все подразделения</SelectItem>
            {departmentsList.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Должность" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все должности</SelectItem>
            {positionsList.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={positionCategoryFilter} onValueChange={setPositionCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Категория должности" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {positionCategoriesList.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Экспорт
        </Button>

        <Button onClick={() => setImportUsersDialog(true)} variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Импорт
        </Button>

        <Button onClick={() => setCreateUserDialog(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Создать пользователя
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto scrollbar-visible scrollbar-top">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Должность</TableHead>
                <TableHead>Подразделение</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Bitrix ID</TableHead>
                <TableHead>Bitrix Бот</TableHead>
                <TableHead>Изменён</TableHead>
                <TableHead className="text-right min-w-[180px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} className={!user.status ? 'opacity-50' : ''}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {[user.last_name, user.first_name, user.middle_name].filter(Boolean).join(' ') || '-'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) => handleRoleChange(user.id, value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            {getRoleLabel(user.role)}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="hr_bp">HR BP</SelectItem>
                        <SelectItem value="manager">Руководитель</SelectItem>
                        <SelectItem value="employee">Сотрудник</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{user.position_name || '-'}</TableCell>
                  <TableCell>{user.department_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.status}
                        onCheckedChange={(checked) => handleStatusToggle(user.id, checked)}
                      />
                      <span className="text-sm">{user.status ? 'Активен' : 'Деактивирован'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{user.bitrix_user_id || '-'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={user.bitrix_bot_enabled || false}
                      disabled={!user.bitrix_user_id}
                      onCheckedChange={async (checked) => {
                        if (checked && !user.bitrix_user_id) {
                          toast.error('Сначала укажите Bitrix User ID');
                          return;
                        }
                        try {
                          await supabase.from('users').update({ bitrix_bot_enabled: checked }).eq('id', user.id);
                          setUsers(users.map(u => u.id === user.id ? { ...u, bitrix_bot_enabled: checked } : u));
                          toast.success(checked ? 'Bitrix бот включён' : 'Bitrix бот выключен');
                        } catch { toast.error('Ошибка обновления'); }
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {format(new Date(user.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      {isRecentlyUpdated(user.updated_at) && (
                        <Badge variant="secondary" className="text-xs">Недавно</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setViewUserData(user);
                          setViewUserDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user.id);
                          setAuditSheetOpen(true);
                        }}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.email)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* User Audit History Sheet */}
      {selectedUser && (
        <UserAuditSheet
          userId={selectedUser}
          open={auditSheetOpen}
          onOpenChange={setAuditSheetOpen}
        />
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Подтвердите действие</AlertDialogTitle>
              <AlertDialogDescription>
                Вы уверены, что хотите {confirmDialog.action === 'activate' ? 'активировать' : 'деактивировать'} этого пользователя?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={confirmStatusChange}>Подтвердить</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Delete User Dialog */}
      {deleteDialog && (
        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удаление пользователя</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p className="font-semibold text-destructive">
                  Внимание! Это действие необратимо.
                </p>
                <p>
                  Будут удалены все данные пользователя <span className="font-semibold">{deleteDialog.userEmail}</span>:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 pl-4">
                  <li>Учетная запись в системе авторизации</li>
                  <li>Профиль и личные данные</li>
                  <li>История оценок и опросов</li>
                  <li>Все связанные записи в базе данных</li>
                </ul>
                <p className="pt-2">
                  Вы действительно хотите удалить этого пользователя?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteUser}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить навсегда
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Create User Dialog */}
      <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать нового пользователя</DialogTitle>
            <DialogDescription>
              Пользователь будет создан в Supabase Auth с указанными данными
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Фамилия *</Label>
              <Input
                id="last_name"
                placeholder="Иванов"
                value={newUser.last_name}
                onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first_name">Имя *</Label>
              <Input
                id="first_name"
                placeholder="Иван"
                value={newUser.first_name}
                onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middle_name">Отчество (если есть)</Label>
              <Input
                id="middle_name"
                placeholder="Иванович"
                value={newUser.middle_name}
                onChange={(e) => setNewUser({ ...newUser, middle_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">По умолчанию: test123</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: any) => {
                  setNewUser({ ...newUser, role: value, manager_id: (value === 'employee' || value === 'manager') ? newUser.manager_id : '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="hr_bp">HR BP</SelectItem>
                  <SelectItem value="manager">Руководитель</SelectItem>
                  <SelectItem value="employee">Сотрудник</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Select
                value={newUser.position_id || 'none'}
                onValueChange={(value) => {
                  const posId = value === 'none' ? '' : value;
                  setNewUser({ ...newUser, position_id: posId, grade_id: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначена</SelectItem>
                  {positionsList.map(position => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade">Грейд *</Label>
              <Select
                value={newUser.grade_id || 'none'}
                onValueChange={(value) => setNewUser({ ...newUser, grade_id: value === 'none' ? '' : value })}
                disabled={!newUser.position_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!newUser.position_id ? "Сначала выберите должность" : "Выберите грейд"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {gradesList
                    .filter(grade => grade.position_id === newUser.position_id)
                    .map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name} (уровень {grade.level})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Подразделение</Label>
              <Select
                value={newUser.department_id || 'none'}
                onValueChange={(value) => {
                  setNewUser({ ...newUser, department_id: value === 'none' ? '' : value });
                  // Filter managers by selected department
                  if (value === 'none') {
                    setManagersList(allManagersList);
                  } else {
                    setManagersList(allManagersList.filter(m => m.department_id === value));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите подразделение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначено</SelectItem>
                  {departmentsList.map(department => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Employees and managers can have managers */}
            {(newUser.role === 'employee' || newUser.role === 'manager') && (
              <div className="space-y-2">
                <Label htmlFor="manager">Руководитель</Label>
                <Select
                  value={newUser.manager_id || 'none'}
                  onValueChange={(value) => setNewUser({ ...newUser, manager_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите руководителя" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {managersList.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateUser}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialog} onOpenChange={setEditUserDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>
              Данные шифруются/расшифровываются через безопасный API
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label htmlFor="edit-email" className="text-sm">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editUser?.email || ''}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-last-name" className="text-sm">Фамилия</Label>
                <Input
                  id="edit-last-name"
                  value={editUser?.last_name || ''}
                  onChange={(e) => setEditUser({ ...editUser, last_name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-first-name" className="text-sm">Имя</Label>
                <Input
                  id="edit-first-name"
                  value={editUser?.first_name || ''}
                  onChange={(e) => setEditUser({ ...editUser, first_name: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-middle-name" className="text-sm">Отчество</Label>
                <Input
                  id="edit-middle-name"
                  value={editUser?.middle_name || ''}
                  onChange={(e) => setEditUser({ ...editUser, middle_name: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="edit-role" className="text-sm">Роль</Label>
              <Select
                value={editUser?.role || 'employee'}
                onValueChange={(value: any) => {
                  setEditUser({ ...editUser, role: value, manager_id: (value === 'employee' || value === 'manager') ? editUser?.manager_id : null });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="hr_bp">HR BP</SelectItem>
                  <SelectItem value="manager">Руководитель</SelectItem>
                  <SelectItem value="employee">Сотрудник</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="edit-position" className="text-sm">Должность</Label>
              <Select
                value={editUser?.position_id || 'none'}
                onValueChange={(value) => {
                  const posId = value === 'none' ? null : value;
                  setEditUser({ ...editUser, position_id: posId, grade_id: null });
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначена</SelectItem>
                  {positionsList.map(position => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="edit-grade" className="text-sm">Грейд</Label>
              <Select
                value={editUser?.grade_id || 'none'}
                onValueChange={(value) => setEditUser({ ...editUser, grade_id: value === 'none' ? null : value })}
                disabled={!editUser?.position_id}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={!editUser?.position_id ? "Сначала выберите должность" : "Выберите грейд"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {gradesList
                    .filter(grade => grade.position_id === editUser?.position_id)
                    .map(grade => (
                      <SelectItem key={grade.id} value={grade.id}>
                        {grade.name} (уровень {grade.level})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="edit-department" className="text-sm">Подразделение</Label>
              <Select
                value={editUser?.department_id || 'none'}
                onValueChange={(value) => {
                  setEditUser({ ...editUser, department_id: value === 'none' ? null : value });
                  // Filter managers by selected department
                  if (value === 'none') {
                    setManagersList(allManagersList);
                  } else {
                    setManagersList(allManagersList.filter(m => m.department_id === value));
                  }
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Выберите подразделение" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначено</SelectItem>
                  {departmentsList.map(department => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employees and managers can have managers */}
            {(editUser?.role === 'employee' || editUser?.role === 'manager') && (
              <div className="space-y-1">
                <Label htmlFor="edit-manager" className="text-sm">Руководитель</Label>
                <Select
                  value={editUser?.manager_id || 'none'}
                  onValueChange={(value) => setEditUser({ ...editUser, manager_id: value === 'none' ? null : value })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Выберите руководителя" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {managersList.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-1">
              <Label htmlFor="edit-bitrix-user-id" className="text-sm">Bitrix User ID</Label>
              <Input
                id="edit-bitrix-user-id"
                value={editUser?.bitrix_user_id || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditUser({ ...editUser, bitrix_user_id: val, ...(!val ? { bitrix_bot_enabled: false } : {}) });
                }}
                placeholder="ID пользователя в Bitrix24"
                className="h-9"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-bitrix-bot"
                checked={editUser?.bitrix_bot_enabled || false}
                disabled={!editUser?.bitrix_user_id}
                onCheckedChange={(checked) => {
                  if (checked && !editUser?.bitrix_user_id) {
                    toast.error('Сначала укажите Bitrix User ID');
                    return;
                  }
                  setEditUser({ ...editUser, bitrix_bot_enabled: checked });
                }}
              />
              <Label htmlFor="edit-bitrix-bot" className="text-sm">
                Bitrix Бот включён{!editUser?.bitrix_user_id ? ' (укажите Bitrix ID)' : ''}
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-status"
                checked={editUser?.status || false}
                onCheckedChange={(checked) => setEditUser({ ...editUser, status: checked })}
              />
              <Label htmlFor="edit-status" className="text-sm">Активный</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialog(false)}>
              Отмена
            </Button>
            <Button onClick={saveEditedUser}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={viewUserDialog} onOpenChange={setViewUserDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Информация о пользователе</DialogTitle>
            <DialogDescription>
              Полная информация о пользователе из системы
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {viewUserData && (
              <div className="space-y-6">
                {/* Основная информация */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Основная информация</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{viewUserData.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Табельный номер</Label>
                      <p className="font-medium">{viewUserData.employee_number || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Фамилия</Label>
                      <p className="font-medium">{viewUserData.last_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Имя</Label>
                      <p className="font-medium">{viewUserData.first_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Отчество</Label>
                      <p className="font-medium">{viewUserData.middle_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Статус</Label>
                      <Badge variant={viewUserData.status ? 'default' : 'secondary'}>
                        {viewUserData.status ? 'Активен' : 'Деактивирован'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Роль и права */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Роль и права доступа</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Роль</Label>
                      <div className="mt-1">
                        <Badge variant={getRoleBadgeVariant(viewUserData.role)}>
                          {getRoleLabel(viewUserData.role)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Организационная структура */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Организационная структура</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Должность</Label>
                      <p className="font-medium">{viewUserData.position_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Грейд</Label>
                      <p className="font-medium">{viewUserData.grade_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Компания</Label>
                      <p className="font-medium">{viewUserData.company_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Подразделение</Label>
                      <p className="font-medium">{viewUserData.department_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Руководитель</Label>
                      <p className="font-medium">{viewUserData.manager_name || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Bitrix24 */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Bitrix24</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Bitrix User ID</Label>
                      <p className="font-medium">{viewUserData.bitrix_user_id || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Bitrix Бот</Label>
                      <Badge variant={viewUserData.bitrix_bot_enabled ? 'default' : 'secondary'}>
                        {viewUserData.bitrix_bot_enabled ? 'Включён' : 'Выключен'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Карьерный трек */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Карьерное развитие</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Выбранный карьерный трек</Label>
                      <p className="font-medium">{viewUserData.career_track_name || 'Не выбран'}</p>
                    </div>
                  </div>
                </div>

                {/* Системная информация */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg border-b pb-2">Системная информация</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Последний вход</Label>
                      <p className="font-medium">
                        {viewUserData.last_login_at 
                          ? format(new Date(viewUserData.last_login_at), 'dd.MM.yyyy HH:mm', { locale: ru })
                          : 'Ещё не входил'
                        }
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Дата создания</Label>
                      <p className="font-medium">
                        {format(new Date(viewUserData.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Дата изменения</Label>
                      <p className="font-medium">
                        {format(new Date(viewUserData.updated_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">ID пользователя</Label>
                      <p className="font-mono text-xs">{viewUserData.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setViewUserDialog(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Users Dialog */}
      <ImportUsersDialog
        open={importUsersDialog}
        onOpenChange={setImportUsersDialog}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

export default UsersManagementTable;
