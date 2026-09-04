/**
 * ============================================================================
 * PORTAIL SURVEILLANT — ACCUEIL (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du surveillant (/app/surveillant). Rend la home
 * générique des portails administratifs (AdminPortalHome — bannière d'accueil
 * au thème du métier + cartes d'accès rapide vers les modules du portail :
 * Élèves & Scolarité, Vie Scolaire, Espace Censeur, Examens, Helm Connect)
 * dans le shell surveillant (AdminPortalShell, accent amber).
 *
 * La Vie Scolaire et l'Espace Censeur n'apparaissent que si le niveau
 * Secondaire est actif (requiresSecondary) — le reste fonctionne à tous
 * les niveaux.
 * ============================================================================
 */

import AdminPortalHome from '@/components/portals/admin/AdminPortalHome';

export default function SupervisorHomePage() {
  return <AdminPortalHome portalKey="surveillant" />;
}
