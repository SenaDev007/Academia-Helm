import { Metadata } from 'next';
import PlatformSupportWorkspace from '@/components/platform/support/PlatformSupportWorkspace';

export const metadata: Metadata = {
  title: 'Support & Tickets | Academia Helm Platform',
  description: 'Gestion des demandes d\'assistance des écoles',
};

export default function PlatformSupportPage() {
  return <PlatformSupportWorkspace />;
}
