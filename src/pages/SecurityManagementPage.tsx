import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import RolesPermissionsManager from '@/components/security/RolesPermissionsManager';
import AuditLogViewer from '@/components/security/AuditLogViewer';
import { ArrowLeft, Key, History, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SecurityManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('roles');
  const { hasPermission: hasSecurityPermission, isLoading } = usePermission('security.manage');

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Проверка прав доступа...</p>
        </div>
      </div>
    );
  }

  if (!hasSecurityPermission) {
    return <Navigate to="/" replace />;
  }

  const sections = [
    { id: 'roles', name: 'Роли и права', icon: Key, description: 'Назначение прав ролям' },
    { id: 'audit', name: 'История изменений', icon: History, description: 'Журнал аудита' },
  ];

  return (
    <div className="flex h-full">
      {/* Inline sidebar navigation */}
      <div className="w-64 border-r border-border bg-background flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Безопасность</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Вернуться в портал
          </Button>
        </div>

        <nav className="p-2 space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                activeSection === section.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <section.icon className="h-4 w-4 shrink-0" />
              <span>{section.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-background border-b border-border p-4 sticky top-0 z-10">
          <h1 className="text-xl font-semibold">
            {activeSection === 'roles' ? 'Управление ролями и правами' : 'История изменений'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeSection === 'roles'
              ? 'Назначение прав доступа для каждой роли'
              : 'Журнал всех административных действий'}
          </p>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {activeSection === 'roles' && <RolesPermissionsManager />}
          {activeSection === 'audit' && <AuditLogViewer />}
        </main>
      </div>
    </div>
  );
};

export default SecurityManagementPage;
