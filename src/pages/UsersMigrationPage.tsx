import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
}

interface MigrationResult {
  employee_number: string;
  status: 'success' | 'error';
  message: string;
}

export default function UsersMigrationPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('employee_number', 'EMP011')
        .eq('status', true);

      if (error) throw error;
      setUsers(data || []);
      
      if (data && data.length > 0) {
        setShowConfirmDialog(true);
        toast({
          title: 'Загружено',
          description: `Найдено пользователей для миграции: ${data.length}`,
        });
      } else {
        toast({
          title: 'Нет пользователей',
          description: 'Все пользователи уже мигрированы',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить пользователей',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const migrateUsers = async () => {
    setMigrating(true);
    const migrationResults: MigrationResult[] = [];

    for (const user of users) {
      try {
        // 1. Создаем пользователя через API (с шифрованием)
        const createResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_number: user.employee_number,
            first_name: user.first_name,
            last_name: user.last_name,
            middle_name: user.middle_name,
            email: user.email,
            status: user.status,
            start_date: user.start_date,
            position_id: user.position_id,
            department_id: user.department_id,
            manager_id: user.manager_id,
            hr_bp_id: user.hr_bp_id,
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => null);
          throw new Error(errorData?.message || 'Ошибка создания через API');
        }

        // 2. Удаляем старую запись из Supabase
        const { error: deleteError } = await supabase
          .from('users')
          .delete()
          .eq('id', user.id);

        if (deleteError) {
          throw new Error(`Ошибка удаления: ${deleteError.message}`);
        }

        migrationResults.push({
          employee_number: user.employee_number,
          status: 'success',
          message: 'Успешно мигрирован',
        });

        toast({
          title: 'Успех',
          description: `${user.employee_number} (${user.last_name} ${user.first_name}) успешно мигрирован`,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        migrationResults.push({
          employee_number: user.employee_number,
          status: 'error',
          message: errorMessage,
        });

        toast({
          title: 'Ошибка миграции',
          description: `${user.employee_number}: ${errorMessage}`,
          variant: 'destructive',
        });
      }
    }

    setResults(migrationResults);
    setMigrating(false);

    const successCount = migrationResults.filter(r => r.status === 'success').length;
    const errorCount = migrationResults.filter(r => r.status === 'error').length;

    toast({
      title: 'Миграция завершена',
      description: `Успешно: ${successCount}, Ошибок: ${errorCount}`,
    });
  };

  return (
    <div className="container mx-auto py-8 px-6">
      <Breadcrumbs />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary">Миграция пользователей</h1>
        <p className="text-text-secondary mt-1">
          Пересоздание пользователей с шифрованием через внешний API (кроме EMP011)
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Внимание! Опасная операция
          </CardTitle>
          <CardDescription>
            Эта операция:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Создаст новые записи пользователей через API с шифрованием</li>
              <li>Удалит старые незашифрованные записи из Supabase</li>
              <li>Исключит из миграции пользователя EMP011</li>
              <li>Процесс необратим - убедитесь в наличии резервной копии!</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={loadUsers} disabled={loading || migrating}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Загрузить пользователей
            </Button>

            {users.length > 0 && (
              <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={migrating}>
                    {migrating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Начать миграцию ({users.length} польз.)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Подтверждение миграции</AlertDialogTitle>
                    <AlertDialogDescription>
                      Вы уверены, что хотите мигрировать {users.length} пользователей?
                      <br />
                      <br />
                      Старые незашифрованные записи будут удалены безвозвратно.
                      <br />
                      Убедитесь, что у вас есть резервная копия данных!
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setShowConfirmDialog(false);
                        migrateUsers();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Начать миграцию
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button variant="outline" onClick={() => navigate('/admin')}>
              Назад в админ-панель
            </Button>
          </div>
        </CardContent>
      </Card>

      {users.length > 0 && results.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Пользователи для миграции</CardTitle>
            <CardDescription>Всего: {users.length}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Табельный номер</TableHead>
                  <TableHead>Фамилия</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.employee_number}</TableCell>
                    <TableCell>{user.last_name}</TableCell>
                    <TableCell>{user.first_name}</TableCell>
                    <TableCell className="text-text-secondary">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.status ? 'default' : 'secondary'}>
                        {user.status ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Результаты миграции</CardTitle>
            <CardDescription>
              Успешно: {results.filter(r => r.status === 'success').length} / Ошибок:{' '}
              {results.filter(r => r.status === 'error').length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Статус</TableHead>
                  <TableHead>Табельный номер</TableHead>
                  <TableHead>Сообщение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {result.status === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{result.employee_number}</TableCell>
                    <TableCell className={result.status === 'error' ? 'text-destructive' : ''}>
                      {result.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
