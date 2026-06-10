/**
 * FederisConnectNotices Component
 * 
 * Gestion des communiqués officiels et notes de service
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Notice {
  id: string;
  title: string;
  content: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  requiresAcknowledgement: boolean;
  sentAt: string;
  patronatName: string;
  isRead: boolean;
  isAcknowledged: boolean;
}

export default function FederisConnectNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulation
    setTimeout(() => {
      setNotices([
        {
          id: '1',
          title: 'Calendrier Définitif BEPC 2024',
          content: 'Le calendrier des épreuves écrites et orales a été validé par le conseil supérieur...',
          priority: 'URGENT',
          requiresAcknowledgement: true,
          sentAt: new Date().toISOString(),
          patronatName: 'Bureau National',
          isRead: false,
          isAcknowledged: false
        },
        {
          id: '2',
          title: 'Note de service relative aux correcteurs',
          content: 'Tous les correcteurs doivent se présenter au centre de délibération le 15 juin...',
          priority: 'IMPORTANT',
          requiresAcknowledgement: true,
          sentAt: new Date(Date.now() - 86400000).toISOString(),
          patronatName: 'Département Littoral',
          isRead: true,
          isAcknowledged: true
        }
      ]);
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter italic">Communiqués Officiels</h3>
        <button className="px-6 py-2.5 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-2">
          <AppIcon name="document" size="menu" />
          Nouveau Communiqué
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {notices.map(notice => (
          <div key={notice.id} className={cn(
            "bg-white rounded-3xl border p-8 transition-all relative overflow-hidden",
            notice.priority === 'URGENT' ? "border-red-100 shadow-red-900/5 shadow-2xl" : "border-gray-100 shadow-xl"
          )}>
            {notice.priority === 'URGENT' && (
              <div className="absolute top-0 right-0 p-3">
                <span className="bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full animate-pulse">URGENT</span>
              </div>
            )}
            
            <div className="flex items-center space-x-3 mb-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                notice.priority === 'URGENT' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
              )}>
                <AppIcon name="document" size="dashboard" />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{notice.patronatName}</p>
                <p className="text-[9px] font-bold text-gray-400">{new Date(notice.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <h4 className="text-lg font-black text-gray-900 mb-4 leading-tight">{notice.title}</h4>
            <p className="text-sm text-gray-500 font-medium mb-8 line-clamp-3 leading-relaxed">
              {notice.content}
            </p>

            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
               {notice.requiresAcknowledgement && !notice.isAcknowledged ? (
                 <button className="px-6 py-3 bg-blue-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 transition-all">
                   Accuser Réception
                 </button>
               ) : notice.isAcknowledged ? (
                 <div className="flex items-center space-x-2 text-green-600">
                    <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center">
                      <AppIcon name="sparkles" size="menu" className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Réception Accusée</span>
                 </div>
               ) : (
                 <div className="w-1" />
               )}
               <button className="text-blue-900 font-black text-xs hover:underline">Consulter le PDF</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
