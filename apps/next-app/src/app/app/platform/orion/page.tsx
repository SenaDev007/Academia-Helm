import { Metadata } from 'next';
import PlatformOrionWorkspace from '@/components/platform/orion/PlatformOrionWorkspace';

export const metadata: Metadata = {
  title: 'ORION Global Intelligence | Academia Helm Platform',
  description: 'Supervision analytique et prédictive de la plateforme',
};

export default function PlatformOrionPage() {
  return <PlatformOrionWorkspace />;
}
