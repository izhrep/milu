import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash, Trash2 } from 'lucide-react';
import { foreignKeyMappings, columnDisplayNames, hiddenColumns } from './tableConfig';

interface ReferenceTableViewProps {
  tableName: string;
  displayName: string;
  icon: any;
}

export const ReferenceTableView = ({ tableName, displayName, icon: Icon }: ReferenceTableViewProps) => {
  const [editDialog, setEditDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false });
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  
  const foreignKeyConfigs = React.useMemo(() => 
    Object.entries(foreignKeys).map(([columnName, config]) => ({ columnName, config })),
    [tableName]
  );

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

  const manufacturersQuery = useQuery({
    queryKey: ['related', 'manufacturers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('manufacturers').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'manufacturers'),
  });

  const certificationsQuery = useQuery({
    queryKey: ['related', 'certifications'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certifications').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'certifications'),
  });

  const categorySkillsQuery = useQuery({
    queryKey: ['related', 'category_hard_skills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('category_hard_skills').select('*');
      if (error) throw error;
      return data;
    },
    enabled: foreignKeyConfigs.some(fk => fk.config.table === 'category_hard_skills'),
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
    'manufacturers': manufacturersQuery,
    'certifications': certificationsQuery,
    'category_skills': categorySkillsQuery,
    'companies': companiesQuery,
  };

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
                {columns.map((col) => <TableHead key={col}>{getColumnDisplayName(col)}</TableHead>)}
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData?.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Checkbox 
                      checked={selectedRows.has(row.id)}
                      onCheckedChange={() => toggleRowSelection(row.id)}
                    />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={col} className="max-w-xs truncate">
                      {getDisplayValue(row, col)}
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
