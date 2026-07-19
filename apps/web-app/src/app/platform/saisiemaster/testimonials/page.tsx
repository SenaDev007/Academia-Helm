import { Metadata } from 'next';
import SaisieMasterTestimonialsModeration from '@/components/platform/saisiemaster/TestimonialsModeration';

export const metadata: Metadata = {
  title: 'Témoignages SaisieMaster | Academia Helm Platform',
  description: 'Modération des avis déposés par les utilisateurs SaisieMaster',
};

export default function SaisieMasterTestimonialsPage() {
  return <SaisieMasterTestimonialsModeration />;
}
