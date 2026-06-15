import { Metadata } from 'next';
import PlatformUsersWorkspace from '@/components/platform/users/PlatformUsersWorkspace';

export const metadata: Metadata = {
  title: 'Utilisateurs Plateforme | Academia Helm Platform',
  description: 'Gestion de l\'équipe d\'administration centrale',
};

export default function PlatformUsersPage() {
  return <PlatformUsersWorkspace />;
}
