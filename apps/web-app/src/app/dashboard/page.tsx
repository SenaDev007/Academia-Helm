/**
 * ============================================================================
 * DASHBOARD PAGE - PAGE PRINCIPALE DU DASHBOARD
 * ============================================================================
 * 
 * Page qui dispatch le bon dashboard selon le rôle
 * 
 * ============================================================================
 */

import { DashboardDispatcher } from '../../components/dashboard/DashboardDispatcher';

export default function DashboardPage() {
  return <DashboardDispatcher />;
}
