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
import { motion } from 'framer-motion';
import { getFadeMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import type { User, Tenant } from '@/types';
import { ReviewPromptHost } from '@/components/reviews/ReviewPromptHost';

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
 */
export default function AppLayoutClient({
  children,
  user,
  tenant,
}: AppLayoutClientProps) {
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);
  return (
    <motion.div
      initial={fadeMotion.initial}
      animate={fadeMotion.animate}
      transition={fadeMotion.transition}
    >
      <QueryProvider>
        <AppSessionProvider user={user} tenant={tenant}>
          <Suspense fallback={null}>
            <SettingsBootstrapPrefetch />
          </Suspense>
          <Suspense fallback={null}>
            <AcademicYearProvider>
              <SchoolLevelProvider>
                <ReviewPromptHost user={user} tenant={tenant}>
                  <PostLoginFlowWrapper user={user} tenant={tenant}>
                    {children}
                  </PostLoginFlowWrapper>
                </ReviewPromptHost>
              </SchoolLevelProvider>
            </AcademicYearProvider>
          </Suspense>
        </AppSessionProvider>
      </QueryProvider>
    </motion.div>
  );
}
