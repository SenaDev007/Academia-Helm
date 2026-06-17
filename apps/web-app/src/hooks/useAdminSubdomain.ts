'use client';

import { useEffect, useState } from 'react';

/**
 * useAdminSubdomain
 *
 * Détecte si l'application s'exécute sur le sous-domaine admin.academiahelm.com.
 *
 * Règle : le back-office centralisé d'Academia Helm n'est accessible QUE via
 * admin.academiahelm.com (configuré dans Vercel + bloqué par le middleware).
 * Cette detection côté client permet à la sidebar (PilotageSidebar) de n'afficher
 * les modules /app/platform/* QUE lorsque l'utilisateur est sur ce sous-domaine.
 *
 * En développement local (localhost), on considère qu'on n'est PAS sur admin.*
 * sauf si l'URL contient ?admin=1 ou que le hostname commence par "admin.".
 *
 * SSR-safe : retourne false pendant le rendu serveur, puis se met à jour côté
 * client après le montage.
 */
export function useAdminSubdomain(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname || '';
    const isAdminHost =
      host.startsWith('admin.') ||
      // En dev local : admin.localhost:3001
      host.startsWith('admin-') ||
      // Override explicite pour les tests
      new URLSearchParams(window.location.search).get('admin') === '1';
    setIsAdmin(isAdminHost);
  }, []);

  return isAdmin;
}

/**
 * useCurrentHostname
 *
 * Retourne le hostname courant côté client (ou null pendant le SSR).
 * Utile pour tout composant devant adapter son comportement au sous-domaine.
 */
export function useCurrentHostname(): string | null {
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHostname(window.location.hostname || null);
  }, []);

  return hostname;
}

/**
 * Renvoie l'URL absolue du back-office admin (admin.academiahelm.com).
 * En production, on utilise le domaine principal détecté depuis le hostname courant.
 * En développement local, on renvoie localhost avec ?admin=1 pour les tests.
 */
export function getAdminBackOfficeUrl(path: string = '/app/platform'): string {
  if (typeof window === 'undefined') {
    return `https://admin.academiahelm.com${path}`;
  }
  const host = window.location.hostname || '';
  // Développement local
  if (host === 'localhost' || host === '127.0.0.1') {
    const port = window.location.port || '3000';
    return `${window.location.protocol}//localhost:${port}${path}?admin=1`;
  }
  // Production : extraire le domaine parent (academiahelm.com depuis
  // school.academiahelm.com ou academiahelm.com)
  const parts = host.split('.');
  if (parts.length >= 2) {
    const parentDomain = parts.slice(-2).join('.');
    return `${window.location.protocol}//admin.${parentDomain}${path}`;
  }
  return `${window.location.protocol}//admin.${host}${path}`;
}
