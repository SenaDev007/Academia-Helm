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
import type { User, Tenant } from '@/types';

interface PilotageLayoutProps {
  user: User;
  tenant: Tenant;
  children: React.ReactNode;
}

export default function PilotageLayout({ user, tenant, children }: PilotageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Badge Offline/Online Status */}
      <OfflineStatusBadge />
      
      {/* Toast Synchronisation */}
      <SyncToast />

      {/* Top Bar - Fixé en haut */}
      <PilotageTopBar user={user} tenant={tenant} />

      <div className="flex">
        {/* Sidebar */}
        <PilotageSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
        />

        {/* Main Content - avec scroll contenu isolé */}
        <main
          className={`flex-1 transition-all duration-300 overflow-x-hidden ${
            sidebarOpen ? 'ml-64' : 'ml-16'
          }`}
        >
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Footer minimal — avec décalage pour la sidebar */}
      <footer className={`bg-white border-t border-gray-200 px-6 h-[1cm] min-h-[28px] flex items-center transition-all duration-300 ${
        sidebarOpen ? 'ml-64' : 'ml-16'
      }`}>
        <div className="flex items-center justify-between text-xs text-gray-600 w-full">
          <div className="flex items-center space-x-4">
            <span>Academia Hub v1.0.0</span>
            <span>•</span>
            <span>© 2021-2026 YEHI OR Tech</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
