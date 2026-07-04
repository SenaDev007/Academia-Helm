/**
 * ============================================================================
 * MODULE 4 - FINANCES & ÉCONOMAT - PAGE PRINCIPALE (Dashboard)
 * ============================================================================
 * Le ModuleHeader et la SubModuleNavigation sont gérés par layout.tsx.
 * Cette page ne rend que le contenu du dashboard.
 * ============================================================================
 */

import FinanceDashboard from '@/components/finance/FinanceDashboard';

export default function FinancePage() {
  return <FinanceDashboard />;
}
