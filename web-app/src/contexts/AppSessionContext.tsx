/**
 * Contexte session app : user + tenant fournis par le layout serveur.
 * Permet aux pages (ex. paramètres) d'accéder au user/tenant pour le mode PO (tenant_id en URL).
 */

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import type { User, Tenant } from '@/types';

interface AppSessionContextType {
  user: User;
  tenant: Tenant;
}

const AppSessionContext = createContext<AppSessionContextType | undefined>(undefined);

export function AppSessionProvider({
  user,
  tenant,
  children,
}: {
  user: User;
  tenant: Tenant;
  children: ReactNode;
}) {
  return (
    <AppSessionContext.Provider value={{ user, tenant }}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionContextType {
  const context = useContext(AppSessionContext);
  if (context === undefined) {
    throw new Error('useAppSession must be used within AppSessionProvider');
  }
  return context;
}

export function useAppSessionOptional(): AppSessionContextType | undefined {
  return useContext(AppSessionContext);
}
