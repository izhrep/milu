import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, Mail, Calendar, MapPin, Building2, Briefcase, 
  Phone, Users, Globe
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  phone?: string;
  birth_date?: string;
  avatar_url?: string;
  bio?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  work_address?: string;
  store_number?: string;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { users, loading: usersLoading } = useUsers();
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [userTimezone, setUserTimezone] = useState<string>('Europe/Moscow');
  const [timezoneSaving, setTimezoneSaving] = useState(false);
  
  // Get user ID from query params or use auth user
  const queryParams = new URLSearchParams(window.location.search);
  const userIdParam = queryParams.get('user');
  const targetUserId = userIdParam || authUser?.id;
  
  // Find detailed user data based on target user ID
  const currentUser = users.find(user => user.id === targetUserId);

  // Find HR BP and Manager info
  const hrBP = users.find(user => user.id === currentUser?.hr_bp_id);
  const manager = users.find(user => user.id === currentUser?.manager_id);

  // Fetch company info through department
  const [companyName, setCompanyName] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCompany = async () => {
      if (!currentUser?.departments?.company_id) return;
      
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('name')
          .eq('id', currentUser.departments.company_id)
          .single();
        
        if (error) throw error;
        setCompanyName(data?.name || null);
      } catch (err) {
        console.error('Error fetching company:', err);
      }
    };

    fetchCompany();
  }, [currentUser?.departments?.company_id]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!targetUserId) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', targetUserId)
          .maybeSingle();
        
        if (error) throw error;
        setUserProfile(data);
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchUserProfile();
  }, [targetUserId]);
  // Fetch user timezone (own profile only)
  const isOwnProfile = targetUserId === authUser?.id;
  useEffect(() => {
    if (!isOwnProfile || !targetUserId) return;
    supabase
      .from('users')
      .select('timezone')
      .eq('id', targetUserId)
      .single()
      .then(({ data }) => {
        if (data?.timezone) setUserTimezone(data.timezone);
      });
  }, [targetUserId, isOwnProfile]);

  const COMMON_TIMEZONES: { value: string; label: string }[] = [
    { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
    { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
    { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
    { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
    { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
    { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
    { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
    { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
    { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
    { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
    { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
    { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
    { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
    { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
    { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  ];

  const handleTimezoneChange = async (tz: string) => {
    setUserTimezone(tz);
    setTimezoneSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ timezone: tz, timezone_manual: true } as Record<string, unknown>)
        .eq('id', authUser!.id);
      if (error) throw error;
      toast.success('Часовой пояс сохранён');
    } catch (err) {
      console.error('Failed to save timezone:', err);
      toast.error('Не удалось сохранить часовой пояс');
    } finally {
      setTimezoneSaving(false);
    }
  };

  const loading = usersLoading || profileLoading;
  const userRole = authUser?.role;
  const isLimitedRole = userRole === 'employee' || userRole === 'manager';
  // Employee/manager can only view own profile
  const isViewingOtherProfile = !isOwnProfile;

  if (!authUser || loading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-brand-purple mx-auto"></div>
          <p className="mt-4 text-text-secondary">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  // Block limited roles from viewing other users' profiles
  if (isLimitedRole && isViewingOtherProfile) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">У вас нет доступа к этому профилю</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-secondary">Пользователь не найден</p>
        </div>
      </div>
    );
  }

  // Hide sensitive fields for employee/manager
  const showEmployeeNumber = !isLimitedRole;
  const showDepartment = !isLimitedRole;

  const initials = [currentUser.last_name?.[0], currentUser.first_name?.[0]]
    .filter(Boolean)
    .join('');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Breadcrumbs />
      
      {/* Profile Header */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="w-24 h-24 shadow-lg">
              <AvatarFallback className="bg-gradient-purple text-white text-2xl">
                {initials || '?'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-text-primary">
                  {currentUser.last_name} {currentUser.first_name} {currentUser.middle_name}
                </h1>
                <Badge variant={currentUser.status ? "default" : "secondary"}>
                  {currentUser.status ? 'Активный' : 'Неактивный'}
                </Badge>
              </div>
              
              <p className="text-lg text-text-secondary mb-3">
                {currentUser.positions?.name || 'Должность не указана'}
              </p>
              
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-brand-purple/10 text-brand-purple border-brand-purple/20">
                  {currentUser.role_name || 'Сотрудник'}
                </Badge>
                {companyName && (
                  <Badge variant="outline" className="bg-brand-blue/10 text-brand-blue border-brand-blue/20">
                    {companyName}
                  </Badge>
                )}
                {currentUser.departments?.name && (
                  <Badge variant="outline" className="bg-brand-orange/10 text-brand-orange border-brand-orange/20">
                    {currentUser.departments.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-brand-purple" />
              Контактная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-purple/10 rounded-lg mt-1">
                <Mail className="w-4 h-4 text-brand-purple" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Email</p>
                <p className="font-medium text-text-primary break-all">{currentUser.email}</p>
              </div>
            </div>
            
            {userProfile?.phone && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-purple/10 rounded-lg mt-1">
                  <Phone className="w-4 h-4 text-brand-purple" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Телефон</p>
                  <p className="font-medium text-text-primary">{userProfile.phone}</p>
                </div>
              </div>
            )}
            
            {userProfile?.work_address && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-purple/10 rounded-lg mt-1">
                  <MapPin className="w-4 h-4 text-brand-purple" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Рабочий адрес</p>
                  <p className="font-medium text-text-primary">{userProfile.work_address}</p>
                </div>
              </div>
            )}

            {userProfile?.store_number && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-purple/10 rounded-lg mt-1">
                  <Building2 className="w-4 h-4 text-brand-purple" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Номер магазина</p>
                  <p className="font-medium text-text-primary">{userProfile.store_number}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand-orange" />
              Рабочая информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showEmployeeNumber && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                <MapPin className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Табельный номер</p>
                <p className="font-medium text-text-primary">{currentUser.employee_number}</p>
              </div>
            </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                <Briefcase className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Должность</p>
                <p className="font-medium text-text-primary">
                  {currentUser.positions?.name || 'Не указано'}
                </p>
              </div>
            </div>
            
            {showDepartment && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                <Building2 className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Подразделение</p>
                <p className="font-medium text-text-primary">
                  {currentUser.departments?.name || 'Не указано'}
                </p>
              </div>
            </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                <Calendar className="w-4 h-4 text-brand-orange" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-text-secondary">Дата начала работы</p>
                <p className="font-medium text-text-primary">
                  {currentUser.start_date ? 
                    new Date(currentUser.start_date).toLocaleDateString('ru-RU') : 
                    'Не указано'
                  }
                </p>
              </div>
            </div>
            
            {manager && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                  <Users className="w-4 h-4 text-brand-orange" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Руководитель</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-medium text-brand-purple hover:text-brand-purple/80"
                    onClick={() => navigate(`/profile?user=${manager.id}`)}
                  >
                    {manager.last_name} {manager.first_name} {manager.middle_name}
                  </Button>
                </div>
              </div>
            )}

            {hrBP && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-orange/10 rounded-lg mt-1">
                  <Users className="w-4 h-4 text-brand-orange" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">HR BP</p>
                  <Button
                    variant="link"
                    className="h-auto p-0 font-medium text-brand-purple hover:text-brand-purple/80"
                    onClick={() => navigate(`/profile?user=${hrBP.id}`)}
                  >
                    {hrBP.last_name} {hrBP.first_name} {hrBP.middle_name}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personal Information */}
      {(userProfile?.birth_date || userProfile?.bio || userProfile?.emergency_contact_name) && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-brand-teal" />
              Личная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {userProfile?.birth_date && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-teal/10 rounded-lg mt-1">
                  <Calendar className="w-4 h-4 text-brand-teal" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Дата рождения</p>
                  <p className="font-medium text-text-primary">
                    {new Date(userProfile.birth_date).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            )}

            {userProfile?.bio && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-teal/10 rounded-lg mt-1">
                  <User className="w-4 h-4 text-brand-teal" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">О себе</p>
                  <p className="font-medium text-text-primary">{userProfile.bio}</p>
                </div>
              </div>
            )}

            {userProfile?.emergency_contact_name && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-teal/10 rounded-lg mt-1">
                  <Phone className="w-4 h-4 text-brand-teal" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-secondary">Контакт для экстренной связи</p>
                  <p className="font-medium text-text-primary">
                    {userProfile.emergency_contact_name}
                    {userProfile.emergency_contact_phone && ` - ${userProfile.emergency_contact_phone}`}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timezone Settings — own profile only */}
      {isOwnProfile && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-brand-blue" />
              Часовой пояс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Select value={userTimezone} onValueChange={handleTimezoneChange} disabled={timezoneSaving}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите часовой пояс" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {timezoneSaving && (
                <span className="text-sm text-text-secondary">Сохранение...</span>
              )}
              <p className="text-sm text-text-secondary">
                Используется для уведомлений о встречах
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default ProfilePage;
