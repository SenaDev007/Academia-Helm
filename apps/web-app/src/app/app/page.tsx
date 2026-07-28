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
import { getEffectivePortal } from '@/lib/auth/role-portal-map';
import PilotageDashboardV2 from '@/components/pilotage/dashboards/PilotageDashboardV2';
import type { User } from '@/types';

export default async function AppPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;

  // ⭐ Rediriger les enseignants et parents vers leurs portails dédiés.
  //
  // ⚠️ IMPORTANT : on utilise `getEffectivePortal()` qui fait gagner le portail
  // CHOISI à la connexion (session.portalType / user.portal) sur le rôle DB.
  // Un enseignant qui est aussi parent d'élève et qui se connecte via le portail
  // PARENT doit atterrir sur /app/parent, même si son user.role est 'TEACHER'.
  const teacherRoles = ['teacher', 'TEACHER', 'TEACHER_RESP', 'ENSEIGNANT'];
  const parentRoles = ['PARENT', 'STUDENT', 'PARENT_PRIMARY', 'LEGAL_GUARDIAN', 'FINANCIAL_RESPONSIBLE'];
  const isTeacherOrParent = teacherRoles.includes(user.role) || parentRoles.includes(user.role);

  if (isTeacherOrParent) {
    const effectivePortal = getEffectivePortal(
      user.role,
      (session as any)?.portalType || (user as any)?.portal,
    );

    if (effectivePortal === 'PARENT') {
      redirect('/app/parent');
    } else if (effectivePortal === 'TEACHER') {
      redirect('/app/teacher');
    }
    // Si effectivePortal est SCHOOL/PLATFORM/PUBLIC → on rend le dashboard
    // (cas normal pour un admin/directeur qui a un rôle teacher en DB mais
    // s'est connecté via le portail école).
  }

  // Pour tous les autres rôles (direction, admin, finance, RH, etc.) on
  // affiche le tableau de bord de pilotage unifié.
  // L'accès rapide aux modules est masqué pour les rôles non-admin pour
  // éviter la confusion (ils ont déjà la sidebar pour naviguer).
  const showQuickAccess = true;

  return <PilotageDashboardV2 showQuickAccess={showQuickAccess} />;
}
