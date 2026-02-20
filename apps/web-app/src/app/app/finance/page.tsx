/**
 * ============================================================================
 * MODULE 4 - FINANCES & ÉCONOMAT - PAGE PRINCIPALE
 * ============================================================================
 */

'use client';

import { DollarSign, CreditCard, TrendingDown, Wallet, AlertCircle } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function FinancePage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const pathname = usePathname();

  const subModuleTabs = [
    { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees', icon: DollarSign },
    { id: 'payments', label: 'Paiements', path: '/app/finance/payments', icon: CreditCard },
    { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses', icon: TrendingDown },
    { id: 'treasury', label: 'Trésorerie', path: '/app/finance/treasury', icon: Wallet },
    { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection', icon: AlertCircle },
  ];

  const currentTab = subModuleTabs.find(tab => pathname.startsWith(tab.path))?.id || 'fees';

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Finances & Économat"
        description="Gestion complète des finances de l'établissement : frais, paiements, dépenses, trésorerie et recouvrement."
        icon="finance"
        kpis={[
          { label: 'Recettes du mois', value: '2 450 000', unit: 'XOF' },
          { label: 'Dépenses du mois', value: '1 890 000', unit: 'XOF' },
          { label: 'Taux de recouvrement', value: '87%', unit: '' },
          { label: 'Impayés critiques', value: '12', unit: '' },
        ]}
        actions={[
          { label: 'Nouveau paiement', onClick: () => console.log('Open payment modal'), primary: true },
          { label: 'Nouvelle dépense', onClick: () => console.log('Open expense modal') },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Bienvenue dans le module Finances & Économat
        </h3>
        <p className="text-gray-600 mb-6">
          Sélectionnez un sous-module ci-dessus pour commencer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subModuleTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.path}
              className="p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-center space-x-3 mb-2">
                <tab.icon className="h-6 w-6 text-blue-600" />
                <h4 className="font-semibold text-gray-800">{tab.label}</h4>
              </div>
              <p className="text-sm text-gray-600">
                {tab.id === 'fees' && 'Configurez les frais par niveau et classe'}
                {tab.id === 'payments' && 'Enregistrez et suivez les paiements'}
                {tab.id === 'expenses' && 'Gérez les dépenses et leur approbation'}
                {tab.id === 'treasury' && 'Suivez la trésorerie et les clôtures'}
                {tab.id === 'collection' && 'Recouvrez les impayés efficacement'}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
