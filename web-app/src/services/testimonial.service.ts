/**
 * Testimonial Service
 * 
 * Service pour gérer les témoignages clients
 * Validation manuelle obligatoire côté backend
 */

import apiClient from '@/lib/api/client';
import type { Testimonial, TestimonialSubmission, TestimonialSubmissionResponse } from '@/types';

/**
 * Récupère les témoignages publiés (APPROVED uniquement)
 * 
 * @param featured - Si true, retourne uniquement les témoignages mis en avant
 * @param limit - Nombre maximum de témoignages à retourner
 */
export async function getPublishedTestimonials(
  featured?: boolean,
  limit?: number
): Promise<Testimonial[]> {
  try {
    const params: Record<string, any> = {
      status: 'APPROVED',
    };
    
    if (featured !== undefined) {
      params.featured = featured;
    }
    
    if (limit) {
      params.limit = limit;
    }
    
    const response = await apiClient.get<Testimonial[]>('/testimonials', {
      params,
    });
    
    return response.data;
  } catch (error: any) {
    // Si l'API n'est pas disponible (404, etc.), retourner un tableau vide
    // Le composant gérera l'affichage en conséquence
    if (error?.response?.status === 404 || error?.code === 'ECONNREFUSED' || error?.code === 'ERR_NETWORK') {
      // Erreur silencieuse : l'API n'est pas disponible, c'est attendu si le backend n'est pas démarré
      return [];
    }
    // Pour les autres erreurs, on les propage
    throw error;
  }
}

/**
 * Soumet un nouveau témoignage
 * 
 * Le témoignage sera en statut PENDING et nécessitera
 * une validation manuelle avant publication
 */
export async function submitTestimonial(
  submission: TestimonialSubmission
): Promise<TestimonialSubmissionResponse> {
  const response = await apiClient.post<TestimonialSubmissionResponse>(
    '/testimonials/submit',
    submission
  );
  
  return response.data;
}

/**
 * Récupère les témoignages d'un tenant spécifique
 * (pour affichage dans le dashboard de l'école)
 */
export async function getTenantTestimonials(): Promise<Testimonial[]> {
  const response = await apiClient.get<Testimonial[]>('/testimonials/my');
  return response.data;
}

/**
 * Récupère les statistiques des témoignages validés
 * (pour affichage sur le landing page)
 */
export async function getTestimonialStats(): Promise<{
  totalSchools: number;
  satisfactionRate: number;
  averageRating: number;
}> {
  try {
    const response = await apiClient.get<{
      totalSchools: number;
      satisfactionRate: number;
      averageRating: number;
    }>('/testimonials/stats');
    return response.data;
  } catch (error) {
    // Fallback en cas d'erreur : l'API n'est pas disponible, retourner des valeurs par défaut
    // Erreur silencieuse car c'est attendu si le backend n'est pas démarré
    return {
      totalSchools: 0,
      satisfactionRate: 0,
      averageRating: 0,
    };
  }
}

