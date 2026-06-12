import { Metadata } from 'next';
import PlatformPaymentsWorkspace from '@/components/platform/billing/PlatformPaymentsWorkspace';

export const metadata: Metadata = {
  title: 'Paiements & Transactions | Academia Helm Platform',
  description: 'Historique global des encaissements de la plateforme',
};

export default function PlatformPaymentsPage() {
  return <PlatformPaymentsWorkspace />;
}
