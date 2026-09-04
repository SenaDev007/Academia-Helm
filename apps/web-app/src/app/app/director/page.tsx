/**
 * ============================================================================
 * PORTAIL DIRECTEUR — TABLEAU DE BORD (home du portail)
 * ============================================================================
 *
 * Home du portail dédié du directeur (/app/director). Rend le tableau de
 * bord de pilotage global de l'établissement (PilotageDashboardV2 — KPIs
 * transverses élèves/finances/pédagogie/RH, graphiques, alertes ORION)
 * dans le shell directeur (AdminPortalShell).
 *
 * L'Espace Directeur analytique (score de risque croisé + décrochage)
 * a déménagé vers /app/director/oversight.
 * ============================================================================
 */

import PilotageDashboardV2 from '@/components/pilotage/dashboards/PilotageDashboardV2';

export default function DirectorHomePage() {
  return <PilotageDashboardV2 showQuickAccess />;
}
