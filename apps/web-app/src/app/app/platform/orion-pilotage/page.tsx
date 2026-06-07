import { Metadata } from 'next';
import OrionPilotageWorkspace from '@/components/orion/OrionPilotageWorkspace';

export const metadata: Metadata = {
  title: 'ORION-Pilotage Global | Academia Helm Platform',
  description: 'Intelligence décisionnelle multi-écoles',
};

export default function PlatformOrionPilotagePage() {
  return <OrionPilotageWorkspace />;
}
