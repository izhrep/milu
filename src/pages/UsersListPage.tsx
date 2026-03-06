import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Search } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

interface User {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  status: boolean;
}

const API_URL = 'https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g';

export default function UsersListPage() {
  const navigate = useNavigate();
  
  // All hooks must be called before any conditional returns
  const { hasPermission: canManageUsers, isLoading: permissionLoading } = usePermission('security.manage_users');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof User>('employee_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить список пользователей',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortUsers = () => {
    let result = [...users];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) =>
          user.first_name.toLowerCase().includes(query) ||
          user.last_name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          user.employee_number.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      const aValue = String(a[sortField]);
      const bValue = String(b[sortField]);
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredUsers(result);
  };

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [canManageUsers]);

  useEffect(() => {
    filterAndSortUsers();
  }, [users, searchQuery, sortField, sortDirection]);
  
  // Permission check - after all hooks
  if (permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }
  
  if (!canManageUsers) {
    return <Navigate to="/" replace />;
  }

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof User) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="container mx-auto py-8 px-6">
      <Breadcrumbs />
      
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Список пользователей</h1>
          <p className="text-text-secondary mt-1">Управление пользователями системы</p>
        </div>
        <Button onClick={() => navigate('/users/create')}>
          <Plus className="mr-2 h-4 w-4" />
          Добавить пользователя
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            placeholder="Поиск по имени, email или табельному номеру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-surface-primary rounded-lg border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('employee_number')}
                >
                  Табельный номер{getSortIcon('employee_number')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('first_name')}
                >
                  Имя{getSortIcon('first_name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('last_name')}
                >
                  Фамилия{getSortIcon('last_name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('email')}
                >
                  Email{getSortIcon('email')}
                </TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-text-secondary">
                    {searchQuery ? 'Ничего не найдено' : 'Список пользователей пуст'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.employee_number}</TableCell>
                    <TableCell>{user.first_name}</TableCell>
                    <TableCell>{user.last_name}</TableCell>
                    <TableCell className="text-text-secondary">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.status ? 'default' : 'secondary'}>
                        {user.status ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && filteredUsers.length > 0 && (
        <p className="text-sm text-text-secondary mt-4">
          Показано пользователей: {filteredUsers.length} из {users.length}
        </p>
      )}
    </div>
  );
}