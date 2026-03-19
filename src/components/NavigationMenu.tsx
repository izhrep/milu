import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Rss, User, TrendingUp, GraduationCap, Users, Settings, LogOut, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { usePermission } from '@/hooks/usePermission';
import { decryptUserData, getFullName } from '@/lib/userDataDecryption';

const NavigationMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const { hasPermission: canViewAdmin } = usePermission('users.view');
  const [displayName, setDisplayName] = useState<string>('');

  useEffect(() => {
    const loadUserName = async () => {
      if (user) {
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
      }
    };
    loadUserName();
  }, [user]);


  const menuItems = [
    { 
      icon: Rss, 
      label: 'Лента', 
      path: '/feed',
    },
    { 
      icon: User, 
      label: 'Профиль', 
      path: '/profile',
    },
    { 
      icon: TrendingUp, 
      label: 'Мое развитие', 
      path: '/development',
    },
    { 
      icon: GraduationCap, 
      label: 'Обучение', 
      path: '/training',
    },
    { 
      icon: Users, 
      label: 'Встречи one-to-one', 
      path: '/meetings',
    },
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    toast.success('Вы успешно вышли из системы');
    navigate('/auth');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full bg-background border-r border-border transition-all duration-300 z-50 flex flex-col",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* User Profile Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
          )}>
            <p className="font-semibold text-sm truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
        
        {/* Profile Settings Button */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full mt-3 justify-start gap-2 transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-0 h-0 mt-0 overflow-hidden"
          )}
          onClick={() => navigate('/profile')}
        >
          <UserCog className="h-4 w-4" />
          <span className="text-xs">Настройка профиля</span>
        </Button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Button
              key={item.path}
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 transition-all duration-300",
                isExpanded ? "px-4" : "px-3",
                active && "bg-primary/10 text-primary font-medium"
              )}
              onClick={() => handleNavigation(item.path)}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
              )}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </nav>

      {/* Bottom Section - Logout and Admin */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Logout Button */}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-300",
            isExpanded ? "px-4" : "px-3"
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className={cn(
            "transition-all duration-300 whitespace-nowrap",
            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
          )}>
            Выход
          </span>
        </Button>

        {/* Admin Panel - Only for users with permissions */}
        {canViewAdmin && (
          <>
            <Separator className="my-2" />
            <Button
              variant={isActive('/admin') ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 transition-all duration-300",
                isExpanded ? "px-4" : "px-3",
                isActive('/admin') && "bg-primary/10 text-primary font-medium"
              )}
              onClick={() => handleNavigation('/admin')}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span className={cn(
                "transition-all duration-300 whitespace-nowrap",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
              )}>
                Админ панель
              </span>
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default NavigationMenu;
