/**
 * Auth Service
 * 
 * Service pour l'authentification
 */

import apiClient from '@/lib/api/client';
import type { User, Tenant, AuthSession } from '@/types';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSubdomain?: string;
}

export interface LoginResponse {
  user: User;
  tenant: Tenant;
  token: string;
  expiresAt: string;
}

/**
 * Authentifie un utilisateur
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return response.data;
}

/**
 * Déconnecte l'utilisateur
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/**
 * Vérifie si l'utilisateur est authentifié
 * 
 * Utilise la route Next.js /api/auth/me qui lit la session depuis les cookies.
 * Inclut un mécanisme de retry (3 tentatives) pour gérer les race conditions
 * sur mobile où les cookies peuvent ne pas être encore disponibles.
 */
export async function checkAuth(maxRetries = 3): Promise<{ user: User; tenant: Tenant } | null> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // Inclure les cookies
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Éviter le cache navigateur (important sur mobile)
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Sur mobile, les cookies peuvent ne pas être encore disponibles
          // après une redirection. On retry avec un délai croissant.
          if (attempt < maxRetries) {
            const delay = attempt * 800; // 800ms, 1600ms, 2400ms
            console.warn(`[checkAuth] Tentative ${attempt}/${maxRetries} — 401, retry dans ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { user: data.user, tenant: data.tenant };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = attempt * 800;
        console.warn(`[checkAuth] Tentative ${attempt}/${maxRetries} — erreur réseau, retry dans ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[checkAuth] Échec après', maxRetries, 'tentatives:', lastError);
  return null;
}

/**
 * Rafraîchit le token
 */
export async function refreshToken(): Promise<{ token: string; expiresAt: string }> {
  const response = await apiClient.post<{ token: string; expiresAt: string }>('/auth/refresh');
  return response.data;
}

