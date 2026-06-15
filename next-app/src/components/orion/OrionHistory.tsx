/**
 * ORION History Component
 * 
 * Composant pour afficher l'historique des analyses ORION
 */

'use client';

import type { OrionAnalysisHistory } from '@/types';
import { Shield, Clock } from 'lucide-react';

interface OrionHistoryProps {
  history: OrionAnalysisHistory[];
}

export default function OrionHistory({ history }: OrionHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="w-12 h-12 text-graphite-500 mx-auto mb-4" />
        <p className="text-graphite-700 text-sm">Aucun historique disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item) => (
        <div key={item.id} className="bg-cloud rounded-lg p-5 border border-gray-200">
          <div className="flex items-start space-x-4">
            <Shield className="w-5 h-5 text-gold-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">{item.content.title}</h3>
                <span className="text-xs text-graphite-500">
                  {new Date(item.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>

              {item.content.facts.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-graphite-700 mb-1 uppercase tracking-wide">
                    Faits
                  </p>
                  <ul className="space-y-1">
                    {item.content.facts.map((fact, idx) => (
                      <li key={idx} className="text-xs text-graphite-700 flex items-start space-x-2">
                        <div className="w-1 h-1 bg-gold-500 rounded-full mt-1.5 flex-shrink-0" />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm text-graphite-700 mb-2">{item.content.interpretation}</p>

              {item.content.vigilance && (
                <p className="text-sm font-medium text-orange-700">{item.content.vigilance}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

