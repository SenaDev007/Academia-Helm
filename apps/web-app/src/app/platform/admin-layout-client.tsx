/**
 * ============================================================================
 * PLATFORM ADMIN LAYOUT CLIENT — Layout client pour le back-office admin
 * ============================================================================
 *
 * Version de AppLayoutClient qui inclut TOUS les providers nécessaires au
 * PilotageLayout (SchoolLevelProvider, AcademicYearProvider, etc.) MAIS SANS :
 *   - PostLoginFlowWrapper (redirige vers /login si AUTH_ERROR)
 *   - SessionManagerProvider (gère l'inactivité, refresh token — fetch tenant)
 *   - SettingsBootstrapPrefetch (fetch settings tenant)
 *
 * Ces 3 providers font des fetch vers /api/auth/* (session tenant) qui
 * échouent en 401 pour l'admin (qui n'a que le cookie academia_admin_session).
 * ============================================================================
 */

'use client';

import { Suspense } from 'react';
import { QueryProvider } from '@/providers/QueryProvider';
import { SettingsBootstrapPrefetch } from '@/components/settings/SettingsBootstrapPrefetch';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import { BilingualProvider } from '@/contexts/BilingualContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { motion } from 'framer-motion';
import { getFadeMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import dynamic from 'next/dynamic';

// ⚠️ PAS de TenantThemeProvider ici — le back-office platform (admin.academiahelm.com)
// doit TOUJOURS utiliser la palette Helm par défaut (navy/blue/gold).
// Le thème du tenant s'applique uniquement sur :
//   1. Le site institutionnel public du tenant (sous-domaine école)
//   2. L'application du tenant (/app)
// PAS sur le site principal (academiahelm.com) ni le back-office platform.

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
            <Suspense fallback={null}>
              <AcademicYearProvider>
                <SchoolLevelProvider>
                  <BilingualProvider>
                    <PilotageLayout user={user} tenant={tenant}>
                      {children}
                    </PilotageLayout>
                  </BilingualProvider>
                </SchoolLevelProvider>
              </AcademicYearProvider>
            </Suspense>
          </AppSessionProvider>
        </QueryProvider>
      </I18nProvider>
    </motion.div>
  );
}
