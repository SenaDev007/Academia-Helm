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
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

  useEffect(() => {
    loadAvailableTenants();
  }, []);

  const loadAvailableTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/auth/available-tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to load tenants');
      }

      const data = await response.json();
      setTenants(data);

      // Si un seul tenant, le sélectionner automatiquement
      if (data.length === 1) {
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

      const token = localStorage.getItem('accessToken');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/auth/select-tenant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to select tenant');
      }

      const data = await response.json();

      // Stocker le nouveau token enrichi
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Rediriger vers le dashboard
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error selecting tenant:', err);
      setError(err.message || 'Failed to select tenant');
    } finally {
      setIsSelecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des écoles disponibles...</p>
        </div>
      </div>
    );
  }

  if (error && tenants.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">Erreur</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadAvailableTenants}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Sélectionnez votre école
          </h1>
          <p className="text-gray-600">
            Choisissez l'école pour laquelle vous souhaitez accéder au dashboard
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tenants.map((tenant) => (
            <div
              key={tenant.tenantId}
              onClick={() => !isSelecting && handleSelectTenant(tenant.tenantId)}
              className={`bg-white rounded-lg shadow-md p-6 cursor-pointer transition-all ${
                selectedTenantId === tenant.tenantId
                  ? 'ring-2 ring-blue-600'
                  : 'hover:shadow-lg'
              } ${isSelecting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            </div>
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
