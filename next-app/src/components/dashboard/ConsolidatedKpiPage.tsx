/**
 * Consolidated KPI Page
 * 
 * Page de bilans consolidés multi-écoles
 * Uniquement pour les SUPER_DIRECTOR (promoteurs)
 * Lecture seule, agrégation explicite
 */

'use client';

import { useState, useEffect } from 'react';
import type { User, Tenant, ConsolidatedKpiResponse } from '@/types';
import { getConsolidatedKpi } from '@/services/consolidated-kpi.service';
import {
  Users,
  UserCheck,
  Calculator,
  TrendingUp,
  Building,
  Loader,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

interface ConsolidatedKpiPageProps {
  user: User;
  tenant: Tenant;
}

export default function ConsolidatedKpiPage({ user, tenant }: ConsolidatedKpiPageProps) {
  const [data, setData] = useState<ConsolidatedKpiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const kpiData = await getConsolidatedKpi();
      setData(kpiData);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des bilans consolidés');
    } finally {
      setIsLoading(false);
    }
  };

  if (user.role !== 'SUPER_DIRECTOR') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              Accès restreint
            </h3>
            <p className="text-sm text-yellow-800">
              Cette page est réservée aux promoteurs (SUPER_DIRECTOR).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-2">Erreur</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-navy-900 mb-2">
              Bilans consolidés
            </h1>
            <p className="text-slate-600">
              Vue d'ensemble de tous vos établissements • {data.periodLabel}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              <strong>Important :</strong> Ces données sont en lecture seule. 
              Chaque établissement conserve ses données isolées. 
              Les agrégations sont calculées explicitement pour cette vue consolidée uniquement.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-navy-900">
              {data.totalSchools}
            </div>
            <div className="text-sm text-slate-600">
              Établissement{data.totalSchools > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Consolidés */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-4">Indicateurs consolidés</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Effectif total</p>
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">
              {data.consolidated.totalStudents.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">Élèves (tous établissements)</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Enseignants total</p>
              <UserCheck className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">
              {data.consolidated.totalTeachers.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">Personnel (tous établissements)</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Recettes consolidées</p>
              <Calculator className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">
              {data.consolidated.totalRevenue.toLocaleString()} {data.consolidated.currency}
            </p>
            <p className="text-xs text-slate-500 mt-1">Somme de tous les établissements</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-600">Taux de recouvrement moyen</p>
              <TrendingUp className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">
              {data.consolidated.averageRecoveryRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 mt-1">Moyenne pondérée</p>
          </div>
        </div>
      </div>

      {/* Bilans par établissement */}
      <div>
        <h2 className="text-xl font-bold text-navy-900 mb-4">Bilans par établissement</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.bySchool.map((school) => (
            <div
              key={school.tenantId}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-1">
                    {school.schoolName}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {school.subdomain}.academiahub.com
                  </p>
                </div>
                <Building className="w-6 h-6 text-slate-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Effectif</p>
                  <p className="text-lg font-semibold text-navy-900">
                    {school.kpi.totalStudents.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Enseignants</p>
                  <p className="text-lg font-semibold text-navy-900">
                    {school.kpi.totalTeachers.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Recettes</p>
                  <p className="text-lg font-semibold text-navy-900">
                    {school.kpi.totalRevenue.toLocaleString()} {school.kpi.currency}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-600 mb-1">Recouvrement</p>
                  <p className="text-lg font-semibold text-navy-900">
                    {school.kpi.recoveryRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Note importante */}
      <div className="bg-navy-900 rounded-lg p-6 text-white">
        <div className="flex items-start space-x-3">
          <BarChart3 className="w-6 h-6 text-soft-gold flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Isolation des données</h3>
            <p className="text-sm text-gray-100 leading-relaxed">
              Chaque établissement conserve ses données strictement isolées. 
              Cette vue consolidée est une agrégation explicite en lecture seule, 
              calculée uniquement pour cette page. Aucune opération ne peut mélanger 
              les données entre établissements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

