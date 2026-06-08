/**
 * ============================================================================
 * USE PERMISSIONS HOOK - FRONTEND
 * ============================================================================
 * 
 * Hook React pour vérifier les permissions dans le frontend
 * 
 * ============================================================================
 */

import { useQuery } from '@tanstack/react-query';
import { Module } from './module.enum';
import { PermissionAction } from './permission-action.enum';

interface UserPermissions {
  role: string;
  portal: string;
  permissions: Array<{ module: Module; action: PermissionAction | null }>;
  accessibleModules: Module[];
  modules: Record<
    Module,
    {
      canRead: boolean;
      canWrite: boolean;
      canDelete: boolean;
      canManage: boolean;
    }
  >;
}

/**
 * Hook pour récupérer les permissions de l'utilisateur connecté
 */
export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const response = await fetch('/api/permissions/my-permissions', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  /**
   * Vérifie si l'utilisateur a une permission sur un module
   */
  const hasPermission = (
    module: Module,
    action?: PermissionAction,
  ): boolean => {
    if (!data) return false;

    const modulePermission = data.modules[module];
    if (!modulePermission) return false;

    switch (action) {
      case PermissionAction.READ:
        return modulePermission.canRead;
      case PermissionAction.WRITE:
        return modulePermission.canWrite;
      case PermissionAction.DELETE:
        return modulePermission.canDelete;
      case PermissionAction.MANAGE:
        return modulePermission.canManage;
      default:
        return modulePermission.canRead; // Par défaut, vérifie READ
    }
  };

  /**
   * Récupère les modules accessibles
   */
  const getAccessibleModules = (): Module[] => {
    return data?.accessibleModules || [];
  };

  /**
   * Récupère le portail autorisé
   */
  const getAuthorizedPortal = (): string | null => {
    return data?.portal || null;
  };

  return {
    permissions: data,
    isLoading,
    error,
    hasPermission,
    getAccessibleModules,
    getAuthorizedPortal,
    role: data?.role,
    portal: data?.portal,
  };
}
