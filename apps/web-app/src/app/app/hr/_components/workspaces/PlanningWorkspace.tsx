'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Clock, Search, User, Filter, AlertCircle, Plus, Sparkles, PlusCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const SHIFTS = [
  { name: 'Matin', time: '08:00 - 12:00' },
  { name: 'Après-midi', time: '14:00 - 18:00' },
];

export function PlanningWorkspace() {
  const { tenant } = useModuleContext();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom roster assignments stored in state
  const [assignments, setAssignments] = useState<Record<string, string>>({
    'Lundi-Matin': 'PEDAGOGICAL',
    'Mardi-Matin': 'ADMIN',
    'Mercredi-Après-midi': 'SUPPORT',
  });

  useEffect(() => {
    async function loadStaff() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const data = await apiFetch<any[]>(`/hr/staff?tenantId=${tenant.id}`);
        setStaffList(data);
      } catch (err) {
        console.error('Error loading staff for planning:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
  }, [tenant?.id]);

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* KPI banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" /> Planning Hebdomadaire
          </h3>
          <p className="text-sm text-blue-100 mt-1">
            Organisez la répartition et les rôles de garde des collaborateurs par plages horaires.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">Collaborateurs actifs</p>
            <p className="text-lg font-bold mt-0.5">{staffList.length}</p>
          </div>
        </div>
      </div>

      {/* Roster Calendar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Grille de Garde / Permanence
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-5 py-3 text-slate-500 font-semibold w-40">Horaires</th>
                {DAYS_OF_WEEK.map((day) => (
                  <th key={day} className="px-5 py-3 text-slate-500 font-semibold">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SHIFTS.map((shift) => (
                <tr key={shift.name}>
                  <td className="px-5 py-4 font-semibold text-slate-800 bg-slate-50/20">
                    <div className="text-sm">{shift.name}</div>
                    <div className="text-xs text-slate-400 font-normal mt-0.5">{shift.time}</div>
                  </td>
                  {DAYS_OF_WEEK.map((day) => {
                    const key = `${day}-${shift.name}`;
                    const assignedCat = assignments[key];
                    return (
                      <td key={day} className="px-5 py-4">
                        <select
                          className={cn(
                            'text-xs font-semibold rounded-lg px-2.5 py-1.5 border focus:outline-none w-full shadow-sm transition',
                            assignedCat === 'PEDAGOGICAL' && 'bg-blue-50 text-blue-700 border-blue-200',
                            assignedCat === 'ADMIN' && 'bg-purple-50 text-purple-700 border-purple-200',
                            assignedCat === 'SUPPORT' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                            !assignedCat && 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                          )}
                          value={assignedCat || ''}
                          onChange={(e) => {
                            setAssignments({ ...assignments, [key]: e.target.value });
                          }}
                        >
                          <option value="">-- Non assigné --</option>
                          <option value="PEDAGOGICAL">Corps Enseignant</option>
                          <option value="ADMIN">Administration</option>
                          <option value="SUPPORT">Personnel d'appui</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff directory for quick reference */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h4 className="font-bold text-slate-900 text-sm">Disponibilité du Personnel</h4>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrer par nom..."
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="ALL">Toutes catégories</option>
              <option value="PEDAGOGICAL">Enseignants</option>
              <option value="ADMIN">Administratifs</option>
              <option value="SUPPORT">Appui</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-lg" />)
          ) : filteredStaff.length === 0 ? (
            <p className="text-sm text-slate-400 col-span-full text-center py-6">Aucun collaborateur trouvé</p>
          ) : (
            filteredStaff.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold font-mono">
                    {s.firstName?.[0]}{s.lastName?.[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{s.firstName} {s.lastName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.position || 'Général'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  Actif
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
