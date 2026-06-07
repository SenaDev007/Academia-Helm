import { Metadata } from 'next';
import TenantsWorkspace from '@/components/platform/tenants/TenantsWorkspace';

export const metadata: Metadata = {
  title: 'Écoles / Tenants | Academia Helm Platform',
  description: 'Gestion des établissements clients',
};

export default function TenantsPage() {
  return <TenantsWorkspace />;
}
