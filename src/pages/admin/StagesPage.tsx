import { UnifiedStagesManager } from '@/components/UnifiedStagesManager';
import { DataCleanupWidget } from '@/components/DataCleanupWidget';
import { Navigate } from 'react-router-dom';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { usePermission } from '@/hooks/usePermission';

const StagesPage = () => {
  // Check admin panel access permission
  const { hasPermission: canViewAdminPanel, isLoading } = usePermission('security.view_admin_panel');
  
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
  
  if (!canViewAdminPanel) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Breadcrumbs />
      <UnifiedStagesManager />
      
      <div className="mt-8">
        <DataCleanupWidget />
      </div>
    </div>
  );
};

export default StagesPage;
