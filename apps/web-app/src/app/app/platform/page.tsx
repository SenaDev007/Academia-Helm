import { Metadata } from 'next';
import PlatformDashboard from '@/components/platform/PlatformDashboard';

export const metadata: Metadata = {
  title: 'Tableau de Bord Global | Academia Helm Platform',
  description: 'Centre de commandement global d\'Academia Helm',
};

export default function PlatformPage() {
  return <PlatformDashboard />;
}
