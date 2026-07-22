/**
 * ============================================================================
 * SAISIEMASTER — Page (saissiemaster.academiahelm.com)
 * ============================================================================
 *
 * Module séparé pour la saisie des notes par classe et matière avec
 * 4 types d'évaluations normalisés (EF1, ES1, ES2, ES3).
 *
 * Cette page est accessible via:
 *   - /app/saisiemaster (route directe)
 *   - saissiemaster.academiahelm.com (sous-domaine, à configurer côté DNS)
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { SaisieMasterWorkspace } from '@/components/pedagogy/saisiemaster/SaisieMasterWorkspace';

export default function SaisieMasterPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'SaisieMaster',
        description: academicYear
          ? `Saisie des notes — année ${academicYear.label}`
          : 'Saisie des notes par classe et matière (EF1, ES1, ES2, ES3)',
        icon: 'clipboardCheck'
      }}
      content={{
        layout: 'custom',
        children: <SaisieMasterWorkspace />,
      }}
    />
  );
}
