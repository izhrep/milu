import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Search } from 'lucide-react';

interface AuditLog {
  id: string;
  admin_id: string;
  target_user_id: string | null;
  action_type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  admin_email?: string;
  target_email?: string;
}

const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Fetch user emails
      const userIds = [
        ...new Set([
          ...(data?.map(l => l.admin_id) || []),
          ...(data?.map(l => l.target_user_id).filter(Boolean) || [])
        ])
      ];

      const { data: usersData } = await supabase
        .from('users')
        .select('id, email')
        .in('id', userIds);

      const emailMap = new Map(usersData?.map(u => [u.id, u.email]) || []);

      const logsWithEmails = data?.map(log => ({
        ...log,
        admin_email: emailMap.get(log.admin_id) || 'Неизвестно',
        target_email: log.target_user_id ? emailMap.get(log.target_user_id) || 'Неизвестно' : null
      })) || [];

      setLogs(logsWithEmails);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    if (searchTerm) {
      filtered = filtered.filter(
        l =>
          l.admin_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          l.target_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter(l => l.action_type === actionFilter);
    }

    setFilteredLogs(filtered);
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'role_changed': return 'Изменение роли';
      case 'status_changed': return 'Изменение статуса';
      case 'permission_changed': return 'Изменение прав';
      case 'session_revoked': return 'Завершение сессий';
      default: return action;
    }
  };

  const getActionVariant = (action: string) => {
    switch (action) {
      case 'role_changed': return 'default';
      case 'status_changed': return 'secondary';
      case 'permission_changed': return 'outline';
      case 'session_revoked': return 'destructive';
      default: return 'outline';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Загрузка...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал аудита</CardTitle>
        <CardDescription>
          Полная история всех действий администраторов в системе
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Тип действия" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все действия</SelectItem>
              <SelectItem value="role_changed">Изменение роли</SelectItem>
              <SelectItem value="status_changed">Изменение статуса</SelectItem>
              <SelectItem value="permission_changed">Изменение прав</SelectItem>
              <SelectItem value="session_revoked">Завершение сессий</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата и время</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Администратор</TableHead>
                <TableHead>Целевой пользователь</TableHead>
                <TableHead>Поле</TableHead>
                <TableHead>Было</TableHead>
                <TableHead>Стало</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionVariant(log.action_type)}>
                      {getActionLabel(log.action_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.admin_email}</TableCell>
                  <TableCell>{log.target_email || '-'}</TableCell>
                  <TableCell>{log.field || '-'}</TableCell>
                  <TableCell>{log.old_value || '-'}</TableCell>
                  <TableCell>{log.new_value || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Записи отсутствуют
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditLogViewer;
