/**
 * FederisConnectMessaging Component
 * 
 * Messagerie institutionnelle haute performance
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title?: string;
  participants: any[];
  messages: any[];
  lastMessageAt: string;
}

export default function FederisConnectMessaging() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation
    setTimeout(() => {
      setConversations([
        {
          id: 'conv1',
          title: 'Coordination Examens BEPC',
          participants: [{ user: { firstName: 'Jean', lastName: 'Dupont' } }],
          messages: [{ content: 'Bonjour, avez-vous validé les listes ?' }],
          lastMessageAt: new Date().toISOString()
        },
        {
          id: 'conv2',
          title: 'Patronat ↔ École Les Élites',
          participants: [{ user: { firstName: 'Marie', lastName: 'Sossa' } }],
          messages: [{ content: 'Le virement a été effectué.' }],
          lastMessageAt: new Date(Date.now() - 3600000).toISOString()
        }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex h-[600px]">
      {/* Sidebar Conversations */}
      <div className="w-80 border-r border-gray-100 flex flex-col bg-gray-50/30">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900">Conversations</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Institutional Inbox</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv.id)}
              className={cn(
                "w-full p-4 rounded-2xl text-left transition-all flex items-center space-x-3",
                activeConv === conv.id ? "bg-blue-900 text-white shadow-lg" : "hover:bg-white hover:shadow-md"
              )}
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", activeConv === conv.id ? "bg-white/20" : "bg-blue-50 text-blue-700")}>
                {conv.title?.[0] || 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black truncate">{conv.title || 'Conversation'}</p>
                <p className={cn("text-[10px] font-medium truncate mt-0.5", activeConv === conv.id ? "text-white/70" : "text-gray-400")}>
                  {conv.messages[0]?.content}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {activeConv ? (
          <>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-700">
                   {conversations.find(c => c.id === activeConv)?.title?.[0]}
                 </div>
                 <h4 className="text-sm font-black text-gray-900">{conversations.find(c => c.id === activeConv)?.title}</h4>
               </div>
               <div className="flex space-x-2">
                 <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"><AppIcon name="document" size="menu" /></button>
                 <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-400"><AppIcon name="settings" size="menu" /></button>
               </div>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
               {/* Simulation messages */}
               <div className="flex justify-start">
                 <div className="bg-gray-100 p-4 rounded-2xl rounded-tl-none max-w-[70%]">
                    <p className="text-xs font-medium text-gray-700">Bonjour, avez-vous validé les listes de candidats pour le centre de Cotonou ?</p>
                    <span className="text-[8px] font-bold text-gray-400 mt-2 block">10:45</span>
                 </div>
               </div>
               <div className="flex justify-end">
                 <div className="bg-blue-900 p-4 rounded-2xl rounded-tr-none max-w-[70%]">
                    <p className="text-xs font-medium text-white">Oui, c'est fait. Nous attendons maintenant le retour du bureau national.</p>
                    <span className="text-[8px] font-bold text-white/50 mt-2 block">10:47 • LU</span>
                 </div>
               </div>
            </div>
            <div className="p-6 border-t border-gray-100">
               <div className="relative">
                 <input 
                  type="text" 
                  placeholder="Écrivez votre message institutionnel..." 
                  className="w-full pl-6 pr-20 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 outline-none transition-all"
                 />
                 <button className="absolute right-3 top-2 bottom-2 px-4 bg-blue-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md">
                    Envoyer
                 </button>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
              <AppIcon name="scolarite" size="large" className="text-blue-900" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Messagerie Institutionnelle</h3>
            <p className="text-gray-400 font-medium max-w-sm">Sélectionnez une conversation pour échanger avec vos collaborateurs, les écoles ou le patronat.</p>
          </div>
        )}
      </div>
    </div>
  );
}
