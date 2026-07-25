/**
 * ============================================================================
 * ORION ALERTS CARD
 * ============================================================================
 * 
 * Carte d'alertes ORION - Discrète, non envahissante
 * 
 * Philosophie : Alerter avant qu'il ne soit trop tard
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, ChevronRight, Brain } from 'lucide-react';
import Link from 'next/link';

interface OrionAlertsCardProps {
  academicYearId: string;
  schoolLevelId: string;
}

export default function OrionAlertsCard({ academicYearId, schoolLevelId }: OrionAlertsCardProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadAlerts = async () => {
      // Ne pas déclencher si pas d'année scolaire
      if (!academicYearId) return;
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/orion/alerts?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId || ''}&status=active&limit=3`,
          { cache: 'no-store' }
        );
        if (response.ok) {
          const data = await response.json();
          setAlerts(Array.isArray(data) ? data : (data?.items || []));
        } else {
          setAlerts([]);
        }
      } catch (error) {
        console.error('Failed to load ORION alerts:', error);
        setAlerts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlerts();
    const interval = setInterval(loadAlerts, 60000); // Toutes les minutes
    return () => clearInterval(interval);
  }, [academicYearId, schoolLevelId]);

  // Affichage initial discret (pas de animate-pulse infini)
  if (isLoading && alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="w-5 h-5 text-navy-900" />
          <h3 className="text-lg font-semibold text-navy-900">Analyse ORION</h3>
        </div>
        <div className="text-center py-6">
          <Brain className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Chargement des alertes…</p>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return null; // Ne rien afficher s'il n'y a pas d'alertes
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-navy-900" />
          <h3 className="text-lg font-semibold text-navy-900">Analyse ORION</h3>
        </div>
        <Link
          href="/app/orion/alerts"
          className="text-sm text-navy-600 hover:text-navy-900 font-medium flex items-center space-x-1"
        >
          <span>Voir l'analyse complète</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">{alert.title}</p>
                <p className="text-sm opacity-90">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

