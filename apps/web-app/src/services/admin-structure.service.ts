/**
 * ============================================================================
 * adminStructureService — Client frontend pour le mode d'administration
 * ============================================================================
 *
 * Wraps /api/admin-structure/* (proxy → NestJS AdminStructureController).
 *
 * Utilisation :
 *   import { adminStructureService } from '@/services/admin-structure.service';
 *
 *   const { mode } = await adminStructureService.getMode();
 *   await adminStructureService.setMode('FUSED_MATERNELLE_PRIMAIRE');
 *   const { groups } = await adminStructureService.getGroups();
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export type AdminStructureMode = 'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE';

export interface AdminGroup {
  unit: string;          // MAT, PRI, SEC, MAT_PRI, ALL
  label: string;         // "Maternelle", "Maternelle + Primaire"
  levelIds: string[];
  levelCodes: string[];  // MATERNELLE, PRIMARY, SECONDAIRE
}

async function asFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const url = `/api/admin-structure/${path.replace(/^\//, '')}`;

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

export const adminStructureService = {
  // Récupère le mode d'administration du tenant courant
  getMode: (): Promise<{ mode: AdminStructureMode }> =>
    asFetch<{ mode: AdminStructureMode }>('mode'),

  // Met à jour le mode
  setMode: (mode: AdminStructureMode): Promise<{ success: boolean; mode: AdminStructureMode }> =>
    asFetch<{ success: boolean; mode: AdminStructureMode }>('mode', {
      method: 'PUT',
      body: { mode },
    }),

  // Récupère les unités administratives + le mode
  getGroups: (): Promise<{ mode: AdminStructureMode; groups: AdminGroup[] }> =>
    asFetch<{ mode: AdminStructureMode; groups: AdminGroup[] }>('groups'),

  // Public : par slug tenant (pour le rendu du site public)
  getPublicBySlug: (tenantSlug: string): Promise<{ mode: AdminStructureMode; groups: AdminGroup[] }> =>
    asFetch<{ mode: AdminStructureMode; groups: AdminGroup[] }>(`public/${encodeURIComponent(tenantSlug)}`),
};
