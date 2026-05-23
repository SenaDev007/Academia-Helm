/**
 * ============================================================================
 * EDUCAST CHANNELS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { MonitorPlay, Users, Settings, Plus, ChevronRight, Star } from 'lucide-react';

export default function EduCastChannels() {
  const channels = [
    { id: 1, name: 'Academia Official', owner: 'Direction', contents: 124, subs: 1250, status: 'ACTIVE', color: 'bg-navy-900' },
    { id: 2, name: 'SVT - Secondaire', owner: 'M. Diallo', contents: 45, subs: 450, status: 'ACTIVE', color: 'bg-emerald-600' },
    { id: 3, name: 'English Corner', owner: 'Mme. Koffi', contents: 32, subs: 320, status: 'ACTIVE', color: 'bg-blue-600' },
    { id: 4, name: 'Maths Experts', owner: 'M. Lawson', contents: 67, subs: 600, status: 'ACTIVE', color: 'bg-rose-600' },
    { id: 5, name: 'Parents Info', owner: 'Communication', contents: 12, subs: 800, status: 'PRIVATE', color: 'bg-amber-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Chaînes EduCast</h3>
          <p className="text-slate-500 text-sm font-medium">Organisez vos contenus par thématiques ou services.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4 text-[#C9A84C]" />
          <span>Créer une Chaîne</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((channel, i) => (
          <motion.div
            key={channel.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group"
          >
            <div className={`absolute top-0 left-0 w-2 h-full ${channel.color}`} />
            
            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                  <MonitorPlay className={`w-8 h-8 ${channel.color.replace('bg-', 'text-')}`} />
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <Settings className="w-5 h-5 text-slate-300" />
                </button>
              </div>

              <div>
                <h4 className="text-xl font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{channel.name}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Responsable: {channel.owner}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-50">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contenus</p>
                  <p className="text-lg font-black text-slate-900">{channel.contents}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Abonnés</p>
                  <p className="text-lg font-black text-slate-900">{channel.subs}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                  channel.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {channel.status}
                </span>
                <button className="flex items-center text-blue-600 font-black text-[10px] uppercase tracking-widest hover:translate-x-1 transition-transform">
                  Ouvrir la chaîne
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
