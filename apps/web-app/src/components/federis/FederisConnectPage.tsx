/**
 * FederisConnectPage Component
 * 
 * Espace Federis Connect - Communication Institutionnelle
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import FederisConnectFeed from '@/components/federis/FederisConnectFeed';
import FederisConnectMessaging from '@/components/federis/FederisConnectMessaging';
import FederisConnectNotices from '@/components/federis/FederisConnectNotices';
import FederisConnectGroups from '@/components/federis/FederisConnectGroups';
import FederisConnectDocuments from '@/components/federis/FederisConnectDocuments';
import FederisConnectEvents from '@/components/federis/FederisConnectEvents';

export default function FederisConnectPage() {
  const [activeTab, setActiveTab] = useState<'FEED' | 'MESSAGES' | 'NOTICES' | 'GROUPS' | 'DOCS' | 'EVENTS'>('FEED');

  const tabs = [
    { id: 'FEED', name: 'Fil d\'actualité', icon: 'sparkles' },
    { id: 'MESSAGES', name: 'Messages', icon: 'scolarite' },
    { id: 'NOTICES', name: 'Communiqués', icon: 'document' },
    { id: 'GROUPS', name: 'Groupes', icon: 'group' },
    { id: 'DOCS', name: 'Documents', icon: 'folder' },
    { id: 'EVENTS', name: 'Événements', icon: 'exams' },
  ];

  return (
    <div className="space-y-8">
      {/* Header Premium */}
      <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-blue-950 p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="px-3 py-1 bg-blue-500/20 backdrop-blur-md border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                Institutional Network
              </div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-4">Federis Connect</h1>
            <p className="text-blue-100/70 font-medium max-w-2xl text-lg leading-relaxed">
              Le réseau professionnel sécurisé pour la coordination entre patronats, écoles et responsables d'examens.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right hidden md:block">
              <p className="text-3xl font-black">1.2k</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Utilisateurs Actifs</p>
            </div>
            <div className="w-px h-12 bg-white/10 mx-2" />
            <button className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl border border-white/10 transition-all group">
              <AppIcon name="settings" size="dashboard" className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Subtile */}
        <div className="flex items-center space-x-1 mt-12 bg-black/20 p-1.5 rounded-2xl backdrop-blur-md w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3",
                activeTab === tab.id 
                  ? "bg-white text-blue-900 shadow-xl" 
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
            >
              <AppIcon name={tab.icon as any} size="menu" className={cn("w-4 h-4", activeTab === tab.id ? "text-blue-900" : "text-white/40")} />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'FEED' && <FederisConnectFeed />}
        {activeTab === 'MESSAGES' && <FederisConnectMessaging />}
        {activeTab === 'NOTICES' && <FederisConnectNotices />}
        {activeTab === 'GROUPS' && <FederisConnectGroups />}
        {activeTab === 'DOCS' && <FederisConnectDocuments />}
        {activeTab === 'EVENTS' && <FederisConnectEvents />}
      </div>
    </div>
  );
}
