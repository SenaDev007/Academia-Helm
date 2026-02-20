/**
 * ============================================================================
 * COMMUNICATION MODULE - CHANNELS PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, MessageCircle, Bell, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function ChannelsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch channels from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  const getChannelIcon = (code: string) => {
    switch (code) {
      case 'SMS':
        return <MessageCircle className="w-5 h-5" />;
      case 'EMAIL':
        return <Mail className="w-5 h-5" />;
      case 'WHATSAPP':
        return <MessageCircle className="w-5 h-5" />;
      case 'PUSH':
        return <Bell className="w-5 h-5" />;
      default:
        return <MessageCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Canaux de communication"
        description="Gérer les canaux de communication disponibles (SMS, Email, WhatsApp, Push)."
        icon="communication"
      />
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">Chargement...</div>
          ) : channels.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              <p>Aucun canal configuré pour le moment.</p>
            </div>
          ) : (
            channels.map((channel) => (
              <div key={channel.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {getChannelIcon(channel.code)}
                    <h4 className="font-semibold text-gray-800">{channel.name}</h4>
                  </div>
                  <button className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Code: {channel.code}</span>
                  <button className="text-gray-600 hover:text-gray-800">
                    {channel.isActive ? (
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

