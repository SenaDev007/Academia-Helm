import { Metadata } from 'next';
import ReviewsModerationWorkspace from '@/components/platform/reviews/ReviewsModerationWorkspace';

export const metadata: Metadata = {
  title: 'Avis & Témoignages | Academia Helm Platform',
  description: 'Modération des avis déposés par les établissements et visiteurs',
};

export default function PlatformReviewsPage() {
  return <ReviewsModerationWorkspace />;
}
