/**
 * Loading page for /login
 *
 * ⭐ 2026-11-27 — aligné sur la demande promoteur : depuis le site
 * institutionnel d'une école, l'écran de chargement de la page portail
 * (login) reprend la palette du logo de l'école + le logo de l'école.
 * Résolution : sessionStorage (posé par le site institutionnel / la page
 * de sélection du portail) → ?tenant= / sous-domaine → Helm par défaut.
 */

import TenantBrandLoader from "@/components/ui/TenantBrandLoader";

export default function PageLoading() {
  return <TenantBrandLoader />;
}
