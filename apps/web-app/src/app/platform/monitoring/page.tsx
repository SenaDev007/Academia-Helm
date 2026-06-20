import { Metadata } from 'next';
import MonitoringWorkspace from '@/components/platform/monitoring/MonitoringWorkspace';

export const metadata: Metadata = {
  title: 'Incidents & Monitoring | Academia Helm Platform',
  description: 'Santé technique et supervision des services de la plateforme',
};

export default function MonitoringPage() {
  return <MonitoringWorkspace />;
}
