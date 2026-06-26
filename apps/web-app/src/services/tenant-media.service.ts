/**
 * ============================================================================
 * tenantMediaService — Client frontend pour la bibliothèque médias tenant
 * ============================================================================
 *
 * Wraps /api/tenant-media/* (proxy → NestJS TenantMediaController).
 *
 * Utilisation typique :
 *   1. import { tenantMediaService } from '@/services/tenant-media.service';
 *   2. const { items } = await tenantMediaService.list({ folder: 'hero' });
 *   3. const media = await tenantMediaService.upload({ fileDataUrl, fileName, mimeType, folder: 'hero' });
 *   4. <img src={media.thumbnailUrl || media.hdUrl || media.originalUrl} />
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

// === Types ===

export type MediaType = 'image' | 'video' | 'document';

export interface MediaAsset {
  id: string;
  tenantId: string;
  name: string;
  alt: string | null;
  type: MediaType;
  originalUrl: string;
  hdUrl: string | null;
  thumbnailUrl: string | null;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  folder: string;
  tags: string[];
  uploadedById: string | null;
  usagesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UploadMediaInput {
  fileDataUrl: string;
  fileName: string;
  mimeType: string;
  folder?: string;
  alt?: string;
  tags?: string[];
}

export interface ListMediaParams {
  folder?: string;
  type?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListMediaResult {
  items: MediaAsset[];
  total: number;
}

export interface FolderInfo {
  folder: string;
  count: number;
}

// === Fetch helper ===

async function tmFetch<T>(
  path: string,
  options?: { method?: string; body?: any; query?: Record<string, string | number | undefined> },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const qs = options?.query
    ? '?' + Object.entries(options.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = `/api/tenant-media/${path.replace(/^\//, '')}${qs}`;

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

// === Service ===

export const tenantMediaService = {
  // Upload un média (data URL → optimisation → 3 variantes → DB)
  upload: (input: UploadMediaInput): Promise<MediaAsset> =>
    tmFetch<MediaAsset>('', { method: 'POST', body: input }),

  // Liste paginée
  list: (params: ListMediaParams = {}): Promise<ListMediaResult> =>
    tmFetch<ListMediaResult>('', { query: params as any }),

  // Liste des dossiers
  listFolders: (): Promise<FolderInfo[]> =>
    tmFetch<FolderInfo[]>('folders'),

  // Détail
  getById: (id: string): Promise<MediaAsset> =>
    tmFetch<MediaAsset>(id),

  // Met à jour les métadonnées
  update: (id: string, patch: { name?: string; alt?: string | null; tags?: string[]; folder?: string }): Promise<MediaAsset> =>
    tmFetch<MediaAsset>(id, { method: 'PUT', body: patch }),

  // Supprime
  delete: (id: string): Promise<{ success: boolean }> =>
    tmFetch<{ success: boolean }>(id, { method: 'DELETE' }),

  // Compteur d'usage
  incrementUsage: (id: string): Promise<{ success: boolean }> =>
    tmFetch<{ success: boolean }>(`${id}/use`, { method: 'POST' }),

  decrementUsage: (id: string): Promise<{ success: boolean }> =>
    tmFetch<{ success: boolean }>(`${id}/unuse`, { method: 'POST' }),

  // Nettoyage storage
  cleanupOrphans: (): Promise<{ deletedKeys: string[] }> =>
    tmFetch<{ deletedKeys: string[] }>('cleanup-orphans', { method: 'POST' }),

  // === Helpers ===

  /**
   * Renvoie la meilleure URL pour l'affichage dans un <img> :
   * thumbnailUrl (génération auto pour images) → hdUrl → originalUrl
   */
  getDisplayUrl: (media: Pick<MediaAsset, 'thumbnailUrl' | 'hdUrl' | 'originalUrl'>): string => {
    return media.thumbnailUrl || media.hdUrl || media.originalUrl;
  },

  /**
   * Lit un File en data URL (pour l'upload).
   */
  readFileAsDataUrl: (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  }),

  /**
   * Formatage lisible de la taille (ex: 1.2 Mo, 800 Ko).
   */
  formatSize: (bytes: number): string => {
    if (!bytes) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  },
};
