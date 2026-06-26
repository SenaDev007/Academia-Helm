/**
 * App Layout Client Component
 * 
 * Composant client pour gérer le flow post-login
 * Wrapper autour du layout serveur
 */

'use client';

import { Suspense } from 'react';
import { PostLoginFlowWrapper } from '@/components/loading/PostLoginFlowWrapper';
import { QueryProvider } from '@/providers/QueryProvider';
import { SettingsBootstrapPrefetch } from '@/components/settings/SettingsBootstrapPrefetch';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import { BilingualProvider } from '@/contexts/BilingualContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SessionManagerProvider } from '@/contexts/SessionManagerContext';
import SessionInactivityModal from '@/components/auth/SessionInactivityModal';
import SessionLockScreen from '@/components/auth/SessionLockScreen';
import { motion } from 'framer-motion';
import { getFadeMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import { ReviewPromptHost } from '@/components/reviews/ReviewPromptHost';
import { CrispChat } from '@/components/CrispChat';
import { SubscriptionBanner } from '@/components/billing/SubscriptionBanner';
import { TenantThemeProvider } from '@/providers/TenantThemeProvider';

export interface AppLayoutClientProps {
  children: React.ReactNode;
  user: User;
  tenant: Tenant;
}

/**
 * Layout client pour l'application
 * 
 * Gère le flow post-login avant d'afficher le contenu.
 * AppSessionProvider expose user/tenant aux pages (ex. paramètres en mode PO).
 * SessionManagerProvider gère l'inactivité, le verrouillage et le refresh proactif.
 */
export default function AppLayoutClient({
  children,
  user,
  tenant,
}: AppLayoutClientProps) {
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);
  return (
    <SessionManagerProvider>
      <motion.div
        initial={fadeMotion.initial}
        animate={fadeMotion.animate}
        transition={fadeMotion.transition}
      >
        {/* Bandeau d'abonnement (GRACE_PERIOD / SUSPENDED) */}
        <SubscriptionBanner tenantId={tenant?.id} />
        <I18nProvider>
          <QueryProvider>
            <AppSessionProvider user={user} tenant={tenant}>
              <Suspense fallback={null}>
                <SettingsBootstrapPrefetch />
              </Suspense>
              <Suspense fallback={null}>
                <AcademicYearProvider>
                  <SchoolLevelProvider>
                    <BilingualProvider>
                      <TenantThemeProvider>
                        <ReviewPromptHost user={user} tenant={tenant}>
                          <PostLoginFlowWrapper user={user} tenant={tenant}>
                            {children}
                          </PostLoginFlowWrapper>
                        </ReviewPromptHost>
                      </TenantThemeProvider>
                    </BilingualProvider>
                  </SchoolLevelProvider>
                </AcademicYearProvider>
              </Suspense>
            </AppSessionProvider>
          </QueryProvider>
        </I18nProvider>
      </motion.div>

      {/* Modaux et écrans de session — montés hors du layout principal */}
      <SessionInactivityModal />
      <SessionLockScreen />
      <CrispChat />
    </SessionManagerProvider>
  );
}
