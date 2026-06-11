import { Metadata } from 'next';
import PlatformAuditWorkspace from '@/components/platform/audit/PlatformAuditWorkspace';

export const metadata: Metadata = {
  title: 'Audit & Logs | Academia Helm Platform',
  description: 'Traçabilité des actions administratives',
};

export default function PlatformAuditPage() {
  return <PlatformAuditWorkspace />;
}
