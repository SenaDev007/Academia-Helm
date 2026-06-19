/**
 * ============================================================================
 * PLATFORM ADMIN LAYOUT CLIENT — Layout client pour le back-office admin
 * ============================================================================
 *
 * Version simplifiée de AppLayoutClient qui n'inclut PAS les providers qui
 * font des fetch vers /api/auth/* (session tenant) — ces fetch échouent en
 * 401 pour l'admin (qui n'a que le cookie academia_admin_session).
 *
 * Garde :
 *   - QueryProvider (react-query)
 *   - I18nProvider (traductions)
 *   - AppSessionProvider (contexte user/tenant)
 *   - PilotageLayout (layout complet avec sidebar, topbar, etc.)
 *
 * Retire :
 *   - PostLoginFlowWrapper (redirige vers /login si AUTH_ERROR)
 *   - SessionManagerProvider (gère l'inactivité, refresh token)
 *   - SettingsBootstrapPrefetch (fetch settings tenant)
 *   - AcademicYearProvider (fetch années scolaires tenant)
 *   - SchoolLevelProvider (fetch niveaux scolaires tenant)
 *   - BilingualProvider (fetch config bilingue tenant)
 *   - ReviewPromptHost (fetch reviews tenant)
 *   - SessionInactivityModal / SessionLockScreen (dépendent de SessionManager)
 * ============================================================================
 */

'use client';

import { QueryProvider } from '@/providers/QueryProvider';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { motion } from 'framer-motion';
import { getFadeMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import dynamic from 'next/dynamic';

// Lazy load du PilotageLayout (comme dans AppLayoutClient)
const PilotageLayout = dynamic(
  () => import('@/components/pilotage/PilotageLayout'),
  { ssr: true },
);

export interface PlatformAdminLayoutClientProps {
  user: User;
  tenant: Tenant;
  children: React.ReactNode;
}

export default function PlatformAdminLayoutClient({
  user,
  tenant,
  children,
}: PlatformAdminLayoutClientProps) {
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);

  return (
    <motion.div
      initial={fadeMotion.initial}
      animate={fadeMotion.animate}
      transition={fadeMotion.transition}
    >
      <I18nProvider>
        <QueryProvider>
          <AppSessionProvider user={user} tenant={tenant}>
            <PilotageLayout user={user} tenant={tenant}>
              {children}
            </PilotageLayout>
          </AppSessionProvider>
        </QueryProvider>
      </I18nProvider>
    </motion.div>
  );
}
