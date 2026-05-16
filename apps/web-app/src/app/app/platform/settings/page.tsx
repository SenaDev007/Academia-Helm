import { Metadata } from 'next';
import PlatformSettingsWorkspace from '@/components/platform/settings/PlatformSettingsWorkspace';

export const metadata: Metadata = {
  title: 'Paramètres Plateforme | Academia Helm Platform',
  description: 'Configuration globale d\'Academia Helm',
};

export default function PlatformSettingsPage() {
  return <PlatformSettingsWorkspace />;
}
