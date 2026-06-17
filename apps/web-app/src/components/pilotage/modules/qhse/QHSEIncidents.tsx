/**
 * ============================================================================
 * QHSE INCIDENT REGISTER
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Clock, User, Shield, Search, Filter, Plus, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface IncidentItem {
  id: string;
  type?: string;
  title?: string;
  gravity?: string;
  severity?: string;
  location?: string;
  person?: string;
  date?: string;
  createdAt?: string;
  status?: string;
}

export default function QHSEIncidents() {
  const { academicYear } = useModuleContext();
  const { data: incidents, loading, error } = useModulesList<IncidentItem>('qhse', 'incidents', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des incidents...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

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

      {incidents.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucun incident enregistré pour cette année scolaire.
        </div>
      ) : (
        /* Incident List */
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
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
              {incidents.map((incident, i) => {
                const gravity = incident.gravity || incident.severity || 'FAIBLE';
                const type = incident.type || incident.title || 'Incident';
                const location = incident.location || '—';
                const person = incident.person || '—';
                const date = incident.date || (incident.createdAt ? new Date(incident.createdAt).toLocaleDateString('fr-FR') : '—');
                const status = incident.status || 'DECLARE';
                return (
                  <motion.tr
                    key={incident.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${
                          gravity === 'URGENCE' || gravity === 'CRITIQUE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                        }`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{type}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{incident.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                        gravity === 'URGENCE' || gravity === 'CRITIQUE' ? 'bg-rose-50 text-rose-600' : 
                        gravity === 'IMPORTANT' || gravity === 'HIGH' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {gravity}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {location}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                          <User className="w-3.5 h-3.5" /> {person}
                        </p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 font-mono uppercase">{date}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                          status === 'RESOLU' || status === 'CLOTURE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          status === 'DECLARE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          {status}
                        </span>
                        <button className="p-2.5 hover:bg-emerald-50 rounded-xl text-slate-300 hover:text-emerald-600 transition-all">
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
