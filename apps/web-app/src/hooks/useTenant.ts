/**
 * useTenant Hook
 * 
 * Hook pour gérer le tenant actuel
 */

'use client';

import { useState, useEffect } from 'react';
import type { Tenant } from '@/types';
import { getTenantBySubdomain } from '@/services/tenant.service';

export function useTenant() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTenant = async () => {
      // Extraire le sous-domaine depuis l'URL
      const host = window.location.host;
      const parts = host.split('.');
      const subdomain = parts.length > 2 ? parts[0] : null;

      if (!subdomain || subdomain === 'localhost' || subdomain === 'www') {
        setIsLoading(false);
        return;
      }

      try {
        const tenantData = await getTenantBySubdomain(subdomain);
        setTenant(tenantData);
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTenant();
  }, []);

  return {
    tenant,
    isLoading,
  };
}

