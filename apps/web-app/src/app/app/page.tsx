/**
 * ============================================================================
 * APP PAGE - DASHBOARD PRINCIPAL
 * ============================================================================
 * 
 * Page principale de l'application
 * Affiche le dashboard selon le rôle de l'utilisateur
 * ============================================================================
 */

import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DirectorDashboard from '@/components/pilotage/dashboards/DirectorDashboard';
import TeacherDashboard from '@/components/pilotage/dashboards/TeacherDashboard';
import AccountantDashboard from '@/components/pilotage/dashboards/AccountantDashboard';
import AdminDashboard from '@/components/pilotage/dashboards/AdminDashboard';
import type { User } from '@/types';

export default async function AppPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;
  const tenantId = user.tenantId || '';

  // Afficher le dashboard selon le rôle
  const renderDashboard = () => {
    switch (user.role) {
      case 'PLATFORM_OWNER':
      case 'SUPER_DIRECTOR':
      case 'DIRECTOR':
        return <DirectorDashboard tenantId={tenantId} />;
      case 'TEACHER':
        return <TeacherDashboard />;
      case 'ACCOUNTANT':
        return <AccountantDashboard />;
      case 'ADMIN':
        return <AdminDashboard />;
      default:
        return <AdminDashboard />;
    }
  };

  return renderDashboard();
}
