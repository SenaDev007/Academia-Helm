import { Metadata } from 'next';
import AggregationWorkspace from '@/components/aggregation/AggregationWorkspace';

export const metadata: Metadata = {
  title: 'Module Agrégation | Academia Helm',
  description: 'Moteur de consolidation des données de l\'établissement',
};

export default function AggregationPage() {
  return <AggregationWorkspace />;
}
