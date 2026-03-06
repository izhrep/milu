import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData, getFullName } from '@/lib/userDataDecryption';

const UserMenu = () => {
  const { user, logout } = useAuth();
  const [userRole, setUserRole] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;
      
      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (roleData) {
        const roleLabels: Record<string, string> = {
          admin: 'Администратор',
          hr_bp: 'HR BP',
          manager: 'Руководитель',
          employee: 'Сотрудник'
        };
        setUserRole(roleLabels[roleData.role] || roleData.role);
      }

      // Decrypt and set display name
      if (user.first_name || user.last_name) {
        const decrypted = await decryptUserData({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          middle_name: user.middle_name || '',
          email: user.email || '',
        });
        setDisplayName(getFullName(decrypted));
      } else {
        setDisplayName(user.email || 'Пользователь');
      }
    };

    fetchUserData();
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.success('Вы успешно вышли из системы');
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{displayName}</p>
            {userRole && <p className="text-xs text-muted-foreground">Роль: {userRole}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;