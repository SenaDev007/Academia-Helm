/**
 * Loading page for /school-portal (tenant subdomains)
 *
 * ⭐ 2026-11-27 — Demande promoteur : l'écran de chargement du flux
 * « site institutionnel → portail » doit utiliser la palette de couleurs
 * du logo de l'école ET afficher le logo de l'école (et non plus le logo
 * Academia Helm générique). TenantBrandLoader résout le branding via le
 * sessionStorage (posé avant redirection — instantané) ou le sous-domaine.
 * Sans école identifiée : rendu Helm par défaut (inchangé).
 */

import TenantBrandLoader from "@/components/ui/TenantBrandLoader";

export default function SchoolPortalLoading() {
  return <TenantBrandLoader />;
}
