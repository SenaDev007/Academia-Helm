/**
 * ============================================================================
 * PILOTAGE LAYOUT - LAYOUT MAÎTRE
 * ============================================================================
 * 
 * Layout principal de l'interface de pilotage
 * 
 * Design V2 : Palette officielle Academia Helm
 *   - Footer : cloud (#F7F9FC) bg, gold accent line
 *   - Branding : blue-900 / gold-500
 * 
 * Structure :
 * - Top Bar (Contexte & Commandes globales)
 * - Navigation Latérale (Modules)
 * - Zone de Pilotage Principale (Dashboard / Module actif)
 * - Footer (version, sync, branding)
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
import ReviewAutoPopup from '@/components/reviews/ReviewAutoPopup';

export default function PilotageLayout({ user, tenant, children }: PilotageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true); // lg: expanded/collapsed
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false); // mobile: drawer overlay
  const { currentLevel } = useSchoolLevel();
  const pathname = usePathname();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

  // Stabilized callbacks
  const handleToggleMobileDrawer = useCallback(() => setMobileDrawerOpen(prev => !prev), []);
  const handleCloseMobileDrawer = useCallback(() => setMobileDrawerOpen(false), []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  // Level label for footer
  const getLevelLabel = (code?: string) => {
    if (!code) return null;
    if (code === 'ALL' || code === 'TOUS_LES_NIVEAUX') return 'Tous niveaux';
    if (code === 'MATERNELLE') return 'Maternelle';
    if (code === 'PRIMAIRE') return 'Primaire';
    if (code === 'SECONDAIRE') return 'Secondaire';
    return code;
  };

  return (
    <OfflineGuard>
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col">
        {/* Top Bar - Fixe en haut */}
        <PilotageTopBar
          user={user}
          tenant={tenant}
          onMenuClick={handleToggleMobileDrawer}
          mobileDrawerOpen={mobileDrawerOpen}
        />

        {/* Spacer pour la barre fixe (56px header + 2px gold line) */}
        <div className="h-[58px] shrink-0" aria-hidden />

        {/* Zone principale + footer */}
        <div className="flex flex-1 min-h-0">
          {/* Mobile: backdrop drawer */}
          {mobileDrawerOpen && (
            <>
              <div
                className="fixed inset-0 z-[55] bg-black/50 lg:hidden"
                aria-hidden
                onClick={handleCloseMobileDrawer}
              />
            </>
          )}
          {/* Sidebar */}
          <PilotageSidebar
            isOpen={sidebarOpen}
            onToggle={handleToggleSidebar}
            user={user}
            mobileDrawerOpen={mobileDrawerOpen}
            onCloseMobileDrawer={handleCloseMobileDrawer}
          />

          {/* Main Content */}
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

        {/* Footer — Professionnel et aligné sur la palette */}
        <footer className={`shrink-0 bg-white transition-all duration-300 md:ml-16 ${
          sidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}>
          {/* Gold accent line at top */}
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
          
          <div className="px-4 py-2.5 sm:px-6 md:px-8 lg:px-10">
            <div className="flex items-center justify-between w-full">
              {/* Left: Branding */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] font-semibold text-blue-900">Academia</span>
                  <span className="text-[11px] font-bold text-gold-600">Helm</span>
                </div>
                <span className="text-gray-300">|</span>
                <span className="text-[10px] text-gray-400 font-medium">v1.0.0</span>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <span className="text-[10px] text-gray-400 hidden sm:inline">&copy; 2021-2026 YEHI OR Tech</span>
              </div>

              {/* Right: Status indicators */}
              <div className="flex items-center space-x-3">
                {/* Active level badge */}
                {currentLevel && getLevelLabel(currentLevel.code) && (
                  <div className="hidden sm:flex items-center space-x-1.5 px-2 py-0.5 bg-blue-50 rounded-md border border-blue-100">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      currentLevel.code === 'MATERNELLE' ? 'bg-pink-400' :
                      currentLevel.code === 'PRIMAIRE' ? 'bg-emerald-400' :
                      currentLevel.code === 'SECONDAIRE' ? 'bg-violet-400' :
                      'bg-gold-400'
                    }`} />
                    <span className="text-[10px] font-medium text-blue-800">{getLevelLabel(currentLevel.code)}</span>
                  </div>
                )}
                <OfflineIndicator />
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Auto-popup pour demande d'avis après 30 jours d'existence du tenant.
          On utilise tenant.createdAt (pas user.createdAt) pour être cohérent
          avec ReviewPromptHost qui apparaît dans layout-client.tsx. */}
      <ReviewAutoPopup
        accountCreatedAt={tenant.createdAt || user.createdAt}
        authorName={`${user.firstName} ${user.lastName}`}
        authorRole={user.role}
        schoolName={tenant.name || ''}
        tenantId={tenant.id}
      />
    </OfflineGuard>
  );
}
