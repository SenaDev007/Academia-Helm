/**
 * ============================================================================
 * MODULE 9 — MODULES COMPLÉMENTAIRES
 * ============================================================================
 * Page principale pour la gestion des modules complémentaires
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Utensils,
  Bus,
  BookOpen,
  FlaskConical,
  Heart,
  ShoppingBag,
  Video,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import Link from 'next/link';

export default function ModulesComplementairesPage() {
  const { academicYear } = useModuleContext();
  const [loading, setLoading] = useState(true);
  const [orionKPIs, setOrionKPIs] = useState<any>(null);
  const [orionAlerts, setOrionAlerts] = useState<any[]>([]);
  const [activeModules, setActiveModules] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [academicYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const academicYearId = academicYear?.id;

      if (academicYearId) {
        // Charger les KPIs ORION
        const kpisResponse = await fetch(
          `/api/modules-complementaires/orion/kpis?academicYearId=${academicYearId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (kpisResponse.ok) {
          const kpisData = await kpisResponse.json();
          setOrionKPIs(kpisData);
        }

        // Charger les alertes ORION
        const alertsResponse = await fetch(
          `/api/modules-complementaires/orion/alerts?academicYearId=${academicYearId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          setOrionAlerts(alertsData);
        }

        // TODO: Charger les modules activés depuis tenant-features
        // const featuresResponse = await fetch('/api/tenant-features?...');
        // if (featuresResponse.ok) {
        //   const features = await featuresResponse.json();
        //   setActiveModules(features.filter(f => f.isActive).map(f => f.moduleId));
        // }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading modules complementaires data:', error);
      setLoading(false);
    }
  };

  const modules = [
    {
      id: 'canteen',
      name: 'Cantine Scolaire',
      description: 'Gestion des menus, inscriptions et présences repas',
      icon: Utensils,
      path: '/app/canteen',
      color: 'bg-orange-100 text-orange-800 border-orange-300',
      kpi: orionKPIs?.canteen,
    },
    {
      id: 'transport',
      name: 'Transport Scolaire',
      description: 'Gestion des véhicules, itinéraires et affectations',
      icon: Bus,
      path: '/app/transport',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      kpi: orionKPIs?.transport,
    },
    {
      id: 'library',
      name: 'Bibliothèque',
      description: 'Gestion des ouvrages, emprunts et retours',
      icon: BookOpen,
      path: '/app/library',
      color: 'bg-purple-100 text-purple-800 border-purple-300',
      kpi: orionKPIs?.library,
    },
    {
      id: 'labs',
      name: 'Laboratoires',
      description: 'Gestion des équipements, réservations et maintenance',
      icon: FlaskConical,
      path: '/app/labs',
      color: 'bg-green-100 text-green-800 border-green-300',
      kpi: orionKPIs?.labs,
    },
    {
      id: 'infirmary',
      name: 'Infirmerie',
      description: 'Dossiers médicaux, consultations et alertes santé',
      icon: Heart,
      path: '/app/infirmary',
      color: 'bg-red-100 text-red-800 border-red-300',
      kpi: orionKPIs?.medical,
    },
    {
      id: 'shop',
      name: 'Boutique Scolaire',
      description: 'Gestion des produits, stocks et ventes',
      icon: ShoppingBag,
      path: '/app/shop',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      kpi: orionKPIs?.shop,
    },
    {
      id: 'educast',
      name: 'EduCast',
      description: 'Contenu pédagogique, streaming et diffusion',
      icon: Video,
      path: '/app/educast',
      color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      kpi: orionKPIs?.educast,
    },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Modules Complémentaires"
        description="Gestion des modules optionnels activables à la carte"
        icon="settings"
      />

      {/* Alertes ORION */}
      {orionAlerts.length > 0 && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-800">Alertes ORION</h3>
          </div>
          <div className="p-4 space-y-3">
            {orionAlerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-50 border-red-200'
                    : alert.severity === 'WARNING'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${alert.module === 'CANTINE' ? 'bg-orange-100 text-orange-800' : alert.module === 'TRANSPORT' ? 'bg-blue-100 text-blue-800' : alert.module === 'BIBLIOTHÈQUE' ? 'bg-purple-100 text-purple-800' : alert.module === 'LABORATOIRES' ? 'bg-green-100 text-green-800' : alert.module === 'INFIRMERIE' ? 'bg-red-100 text-red-800' : alert.module === 'BOUTIQUE' ? 'bg-yellow-100 text-yellow-800' : 'bg-indigo-100 text-indigo-800'}`}>
                        {alert.module}
                      </span>
                      <h4 className="font-semibold text-gray-800">{alert.title}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                    {alert.recommendation && (
                      <p className="text-xs text-gray-500 italic">
                        💡 {alert.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPIs ORION Globaux */}
      {orionKPIs && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            KPIs ORION - Vue d'ensemble
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {orionKPIs.canteen && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {orionKPIs.canteen.attendanceRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux présence cantine</div>
              </div>
            )}
            {orionKPIs.transport && (
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {orionKPIs.transport.occupancyRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux occupation transport</div>
              </div>
            )}
            {orionKPIs.library && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {orionKPIs.library.loanRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux emprunt bibliothèque</div>
              </div>
            )}
            {orionKPIs.labs && (
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {orionKPIs.labs.utilizationRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux utilisation labs</div>
              </div>
            )}
            {orionKPIs.medical && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {orionKPIs.medical.visitRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux visites médicales</div>
              </div>
            )}
            {orionKPIs.shop && (
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {(orionKPIs.shop.revenue / 1000).toFixed(0)}K
                </div>
                <div className="text-xs text-gray-600 mt-1">Revenus boutique (XOF)</div>
              </div>
            )}
            {orionKPIs.educast && (
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {orionKPIs.educast.completionRate?.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 mt-1">Taux complétion EduCast</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Liste des Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const Icon = module.icon;
          const isActive = activeModules.includes(module.id);

          return (
            <Link key={module.id} href={module.path}>
              <div
                className={`bg-white rounded-lg shadow-sm border-2 transition-all hover:shadow-md cursor-pointer ${
                  isActive ? module.color : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${isActive ? module.color : 'bg-gray-100'}`}>
                      <Icon className={`w-6 h-6 ${isActive ? 'text-current' : 'text-gray-600'}`} />
                    </div>
                    {isActive && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        Activé
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">{module.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                  {module.kpi && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">KPI principal:</span>
                        <span className="font-semibold text-gray-800">
                          {module.kpi.attendanceRate || module.kpi.occupancyRate || module.kpi.loanRate || module.kpi.utilizationRate || module.kpi.visitRate || module.kpi.revenue || module.kpi.completionRate || 'N/A'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Paramètres d'activation */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Activation des modules
          </h3>
          <Link
            href="/app/settings?tab=features"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Gérer les modules →
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Activez ou désactivez les modules complémentaires selon les besoins de votre établissement.
          Les modules inactifs ne sont pas accessibles mais les données sont conservées.
        </p>
      </div>
    </div>
  );
}

