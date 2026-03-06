import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  admin_email?: string;
}

interface UserAuditSheetProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserAuditSheet: React.FC<UserAuditSheetProps> = ({ userId, open, onOpenChange }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAuditLogs();
    }
  }, [open, userId]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch admin emails
      const adminIds = [...new Set(data?.map(l => l.admin_id) || [])];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email')
        .in('id', adminIds);

      const emailMap = new Map(usersData?.map(u => [u.id, u.email]) || []);

      const logsWithEmails = data?.map(log => ({
        ...log,
        admin_email: emailMap.get(log.admin_id) || 'Неизвестно'
      })) || [];

      setLogs(logsWithEmails);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>История изменений</SheetTitle>
          <SheetDescription>
            Все действия администраторов с этим пользователем
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              История изменений отсутствует
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <Badge variant="outline">{getActionLabel(log.action_type)}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </span>
                </div>

                {log.field && (
                  <div className="text-sm">
                    <span className="font-medium">Поле:</span> {log.field}
                  </div>
                )}

                {log.old_value && (
                  <div className="text-sm">
                    <span className="font-medium">Было:</span> {log.old_value}
                  </div>
                )}

                {log.new_value && (
                  <div className="text-sm">
                    <span className="font-medium">Стало:</span> {log.new_value}
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Администратор: {log.admin_email}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserAuditSheet;
