'use client';

/**
 * ============================================================================
 * USE TENANT COLORS — Ré-exports client de la palette tenant
 * ============================================================================
 *
 * ⭐ 2026-11-26 — Fix build Vercel : le contenu (fonctions PURES) a été
 *    déplacé dans `tenant-colors-core.ts` (module partagé sans directive)
 *    car `app-brand-theme.ts` — évalué côté SERVEUR au build — appelle
 *    `resolveTenantColors()`, ce que Next.js 16 refuse depuis un module
 *    client (« It's not possible to invoke a client function from the
 *    server »).
 *
 *    Ce fichier conserve la directive 'use client' et re-exporte tout le
 *    core pour les composants clients existants (site institutionnel,
 *    TenantPortalSelection, school-portal…) — AUCUN import à changer.
 *
 * Nouveaux usages côté serveur : importer directement
 * `@/lib/tenant/tenant-colors-core`.
 * ============================================================================
 */

export {
  resolveTenantColors,
  themeToColors,
  HELM_DEFAULT,
  type TenantColors,
} from '@/lib/tenant/tenant-colors-core';
