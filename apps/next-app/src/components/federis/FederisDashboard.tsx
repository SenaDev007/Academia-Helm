/**
 * FederisDashboard Component
 * 
 * Cockpit institutionnel Academia Federis avec KPI et Pilotage ORION
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface KPIData {
  schoolsCount: number;
  candidatesCount: number;
  activeExamsCount: number;
  totalRevenue: number;
  criticalAlerts: number;
}

export default function FederisDashboard({ tenantId }: { tenantId: string }) {
  const [kpiData, setKpiData] = useState<KPIData>({
    schoolsCount: 0,
    candidatesCount: 0,
    activeExamsCount: 0,
    totalRevenue: 0,
    criticalAlerts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadKPIs = async () => {
      try {
        // Simulation de chargement
        setTimeout(() => {
          setKpiData({
            schoolsCount: 24,
            candidatesCount: 15420,
            activeExamsCount: 4,
            totalRevenue: 12500000,
            criticalAlerts: 3,
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error loading KPIs:', error);
      }
    };

    loadKPIs();
  }, [tenantId]);

  const kpiCards = [
    {
      title: 'Écoles Fédérées',
      value: kpiData.schoolsCount,
      icon: 'building' as const,
      color: 'blue',
      trend: '+4 ce mois',
    },
    {
      title: 'Effectif Global Candidats',
      value: kpiData.candidatesCount.toLocaleString(),
      icon: 'scolarite' as const,
      color: 'green',
      trend: 'Session 2024',
    },
    {
      title: 'Examens en Cours',
      value: kpiData.activeExamsCount,
      icon: 'exams' as const,
      color: 'purple',
      trend: '3 compositions / 1 correction',
    },
    {
      title: 'Alertes Système',
      value: kpiData.criticalAlerts,
      icon: 'warning' as const,
      color: 'red',
      trend: 'Action requise',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">Academia Federis</h1>
          <p className="text-gray-500 mt-1 font-medium">
            Pilotage institutionnel et gouvernance des examens.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
            Exporter Rapport Annuel
          </button>
          <button className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-semibold shadow-md hover:bg-blue-800 transition-all">
            Nouvelle Session d'Examen
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiCards.map((kpi, index) => (
          <div
            key={index}
            className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                kpi.color === 'blue' && 'bg-blue-50 group-hover:bg-blue-100',
                kpi.color === 'green' && 'bg-green-50 group-hover:bg-green-100',
                kpi.color === 'purple' && 'bg-purple-50 group-hover:bg-purple-100',
                kpi.color === 'red' && 'bg-red-50 group-hover:bg-red-100'
              )}>
                <AppIcon
                  name={kpi.icon}
                  size="dashboard"
                  className={cn(
                    kpi.color === 'blue' && 'text-blue-700',
                    kpi.color === 'green' && 'text-green-700',
                    kpi.color === 'purple' && 'text-purple-700',
                    kpi.color === 'red' && 'text-red-700'
                  )}
                />
              </div>
              <div className="h-2 w-16 bg-gray-50 rounded-full overflow-hidden">
                <div className={cn(
                  'h-full rounded-full',
                  kpi.color === 'blue' && 'bg-blue-600 w-3/4',
                  kpi.color === 'green' && 'bg-green-600 w-1/2',
                  kpi.color === 'purple' && 'bg-purple-600 w-1/4',
                  kpi.color === 'red' && 'bg-red-600 w-full'
                )} />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                {kpi.title}
              </p>
              <p className="text-3xl font-black text-gray-900 mb-1">
                {loading ? '...' : kpi.value}
              </p>
              <div className="flex items-center space-x-2">
                <span className={cn(
                  'text-[10px] font-bold px-1.5 py-0.5 rounded uppercase',
                  kpi.color === 'blue' && 'bg-blue-50 text-blue-700',
                  kpi.color === 'green' && 'bg-green-50 text-green-700',
                  kpi.color === 'purple' && 'bg-purple-50 text-purple-700',
                  kpi.color === 'red' && 'bg-red-50 text-red-700'
                )}>
                  {kpi.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pilotage ORION */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-blue-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                  <AppIcon name="sparkles" size="dashboard" className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Vigilance ORION</h2>
                  <p className="text-blue-100 text-sm">Analyse prédictive de la session d'examen</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-5">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-3 text-white">Status Composition</p>
                  <p className="text-sm leading-relaxed text-white">
                    Le taux de présence global est de **98.4%**. Aucun incident majeur n'a été signalé dans les 42 centres actifs.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-5">
                  <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-3 text-white">Alerte Logistique</p>
                  <p className="text-sm leading-relaxed text-white text-white">
                    Alerte : Le centre "Littoral A" signale une rupture imminente de copies de réserve. Livraison urgente prévue à 14h.
                  </p>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-white">
                <p className="text-sm font-medium text-blue-100">Dernière analyse effectuée il y a 12 minutes.</p>
                <button className="text-sm font-bold bg-white text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                  Consulter le Rapport ORION
                </button>
              </div>
            </div>
            
            {/* Décoration fond */}
            <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-700/30 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl" />
          </div>

          {/* Recent Compositions (Module 10) */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Compositions Récentes</h3>
              <button className="text-sm font-bold text-blue-700 hover:text-blue-900">Tout voir</button>
            </div>
            <div className="divide-y divide-gray-50">
              {[1, 2, 3].map((item) => (
                <div key={item} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center font-bold text-gray-500">
                      C{item}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Épreuve de Mathématiques - CEP</p>
                      <p className="text-xs text-gray-500">16 Centres • 4,500 candidats • Terminé</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded">99% Présence</p>
                    <p className="text-[10px] text-gray-400 mt-1">Il y a 2 heures</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Actions & Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-6">Actions Rapides</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'École', icon: 'building', color: 'blue' },
                { label: 'Examen', icon: 'exams', color: 'purple' },
                { label: 'Candidat', icon: 'scolarite', color: 'green' },
                { label: 'Centre', icon: 'classes', color: 'orange' },
              ].map((action, i) => (
                <button key={i} className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl border border-transparent hover:border-blue-200 hover:bg-blue-50 transition-all group">
                  <AppIcon name={action.icon as any} size="menu" className="text-gray-400 group-hover:text-blue-700 mb-2" />
                  <span className="text-[11px] font-bold text-gray-600 group-hover:text-blue-900 uppercase">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gold-500 to-gold-700 rounded-xl p-6 text-white shadow-lg shadow-gold-500/20">
            <div className="flex items-center space-x-3 mb-4">
              <AppIcon name="finance" size="menu" className="text-white" />
              <h3 className="font-bold uppercase tracking-widest text-xs">Abonnement Federis</h3>
            </div>
            <p className="text-2xl font-black mb-1">PLAN ENTERPRISE</p>
            <p className="text-sm text-gold-100 font-medium mb-6">Valide jusqu'au 31/12/2026</p>
            <button className="w-full py-2.5 bg-white text-gold-700 rounded-lg text-sm font-bold shadow-md hover:bg-gold-50 transition-all">
              Gérer l'abonnement
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

