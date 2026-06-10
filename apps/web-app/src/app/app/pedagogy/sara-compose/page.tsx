import { Metadata } from 'next';
import SaraComposeWorkspace from '@/components/pedagogy/sara/SaraComposeWorkspace';

export const metadata: Metadata = {
  title: 'Sara Compose (IA) | Academia Helm',
  description: 'Générateur IA d\'épreuves, devoirs et exercices pédagogiques',
};

export default function SaraComposePage() {
  return <SaraComposeWorkspace />;
}
