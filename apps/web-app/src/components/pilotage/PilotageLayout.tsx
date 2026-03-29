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
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
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
  const [sidebarOpen, setSidebarOpen] = useState(true); // lg: expanded/collapsed
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false); // mobile: drawer overlay
  const { currentLevel } = useSchoolLevel();
  const pathname = usePathname();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

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

      {/* Top Bar - Fixe en haut, toujours visible — hamburger mobile */}
      <PilotageTopBar
        user={user}
        tenant={tenant}
        onMenuClick={() => setMobileDrawerOpen(true)}
      />

      {/* Spacer pour éviter que le contenu passe sous la barre fixe (hauteur ~ barre) */}
      <div className="h-14 shrink-0" aria-hidden />

      {/* Zone principale + footer : flex-1 pour occuper l'espace et garder le footer en bas */}
      <div className="flex flex-1 min-h-0">
        {/* Mobile: backdrop drawer */}
        {mobileDrawerOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              aria-hidden
              onClick={() => setMobileDrawerOpen(false)}
            />
          </>
        )}
        {/* Sidebar — 3 états: drawer mobile / icônes tablette / complète PC */}
        <PilotageSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
          mobileDrawerOpen={mobileDrawerOpen}
          onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
        />

        {/* Main Content — décalé selon breakpoint: 0 mobile, ml-16 tablette, ml-16/lg:ml-64 PC */}
        <main
          className={`flex-1 min-h-0 transition-all duration-300 overflow-x-hidden overflow-y-auto md:ml-16 ${
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
            className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full"
            key={`${pathname}-${currentLevel?.id ?? 'no-level'}`}
            initial={pageMotion.initial}
            animate={pageMotion.animate}
            exit={pageMotion.exit}
            transition={pageMotion.transition}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer — décalé comme main (responsive) */}
      <footer className={`shrink-0 bg-white border-t border-gray-200 px-4 py-3 sm:px-6 md:px-8 lg:px-10 xl:px-12 flex items-center transition-all duration-300 md:ml-16 ${
        sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
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
