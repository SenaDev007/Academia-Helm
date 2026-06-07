/**
 * ============================================================================
 * DASHBOARD DISPATCHER - DISPATCHER PAR RÔLE
 * ============================================================================
 * 
 * Composant qui dispatch le bon dashboard selon le rôle de l'utilisateur
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';
import { PlatformOwnerDashboard } from './roles/PlatformOwnerDashboard';
import { PromoterDashboard } from './roles/PromoterDashboard';
import { DirectorDashboard } from './roles/DirectorDashboard';
import { AccountantDashboard } from './roles/AccountantDashboard';
import { TeacherDashboard } from './roles/TeacherDashboard';
import { ParentDashboard } from './roles/ParentDashboard';
import { StudentDashboard } from './roles/StudentDashboard';

export function DashboardDispatcher() {
  const { context } = useTenantContext();

  if (!context) {
    return null;
  }

  const { role } = context;

  // Dispatcher selon le rôle
  switch (role) {
    case 'PLATFORM_OWNER':
      return <PlatformOwnerDashboard />;

    case 'PROMOTER':
      return <PromoterDashboard />;

    case 'DIRECTOR':
      return <DirectorDashboard />;

    case 'ACCOUNTANT':
    case 'SECRETARY':
      return <AccountantDashboard />;

    case 'TEACHER':
    case 'INSTITUTEUR':
      return <TeacherDashboard />;

    case 'PARENT':
      return <ParentDashboard />;

    case 'STUDENT':
      return <StudentDashboard />;

    default:
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold mb-4">Dashboard non disponible</h1>
          <p className="text-gray-600">
            Aucun dashboard n'est configuré pour le rôle : <strong>{role}</strong>
          </p>
        </div>
      );
  }
}
