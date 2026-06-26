/**
 * ============================================================================
 * tenantBlockSelectionService — Client frontend pour les sélections de composants
 * ============================================================================
 *
 * Wraps /api/tenant-block-selections/* (proxy → NestJS).
 *
 * Utilisation :
 *   import { tenantBlockSelectionService } from '@/services/tenant-block-selection.service';
 *
 *   // Récupérer toutes les sélections
 *   const selections = await tenantBlockSelectionService.getAll();
 *
 *   // Sauvegarder un choix
 *   await tenantBlockSelectionService.upsert('navbar', 'navbar-classic', { primary: '217 91% 60%' });
 *
 *   // Supprimer
 *   await tenantBlockSelectionService.delete('navbar');
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import type { ColorOverride } from '@/lib/themes/blocks.config';

export interface BlockSelection {
  id?: string;
  category: string;
  variantId: string | null;
  colorOverrides: ColorOverride | null;
}

async function tbsFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const url = `/api/tenant-block-selections/${path.replace(/^\//, '')}`;

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

export const tenantBlockSelectionService = {
  // Toutes les sélections du tenant courant
  getAll: (): Promise<BlockSelection[]> =>
    tbsFetch<BlockSelection[]>(''),

  // Une catégorie
  getByCategory: (category: string): Promise<BlockSelection> =>
    tbsFetch<BlockSelection>(category),

  // Upsert
  upsert: (category: string, variantId: string, colorOverrides?: ColorOverride): Promise<BlockSelection> =>
    tbsFetch<BlockSelection>(category, {
      method: 'PUT',
      body: { variantId, colorOverrides },
    }),

  // Supprimer
  delete: (category: string): Promise<{ success: boolean }> =>
    tbsFetch<{ success: boolean }>(category, { method: 'DELETE' }),

  // Public : par slug tenant (pour le rendu du site public)
  getPublicBySlug: (tenantSlug: string): Promise<BlockSelection[]> =>
    tbsFetch<BlockSelection[]>(`public/${encodeURIComponent(tenantSlug)}`),
};
