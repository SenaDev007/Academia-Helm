/**
 * ============================================================================
 * DASHBOARD COMPTABLE
 * ============================================================================
 * 
 * Wireframe :
 * - Finances & Économat
 * - Paiements
 * - Dépenses
 * - Clôtures
 * - ORION (financier)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, FileText, AlertCircle } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import Link from 'next/link';

interface FinanceSummary {
  revenue: number;
  expenses: number;
  balance: number;
  unpaidCount: number;
}

export default function AccountantDashboard() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFinanceSummary = async () => {
      if (!currentYear || !currentLevel) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/general/revenue?academicYearId=${currentYear.id}&schoolLevelId=${currentLevel.id}`
        );
        if (response.ok) {
          const data = await response.json();
          setSummary({
            revenue: data.total || 0,
            expenses: 0, // TODO: Charger les dépenses
            balance: data.total || 0,
            unpaidCount: 0, // TODO: Calculer les impayés
          });
        }
      } catch (error) {
        console.error('Failed to load finance summary:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFinanceSummary();
  }, [currentYear, currentLevel]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de bord financier
        </h1>
        <p className="text-gray-600">
          {currentYear?.name} • {currentLevel?.code === 'MATERNELLE' ? 'Maternelle' :
                                 currentLevel?.code === 'PRIMAIRE' ? 'Primaire' :
                                 currentLevel?.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel?.code}
        </p>
      </div>

      {/* Résumé financier */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Recettes</p>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {isLoading ? '—' : formatCurrency(summary?.revenue || 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Dépenses</p>
            <TrendingDown className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {isLoading ? '—' : formatCurrency(summary?.expenses || 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Solde</p>
            <DollarSign className="w-5 h-5 text-navy-900" />
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {isLoading ? '—' : formatCurrency(summary?.balance || 0)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Impayés</p>
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <p className="text-2xl font-bold text-navy-900">
            {isLoading ? '—' : summary?.unpaidCount || 0}
          </p>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/app/finance/payments"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Paiements</h3>
              <p className="text-sm text-gray-600">Gérer les paiements</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/finance/expenses"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Dépenses</h3>
              <p className="text-sm text-gray-600">Enregistrer les dépenses</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/finance/closures"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Clôtures</h3>
              <p className="text-sm text-gray-600">Effectuer les clôtures</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/orion/financial"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Analyse ORION</h3>
              <p className="text-sm text-gray-600">Insights financiers</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

