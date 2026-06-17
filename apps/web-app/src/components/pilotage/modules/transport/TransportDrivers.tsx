'use client';

import { Users, Plus, Search, Mail, Phone, Calendar, ShieldCheck, MoreVertical, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface DriverItem {
  id: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string;
  license?: string;
  licenseTypes?: string;
  role?: string;
  expiry?: string;
  licenseExpiry?: string;
  status?: string;
  [key: string]: any;
}

export default function TransportDrivers() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesList<DriverItem>('transport', 'drivers', academicYear?.id);

  const drivers = data ?? [];

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
            placeholder="Rechercher un chauffeur ou accompagnateur..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
          <Plus className="w-4 h-4" />
          Nouveau Personnel
        </button>
      </div>

      {drivers.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Personnel</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Permis / Rôle</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiration</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((person) => {
                  const name = person.name || person.fullName || [person.firstName, person.lastName].filter(Boolean).join(' ') || `Personnel ${person.id}`;
                  const phone = person.phone || person.phoneNumber || '—';
                  const licenseOrRole = person.license || person.licenseTypes || person.role || '—';
                  const expiry = person.expiry || person.licenseExpiry;
                  const status = person.status || 'ACTIVE';
                  return (
                    <tr key={person.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-navy-900 group-hover:text-white transition-all font-black text-xs">
                            {name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: DRV-{String(person.id).padStart(3, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-600 flex items-center gap-2">
                            <Phone className="w-3 h-3 text-slate-400" /> {phone}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-bold text-slate-700 uppercase tracking-tighter">{licenseOrRole}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-sm font-medium text-slate-600">{expiry ? new Date(expiry).toLocaleDateString() : '—'}</p>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
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
