/**
 * ORION Alerts Component
 * 
 * Composant pour afficher les alertes ORION
 */

'use client';

import type { OrionAlert } from '@/types';
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { acknowledgeOrionAlert } from '@/services/orion.service';

interface OrionAlertsProps {
  alerts: OrionAlert[];
  onAcknowledge?: (alertId: string) => void;
}

export default function OrionAlerts({ alerts, onAcknowledge }: OrionAlertsProps) {
  const getAlertLevelConfig = (level: string) => {
    switch (level) {
      case 'CRITIQUE':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'ATTENTION':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
        };
      case 'INFO':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
        };
      default:
        return {
          icon: Info,
          bgColor: 'bg-cloud',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  async function handleAcknowledge(alertId: string) {
    try {
      await acknowledgeOrionAlert(alertId);
      if (onAcknowledge) {
        onAcknowledge(alertId);
      }
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
        <p className="text-graphite-700 text-sm">Aucune alerte en cours</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => {
        const config = getAlertLevelConfig(alert.level);
        const Icon = config.icon;
        return (
          <div
            key={alert.id}
            className={`rounded-lg p-5 border-2 ${config.bgColor} ${config.borderColor}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <Icon className={`w-6 h-6 ${config.iconColor}`} />
                  <h3 className={`font-semibold text-lg ${config.textColor}`}>
                    {alert.title}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded ${config.borderColor} ${config.textColor} bg-white`}>
                    {alert.level}
                  </span>
                </div>

                {/* Faits */}
                {alert.facts.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-graphite-700 mb-2 uppercase tracking-wide">
                      Faits Observés
                    </p>
                    <ul className="space-y-1">
                      {alert.facts.map((fact, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-sm text-graphite-700">
                          <div className="w-1.5 h-1.5 bg-gold-500 rounded-full mt-2 flex-shrink-0" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interprétation */}
                <p className={`text-sm ${config.textColor} mb-3`}>
                  {alert.interpretation}
                </p>

                {/* Vigilance */}
                <p className={`text-sm font-medium ${config.textColor}`}>
                  {alert.vigilance}
                </p>
              </div>

              {!alert.acknowledgedAt && (
                <button
                  onClick={() => handleAcknowledge(alert.id)}
                  className="ml-4 p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                  title="Acquitter l'alerte"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

