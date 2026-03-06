import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { roles, resourceNames } from './PermissionsGroupConfig';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface RolePermission {
  role: string;
  permission_id: string;
}

interface PermissionsTableProps {
  permissions: Permission[];
  rolePermissions: RolePermission[];
  onTogglePermission: (role: string, permissionId: string, checked: boolean) => void;
}

export const PermissionsTable = ({ 
  permissions, 
  rolePermissions,
  onTogglePermission 
}: PermissionsTableProps) => {
  
  const hasPermission = (role: string, permissionId: string) => {
    return rolePermissions.some(
      rp => rp.role === role && rp.permission_id === permissionId
    );
  };

  // Группируем права по ресурсу для отображения
  const permissionsByResource = permissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) {
      acc[perm.resource] = [];
    }
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (permissions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Нет прав для отображения
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(permissionsByResource).map(([resource, resourcePerms]) => (
        <div key={resource} className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h4 className="font-medium flex items-center gap-2">
              {resourceNames[resource] || resource}
              <Badge variant="secondary" className="text-xs">
                {resourcePerms.length}
              </Badge>
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[350px]">Право доступа</TableHead>
                  {roles.map(role => (
                    <TableHead key={role.value} className="text-center min-w-[100px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg">{role.icon}</span>
                        <Badge variant={role.variant} className="text-xs">
                          {role.label}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resourcePerms.map(perm => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <div className="font-medium">{perm.description || perm.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{perm.name}</div>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p className="font-medium">{perm.name}</p>
                              <p className="text-sm mt-1">{perm.description || 'Нет описания'}</p>
                              <p className="text-xs mt-2 text-muted-foreground font-mono">
                                {perm.resource}.{perm.action}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                    {roles.map(role => (
                      <TableCell key={role.value} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={role.value === 'admin' || hasPermission(role.value, perm.id)}
                            onCheckedChange={(checked) =>
                              onTogglePermission(role.value, perm.id, checked as boolean)
                            }
                            disabled={role.value === 'admin'}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PermissionsTable;
