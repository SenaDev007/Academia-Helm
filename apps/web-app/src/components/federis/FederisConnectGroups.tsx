/**
 * FederisConnectGroups Component
 * 
 * Gestion et exploration des groupes et communautés institutionnelles
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Group {
  id: string;
  name: string;
  description: string;
  type: 'OFFICIAL' | 'THEMATIC' | 'COMMUNITY';
  memberCount: number;
  isMember: boolean;
}

export default function FederisConnectGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation
    setTimeout(() => {
      setGroups([
        {
          id: 'g1',
          name: 'Comité de Pilotage BAC 2024',
          description: 'Espace de coordination stratégique pour les épreuves du Baccalauréat.',
          type: 'OFFICIAL',
          memberCount: 24,
          isMember: true
        },
        {
          id: 'g2',
          name: 'Directeurs du Littoral',
          description: 'Forum d\'échange entre les chefs d\'établissement du département.',
          type: 'OFFICIAL',
          memberCount: 156,
          isMember: true
        },
        {
          id: 'c1',
          name: 'Communauté des Professeurs de Français',
          description: 'Partage de ressources pédagogiques et de bonnes pratiques.',
          type: 'COMMUNITY',
          memberCount: 450,
          isMember: false
        },
        {
          id: 'g3',
          name: 'Commission d\'Appel des Examens',
          description: 'Gestion des litiges et des demandes de révision de notes.',
          type: 'THEMATIC',
          memberCount: 12,
          isMember: false
        }
      ]);
      setLoading(false);
    }, 700);
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">Groupes & Communautés</h3>
          <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Rejoignez des espaces de collaboration spécialisés</p>
        </div>
        <button className="px-6 py-2.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2">
          <AppIcon name="group" size="menu" />
          Créer un Groupe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map(group => (
          <div key={group.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-xl hover:shadow-2xl transition-all group overflow-hidden relative">
            <div className={cn(
              "absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16 transition-all group-hover:scale-150",
              group.type === 'OFFICIAL' ? "bg-blue-50/50" : group.type === 'COMMUNITY' ? "bg-purple-50/50" : "bg-orange-50/50"
            )} />
            
            <div className="relative z-10">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg",
                group.type === 'OFFICIAL' ? "bg-blue-900 text-white" : group.type === 'COMMUNITY' ? "bg-purple-900 text-white" : "bg-orange-900 text-white"
              )}>
                <AppIcon name={group.type === 'COMMUNITY' ? 'scolarite' : 'group'} size="dashboard" />
              </div>

              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={cn(
                    "text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest",
                    group.type === 'OFFICIAL' ? "bg-blue-50 text-blue-700" : group.type === 'COMMUNITY' ? "bg-purple-50 text-purple-700" : "bg-orange-50 text-orange-700"
                  )}>
                    {group.type}
                  </span>
                  <span className="text-[10px] font-bold text-gray-400">• {group.memberCount} membres</span>
                </div>
                <h4 className="text-md font-black text-gray-900 mb-2 leading-tight">{group.name}</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-2">
                  {group.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                {group.isMember ? (
                  <button className="flex items-center space-x-2 text-green-600 text-[10px] font-black uppercase tracking-widest">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>Déjà Membre</span>
                  </button>
                ) : (
                  <button className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-black transition-all">
                    Rejoindre
                  </button>
                )}
                <button className="p-2 text-gray-400 hover:text-blue-900 transition-colors">
                  <AppIcon name="settings" size="menu" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
