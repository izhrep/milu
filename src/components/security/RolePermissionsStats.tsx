import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Shield, CheckCircle, XCircle } from "@/components/icons";

interface RoleStats {
  role: string;
  label: string;
  icon: string;
  userCount: number;
  permissionsCount: number;
  totalPermissions: number;
  variant: 'default' | 'destructive' | 'secondary' | 'outline';
  color: string;
}

interface RolePermissionsStatsProps {
  roleStats: RoleStats[];
}

export const RolePermissionsStats: React.FC<RolePermissionsStatsProps> = ({ roleStats }) => {
  const totalUsers = roleStats.reduce((sum, stat) => sum + stat.userCount, 0);
  const totalActiveRoles = roleStats.filter(stat => stat.userCount > 0).length;
  const avgPermissions = roleStats.reduce((sum, stat) => sum + stat.permissionsCount, 0) / roleStats.length;

  return (
    <div className="space-y-4">
      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body-md font-medium">Всего пользователей</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-3 font-bold">{totalUsers}</div>
            <p className="text-caption-sm text-muted-foreground">
              С назначенными ролями
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body-md font-medium">Активных ролей</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-3 font-bold">{totalActiveRoles}</div>
            <p className="text-caption-sm text-muted-foreground">
              Из {roleStats.length} доступных
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-body-md font-medium">Среднее прав на роль</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-heading-3 font-bold">{Math.round(avgPermissions)}</div>
            <p className="text-caption-sm text-muted-foreground">
              Прав доступа
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Role Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Детальная статистика по ролям</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roleStats.map((stat) => {
              // Admin automatically has all permissions
              const percentage = stat.role === 'admin' 
                ? 100 
                : (stat.permissionsCount / stat.totalPermissions) * 100;
              
              return (
                <div key={stat.role} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-heading-4">{stat.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{stat.label}</span>
                          <Badge variant={stat.variant} className="text-caption-sm">
                            {stat.role}
                          </Badge>
                        </div>
                        <div className="text-caption-sm text-muted-foreground">
                          {stat.userCount} {stat.userCount === 1 ? 'пользователь' : 'пользователей'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {stat.permissionsCount} / {stat.totalPermissions}
                      </div>
                      <div className="text-caption-sm text-muted-foreground">
                        {percentage.toFixed(0)}% прав
                      </div>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
