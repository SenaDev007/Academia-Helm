import { Metadata } from 'next';
import PlatformAggregationWorkspace from '@/components/platform/aggregation/PlatformAggregationWorkspace';

export const metadata: Metadata = {
  title: 'Agrégation Globale | Academia Helm Platform',
  description: 'Consolidation multi-écoles — effectifs, finances, pédagogie',
};

export default function PlatformAggregationPage() {
  return <PlatformAggregationWorkspace />;
}
