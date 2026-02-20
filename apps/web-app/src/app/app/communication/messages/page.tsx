/**
 * ============================================================================
 * COMMUNICATION MODULE - MESSAGES PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Send, Archive } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function MessagesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch messages from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Messages"
        description="Gérer et envoyer des messages aux parents, élèves et personnel."
        icon="communication"
      />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Rechercher un message..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              Filtrer
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Nouveau message
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800">Liste des messages</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun message pour le moment.</p>
                <button className="mt-4 text-blue-600 hover:underline">
                  Créer votre premier message
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-gray-800">{message.subject}</h4>
                        <p className="text-sm text-gray-600 mt-1">{message.content}</p>
                        <div className="flex gap-4 mt-2 text-xs text-gray-500">
                          <span>Type: {message.messageType}</span>
                          <span>Statut: {message.status}</span>
                          <span>Envoyé: {new Date(message.sentAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                          <Send className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                          <Archive className="w-4 h-4" />
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

