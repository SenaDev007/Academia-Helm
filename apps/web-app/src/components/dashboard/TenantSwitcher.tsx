/**
 * Tenant Switcher Component
 * 
 * Composant pour basculer entre les établissements
 * Affiché uniquement pour les SUPER_DIRECTOR
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Tenant, User } from '@/types';
import { switchTenant, getAccessibleTenants } from '@/services/tenant-switch.service';
import { Building, ChevronDown, Check, Loader } from 'lucide-react';

interface TenantSwitcherProps {
  user: User;
  currentTenant: Tenant;
}

export default function TenantSwitcher({ user, currentTenant }: TenantSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const isSuperDirector =
    user.role === 'SUPER_DIRECTOR' || user.role === 'PLATFORM_OWNER';

  useEffect(() => {
    if (isSuperDirector && user.accessibleTenants) {
      setTenants(user.accessibleTenants);
    } else if (isSuperDirector) {
      // Charger les tenants accessibles si pas déjà dans la session
      loadTenants();
    }
  }, [isSuperDirector, user.accessibleTenants]);

  const loadTenants = async () => {
    setIsLoading(true);
    try {
      const accessibleTenants = await getAccessibleTenants();
      setTenants(accessibleTenants);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitch = async (tenant: Tenant) => {
    if (tenant.id === currentTenant.id) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(true);
    try {
      await switchTenant(tenant.id, tenant.subdomain);
      // La redirection est gérée par switchTenant
    } catch (error) {
      console.error('Error switching tenant:', error);
      alert('Erreur lors du changement d\'établissement');
      setIsSwitching(false);
    }
  };

  // Ne pas afficher si l'utilisateur n'est pas SUPER_DIRECTOR
  if (!isSuperDirector || tenants.length <= 1) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Building className="w-4 h-4 text-slate-600" />
        <span className="text-sm font-medium text-navy-900">
          {currentTenant.name}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Overlay pour fermer le menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu déroulant */}
          <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                Établissements
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="space-y-1">
                  {tenants.map((tenant) => {
                    const isCurrent = tenant.id === currentTenant.id;
                    return (
                      <button
                        key={tenant.id}
                        onClick={() => handleSwitch(tenant)}
                        disabled={isSwitching || isCurrent}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                          isCurrent
                            ? 'bg-navy-50 text-navy-900 cursor-default'
                            : 'hover:bg-gray-50 text-slate-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {tenant.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {tenant.subdomain}.academiahub.com
                          </div>
                        </div>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-navy-900 flex-shrink-0 ml-2" />
                        )}
                        {isSwitching && !isCurrent && (
                          <Loader className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

