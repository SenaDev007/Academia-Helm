/**
 * useAuth Hook
 * 
 * Hook pour gérer l'authentification côté client
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Tenant } from '@/types';
import { getClientToken } from '@/lib/auth/session-client';
import { checkAuth } from '@/services/auth.service';

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const loadAuth = async () => {
      const token = getClientToken();
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await checkAuth();
        if (data) {
          setUser(data.user);
          setTenant(data.tenant);
          setIsAuthenticated(true);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  const logout = async () => {
    // Utiliser le hook useSecureLogout pour le flow complet
    // Cette fonction est conservée pour compatibilité mais devrait être remplacée
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setTenant(null);
      setIsAuthenticated(false);
      router.push('/portal');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return {
    user,
    tenant,
    isAuthenticated,
    isLoading,
    logout,
  };
}

