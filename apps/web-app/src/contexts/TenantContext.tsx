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

      // Vérifier si on a un token
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('No access token found');
      }

      // Essayer de charger depuis le cache d'abord (si offline)
      if (offlineCacheService.isOffline()) {
        const cachedContext = offlineCacheService.getCachedContext();
        if (cachedContext) {
          console.log('📦 Using cached context (offline mode)');
          setContext(cachedContext);
          setIsLoading(false);
          return;
        }
      }

      // Appeler l'endpoint bootstrap
      const response = await fetch('/api/context/bootstrap', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Si offline, essayer le cache
        if (offlineCacheService.isOffline()) {
          const cachedContext = offlineCacheService.getCachedContext();
          if (cachedContext) {
            console.log('📦 Using cached context (offline fallback)');
            setContext(cachedContext);
            setIsLoading(false);
            return;
          }
        }

        if (response.status === 401) {
          // Token invalide ou expiré
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          offlineCacheService.clearContextCache();
          router.push('/auth/login');
          return;
        }
        if (response.status === 403) {
          // Pas de tenant sélectionné
          router.push('/auth/select-tenant');
          return;
        }
        throw new Error(`Failed to load context: ${response.statusText}`);
      }

      const data = await response.json();
      setContext(data);
      
      // Mettre en cache le contexte
      offlineCacheService.cacheContext(data);
    } catch (err: any) {
      console.error('Error loading context:', err);
      
      // Essayer le cache en dernier recours
      const cachedContext = offlineCacheService.getCachedContext();
      if (cachedContext) {
        console.log('📦 Using cached context (error fallback)');
        setContext(cachedContext);
        setIsLoading(false);
        return;
      }

      setError(err.message || 'Failed to load context');
      
      // Si erreur critique, rediriger vers login
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
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
