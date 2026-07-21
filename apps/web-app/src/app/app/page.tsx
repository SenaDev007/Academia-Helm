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
import ParentDashboard from '@/components/pilotage/dashboards/ParentDashboard';
import PromoterDashboard from '@/components/pilotage/dashboards/PromoterDashboard';
import type { User } from '@/types';

export default async function AppPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;
  const tenantId = user.tenantId || '';

  // ⭐ Rediriger les enseignants vers leur portail dédié
  const teacherRoles = ['teacher', 'TEACHER', 'TEACHER_RESP', 'ENSEIGNANT'];
  if (teacherRoles.includes(user.role)) {
    redirect('/app/teacher');
  }

  // ⭐ Rediriger les parents vers leur portail dédié
  const parentRoles = ['PARENT', 'STUDENT', 'PARENT_PRIMARY', 'LEGAL_GUARDIAN', 'FINANCIAL_RESPONSIBLE'];
  if (parentRoles.includes(user.role)) {
    redirect('/app/parent');
  }

  // Afficher le dashboard selon le rôle (pour les rôles admin/direction/finance)
  const renderDashboard = () => {
    switch (user.role) {
      case 'PLATFORM_OWNER':
      case 'PLATFORM_ADMIN':
      case 'SUPER_DIRECTOR':
      case 'director':
      case 'DIRECTEUR_GENERAL':
      case 'DIRECTEUR_ETABLISSEMENT':
      case 'DIRECTEUR':
      case 'DIRECTOR_GENERAL':
      case 'SCHOOL_DIRECTOR':
      case 'DEPUTY_DIRECTOR':
        return <DirectorDashboard tenantId={tenantId} />;
      case 'PROMOTER':
      case 'PROMOTEUR':
        return <PromoterDashboard tenantId={tenantId} />;
      case 'COMPTABLE':
      case 'ACCOUNTANT':
      case 'SECRETAIRE_COMPTABLE':
      case 'CFO':
      case 'FINANCE_MANAGER':
      case 'CASHIER':
      case 'CAISSIER':
      case 'ECONOME':
      case 'RECOVERY_MANAGER':
      case 'accountant':
        return <AccountantDashboard />;
      // Les secrétaires, surveillants, et autres rôles voient le dashboard admin
      case 'SECRETAIRE':
      case 'SECRETAIRE_GENERAL':
      case 'SURVEILLANT':
      case 'SURVEILLANT_GENERAL':
      case 'CENSEUR':
      case 'SCHOOL_LIFE_MANAGER':
      case 'admin':
      case 'SCHOOL_ADMIN':
      case 'SCHOOL_OWNER':
      default:
        return <AdminDashboard />;
    }
  };

  return renderDashboard();
}
