/**
 * Testimonial Service
 * 
 * Service pour gérer les témoignages clients
 * Validation manuelle obligatoire côté backend
 */

import { offlineFetch, offlineMutation } from '@/lib/offline/offline-fetch';
import type { Testimonial, TestimonialSubmission, TestimonialSubmissionResponse } from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

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

    const qs = new URLSearchParams(params).toString();
    return await offlineFetch<Testimonial[]>(`/testimonials?${qs}`, 'testimonials_cache', {
      tenantId: getTenantId(),
    });
  } catch (error: any) {
    // Si l'API n'est pas disponible, retourner un tableau vide
    return [];
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
  const result = await offlineMutation<TestimonialSubmissionResponse>(
    '/testimonials/submit',
    'POST',
    submission,
    { tenantId: getTenantId() }
  );
  if (result.error) throw new Error(result.error);
  return result.data!;
}

/**
 * Récupère les témoignages d'un tenant spécifique
 * (pour affichage dans le dashboard de l'école)
 */
export async function getTenantTestimonials(): Promise<Testimonial[]> {
  return offlineFetch<Testimonial[]>('/testimonials/my', 'testimonials_cache', {
    tenantId: getTenantId(),
  });
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
    return await offlineFetch<{
      totalSchools: number;
      satisfactionRate: number;
      averageRating: number;
    }>('/testimonials/stats', 'testimonials_cache', {
      tenantId: getTenantId(),
    });
  } catch (error) {
    // Fallback en cas d'erreur : l'API n'est pas disponible, retourner des valeurs par défaut
    return {
      totalSchools: 0,
      satisfactionRate: 0,
      averageRating: 0,
    };
  }
}
