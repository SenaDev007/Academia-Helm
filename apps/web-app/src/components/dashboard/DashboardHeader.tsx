/**
 * Dashboard Header
 * 
 * Header compact du dashboard avec infos utilisateur
 */

'use client';

import type { User, Tenant } from '@/types';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clearClientSessionSync } from '@/lib/auth/client-access-token';
import TenantSwitcher from './TenantSwitcher';
import AcademicTrackSelector from './AcademicTrackSelector';

interface DashboardHeaderProps {
  user: User;
  tenant: Tenant;
}

export default function DashboardHeader({ user, tenant }: DashboardHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      // Appel au backend pour révoquer le token — avec timeout court (3s)
      // Si le backend ne répond pas, on déconnecte quand même côté client
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('/api/auth/logout', {
        method: 'POST',
        signal: controller.signal,
      }).catch(() => {
        // Timeout ou erreur réseau — on continue la déconnexion côté client
      });

      clearTimeout(timeoutId);

      // Nettoyer côté client (localStorage, sessionStorage, cookies client)
      clearClientSessionSync();

      // Redirection immédiate vers la page d'accueil
      window.location.href = '/';
    } catch (error) {
      console.error('Error logging out:', error);
      // Même en cas d'erreur, on nettoie et on redirige
      clearClientSessionSync();
      window.location.href = '/';
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <p className="text-sm text-slate-600">Tableau de bord</p>
          </div>
          {/* Sélecteur Academic Track (conditionnel) */}
          <AcademicTrackSelector />
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Sélecteur de tenant pour les SUPER_DIRECTOR */}
          <TenantSwitcher user={user} currentTenant={tenant} />
          
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-navy-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-600">{user.email}</p>
            {(user.role === 'SUPER_DIRECTOR' || user.role === 'PLATFORM_OWNER') && (
              <p className="text-xs text-soft-gold font-semibold">
                {user.role === 'PLATFORM_OWNER' ? 'Propriétaire plateforme' : 'Promoteur'}
              </p>
            )}
          </div>
          
          <div className="w-10 h-10 bg-navy-900 rounded-full flex items-center justify-center">
            <UserIcon className="w-5 h-5 text-white" />
          </div>
          
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
}

