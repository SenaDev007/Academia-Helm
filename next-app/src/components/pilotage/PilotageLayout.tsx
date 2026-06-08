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

import { useState, useEffect, useCallback } from 'react';
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

import OfflineIndicator from '@/components/offline/OfflineIndicator';
import OfflineGuard from '@/components/offline/OfflineGuard';

export default function PilotageLayout({ user, tenant, children }: PilotageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true); // lg: expanded/collapsed
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false); // mobile: drawer overlay
  const { currentLevel } = useSchoolLevel();
  const pathname = usePathname();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

  // Stabilized callbacks — prevent useEffect from firing on every render
  // (inline arrow functions create new references, causing the mobile drawer to close immediately)
  const handleToggleMobileDrawer = useCallback(() => setMobileDrawerOpen(prev => !prev), []);
  const handleCloseMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  return (
    <OfflineGuard>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Bar - Fixe en haut, toujours visible — hamburger mobile */}
        <PilotageTopBar
          user={user}
          tenant={tenant}
          onMenuClick={handleToggleMobileDrawer}
          mobileDrawerOpen={mobileDrawerOpen}
        />

        {/* Spacer pour éviter que le contenu passe sous la barre fixe (hauteur ~ barre) */}
        <div className="h-14 shrink-0" aria-hidden />

        {/* Zone principale + footer : flex-1 pour occuper l'espace et garder le footer en bas */}
        <div className="flex flex-1 min-h-0">
          {/* Mobile: backdrop drawer — z-[55] pour couvrir la TopBar (z-50) mais rester sous le drawer (z-[60]) */}
          {mobileDrawerOpen && (
            <>
              <div
                className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
                aria-hidden
                onClick={handleCloseMobileDrawer}
              />
            </>
          )}
          {/* Sidebar — 3 états: drawer mobile / icônes tablette / complète PC */}
          <PilotageSidebar
            isOpen={sidebarOpen}
            onToggle={handleToggleSidebar}
            user={user}
            mobileDrawerOpen={mobileDrawerOpen}
            onCloseMobileDrawer={handleCloseMobileDrawer}
          />

          {/* Main Content — décalé selon breakpoint: 0 mobile, ml-16 tablette, ml-16/lg:ml-64 PC */}
          <main
            className={`flex-1 min-h-0 transition-all duration-300 overflow-y-auto md:ml-16 ${
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
            {/* Indicateur de Synchronisation & Offline */}
            <OfflineIndicator />
          </div>
        </footer>
      </div>
    </OfflineGuard>
  );
}
