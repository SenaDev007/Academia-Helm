'use client';

import { useState, useEffect } from 'react';
import { Loader2, Search, Users, Download } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { formatCurrency } from '@/lib/utils';

export function StaffFiscalManagement() {
  const { tenant } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PERMANENT' | 'VACATAIRE'>('ALL');

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('taxes/staff-fiscal', { tenantId: tenant.id }));
        setStaff(Array.isArray(res) ? res : []);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenant?.id]);

  const filtered = staff.filter(s => {
    const matchSearch = `${s.firstName} ${s.lastName} ${s.position || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || s.staffType === filter;
    return matchSearch && matchFilter;
  });

  const totalSalary = filtered.reduce((sum, s) => sum + (s.salary || 0), 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">Gestion du personnel</h3>
          <p className="text-xs text-slate-500 mt-0.5">Annuaire fiscal : personnels permanents et vacataires</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2">
            <p className="text-xs text-slate-500">Effectif</p>
            <p className="text-lg font-bold text-slate-900">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2">
            <p className="text-xs text-slate-500">Masse salariale</p>
            <p className="text-lg font-bold text-[#1A2BA6]">{formatCurrency(totalSalary)}</p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['ALL', 'PERMANENT', 'VACATAIRE'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filter === f ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500'}`}>
              {f === 'ALL' ? 'Tous' : f === 'PERMANENT' ? 'Permanents' : 'Vacataires'}
            </button>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Nom & Prénoms</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Fonction</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Diplôme</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Sit. Matrim.</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Enfants</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">N° CNSS</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">N° IFU</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600">Salaire</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Embauche</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                <td className="px-4 py-3">
                  <div className="font-bold text-slate-900">{s.firstName} {s.lastName}</div>
                  <div className="text-xs text-slate-400">{s.tenantMatricule || s.employeeNumber || 'N/A'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.position || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${s.staffType === 'PERMANENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {s.staffType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.diploma || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.maritalStatus || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.numberOfChildren ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{s.cnssNumber || '—'}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{s.ifuNumber || '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(s.salary || 0)}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-12 text-slate-400">Aucun personnel trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
