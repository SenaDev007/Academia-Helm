/**
 * ============================================================================
 * HR MODULE - ATTENDANCE PAGE
 * ============================================================================
 */

'use client';

import { 
  Plus, 
  UserCheck, 
  Users, 
  FileText, 
  Clock, 
  DollarSign, 
  Shield 
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { usePathname } from 'next/navigation';

export default function AttendancePage() {
  const pathname = usePathname();

  const subModuleTabs = [
    { id: 'overview', label: "Vue d'ensemble", path: '/app/hr', icon: UserCheck, exact: true },
    { id: 'staff', label: 'Personnel', path: '/app/hr/staff', icon: Users },
    { id: 'contracts', label: 'Contrats', path: '/app/hr/contracts', icon: FileText },
    { id: 'leaves', label: 'Congés & Absences', path: '/app/hr/leaves', icon: Clock },
    { id: 'planning', label: 'Planning', path: '/app/hr/planning', icon: Clock },
    { id: 'allowances', label: 'Indemnités', path: '/app/hr/allowances', icon: DollarSign },
    { id: 'payroll', label: 'Paie', path: '/app/hr/payroll', icon: DollarSign },
    { id: 'cnss', label: 'CNSS', path: '/app/hr/cnss', icon: Shield },
    { id: 'reporting', label: 'Rapports', path: '/app/hr/reporting', icon: FileText },
    { id: 'settings', label: 'Paramètres', path: '/app/hr/settings', icon: Shield },
  ];

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Présences & Temps de travail"
        description="Gestion des présences et heures supplémentaires"
        icon="attendance"
      />
      <div className="px-6">
        <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />

        <div className="flex justify-end mb-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all shadow-md">
            <Plus className="w-4 h-4 inline mr-2" />
            Enregistrer présence
          </button>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          <p>Interface de gestion des présences en cours de développement...</p>
        </div>
      </div>
    </div>
  );
}

