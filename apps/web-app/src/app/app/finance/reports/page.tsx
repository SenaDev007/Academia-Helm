'use client';

import { useState, useEffect } from 'react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';

const formatXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

export default function FinanceReportsPage() {
  const { academicYear } = useModuleContext();
  const [kpi, setKpi] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!academicYear?.id) return;
    fetch(`/api/finance/reports/kpi?academicYearId=${academicYear.id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setKpi);
  }, [academicYear?.id]);
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Rapports financiers"
        description="Encaissement par période et par classe, recouvrement global, dépenses par catégorie, prévision trésorerie, comparatif années."
        icon="finance"
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/reports" />
      <ModuleContentArea layout="custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border p-4"><p className="text-sm text-gray-600">Total dû</p><p className="text-xl font-semibold">{kpi ? formatXOF(kpi.totalDue ?? 0) : '—'}</p></div>
          <div className="rounded-lg border p-4"><p className="text-sm text-gray-600">Total encaissé</p><p className="text-xl font-semibold">{kpi ? formatXOF(kpi.totalPaid ?? 0) : '—'}</p></div>
          <div className="rounded-lg border p-4"><p className="text-sm text-gray-600">Taux recouvrement</p><p className="text-xl font-semibold">{kpi?.tauxRecouvrement != null ? `${kpi.tauxRecouvrement} %` : '—'}</p></div>
          <div className="rounded-lg border p-4"><p className="text-sm text-gray-600">Dépenses</p><p className="text-xl font-semibold">{kpi ? formatXOF(kpi.totalDepenses ?? 0) : '—'}</p></div>
        </div>
        <p className="text-gray-600">Rapports avancés et export PDF à brancher sur les endpoints dédiés.</p>
      </ModuleContentArea>
    </div>
  );
}
