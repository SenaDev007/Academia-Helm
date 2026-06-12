/**
 * ============================================================================
 * DASHBOARD LAYOUT - LAYOUT AVEC GUARDS
 * ============================================================================
 * 
 * Layout qui protège les dashboards avec des guards
 * 
 * ============================================================================
 */

import { TenantContextProvider } from '../../contexts/TenantContext';
import { DashboardGuard } from '../../components/dashboard/DashboardGuard';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantContextProvider>
      <DashboardGuard>
        {children}
      </DashboardGuard>
    </TenantContextProvider>
  );
}
