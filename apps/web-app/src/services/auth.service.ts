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
 * Utilise la route Next.js /api/auth/me qui lit la session depuis les cookies
 */
export async function checkAuth(): Promise<{ user: User; tenant: Tenant } | null> {
  try {
    // Utiliser fetch directement pour appeler la route Next.js /api/auth/me
    // plutôt que le backend NestJS via apiClient
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include', // Inclure les cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return { user: data.user, tenant: data.tenant };
  } catch (error) {
    console.error('[checkAuth] Error:', error);
    return null;
  }
}

/**
 * Rafraîchit le token
 */
export async function refreshToken(): Promise<{ token: string; expiresAt: string }> {
  const response = await apiClient.post<{ token: string; expiresAt: string }>('/auth/refresh');
  return response.data;
}

