/**
 * ============================================================================
 * QHSE SECURITE SCOLAIRE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { HardHat, Lock, ShieldCheck, Video, Users, Bell, Eye, Search, Plus, Map, Radio } from 'lucide-react';

export default function QHSESecurity() {
  const securityItems = [
    { id: 1, label: 'Contrôle Accès (Entrée)', status: 'OPERATIONNEL', icon: Lock, color: 'text-emerald-600', bg: 'bg-emerald-50', lastCheck: 'Aujourd\'hui, 07:45' },
    { id: 2, label: 'Système Vidéo (12/12)', status: 'OPERATIONNEL', icon: Video, color: 'text-emerald-600', bg: 'bg-emerald-50', lastCheck: 'Il y a 10min' },
    { id: 3, label: 'Alarmes Incendie', status: 'MAINTENANCE', icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50', lastCheck: 'Prévu : 16/05' },
    { id: 4, label: 'Éclairage Extérieur', status: 'ANOMALIE', icon: Eye, color: 'text-rose-600', bg: 'bg-rose-50', lastCheck: 'Signalé : Hier' },
  ];

  return (
    <div className="space-y-8">
      {/* Real-time Monitoring Bar */}
      <div className="bg-navy-900 text-white p-6 rounded-[2rem] flex items-center justify-between shadow-xl shadow-navy-900/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Système Live</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-white/60 uppercase tracking-widest border-l border-white/10 pl-6">
            <Radio className="w-4 h-4" /> 8 Agents en poste
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-white/60 uppercase tracking-widest border-l border-white/10 pl-6">
            <Users className="w-4 h-4" /> 45 Visiteurs déclarés
          </div>
        </div>
        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
          Accéder au Poste de Contrôle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {securityItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center text-center group hover:shadow-xl transition-all"
          >
            <div className={`p-5 rounded-3xl ${item.bg} ${item.color} mb-6 group-hover:scale-110 transition-transform`}>
              <item.icon className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{item.label}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">{item.lastCheck}</p>
            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
              item.status === 'OPERATIONNEL' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
              item.status === 'MAINTENANCE' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}>
              {item.status}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Visitors Log */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
              <Users className="w-6 h-6 mr-3 text-slate-400" /> Registre Visiteurs
            </h3>
            <button className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:underline">Voir Tout</button>
          </div>
          <div className="space-y-4">
            {[
              { id: 1, name: 'Jean Dupont', target: 'Mme Koffi', time: '08:15', type: 'Parent' },
              { id: 2, name: 'Saliou Service', target: 'Direction', time: '09:30', type: 'Fournisseur' },
              { id: 3, name: 'Amina Diallo', target: 'Secrétariat', time: '10:15', type: 'Ancien élève' },
            ].map((v) => (
              <div key={v.id} className="p-4 bg-slate-50/50 rounded-2xl flex items-center justify-between group cursor-pointer hover:bg-slate-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                    {v.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight">{v.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{v.type} • Rdv avec {v.target}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-900">{v.time}</p>
                  <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Entrée Validée</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Map Preview */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col justify-center items-center relative overflow-hidden shadow-xl shadow-slate-900/20 group">
          <Map className="w-24 h-24 mb-6 text-white/20 group-hover:scale-110 transition-transform" />
          <h3 className="text-2xl font-black uppercase tracking-tighter text-center">Plan d'Évacuation & Points Chauds</h3>
          <p className="text-sm font-medium text-white/40 mt-2 text-center max-w-xs">Visualisez l'état sécuritaire de chaque bâtiment en temps réel.</p>
          <button className="mt-8 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 transition-all">
            Ouvrir la Carte Interactive
          </button>
          <div className="absolute top-6 right-6 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[8px] font-black uppercase tracking-widest">
            3 Zones Sensibles
          </div>
        </div>
      </div>
    </div>
  );
}
