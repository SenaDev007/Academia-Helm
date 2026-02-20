/**
 * ============================================================================
 * COMMUNICATION MODULE - SCHEDULING PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function SchedulingPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch scheduled messages from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SENT':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Planification des messages"
        description="Gérer les messages planifiés et leur statut d'envoi."
        icon="attendance"
      />
      <div className="p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Messages planifiés</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : scheduledMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun message planifié pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledMessages.map((scheduled) => (
                  <div key={scheduled.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(scheduled.status)}
                          <h4 className="font-semibold text-gray-800">
                            {scheduled.message?.subject || 'Sans objet'}
                          </h4>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{scheduled.message?.content}</p>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>Planifié: {new Date(scheduled.scheduledAt).toLocaleString()}</span>
                          {scheduled.sentAt && (
                            <span>Envoyé: {new Date(scheduled.sentAt).toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded">
                          Annuler
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

