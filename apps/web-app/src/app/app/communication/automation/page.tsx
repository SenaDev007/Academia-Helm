/**
 * ============================================================================
 * COMMUNICATION MODULE - AUTOMATION PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, ToggleLeft, ToggleRight, Edit, Trash2, Activity } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function AutomationPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch triggers from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Automatisation"
        description="Configurer des déclencheurs automatiques pour les messages (absences, impayés, incidents, etc.)."
        icon="communication"
      />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-800">Déclencheurs automatisés</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nouveau déclencheur
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Chargement...</div>
          ) : triggers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>Aucun déclencheur automatisé pour le moment.</p>
              <button className="mt-4 text-blue-600 hover:underline">
                Créer votre premier déclencheur
              </button>
            </div>
          ) : (
            triggers.map((trigger) => (
              <div key={trigger.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-800 capitalize">{trigger.triggerType}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Canal: {trigger.channel?.name || trigger.channelId}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Activity className="w-4 h-4" />
                    <span>{trigger.triggerCount} exécutions</span>
                  </div>
                  <button className="text-gray-600 hover:text-gray-800">
                    {trigger.isActive ? (
                      <ToggleRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

