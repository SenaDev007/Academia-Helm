/**
 * Dashboard Layout Client Component
 * 
 * Layout client pour le dashboard avec sidebar et header
 */

'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getPageSlideMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import DashboardSidebar from './DashboardSidebar';
import DashboardHeader from './DashboardHeader';
import OfflineIndicator from '@/components/offline/OfflineIndicator';

interface DashboardLayoutClientProps {
  user: User;
  tenant: Tenant;
  children: React.ReactNode;
}

export default function DashboardLayoutClient({
  user,
  tenant,
  children,
}: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const { shouldReduceMotion } = useMotionBudget();
  const pageMotion = getPageSlideMotion(shouldReduceMotion);

  // Initialiser les services offline
  useEffect(() => {
    // Initialiser la base locale et la synchronisation
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
    <div className="min-h-screen bg-gray-50">
      <DashboardSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        user={user}
      />
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <DashboardHeader user={user} tenant={tenant} />
        <main className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
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
      {/* Indicateur Offline */}
      <OfflineIndicator />
    </div>
  );
}

