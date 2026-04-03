/**
 * ============================================================================
 * SELECT TENANT PAGE - SÉLECTION DU TENANT
 * ============================================================================
 * 
 * Page pour sélectionner un tenant après l'authentification
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

interface Tenant {
  tenantId: string;
  schoolName: string;
  tenantName: string;
  slug: string;
  subdomain: string | null;
  logoUrl: string | null;
  country: string | null;
}

export default function SelectTenantPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion, 12, -4);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/app';

  useEffect(() => {
    loadAvailableTenants();
  }, []);

  const loadAvailableTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/auth/available-tenants', {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            const { clearClientSessionSync } = await import('@/lib/auth/client-access-token');
            clearClientSessionSync();
          }
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to load tenants');
      }

      const data = await response.json();
      setTenants(data);

      if (Array.isArray(data) && data.length === 1) {
        handleSelectTenant(data[0].tenantId);
      }
    } catch (err: any) {
      console.error('Error loading tenants:', err);
      setError(err.message || 'Failed to load tenants');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTenant = async (tenantId: string) => {
    try {
      setIsSelecting(true);
      setError(null);

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/auth/select-tenant', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to select tenant');
      }

      if (typeof window !== 'undefined') {
        const { persistClientSession } = await import('@/lib/auth/client-access-token');
        persistClientSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          serverSessionId: data.serverSessionId,
          user: data.user,
          tenant: data.tenant,
          expiresAt: data.expiresAt,
        });
      }

      router.push(redirectTo);
    } catch (err: any) {
      console.error('Error selecting tenant:', err);
      setError(err.message || 'Failed to select tenant');
    } finally {
      setIsSelecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des écoles disponibles...</p>
        </motion.div>
      </div>
    );
  }

  if (error && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-red-600 mb-4">Erreur</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadAvailableTenants}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={pageMotion.initial}
          animate={pageMotion.animate}
          transition={pageMotion.transition}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sélectionnez votre école
          </h1>
          <p className="text-gray-600">
            Choisissez l'école pour laquelle vous souhaitez accéder au dashboard
          </p>
        </motion.div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenants.map((tenant, index) => (
            <motion.div
              key={tenant.tenantId}
              onClick={() => !isSelecting && handleSelectTenant(tenant.tenantId)}
              className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all ${
                selectedTenantId === tenant.tenantId
                  ? 'ring-2 ring-blue-600'
                  : 'hover:shadow-lg'
              } ${isSelecting ? 'opacity-50 cursor-not-allowed' : ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...pageMotion.transition, delay: (shouldReduceMotion ? 0 : index * 0.04) }}
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            >
              <div className="flex items-start">
                {tenant.logoUrl && (
                  <img
                    src={tenant.logoUrl}
                    alt={tenant.schoolName}
                    className="w-16 h-16 rounded-lg object-cover mr-4"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">
                    {tenant.schoolName}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {tenant.tenantName}
                  </p>
                  {tenant.country && (
                    <p className="text-xs text-gray-400">
                      {tenant.country}
                    </p>
                  )}
                </div>
              </div>
              {isSelecting && selectedTenantId === tenant.tenantId && (
                <div className="mt-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Connexion en cours...</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {tenants.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">
              Aucune école disponible pour votre compte
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retour à la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
