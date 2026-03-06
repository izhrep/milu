import { ReferenceTableLayout } from '@/components/admin/ReferenceTableLayout';
import UsersManagementTable from '@/components/security/UsersManagementTable';
import { Users } from 'lucide-react';

export default function UsersAdminPage() {
  return (
    <ReferenceTableLayout 
      title="Пользователи"
      description="Управление пользователями системы"
      icon={<Users className="h-8 w-8" />}
    >
      <UsersManagementTable />
    </ReferenceTableLayout>
  );
}
