/**
 * Tenant Website Service — Frontend client for the CMS API
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

async function twFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const res = await fetch(`/api/tenant-website/${path.replace(/^\//, '')}`, {
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

export const tenantWebsiteService = {
  // Config
  getConfig: () => twFetch<any>(''),
  updateConfig: (data: any) => twFetch<any>('', { method: 'PUT', body: data }),

  // News
  getNews: () => twFetch<any[]>('news'),
  createNews: (data: any) => twFetch<any>('news', { method: 'POST', body: data }),
  updateNews: (id: string, data: any) => twFetch<any>(`news/${id}`, { method: 'PUT', body: data }),
  deleteNews: (id: string) => twFetch<any>(`news/${id}`, { method: 'DELETE' }),

  // Events
  getEvents: () => twFetch<any[]>('events'),
  createEvent: (data: any) => twFetch<any>('events', { method: 'POST', body: data }),
  updateEvent: (id: string, data: any) => twFetch<any>(`events/${id}`, { method: 'PUT', body: data }),
  deleteEvent: (id: string) => twFetch<any>(`events/${id}`, { method: 'DELETE' }),

  // Gallery
  getGallery: () => twFetch<any[]>('gallery'),
  createGalleryItem: (data: any) => twFetch<any>('gallery', { method: 'POST', body: data }),
  updateGalleryItem: (id: string, data: any) => twFetch<any>(`gallery/${id}`, { method: 'PUT', body: data }),
  deleteGalleryItem: (id: string) => twFetch<any>(`gallery/${id}`, { method: 'DELETE' }),

  // Testimonials
  getTestimonials: () => twFetch<any[]>('testimonials'),
  createTestimonial: (data: any) => twFetch<any>('testimonials', { method: 'POST', body: data }),
  updateTestimonial: (id: string, data: any) => twFetch<any>(`testimonials/${id}`, { method: 'PUT', body: data }),
  deleteTestimonial: (id: string) => twFetch<any>(`testimonials/${id}`, { method: 'DELETE' }),

  // FAQ
  getFaq: () => twFetch<any[]>('faq'),
  createFaqItem: (data: any) => twFetch<any>('faq', { method: 'POST', body: data }),
  updateFaqItem: (id: string, data: any) => twFetch<any>(`faq/${id}`, { method: 'PUT', body: data }),
  deleteFaqItem: (id: string) => twFetch<any>(`faq/${id}`, { method: 'DELETE' }),

  // Contact messages
  getContactMessages: (status?: string) => twFetch<any[]>(`contact${status ? `?status=${status}` : ''}`),
  updateContactStatus: (id: string, status: string) => twFetch<any>(`contact/${id}`, { method: 'PUT', body: { status } }),
  deleteContactMessage: (id: string) => twFetch<any>(`contact/${id}`, { method: 'DELETE' }),

  // Level sections (multi-niveaux)
  getLevelSections: () => twFetch<any[]>('level-sections'),
  upsertLevelSection: (schoolLevelId: string, data: any) => twFetch<any>(`level-sections/${schoolLevelId}`, { method: 'PUT', body: data }),
  deleteLevelSection: (schoolLevelId: string) => twFetch<any>(`level-sections/${schoolLevelId}`, { method: 'DELETE' }),
};
