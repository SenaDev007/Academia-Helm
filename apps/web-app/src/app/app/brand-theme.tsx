/**
 * ============================================================================
 * APP BRAND THEME — injection serveur de la palette de l'école dans /app/*
 * ============================================================================
 *
 * ⭐ 2026-11-26 — L'application prend automatiquement les couleurs de
 *    l'école (palette du logo / du CMS / thème officiel — même chaîne que
 *    le site institutionnel du sous-domaine).
 *
 * Pourquoi un composant SERVEUR + <style> inline :
 *   - Les variables sont dans le HTML dès le premier paint → AUCUN flash
 *     (l'ancien TenantThemeProvider client causait un flash noir, d'où
 *     les couleurs hardcodées documentées dans tailwind.config.js).
 *   - Aucun JS client supplémentaire, aucun re-render.
 *   - Posé sur :root → les portails Radix (modales dans document.body)
 *     héritent du thème.
 *
 * Fail-open total : pas de palette / API lente → le composant ne rend
 * RIEN et l'application garde son rendu Helm actuel (fallbacks hex dans
 * tailwind.config.js).
 */

import { resolveAppBrandColors, buildAppBrandCss } from '@/lib/tenant/app-brand-theme';

export default async function AppBrandTheme({
  tenantSlug,
}: {
  tenantSlug?: string | null;
}) {
  if (!tenantSlug) return null;

  const resolved = await resolveAppBrandColors(tenantSlug);
  if (!resolved?.colors) return null;

  const css = buildAppBrandCss(resolved.colors);

  return (
    <style
      id="app-brand-theme"
      data-brand-source={resolved.source}
      data-brand-primary={resolved.colors.primary}
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
