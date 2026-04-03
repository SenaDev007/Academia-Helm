/**
 * ============================================================================
 * TENANT CONTEXT PROVIDER - CONTEXTE GLOBAL TENANT
 * ============================================================================
 * 
 * Contexte React pour gérer le contexte tenant global de l'application.
 * Alimenté après /auth/select-tenant et /context/bootstrap
 * 
 * ============================================================================
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { offlineCacheService } from '../services/offline-cache.service';
import {
  clearClientSessionSync,
  tryRefreshAccessToken,
  hasLocalSessionHints,
} from '@/lib/auth/client-access-token';

export interface AppContext {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isPlatformOwner: boolean;
    createdAt: string;
    lastLogin: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    type: string;
    status: string;
    country: {
      name: string;
      code: string;
    } | null;
    school: {
      id: string;
      name: string;
      logo: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      educationLevels: any[];
    } | null;
  };
  role: string;
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  } | null;
  permissions: Record<string, boolean>;
  orionSummary: {
    criticalAlerts: number;
    dataInconsistencies: number;
    lastCheck: string;
    status: 'ok' | 'warning' | 'error';
  } | null;
  timestamp: string;
}

interface TenantContextType {
  context: AppContext | null;
  isLoading: boolean;
  error: string | null;
  refreshContext: () => Promise<void>;
  clearContext: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<AppContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  /**
   * Charge le contexte depuis le backend ou le cache
   */
  const loadContext = async () => {
    try {
      setIsLoading(true);
      setError(null);

      /**
       * 1) Hors ligne : pas d’appel réseau — uniquement le cache (JWT périmé = normal).
       *    La première connexion sur l’appareil doit avoir enregistré ce cache via bootstrap.
       */
      if (offlineCacheService.isOffline()) {
        const cachedContext = offlineCacheService.getCachedContext();
        if (cachedContext) {
          console.log('📦 Contexte depuis le cache (mode hors ligne)');
          setContext(cachedContext);
          return;
        }
        setError(
          'Aucun contexte en cache pour le mode hors ligne. Connectez-vous une fois en ligne sur cet appareil.',
        );
        return;
      }

      /**
       * 2) En ligne : access token manquant → tentative de refresh avant bootstrap.
       */
      let token = localStorage.getItem('accessToken')?.trim() ?? '';
      if (!token) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
          token = localStorage.getItem('accessToken')?.trim() ?? '';
        }
      }
      if (!token) {
        if (hasLocalSessionHints()) {
          const cachedContext = offlineCacheService.getCachedContext();
          if (cachedContext) {
            console.log('📦 Pas de JWT — contexte depuis cache (session locale)');
            setContext(cachedContext);
            return;
          }
        }
        throw new Error('No access token found');
      }

      const response = await fetch('/api/context/bootstrap', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          const refreshed = await tryRefreshAccessToken();
          if (refreshed) {
            const retry = await fetch('/api/context/bootstrap', {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
              },
            });
            if (retry.ok) {
              const data = await retry.json();
              setContext(data);
              offlineCacheService.cacheContext(data);
              return;
            }
          }
          const cachedContext = offlineCacheService.getCachedContext();
          if (cachedContext) {
            console.warn('📦 Bootstrap 401 — contexte en cache jusqu’à nouvelle connexion');
            setContext(cachedContext);
            return;
          }
          clearClientSessionSync();
          offlineCacheService.clearContextCache();
          router.push('/auth/login');
          return;
        }
        if (response.status === 403) {
          router.push('/auth/select-tenant');
          return;
        }
        throw new Error(`Failed to load context: ${response.statusText}`);
      }

      const data = await response.json();
      setContext(data);
      offlineCacheService.cacheContext(data);
    } catch (err: any) {
      console.error('Error loading context:', err);

      const cachedContext = offlineCacheService.getCachedContext();
      if (cachedContext) {
        console.log('📦 Contexte depuis cache (erreur réseau ou serveur)');
        setContext(cachedContext);
        return;
      }

      setError(err.message || 'Failed to load context');

      if (err.message?.includes('No access token')) {
        router.push('/auth/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Rafraîchit le contexte
   */
  const refreshContext = async () => {
    await loadContext();
  };

  /**
   * Vide le contexte (logout)
   */
  const clearContext = () => {
    setContext(null);
    clearClientSessionSync();
    offlineCacheService.clearContextCache();
    router.push('/auth/login');
  };

  // Charger le contexte au montage
  useEffect(() => {
    loadContext();
  }, []);

  return (
    <TenantContext.Provider
      value={{
        context,
        isLoading,
        error,
        refreshContext,
        clearContext,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

/**
 * Hook pour utiliser le contexte tenant
 */
export function useTenantContext() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenantContext must be used within a TenantContextProvider');
  }
  return context;
}
