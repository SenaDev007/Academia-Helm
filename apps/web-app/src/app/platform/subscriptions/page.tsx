import { Metadata } from 'next';
import SubscriptionsWorkspace from '@/components/platform/subscriptions/SubscriptionsWorkspace';

export const metadata: Metadata = {
  title: 'Abonnements & Plans SaaS | Academia Helm Platform',
  description: 'Gestion des offres commerciales et abonnements',
};

export default function SubscriptionsPage() {
  return <SubscriptionsWorkspace />;
}
