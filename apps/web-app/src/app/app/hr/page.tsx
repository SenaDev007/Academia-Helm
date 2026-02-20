/**
 * ============================================================================
 * HR MODULE - MAIN PAGE
 * ============================================================================
 */

'use client';

import { UserCheck, FileText, Clock, DollarSign, Shield, Users } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { usePathname } from 'next/navigation';

export default function HRPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const pathname = usePathname();

  const subModuleTabs = [
    { id: 'staff', label: 'Personnel', path: '/app/hr/staff', icon: Users },
    { id: 'contracts', label: 'Contrats', path: '/app/hr/contracts', icon: FileText },
    { id: 'attendance', label: 'Présences', path: '/app/hr/attendance', icon: Clock },
    { id: 'payroll', label: 'Paie', path: '/app/hr/payroll', icon: DollarSign },
    { id: 'cnss', label: 'CNSS', path: '/app/hr/cnss', icon: Shield },
  ];

  const currentTab = subModuleTabs.find(tab => pathname.startsWith(tab.path))?.id || 'staff';

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Personnel, RH & Paie"
        description="Gestion complète du personnel, des contrats, des présences, de la paie et des déclarations sociales."
        icon="rh"
        kpis={[
          { label: 'Effectif total', value: '45', unit: 'personnes' },
          { label: 'Taux de présence', value: '92%', unit: '' },
          { label: 'Masse salariale', value: '8.5M', unit: 'XOF/mois' },
          { label: 'Employés CNSS', value: '38', unit: '' },
        ]}
        actions={[
          { label: 'Ajouter un membre', onClick: () => console.log('Open add staff modal'), primary: true },
          { label: 'Enregistrer présence', onClick: () => console.log('Open record attendance modal') },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Bienvenue dans le module {subModuleTabs.find(tab => tab.id === currentTab)?.label}
        </h3>
        <p className="text-gray-600">
          Sélectionnez un sous-module ci-dessus pour commencer.
        </p>
      </div>
    </div>
  );
}
