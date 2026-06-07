import { apiFetch } from '@/lib/api/client';

export interface GlobalPedagogicalResource {
  id: string;
  title: string;
  description?: string;
  level?: string;
  classLevel?: string;
  series?: string;
  subject?: string;
  language?: string;
  resourceType: string;
  fileUrl?: string;
  externalUrl?: string;
  version: number;
  isPublished: boolean;
  createdAt: string;
  _count?: {
    usages: number;
  };
}

export interface ResourceAnnotation {
  id: string;
  resourceId: string;
  staffId: string;
  note: string;
  updatedAt: string;
}

export const globalLibraryClient = {
  /**
   * Récupère toutes les ressources
   */
  async findAll(filters?: any) {
    const params = new URLSearchParams(filters);
    return apiFetch(`/pedagogy/global-library?${params.toString()}`);
  },

  /**
   * Récupère une ressource par ID
   */
  async findOne(id: string) {
    return apiFetch(`/pedagogy/global-library/${id}`);
  },

  /**
   * Enregistre l'utilisation
   */
  async logUsage(id: string, staffId: string) {
    return apiFetch(`/pedagogy/global-library/${id}/usage`, {
      method: 'POST',
      body: JSON.stringify({ staffId }),
    });
  },

  /**
   * Gère les annotations
   */
  async upsertAnnotation(id: string, staffId: string, note: string) {
    return apiFetch(`/pedagogy/global-library/${id}/annotation`, {
      method: 'POST',
      body: JSON.stringify({ staffId, note }),
    });
  },

  /**
   * Récupère l'annotation
   */
  async getAnnotation(id: string, staffId: string): Promise<ResourceAnnotation | null> {
    return apiFetch<ResourceAnnotation>(`/pedagogy/global-library/${id}/annotation/${staffId}`);
  },

  /**
   * (Admin) Crée une ressource
   */
  async create(data: any) {
    return apiFetch(`/pedagogy/global-library`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * (Admin) Met à jour une ressource
   */
  async update(id: string, data: any) {
    return apiFetch(`/pedagogy/global-library/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * (Admin) Supprime une ressource
   */
  async delete(id: string) {
    return apiFetch(`/pedagogy/global-library/${id}`, {
      method: 'DELETE',
    });
  },

  // --- OFFLINE-FIRST HELPERS ---

  /**
   * Sauvegarde une ressource pour consultation hors-ligne
   */
  saveForOffline(resource: GlobalPedagogicalResource) {
    if (typeof window === 'undefined') return;
    const offlineList = JSON.parse(localStorage.getItem('offline_resources') || '[]');
    if (!offlineList.find((r: any) => r.id === resource.id)) {
      localStorage.setItem('offline_resources', JSON.stringify([...offlineList, resource]));
    }
  },

  /**
   * Récupère les ressources sauvegardées hors-ligne
   */
  getOfflineResources(): GlobalPedagogicalResource[] {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('offline_resources') || '[]');
  },

  /**
   * Sauvegarde une annotation locale (si offline)
   */
  async saveLocalAnnotation(id: string, staffId: string, note: string) {
    if (typeof window === 'undefined') return;
    const localAnnotations = JSON.parse(localStorage.getItem('local_annotations') || '{}');
    localAnnotations[`${id}_${staffId}`] = { id, staffId, note, updatedAt: new Date().toISOString() };
    localStorage.setItem('local_annotations', JSON.stringify(localAnnotations));
    
    // Tenter la synchro si possible, sinon ce sera fait au prochain chargement
    try {
      return await this.upsertAnnotation(id, staffId, note);
    } catch (e) {
      console.warn('Sync failed, annotation saved locally');
      return localAnnotations[`${id}_${staffId}`];
    }
  }
};
