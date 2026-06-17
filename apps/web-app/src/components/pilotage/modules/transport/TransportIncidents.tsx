'use client';

import { AlertTriangle, Plus, Search, Filter, MoreVertical, MessageSquare, ShieldAlert, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface IncidentItem {
  id: string;
  type?: string;
  incidentType?: string;
  title?: string;
  vehicle?: string;
  vehicleName?: string;
  date?: string;
  incidentDate?: string;
  severity?: string;
  status?: string;
  desc?: string;
  description?: string;
  [key: string]: any;
}

export default function TransportIncidents() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<IncidentItem>('transport', 'incidents', academicYear?.id);

  const incidents = data ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-rose-600" /> Gestion des incidents
        </h3>
        <button className="flex items-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20">
          <Plus className="w-4 h-4" /> Signaler un incident
        </button>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {incidents.map((incident) => {
            const type = incident.type || incident.incidentType || incident.title || `Incident ${incident.id}`;
            const vehicle = incident.vehicle || incident.vehicleName || '—';
            const date = incident.date || incident.incidentDate;
            const severity = incident.severity || 'MEDIUM';
            const status = incident.status || 'OPEN';
            const desc = incident.desc || incident.description || '';
            return (
              <div key={incident.id} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        severity === 'HIGH' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {severity} SEVERITY
                      </span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        {status}
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase mb-2">{type}</h4>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">{desc}</p>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Véhicule:</p>
                        <p className="text-xs font-black text-slate-900">{vehicle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date:</p>
                        <p className="text-xs font-black text-slate-900">{date ? new Date(date).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col justify-end gap-3 shrink-0">
                    <button className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
                      <MessageSquare className="w-4 h-4" /> Contacter
                    </button>
                    <button className="flex items-center justify-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
                      Détails & Résolution
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
