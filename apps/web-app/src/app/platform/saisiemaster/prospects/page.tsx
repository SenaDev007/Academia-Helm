import { Metadata } from 'next';
import SaisieMasterProspectsWorkspace from '@/components/platform/saisiemaster/ProspectsWorkspace';

export const metadata: Metadata = {
  title: 'Prospects SaisieMaster | Academia Helm Platform',
  description: 'Liste des prospects SaisieMaster avec relances email et WhatsApp',
};

export default function SaisieMasterProspectsPage() {
  return <SaisieMasterProspectsWorkspace />;
}
