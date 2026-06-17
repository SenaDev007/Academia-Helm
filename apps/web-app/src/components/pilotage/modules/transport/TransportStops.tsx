'use client';

import { MapPin, Plus, Search, Filter, MoreVertical, Navigation, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface RouteStop {
  id?: string;
  name?: string;
  label?: string;
  zone?: string;
  zoneName?: string;
  students?: number;
  studentCount?: number;
  arrivalTime?: string;
  estimatedTime?: string;
  type?: string;
  stopType?: string;
  [key: string]: any;
}

interface RouteItem {
  id: string;
  name?: string;
  stops?: RouteStop[] | number;
  stopsList?: RouteStop[];
  [key: string]: any;
}

export default function TransportStops() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<RouteItem>('transport', 'routes', academicYear?.id);

  // Les arrêts sont imbriqués dans les routes — on les aplatit
  const routes = data ?? [];
  const stops: (RouteStop & { routeId?: string; routeName?: string })[] = routes.flatMap((route) => {
    const stopList: RouteStop[] = Array.isArray(route.stops) ? route.stops : (route.stopsList ?? []);
    return stopList.map((s, idx) => ({
      ...s,
      id: s.id ?? `${route.id}-${idx}`,
      routeId: route.id,
      routeName: route.name,
    }));
  });

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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un arrêt..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
            <Plus className="w-4 h-4" />
            Nouvel Arrêt
          </button>
        </div>
      </div>

      {stops.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Point d'arrêt</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zone</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Élèves</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stops.map((stop) => {
                  const name = stop.name || stop.label || `Arrêt ${stop.id}`;
                  const zone = stop.zone || stop.zoneName || stop.routeName || '—';
                  const students = stop.students ?? stop.studentCount ?? 0;
                  const arrivalTime = stop.arrivalTime || stop.estimatedTime || '—';
                  const type = stop.type || stop.stopType || 'QUARTIER';
                  return (
                    <tr key={stop.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-xl bg-navy-50 text-navy-900">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heure estimée: {arrivalTime}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-sm font-bold text-slate-700">{zone}</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {type}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-sm font-black text-navy-900 bg-navy-50 px-3 py-1 rounded-lg border border-navy-100">{students}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-slate-400 hover:text-navy-900 transition-colors">
                            <Navigation className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
