import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { toast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

const userSchema = z.object({
  first_name: z.string().min(1, 'Укажите имя').max(100, 'Имя не может быть длиннее 100 символов'),
  last_name: z.string().min(1, 'Укажите фамилию').max(100, 'Фамилия не может быть длиннее 100 символов'),
  email: z.string().email('Некорректный email').max(255, 'Email не может быть длиннее 255 символов'),
  employee_number: z.string().min(1, 'Укажите табельный номер').max(50, 'Табельный номер не может быть длиннее 50 символов'),
});

type UserFormData = z.infer<typeof userSchema>;

const API_URL = 'https://functions.yandexcloud.net/d4eb74i8p2s72d275h1g';

export default function CreateUserPage() {
  const navigate = useNavigate();
  
  // All hooks must be called before any conditional returns
  const { hasPermission: canManageUsers, isLoading: permissionLoading } = usePermission('security.manage_users');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const onSubmit = async (data: UserFormData) => {
    try {
      setLoading(true);
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Ошибка при создании пользователя');
      }

      toast({
        title: 'Успешно',
        description: 'Пользователь успешно создан',
      });

      navigate('/users');
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать пользователя',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
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

  return (
    <div className="container mx-auto py-4 px-6 max-w-2xl h-screen flex flex-col overflow-hidden">
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/users')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Добавить пользователя</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="last_name" className="text-sm">
                    Фамилия <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    placeholder="Фамилия"
                    {...register('last_name')}
                    disabled={loading}
                    className="h-9"
                  />
                  {errors.last_name && (
                    <p className="text-xs text-destructive">{errors.last_name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="first_name" className="text-sm">
                    Имя <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    placeholder="Имя"
                    {...register('first_name')}
                    disabled={loading}
                    className="h-9"
                  />
                  {errors.first_name && (
                    <p className="text-xs text-destructive">{errors.first_name.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-sm">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@company.com"
                    {...register('email')}
                    disabled={loading}
                    className="h-9"
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="employee_number" className="text-sm">
                    Табельный номер <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="employee_number"
                    placeholder="EMP001"
                    {...register('employee_number')}
                    disabled={loading}
                    className="h-9"
                  />
                  {errors.employee_number && (
                    <p className="text-xs text-destructive">{errors.employee_number.message}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Создать
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/users')}
                  disabled={loading}
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}