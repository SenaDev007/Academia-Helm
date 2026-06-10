/**
 * ============================================================================
 * CONDITIONAL MENU - MENU CONDITIONNEL BASÉ SUR LES PERMISSIONS
 * ============================================================================
 * 
 * Exemple de composant React qui affiche/masque les menus selon les permissions
 * 
 * ============================================================================
 */

'use client';

import { usePermissions } from '@/lib/permissions/use-permissions';
import { Module } from '@/lib/permissions/module.enum';
import { PermissionAction } from '@/lib/permissions/permission-action.enum';
import Link from 'next/link';

export function ConditionalMenu() {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading) {
    return <div>Chargement des permissions...</div>;
  }

  return (
    <nav className="space-y-2">
      {/* Menu Élèves */}
      {hasPermission(Module.ELEVES) && (
        <Link href="/app/students" className="block px-4 py-2 hover:bg-gray-100">
          Élèves
        </Link>
      )}

      {/* Menu Finances - Seulement si MANAGE */}
      {hasPermission(Module.FINANCES, PermissionAction.MANAGE) && (
        <Link href="/app/finances" className="block px-4 py-2 hover:bg-gray-100">
          Finances
        </Link>
      )}

      {/* Menu Finances - Lecture seule */}
      {hasPermission(Module.FINANCES, PermissionAction.READ) &&
        !hasPermission(Module.FINANCES, PermissionAction.MANAGE) && (
          <Link href="/app/finances/view" className="block px-4 py-2 hover:bg-gray-100">
            Finances (Lecture seule)
          </Link>
        )}

      {/* Menu ORION */}
      {hasPermission(Module.ORION) && (
        <Link href="/app/orion" className="block px-4 py-2 hover:bg-gray-100">
          ORION
        </Link>
      )}

      {/* Menu Matériel Pédagogique */}
      {hasPermission(Module.MATERIEL_PEDAGOGIQUE) && (
        <Link
          href="/app/pedagogy/pedagogical-materials"
          className="block px-4 py-2 hover:bg-gray-100"
        >
          Matériel Pédagogique
        </Link>
      )}
    </nav>
  );
}
