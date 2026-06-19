import { Metadata } from 'next';
import PlatformOrionWorkspace from '@/components/platform/orion/PlatformOrionWorkspace';

export const metadata: Metadata = {
  title: 'ORION-Pilotage Global | Academia Helm Platform',
  description: 'Intelligence décisionnelle multi-écoles',
};

export default function PlatformOrionPilotagePage() {
  return <PlatformOrionWorkspace />;
}
