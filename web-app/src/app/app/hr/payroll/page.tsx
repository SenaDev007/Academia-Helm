'use client';

import { HRShell } from '../_components/HRShell';
import { PayrollWorkspace } from '../_components/workspaces/PayrollWorkspace';

export default function PayrollPage() {
  return (
    <HRShell
      activeId="payroll"
      title="Paie"
      description="Gestion des bulletins de paie, périodes salariales et virements."
    >
      <PayrollWorkspace />
    </HRShell>
  );
}
