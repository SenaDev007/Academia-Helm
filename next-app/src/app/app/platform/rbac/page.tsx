import { Metadata } from 'next';
import PlatformRBACWorkspace from '@/components/platform/rbac/PlatformRBACWorkspace';

export const metadata: Metadata = {
  title: 'Rôles & Permissions | Academia Helm Platform',
  description: 'Gestion du modèle RBAC global de la plateforme',
};

export default function PlatformRBACPage() {
  return <PlatformRBACWorkspace />;
}
