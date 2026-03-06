import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, Briefcase, Building2, Trophy, BookOpen, Target, 
  MapPin, Package, Zap, FileText, Settings, GraduationCap, Pencil, Trash, Plus, Trash2
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UsersTableAdmin } from '@/components/UsersTableAdmin';
import { Calendar } from 'lucide-react';

const AdminPage = () => {
  const { user } = useAuth();
  const [activeTable, setActiveTable] = useState('users');
  const { hasPermission: hasAdminPermission, isLoading } = usePermission('security.view_admin_panel');

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return null; // or a loading spinner
  }

  if (!hasAdminPermission) {
    return <Navigate to="/" replace />;
  }

  // Define all reference tables
  const referenceTables = [
    { id: 'users', name: 'Пользователи', icon: Users, table: 'users' },
    { id: 'roles', name: 'Роли', icon: Settings, table: 'roles' },
    { id: 'companies', name: 'Компании', icon: Building2, table: 'companies' },
    { id: 'departments', name: 'Подразделения', icon: Building2, table: 'departments' },
    { id: 'positions', name: 'Должности', icon: Briefcase, table: 'positions' },
    { id: 'position_categories', name: 'Категории должностей', icon: FileText, table: 'position_categories' },
    { id: 'grades', name: 'Грейды', icon: Target, table: 'grades' },
    { id: 'skills', name: 'Навыки', icon: BookOpen, table: 'skills' },
    { id: 'qualities', name: 'Качества', icon: Trophy, table: 'qualities' },
    { id: 'hard_skill_questions', name: 'Вопросы по навыкам', icon: BookOpen, table: 'hard_skill_questions' },
    { id: 'hard_skill_answer_options', name: 'Варианты ответов (навыки)', icon: BookOpen, table: 'hard_skill_answer_options' },
    { id: 'soft_skill_questions', name: 'Вопросы по качествам', icon: Trophy, table: 'soft_skill_questions' },
    { id: 'soft_skill_answer_options', name: 'Варианты ответов (360)', icon: Trophy, table: 'soft_skill_answer_options' },
    { id: 'competency_levels', name: 'Уровни компетенций', icon: GraduationCap, table: 'competency_levels' },
    { id: 'career_tracks', name: 'Карьерные треки', icon: MapPin, table: 'career_tracks' },
    { id: 'track_types', name: 'Типы треков', icon: FileText, table: 'track_types' },
    { id: 'meeting_stages', name: 'Этапы встреч', icon: Calendar, table: 'meeting_stages', custom: true },
    { id: 'meeting_stage_participants', name: 'Участники этапов', icon: Users, table: 'meeting_stage_participants' },
    { id: 'one_on_one_meetings', name: 'Встречи', icon: Users, table: 'one_on_one_meetings' },
    { id: 'meeting_decisions', name: 'Решения встреч', icon: Target, table: 'meeting_decisions' },
    { id: 'trade_points', name: 'Торговые точки', icon: MapPin, table: 'trade_points' },
  ];

  // Map table IDs to their configurations
  const tableConfig = referenceTables.reduce((acc, table) => {
    acc[table.id] = table;
    return acc;
  }, {} as Record<string, typeof referenceTables[0]>);

  const currentTable = tableConfig[activeTable];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar activeTable={activeTable} onTableSelect={setActiveTable} />
        
        <div className="flex-1 flex flex-col">
          <header className="bg-background border-b border-border p-4 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-xl font-semibold">Справочники</h1>
                <p className="text-sm text-muted-foreground">Управление справочными данными системы</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            {activeTable === 'users' ? (
              <UsersTableAdmin />
            ) : currentTable && (
              <ReferenceTableView 
                tableName={currentTable.table} 
                displayName={currentTable.name}
                icon={currentTable.icon}
              />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

// Foreign key mappings for all tables
const foreignKeyMappings: Record<string, Record<string, { table: string; display: string; filter?: { column: string; value: string } }>> = {
  users: { 
    position_id: { table: 'positions', display: 'name' }, 
    department_id: { table: 'departments', display: 'name' },
    manager_id: { table: 'users', display: 'last_name' },
    hr_bp_id: { table: 'users', display: 'last_name' }
  },
  positions: { position_category_id: { table: 'position_categories', display: 'name' } },
  grades: { 
    position_id: { table: 'positions', display: 'name' }, 
    position_category_id: { table: 'position_categories', display: 'name' },
    parent_grade_id: { table: 'grades', display: 'name' }
  },
  career_tracks: { track_type_id: { table: 'track_types', display: 'name' }, target_position_id: { table: 'positions', display: 'name' } },
  career_track_steps: { career_track_id: { table: 'career_tracks', display: 'name' }, grade_id: { table: 'grades', display: 'name' } },
  grade_skills: { grade_id: { table: 'grades', display: 'name' }, skill_id: { table: 'skills', display: 'name' } },
  grade_qualities: { grade_id: { table: 'grades', display: 'name' }, quality_id: { table: 'qualities', display: 'name' } },
  hard_skill_questions: { skill_id: { table: 'skills', display: 'name' } },
  soft_skill_questions: { quality_id: { table: 'qualities', display: 'name' } },
};

// Column display names in Russian
const columnDisplayNames: Record<string, Record<string, string>> = {
  users: {
    last_name: 'Фамилия',
    first_name: 'Имя',
    middle_name: 'Отчество',
    employee_number: 'Табельный номер',
    email: 'Email',
    position_id: 'Должность',
    department_id: 'Подразделение',
    manager_id: 'Руководитель',
    hr_bp_id: 'HR BP',
    start_date: 'Дата начала работы',
    status: 'Статус'
  },
  departments: {
    name: 'Название',
    description: 'Описание'
  },
  positions: {
    name: 'Название',
    position_category_id: 'Категория должности'
  },
  position_categories: {
    name: 'Название',
    description: 'Описание'
  },
  grades: {
    name: 'Название',
    level: 'Уровень',
    position_id: 'Должность',
    position_category_id: 'Категория должности',
    parent_grade_id: 'Родительский грейд',
    description: 'Описание',
    key_tasks: 'Ключевые задачи',
    certification: 'Сертификация',
    min_salary: 'Минимальная зарплата',
    max_salary: 'Максимальная зарплата'
  },
  skills: {
    name: 'Название',
    description: 'Описание',
    category: 'Категория'
  },
  qualities: {
    name: 'Название',
    description: 'Описание',
    is_universal: 'Универсальное'
  },
  competency_levels: {
    level: 'Уровень',
    name: 'Название',
    description: 'Описание'
  },
  hard_skill_questions: {
    question_text: 'Текст вопроса',
    skill_id: 'Навык',
    order_index: 'Порядковый номер'
  },
  hard_skill_answer_options: {
    title: 'Название',
    description: 'Описание',
    step: 'Шаг'
  },
  soft_skill_questions: {
    question_text: 'Текст вопроса',
    quality_id: 'Качество',
    category: 'Категория',
    order_index: 'Порядковый номер'
  },
  soft_skill_answer_options: {
    label: 'Название',
    description: 'Описание',
    value: 'Значение'
  },
  career_tracks: {
    name: 'Название',
    description: 'Описание',
    track_type_id: 'Тип трека',
    target_position_id: 'Целевая должность',
    duration_months: 'Длительность (месяцы)'
  },
  track_types: {
    name: 'Название',
    description: 'Описание'
  },
  trade_points: {
    name: 'Название',
    address: 'Адрес',
    latitude: 'Широта',
    longitude: 'Долгота',
    status: 'Статус'
  }
};

const hiddenColumns = ['id', 'created_at', 'updated_at'];

// Component for displaying and managing reference tables
const ReferenceTableView = ({ tableName, displayName, icon: Icon }: { 
  tableName: string; 
  displayName: string;
  icon: any;
}) => {
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Проверка прав для таблицы companies - только админы могут редактировать/удалять
  const { hasPermission: canManageCompanies } = usePermission('security.manage_users');
  const isCompaniesTable = tableName === 'companies';
  const canEdit = !isCompaniesTable || canManageCompanies;


  const { data: tableData, isLoading } = useQuery({
    queryKey: ['admin', tableName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch related data for foreign keys
  const foreignKeys = foreignKeyMappings[tableName] || {};
  
  // Create stable array of foreign key configs
  const foreignKeyConfigs = React.useMemo(() => 
    Object.entries(foreignKeys).map(([columnName, config]) => ({ columnName, config })),
    [tableName]
  );

  // Note: roles table removed, using user_roles instead

  const positionsQuery = useQuery({
    queryKey: ['related', 'positions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'positions'),
  });

  const departmentsQuery = useQuery({
    queryKey: ['related', 'departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'departments'),
  });

  const usersQuery = useQuery({
    queryKey: ['related', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'users'),
  });

  const positionCategoriesQuery = useQuery({
    queryKey: ['related', 'position_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('position_categories').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'position_categories'),
  });

  const trackTypesQuery = useQuery({
    queryKey: ['related', 'track_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('track_types').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'track_types'),
  });

  const careerTracksQuery = useQuery({
    queryKey: ['related', 'career_tracks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('career_tracks').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'career_tracks'),
  });

  const gradesQuery = useQuery({
    queryKey: ['related', 'grades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('grades').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'grades'),
  });

  const skillsQuery = useQuery({
    queryKey: ['related', 'hard_skills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hard_skills').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'hard_skills'),
  });

  const qualitiesQuery = useQuery({
    queryKey: ['related', 'soft_skills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('soft_skills').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'soft_skills'),
  });

  const tradePointsQuery = useQuery({
    queryKey: ['related', 'trade_points'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trade_points').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'trade_points'),
  });

  const companiesQuery = useQuery({
    queryKey: ['related', 'companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'companies'),
  });

  // Map table names to queries
  const queryMap: Record<string, any> = {
    'positions': positionsQuery,
    'departments': departmentsQuery,
    'users': usersQuery,
    'position_categories': positionCategoriesQuery,
    'track_types': trackTypesQuery,
    'career_tracks': careerTracksQuery,
    'grades': gradesQuery,
    'skills': skillsQuery,
    'qualities': qualitiesQuery,
    'trade_points': tradePointsQuery,
    'companies': companiesQuery,
  };

  // Helper to get related data for a foreign key
  const getRelatedData = (config: any) => {
    const query = queryMap[config.table];
    if (!query?.data) return [];
    
    return query.data;
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(tableName as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', tableName] });
      toast({ title: 'Запись удалена' });
      setDeleteDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from(tableName as any).delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', tableName] });
      toast({ title: `Удалено записей: ${selectedRows.size}` });
      setSelectedRows(new Set());
      setBulkDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      if (editDialog.data?.id) {
        const { error } = await supabase.from(tableName as any).update(formData).eq('id', editDialog.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(tableName as any).insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', tableName] });
      toast({ title: editDialog.data?.id ? 'Запись обновлена' : 'Запись создана' });
      setEditDialog({ open: false });
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Загрузка...</div>;
  }

  const columns: string[] = tableData && tableData.length > 0 
    ? Object.keys(tableData[0]).filter(col => !hiddenColumns.includes(col))
    : [];

  const getDisplayValue = (row: any, col: string) => {
    const value = row[col];
    if (foreignKeys[col]) {
      const relatedData = getRelatedData(foreignKeys[col]);
      const relatedItem = relatedData?.find((item: any) => item.id === value);
      return relatedItem?.[foreignKeys[col].display] || value || '-';
    }
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Активный' : 'Неактивный';
    return String(value || '-');
  };

  const getColumnDisplayName = (col: string) => {
    return columnDisplayNames[tableName]?.[col] || col;
  };

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
      setSelectedRows(new Set(tableData?.map((row: any) => row.id) || []));
    }
  };

  const handleBulkDelete = () => {
    if (selectedRows.size > 0) {
      setBulkDeleteDialog(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{displayName}</CardTitle>
              <CardDescription>
                Всего записей: {tableData?.length || 0}
                {selectedRows.size > 0 && ` • Выбрано: ${selectedRows.size}`}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedRows.size > 0 && canEdit && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить ({selectedRows.size})
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => setEditDialog({ open: true })}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  {canEdit && (
                    <Checkbox 
                      checked={selectedRows.size === tableData?.length && tableData?.length > 0}
                      onCheckedChange={toggleAllRows}
                    />
                  )}
                </TableHead>
                {columns.map((col) => <TableHead key={col}>{getColumnDisplayName(col)}</TableHead>)}
                {canEdit && <TableHead className="w-24">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData?.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {canEdit && (
                      <Checkbox 
                        checked={selectedRows.has(row.id)}
                        onCheckedChange={() => toggleRowSelection(row.id)}
                      />
                    )}
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className="max-w-xs truncate">
                      {getDisplayValue(row, col)}
                    </TableCell>
                  ))}
                  {canEdit && (
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
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <EditDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false })}
        data={editDialog.data}
        tableName={tableName}
        columns={columns}
        foreignKeys={foreignKeys}
        getRelatedData={getRelatedData}
        onSave={(formData) => saveMutation.mutate(formData)}
      />

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>Вы уверены, что хотите удалить эту запись?</DialogDescription>
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
              Вы уверены, что хотите удалить выбранные записи ({selectedRows.size} шт.)? Это действие нельзя отменить.
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

const EditDialog = ({ open, onClose, data, tableName, columns, foreignKeys, getRelatedData, onSave }: any) => {
  const [formData, setFormData] = useState<any>({});

  React.useEffect(() => {
    if (data) {
      setFormData(data);
    } else {
      setFormData({});
    }
  }, [data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanData = { ...formData };
    delete cleanData.id;
    delete cleanData.created_at;
    delete cleanData.updated_at;
    onSave(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.id ? 'Редактировать запись' : 'Создать запись'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {columns.map((col: string) => {
            const isForeignKey = foreignKeys[col];
            const relatedData = isForeignKey ? getRelatedData(foreignKeys[col]) : null;

            const displayName = columnDisplayNames[tableName]?.[col] || col;
            
            return (
              <div key={col} className="space-y-2">
                <Label>{displayName}</Label>
                {isForeignKey ? (
                  <Select
                    value={formData[col] || ''}
                    onValueChange={(value) => setFormData({ ...formData, [col]: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    <SelectContent>
                      {relatedData?.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item[foreignKeys[col].display]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : col === 'status' && tableName === 'users' ? (
                  <Select
                    value={formData[col] === undefined ? '' : String(formData[col])}
                    onValueChange={(value) => setFormData({ ...formData, [col]: value === 'true' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Активный</SelectItem>
                      <SelectItem value="false">Неактивный</SelectItem>
                    </SelectContent>
                  </Select>
                ) : col.includes('description') || col.includes('bio') ? (
                  <Textarea
                    value={formData[col] || ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                  />
                ) : col.includes('date') ? (
                  <Input
                    type="date"
                    value={formData[col] || ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                  />
                ) : (
                  <Input
                    type={typeof data?.[col] === 'number' ? 'number' : 'text'}
                    value={formData[col] || ''}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                  />
                )}
              </div>
            );
          })}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit">{data?.id ? 'Сохранить' : 'Создать'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPage;