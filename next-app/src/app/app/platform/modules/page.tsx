import { Metadata } from 'next';
import ModulesWorkspace from '@/components/platform/modules/ModulesWorkspace';

export const metadata: Metadata = {
  title: 'Modules & Fonctionnalités | Academia Helm Platform',
  description: 'Catalogue global et gestion des fonctionnalités',
};

export default function ModulesPage() {
  return <ModulesWorkspace />;
}
