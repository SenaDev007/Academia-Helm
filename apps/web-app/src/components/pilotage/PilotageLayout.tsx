/**
 * ============================================================================
 * PILOTAGE LAYOUT - LAYOUT MAÎTRE
 * ============================================================================
 * 
 * Layout principal de l'interface de pilotage
 * 
 * Structure :
 * - Top Bar (Contexte & Commandes globales)
 * - Navigation Latérale (Modules)
 * - Zone de Pilotage Principale (Dashboard / Module actif)
 * - Footer minimal (statut, sync, version)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import PilotageTopBar from './PilotageTopBar';
import PilotageSidebar from './PilotageSidebar';
import { OfflineStatusBadge } from '@/components/offline/OfflineStatusBadge';
import { SyncToast } from '@/components/offline/SyncToast';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import type { User, Tenant } from '@/types';

interface PilotageLayoutProps {
  user: User;
  tenant: Tenant;
  children: React.ReactNode;
}

export default function PilotageLayout({ user, tenant, children }: PilotageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { currentLevel } = useSchoolLevel();

  // Initialiser les services offline
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const initOffline = async () => {
        try {
          const { localDb } = await import('@/lib/offline/local-db.service');
          await localDb.initialize();
          
          const { offlineSyncService } = await import('@/lib/offline/offline-sync.service');
          // Le service se lance automatiquement
        } catch (error) {
          console.error('Failed to initialize offline services:', error);
        }
      };
      
      initOffline();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden flex flex-col">
      {/* Badge Offline/Online Status */}
      <OfflineStatusBadge />
      
      {/* Toast Synchronisation */}
      <SyncToast />

      {/* Top Bar - Fixe en haut, toujours visible */}
      <PilotageTopBar user={user} tenant={tenant} />

      {/* Spacer pour éviter que le contenu passe sous la barre fixe (hauteur ~ barre) */}
      <div className="h-14 shrink-0" aria-hidden />

      {/* Zone principale + footer : flex-1 pour occuper l'espace et garder le footer en bas */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <PilotageSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
        />

        {/* Main Content - scroll interne si contenu long */}
        <main
          className={`flex-1 min-h-0 transition-all duration-300 overflow-x-hidden overflow-y-auto ${
            sidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          <div
            className="px-6 py-6 sm:px-8 lg:px-10 xl:px-12 max-w-[1600px] mx-auto"
            key={currentLevel?.id ?? 'no-level'}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Footer — toujours en bas de l'app (shrink-0 pour ne pas être compressé) */}
      <footer className={`shrink-0 bg-white border-t border-gray-200 px-6 py-3 sm:px-8 lg:px-10 xl:px-12 flex items-center transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-16'
      }`}>
        <div className="flex items-center justify-between text-xs text-gray-600 w-full">
          <div className="flex items-center space-x-4">
            <span>Academia Helm v1.0.0</span>
            <span>•</span>
            <span>© 2021-2026 YEHI OR Tech</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
