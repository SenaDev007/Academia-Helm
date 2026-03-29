/**
 * Consolidated KPI Page
 * 
 * Page de bilans consolidés multi-écoles
 * Accessible uniquement aux SUPER_DIRECTOR
 */

import { getServerSession } from '@/lib/auth/session';
import ConsolidatedKpiPage from '@/components/dashboard/ConsolidatedKpiPage';
import { redirect } from 'next/navigation';

export default async function Page() {
  const session = await getServerSession();

  if (!session) {
    redirect('/login');
  }

  // Vérifier que l'utilisateur est SUPER_DIRECTOR
  if (session.user.role !== 'SUPER_DIRECTOR') {
    redirect('/app');
  }

  return (
    <ConsolidatedKpiPage 
      user={session.user}
      tenant={session.tenant}
    />
  );
}

