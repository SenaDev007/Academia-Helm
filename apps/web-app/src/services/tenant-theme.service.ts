/**
 * ============================================================================
 * tenantThemeService — Client frontend pour la gestion des thèmes
 * ============================================================================
 *
 * Wraps /api/tenant-theme/* (proxy → NestJS TenantThemeController).
 *
 * Utilisation :
 *   import { tenantThemeService } from '@/services/tenant-theme.service';
 *
 *   // Côté admin CMS :
 *   const settings = await tenantThemeService.getSettings();
 *   await tenantThemeService.setSettings({ themeId: 'ocean-breeze', mode: 'dark' });
 *
 *   // Côté public (site institutionnel) :
 *   const { themeId, mode } = await tenantThemeService.getPublicSettings('mon-ecole');
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import type { ThemeMode } from '@/lib/themes/themes.config';

export interface TenantThemeSettings {
  themeId: string | null;
  mode: ThemeMode;
}

async function ttFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const url = `/api/tenant-theme/${path.replace(/^\//, '')}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });

  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try { err = JSON.parse(text); } catch { err = {}; }
    }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }
  if (!text.trim()) return null as T;
  try { return JSON.parse(text) as T; } catch { throw new Error('Réponse invalide'); }
}

export const tenantThemeService = {
  // Récupère les settings du tenant courant (auth requis)
  getSettings: (): Promise<TenantThemeSettings> =>
    ttFetch<TenantThemeSettings>(''),

  // Met à jour le thème + mode (auth requis)
  setSettings: (payload: { themeId?: string | null; mode?: ThemeMode }): Promise<TenantThemeSettings> =>
    ttFetch<TenantThemeSettings>('', { method: 'PUT', body: payload }),

  // Récupère les settings publics par slug tenant (no auth — pour le site public)
  getPublicSettings: (tenantSlug: string): Promise<TenantThemeSettings> =>
    ttFetch<TenantThemeSettings>(`public/${encodeURIComponent(tenantSlug)}`),
};
