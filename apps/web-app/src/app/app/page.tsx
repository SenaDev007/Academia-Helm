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
import { getAdminPortalHomeForRole } from '@/lib/auth/admin-portal-map';
import PilotageDashboardV2 from '@/components/pilotage/dashboards/PilotageDashboardV2';
import type { User } from '@/types';

export default async function AppPage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  const user = session.user as User;

  // ⭐ Rediriger les utilisateurs des portails TEACHER/PARENT vers leurs portails dédiés.
  //
  // ⚠️ FIX DOUBLE-CASQUETTE : on utilise `getEffectivePortal()` pour TOUS les
  // utilisateurs, pas seulement ceux dont le rôle DB est enseignant/parent.
  // Le portail CHOISI à la connexion (session.portalType / user.portal) fait
  // foi : un personnel cumulant un poste administratif (rôle DB DIRECTOR/
  // DIRECTEUR/...) et un poste d'enseignement qui se connecte via le portail
  // ENSEIGNANT (matricule) doit atterrir sur /app/teacher, même si son
  // user.role en DB est administratif. Connecté via le portail ÉCOLE (email),
  // il atterrit sur l'UI école (dashboard pilotage).
  const effectivePortal = getEffectivePortal(
    user.role,
    (session as any)?.portalType || (user as any)?.portal,
  );

  if (effectivePortal === 'PARENT') {
    redirect('/app/parent');
  } else if (effectivePortal === 'TEACHER') {
    redirect('/app/teacher');
  }

  // ⭐ PORTAILS ADMIN DÉDIÉS : rediriger chaque métier de l'administration vers
  // la home de SON portail (les 6 métiers sont migrés : directeur, secrétaire,
  // secrétaire-comptable, comptable, surveillant, censeur).
  // Le promoteur et les rôles full-access ne sont pas migrés (null) :
  // ils conservent le tableau de pilotage unifié de l'UI complète partagée.
  if (effectivePortal === 'SCHOOL') {
    const adminHome = getAdminPortalHomeForRole(user.role);
    if (adminHome) {
      redirect(adminHome);
    }
  }

  // Pour tous les autres rôles (direction, admin, finance, RH, etc.) on
  // affiche le tableau de bord de pilotage unifié.
  // L'accès rapide aux modules est masqué pour les rôles non-admin pour
  // éviter la confusion (ils ont déjà la sidebar pour naviguer).
  const showQuickAccess = true;

  return <PilotageDashboardV2 showQuickAccess={showQuickAccess} />;
}
