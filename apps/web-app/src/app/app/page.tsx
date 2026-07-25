/**
 * ============================================================================
 * APP PAGE - DASHBOARD PRINCIPAL DE PILOTAGE
 * ============================================================================
 *
 * Page principale de l'application. Affiche le tableau de bord de pilotage
 * unifié (PilotageDashboardV2) pour tous les rôles administratifs /
 * direction / finance, avec redirection vers les portails dédiés pour
 * les enseignants et parents.
 *
 * PilotageDashboardV2 couvre toute l'application :
 *  - KPIs transverses (élèves, finances, pédagogie, RH)
 *  - Graphiques (effectifs par classe, répartition par sexe, évolution moyennes)
 *  - Alertes ORION
 *  - Accès rapide aux modules
 *
 * ============================================================================
 */

import { getServerSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import PilotageDashboardV2 from '@/components/pilotage/dashboards/PilotageDashboardV2';
import type { User } from '@/types';

export default async function AppPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;

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

  // Pour tous les autres rôles (direction, admin, finance, RH, etc.) on
  // affiche le tableau de bord de pilotage unifié.
  // L'accès rapide aux modules est masqué pour les rôles non-admin pour
  // éviter la confusion (ils ont déjà la sidebar pour naviguer).
  const showQuickAccess = true;

  return <PilotageDashboardV2 showQuickAccess={showQuickAccess} />;
}
