/**
 * Loading page for /school-portal (tenant subdomains)
 *
 * Affiche le logo et le nom de l'école au lieu d'Academia Helm.
 */

import TenantSchoolLoader from '@/components/ui/TenantSchoolLoader';

export default function SchoolPortalLoading() {
  return <TenantSchoolLoader />;
}
