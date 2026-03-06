import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Pencil, Trash, Plus, Trash2, Wand2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';

const API_URL = 'https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g';

interface User {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  status: boolean;
  start_date?: string;
  position_id?: string;
  department_id?: string;
  manager_id?: string;
  hr_bp_id?: string;
  grade_id?: string;
}

export const UsersTableAdmin = () => {
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: User }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch users from external API
  const { data: tableData, isLoading, error } = useQuery({
    queryKey: ['admin', 'users', 'external'],
    queryFn: async () => {
      console.log('Fetching users from API:', API_URL);
      const response = await fetch(API_URL);
      console.log('API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Ошибка загрузки данных: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response data:', data);
      return data;
    },
  });

  // Show error in toast if fetch fails
  React.useEffect(() => {
    if (error) {
      console.error('Query error:', error);
      toast({
        title: 'Ошибка загрузки пользователей',
        description: error instanceof Error ? error.message : 'Не удалось загрузить данные из API',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  // Note: roles table removed, using user_roles instead

  const { data: positions } = useQuery({
    queryKey: ['related', 'positions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['related', 'departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: grades } = useQuery({
    queryKey: ['related', 'grades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grades').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ['related', 'all-users'],
    queryFn: async () => {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('Ошибка загрузки данных');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting user:', id);
      const response = await fetch(`${API_URL}?id=${id}`, { 
        method: 'DELETE',
        mode: 'cors',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete error:', errorText);
        throw new Error(`Ошибка удаления: ${response.status}`);
      }
      
      console.log('Delete success');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'external'] });
      queryClient.invalidateQueries({ queryKey: ['related', 'all-users'] });
      toast({ title: 'Пользователь удален' });
      setDeleteDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      console.log('Bulk deleting users:', ids);
      await Promise.all(
        ids.map(id => fetch(`${API_URL}?id=${id}`, { 
          method: 'DELETE',
          mode: 'cors',
        }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'external'] });
      queryClient.invalidateQueries({ queryKey: ['related', 'all-users'] });
      toast({ title: `Удалено пользователей: ${selectedRows.size}` });
      setSelectedRows(new Set());
      setBulkDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: Partial<User>) => {
      const method = editDialog.data?.id ? 'PUT' : 'POST';
      const url = editDialog.data?.id ? `${API_URL}?id=${editDialog.data.id}` : API_URL;
      
      console.log('Saving user:', { method, url, formData });
      
      try {
        const response = await fetch(url, {
          method,
          mode: 'cors',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(formData),
        });
        
        console.log('Save response status:', response.status);
        console.log('Save response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Save error response:', errorText);
          
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { message: errorText || `Ошибка ${response.status}` };
          }
          
          throw new Error(errorData?.message || `Ошибка сохранения: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Save success:', result);
        return result;
      } catch (error) {
        console.error('Save fetch error:', error);
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('CORS ошибка: Yandex Cloud Function должна разрешать POST запросы с этого домена. Проверьте настройки CORS в функции.');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'external'] });
      queryClient.invalidateQueries({ queryKey: ['related', 'all-users'] });
      toast({ title: editDialog.data?.id ? 'Пользователь обновлен' : 'Пользователь создан' });
      setEditDialog({ open: false });
    },
    onError: (error: any) => {
      console.error('Save mutation error:', error);
      toast({ 
        title: 'Ошибка сохранения', 
        description: error.message || 'Не удалось сохранить данные пользователя', 
        variant: 'destructive' 
      });
    },
  });

  const toggleRowSelection = (id: string) => {
    const newSelection = new Set(selectedRows);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedRows(newSelection);
  };

  const toggleAllRows = () => {
    if (selectedRows.size === tableData?.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(tableData?.map((row: User) => row.id) || []));
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size > 0) {
      setBulkDeleteDialog(true);
    }
  };

  const getDisplayValue = (row: User, col: keyof User) => {
    const value = row[col];
    
    if (col === 'position_id') {
      return positions?.find(p => p.id === value)?.name || value || '-';
    }
    if (col === 'department_id') {
      return departments?.find(d => d.id === value)?.name || value || '-';
    }
    if (col === 'manager_id' || col === 'hr_bp_id') {
      const user = allUsers?.find((u: User) => u.id === value);
      return user ? `${user.last_name} ${user.first_name}` : value || '-';
    }
    if (col === 'status') {
      return value ? 'Активный' : 'Неактивный';
    }
    
    return String(value || '-');
  };

  const columns: Array<{ key: keyof User; label: string }> = [
    { key: 'employee_number', label: 'Табельный номер' },
    { key: 'last_name', label: 'Фамилия' },
    { key: 'first_name', label: 'Имя' },
    { key: 'middle_name', label: 'Отчество' },
    { key: 'email', label: 'Email' },
    { key: 'position_id', label: 'Должность' },
    { key: 'department_id', label: 'Подразделение' },
    { key: 'manager_id', label: 'Руководитель' },
    { key: 'hr_bp_id', label: 'HR BP' },
    { key: 'start_date', label: 'Дата начала работы' },
    { key: 'status', label: 'Статус' },
  ];

  if (isLoading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Пользователи</CardTitle>
              <CardDescription>
                Всего записей: {tableData?.length || 0}
                {selectedRows.size > 0 && ` • Выбрано: ${selectedRows.size}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedRows.size > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить ({selectedRows.size})
              </Button>
            )}
            <Button onClick={() => setEditDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" />
              Добавить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedRows.size === tableData?.length && tableData?.length > 0}
                    onCheckedChange={toggleAllRows}
                  />
                </TableHead>
                {columns.map((col) => <TableHead key={col.key}>{col.label}</TableHead>)}
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData?.map((row: User) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedRows.has(row.id)}
                      onCheckedChange={() => toggleRowSelection(row.id)}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="max-w-xs truncate">
                      {getDisplayValue(row, col.key)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditDialog({ open: true, data: row })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ open: true, id: row.id })}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <UserEditDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false })}
        data={editDialog.data}
        positions={positions}
        departments={departments}
        grades={grades}
        users={allUsers}
        onSave={(formData) => saveMutation.mutate(formData)}
      />

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>Вы уверены, что хотите удалить этого пользователя?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false })}>Отмена</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteDialog.id!)}>Удалить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={bulkDeleteDialog} onOpenChange={setBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтверждение массового удаления</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить выбранных пользователей ({selectedRows.size} шт.)? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedRows))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

