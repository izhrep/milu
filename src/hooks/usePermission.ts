import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { HasPermissionArgs } from '@/types/supabase-rpc';

/**
 * React hook for checking user permissions
 * Uses has_permission() function from database with caching
 */
export const usePermission = (permissionName: string): { hasPermission: boolean; isLoading: boolean } => {
  const { user } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.id) {
        setHasPermission(false);
        setIsLoading(false);
        return;
      }

      try {
        // Type assertion needed because types.ts still has old signature (_user_id)
        // The actual DB function only takes _permission_name
        const { data, error } = await (supabase.rpc as any)('has_permission', {
          _permission_name: permissionName
        });

        if (error) {
          console.error('Permission check error:', error);
          setHasPermission(false);
        } else {
          setHasPermission(data || false);
        }
      } catch (err) {
        console.error('Permission check failed:', err);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermission();
  }, [user?.id, permissionName]);

  return { hasPermission, isLoading };
};

/**
 * Hook for checking multiple permissions at once
 */
export const usePermissions = (permissionNames: string[]): Record<string, boolean> => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user?.id) {
        const emptyPermissions = permissionNames.reduce((acc, name) => ({
          ...acc,
          [name]: false
        }), {});
        setPermissions(emptyPermissions);
        setIsLoading(false);
        return;
      }

      try {
        const results = await Promise.all(
          permissionNames.map(async (permissionName) => {
            // Type assertion needed because types.ts still has old signature (_user_id)
            // The actual DB function only takes _permission_name
            const { data, error } = await (supabase.rpc as any)('has_permission', {
              _permission_name: permissionName
            });

            if (error) {
              console.error(`Permission check error for ${permissionName}:`, error);
              return { name: permissionName, hasPermission: false };
            }

            return { name: permissionName, hasPermission: data || false };
          })
        );

        const permissionsMap = results.reduce((acc, result) => ({
          ...acc,
          [result.name]: result.hasPermission
        }), {});

        setPermissions(permissionsMap);
      } catch (err) {
        console.error('Permissions check failed:', err);
        const emptyPermissions = permissionNames.reduce((acc, name) => ({
          ...acc,
          [name]: false
        }), {});
        setPermissions(emptyPermissions);
      } finally {
        setIsLoading(false);
      }
    };

    checkPermissions();
  }, [user?.id, JSON.stringify(permissionNames)]);

  return permissions;
};

/**
 * Helper hook to check if user has admin role
 * This is a convenience wrapper using permissions
 */
export const useIsAdmin = (): { isAdmin: boolean; isLoading: boolean } => {
  const result = usePermission('users.manage_roles'); // Admin-only permission
  return { isAdmin: result.hasPermission, isLoading: result.isLoading };
};
