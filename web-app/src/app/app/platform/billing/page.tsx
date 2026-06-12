import { Metadata } from 'next';
import PlatformBillingWorkspace from '@/components/platform/billing/PlatformBillingWorkspace';

export const metadata: Metadata = {
  title: 'Facturation SaaS | Academia Helm Platform',
  description: 'Gestion des factures et paiements des écoles',
};

export default function PlatformBillingPage() {
  return <PlatformBillingWorkspace />;
}
