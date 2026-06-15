import { Metadata } from 'next';
import InitialSubscriptionsWorkspace from '@/components/platform/billing/InitialSubscriptionsWorkspace';

export const metadata: Metadata = {
  title: 'Souscriptions Initiales | Academia Helm Platform',
  description: 'Gestion des frais d\'entrée et d\'activation',
};

export default function InitialSubscriptionsPage() {
  return <InitialSubscriptionsWorkspace />;
}
