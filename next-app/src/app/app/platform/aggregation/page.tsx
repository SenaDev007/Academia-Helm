import { Metadata } from 'next';
import AggregationWorkspace from '@/components/aggregation/AggregationWorkspace';

export const metadata: Metadata = {
  title: 'Agrégation Globale | Academia Helm Platform',
  description: 'Moteur de consolidation multi-écoles',
};

export default function PlatformAggregationPage() {
  // En production, on passerait un prop isGlobal={true} pour changer le contexte
  return <AggregationWorkspace />;
}
