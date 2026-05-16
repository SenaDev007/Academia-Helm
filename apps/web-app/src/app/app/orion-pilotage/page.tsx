import { Metadata } from 'next';
import OrionPilotageWorkspace from '@/components/orion/OrionPilotageWorkspace';

export const metadata: Metadata = {
  title: 'ORION-Pilotage Direction | Academia Helm',
  description: 'Intelligence décisionnelle assistée par IA pour la direction',
};

export default function OrionPilotagePage() {
  return <OrionPilotageWorkspace />;
}