const UserEditDialog = ({ open, onClose, data, positions, departments, grades, users, onSave }: any) => {
  const [formData, setFormData] = useState<Partial<User>>({});
  const [filteredGrades, setFilteredGrades] = useState<any[]>([]);

  React.useEffect(() => {
    if (data) {
      setFormData(data);
    } else {
      setFormData({ status: true });
    }
  }, [data]);

  React.useEffect(() => {
    if (formData.position_id && grades) {
      const filtered = grades.filter((g: any) => g.position_id === formData.position_id);
      setFilteredGrades(filtered);
    } else {
      setFilteredGrades([]);
    }
  }, [formData.position_id, grades]);

  const generateEmployeeNumber = () => {
    const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `TAB${randomDigits}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.employee_number) {
      alert('Табельный номер обязателен для заполнения');
      return;
    }
    if (!formData.last_name) {
      alert('Фамилия обязательна для заполнения');
      return;
    }
    if (!formData.first_name) {
      alert('Имя обязательно для заполнения');
      return;
    }
    if (!formData.email) {
      alert('Email обязателен для заполнения');
      return;
    }
    if (!formData.position_id) {
      alert('Должность обязательна для заполнения');
      return;
    }
    if (!formData.department_id) {
      alert('Подразделение обязательно для заполнения');
      return;
    }
    if (!formData.grade_id) {
      alert('Грейд обязателен для заполнения');
      return;
    }
    if (formData.status === undefined) {
      alert('Статус обязателен для заполнения');
      return;
    }
    
    const cleanData = { ...formData };
    delete (cleanData as any).id;
    delete (cleanData as any).created_at;
    delete (cleanData as any).updated_at;
    onSave(cleanData);
  };

  // Note: managers and HR BPs filtering removed since roles moved to user_roles table
  const managers = users || [];
  const hrBPs = users || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.id ? 'Редактировать пользователя' : 'Создать пользователя'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Табельный номер <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                value={formData.employee_number || ''}
                onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                required
                placeholder="TAB0000"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setFormData({ ...formData, employee_number: generateEmployeeNumber() })}
                title="Сгенерировать табельный номер"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Фамилия <span className="text-destructive">*</span></Label>
            <Input
              value={formData.last_name || ''}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Имя <span className="text-destructive">*</span></Label>
            <Input
              value={formData.first_name || ''}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Отчество</Label>
            <Input
              value={formData.middle_name || ''}
              onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          {/* Note: Role selection removed - roles are now managed in user_roles table */}

          <div className="space-y-2">
            <Label>Должность <span className="text-destructive">*</span></Label>
            <Select
              value={formData.position_id || ''}
              onValueChange={(value) => setFormData({ ...formData, position_id: value, grade_id: undefined })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                {positions?.map((position: any) => (
                  <SelectItem key={position.id} value={position.id}>
                    {position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Грейд <span className="text-destructive">*</span></Label>
            <Select
              value={formData.grade_id || ''}
              onValueChange={(value) => setFormData({ ...formData, grade_id: value })}
              required
              disabled={!formData.position_id || filteredGrades.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={!formData.position_id ? "Сначала выберите должность" : filteredGrades.length === 0 ? "Нет грейдов для этой должности" : "Выберите грейд"} />
              </SelectTrigger>
              <SelectContent>
                {filteredGrades?.map((grade: any) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.name} (уровень {grade.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Подразделение <span className="text-destructive">*</span></Label>
            <Select
              value={formData.department_id || ''}
              onValueChange={(value) => setFormData({ ...formData, department_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите подразделение" />
              </SelectTrigger>
              <SelectContent>
                {departments?.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Руководитель</Label>
            <Select
              value={formData.manager_id || ''}
              onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите руководителя" />
              </SelectTrigger>
              <SelectContent>
                {managers?.map((manager: User) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.last_name} {manager.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>HR BP</Label>
            <Select
              value={formData.hr_bp_id || ''}
              onValueChange={(value) => setFormData({ ...formData, hr_bp_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите HR BP" />
              </SelectTrigger>
              <SelectContent>
                {hrBPs?.map((hrBP: User) => (
                  <SelectItem key={hrBP.id} value={hrBP.id}>
                    {hrBP.last_name} {hrBP.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Дата начала работы</Label>
            <Input
              type="date"
              value={formData.start_date || ''}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Статус <span className="text-destructive">*</span></Label>
            <Select
              value={formData.status === undefined ? '' : String(formData.status)}
              onValueChange={(value) => setFormData({ ...formData, status: value === 'true' })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Активный</SelectItem>
                <SelectItem value="false">Неактивный</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit">{data?.id ? 'Сохранить' : 'Создать'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
