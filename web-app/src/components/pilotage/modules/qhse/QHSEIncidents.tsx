/**
 * ============================================================================
 * QHSE INCIDENT REGISTER
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Clock, User, Shield, Search, Filter, Plus, ChevronRight, Eye } from 'lucide-react';

export default function QHSEIncidents() {
  const incidents = [
    { id: 'INC-001', type: 'Accident élève', gravity: 'URGENCE', location: 'Terrain de sport', person: 'Jean Bakary (3ème)', date: '15/05/2026', status: 'DECLARE' },
    { id: 'INC-002', type: 'Chute escalier', gravity: 'IMPORTANT', location: 'Bâtiment C', person: 'Mme Koffi (Enseignante)', date: '14/05/2026', status: 'TRAITEMENT' },
    { id: 'INC-003', type: 'Fuite d\'eau', gravity: 'FAIBLE', location: 'Sanitaires garçons', person: 'Service Entretien', date: '14/05/2026', status: 'RESOLU' },
    { id: 'INC-004', type: 'Conflit physique', gravity: 'IMPORTANT', location: 'Cour de récréation', person: 'Groupe d\'élèves', date: '12/05/2026', status: 'CLOTURE' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher un incident..." 
              className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
            />
          </div>
          <button className="p-3.5 bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-2xl transition-all border border-transparent hover:border-emerald-100">
            <Filter className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-6 py-3.5 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all">
            Urgence Signalée (0)
          </button>
        </div>
      </div>

      {/* Incident List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              <th className="px-8 py-5">ID / Type</th>
              <th className="px-8 py-5">Gravité</th>
              <th className="px-8 py-5">Lieu / Personne</th>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {incidents.map((incident, i) => (
              <motion.tr
                key={incident.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${
                      incident.gravity === 'URGENCE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{incident.type}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{incident.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                    incident.gravity === 'URGENCE' ? 'bg-rose-50 text-rose-600' : 
                    incident.gravity === 'IMPORTANT' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {incident.gravity}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {incident.location}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                      <User className="w-3.5 h-3.5" /> {incident.person}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-5 text-xs font-bold text-slate-500 font-mono uppercase">{incident.date}</td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      incident.status === 'RESOLU' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      incident.status === 'DECLARE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {incident.status}
                    </span>
                    <button className="p-2.5 hover:bg-emerald-50 rounded-xl text-slate-300 hover:text-emerald-600 transition-all">
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
