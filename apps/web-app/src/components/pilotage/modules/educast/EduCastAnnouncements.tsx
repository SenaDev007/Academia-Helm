/**
 * ============================================================================
 * EDUCAST ANNOUNCEMENTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Megaphone, Calendar, Users, Eye, MoreHorizontal, Plus, Bell, MessageSquare } from 'lucide-react';

export default function EduCastAnnouncements() {
  const announcements = [
    { id: 1, title: 'Message de rentrée du Directeur', author: 'Directeur Général', target: 'Parents & Élèves', date: '15/05/2026', views: 1250, important: true },
    { id: 2, title: 'Consignes de sécurité - Labo Sciences', author: 'Resp. Labo', target: 'Élèves Secondaire', date: '14/05/2026', views: 450, important: false },
    { id: 3, title: 'Webinaire Orientation : Rappel', author: 'Orientation', target: 'Terminales', date: '12/05/2026', views: 890, important: true },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Megaphone className="w-6 h-6 mr-3 text-amber-600" />
            Publications & Annonces
          </h3>
          <p className="text-slate-500 text-sm font-medium">Communiquez officiellement via des formats audio/vidéo.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10">
          Créer une Annonce
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {announcements.map((ann, i) => (
          <motion.div
            key={ann.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white rounded-3xl border p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${
              ann.important ? 'border-amber-200 border-l-8 border-l-amber-500' : 'border-slate-200 border-l-8 border-l-blue-500'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="flex items-center gap-8 flex-1">
                <div className={`p-5 rounded-2xl ${ann.important ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  <Bell className="w-8 h-8" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[8px] font-black uppercase tracking-widest rounded-md">{ann.date}</span>
                    {ann.important && <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest animate-pulse">IMPORTANT</span>}
                  </div>
                  <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{ann.title}</h4>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Cible: {ann.target}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Par {ann.author}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900">{ann.views}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vues</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl transition-all">
                    <Eye className="w-5 h-5" />
                  </button>
                  <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl transition-all">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
