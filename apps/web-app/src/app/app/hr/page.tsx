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
import { useState, useEffect } from 'react';
import { HROverview } from './_components/HROverview';
import { apiFetch } from '@/lib/api/client';

export default function HRPage() {
  const { tenant, academicYear } = useModuleContext();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const currentTab = subModuleTabs.find(tab => 
    tab.exact ? pathname === tab.path : pathname.startsWith(tab.path)
  )?.id || 'overview';

  useEffect(() => {
    async function fetchData() {
      if (!tenant?.id || !academicYear?.id) return;
      
      try {
        setLoading(true);
        const result = await apiFetch<any>(`/hr/overview/dashboard?tenantId=${tenant.id}&academicYearId=${academicYear.id}`);
        setData(result);
      } catch (error) {
        console.error('Error fetching HR overview data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (currentTab === 'overview') {
      fetchData();
    }
  }, [tenant?.id, academicYear?.id, currentTab]);

  return (
    <div className="space-y-6 pb-10">
      <ModuleHeader
        title="Personnel, RH & Paie"
        description="Gestion complète du personnel, des contrats, des présences, de la paie et des déclarations sociales."
        icon="rh"
        kpis={[
          { label: 'Effectif total', value: data?.snapshot?.totalStaff || '0', unit: 'pers.' },
          { label: 'Masse salariale', value: data?.snapshot?.monthlyPayroll ? `${Math.round(data.snapshot.monthlyPayroll / 1000000)}M` : '0', unit: 'XOF' },
          { label: 'Congés actifs', value: data?.snapshot?.leaveCount || '0', unit: '' },
          { label: 'Alertes ORION', value: data?.orionAlerts?.length || '0', unit: '' },
        ]}
        actions={[
          { label: 'Ajouter un membre', onClick: () => console.log('Open add staff modal'), primary: true },
          { label: 'Calculer la paie', onClick: () => console.log('Open payroll modal') },
        ]}
      />

      <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />

      <div className="px-6">
        {currentTab === 'overview' ? (
          <HROverview data={data} loading={loading} />
        ) : (
          <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Module {subModuleTabs.find(tab => tab.id === currentTab)?.label}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Ce sous-module est en cours de déploiement. Utilisez la navigation pour consulter les autres sections.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

