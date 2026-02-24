/**
 * App Layout Client Component
 * 
 * Composant client pour gérer le flow post-login
 * Wrapper autour du layout serveur
 */

'use client';

import { PostLoginFlowWrapper } from '@/components/loading/PostLoginFlowWrapper';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
import type { User, Tenant } from '@/types';

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
  return (
    <AppSessionProvider user={user} tenant={tenant}>
      <AcademicYearProvider>
        <SchoolLevelProvider>
          <PostLoginFlowWrapper user={user} tenant={tenant}>
            {children}
          </PostLoginFlowWrapper>
        </SchoolLevelProvider>
      </AcademicYearProvider>
    </AppSessionProvider>
  );
}
