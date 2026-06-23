'use client';

import { useState, useEffect } from 'react';
import { Loader2, Search, Download, Phone, Mail, Save, Edit2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

export function StaffFiscalManagement() {
  const { tenant } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PERMANENT' | 'VACATAIRE'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

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

  function startEdit(s: any) {
    setEditingId(s.id);
    setEditForm({
      qualifications: s.qualifications || '',
      maritalStatus: s.maritalStatus || '',
      numberOfChildren: s.numberOfChildren ?? '',
      cnssNumber: s.cnssNumber || '',
      ifuNumber: s.ifuNumber || '',
      salary: s.salary || 0,
      notes: s.notes || '',
    });
  }

  async function saveEdit(staffId: string) {
    try {
      await hrFetch(hrUrl(`staff/${staffId}`, { tenantId: tenant?.id }), {
        method: 'PUT',
        body: editForm,
      });
      toast({ variant: 'success', title: 'Modifications enregistrées' });
      setStaff(prev => prev.map(s => s.id === staffId ? { ...s, ...editForm } : s));
      setEditingId(null);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    }
  }

  function exportExcel() {
    if (!tenant?.id) return;
    window.open(hrUrl('taxes/export/staff-fiscal', { tenantId: tenant.id }), '_blank');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const tdClass = "px-3 py-2.5 text-slate-700 text-sm whitespace-nowrap";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">Gestion du personnel</h3>
          <p className="text-xs text-slate-500 mt-0.5">Annuaire fiscal : personnels permanents et vacataires</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2">
            <p className="text-xs text-slate-500">Effectif</p>
            <p className="text-lg font-bold text-slate-900">{filtered.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-2">
            <p className="text-xs text-slate-500">Masse salariale</p>
            <p className="text-lg font-bold text-[#1A2BA6] whitespace-nowrap">{new Intl.NumberFormat('fr-FR').format(totalSalary)} FCFA</p>
          </div>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition whitespace-nowrap">
            <Download className="h-3.5 w-3.5" /> Export Excel
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['ALL', 'PERMANENT', 'VACATAIRE'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition whitespace-nowrap ${filter === f ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500'}`}>
              {f === 'ALL' ? 'Tous' : f === 'PERMANENT' ? 'Permanents' : 'Vacataires'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-auto">
        <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
            <tr>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Nom & Prénoms</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Fonction</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Type</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Diplôme</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Téléphone</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Email</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Sit. Matrim.</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Enfants</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">N° CNSS</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">N° IFU</th>
              <th className="text-right px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Salaire (FCFA)</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Embauche</th>
              <th className="text-left px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Observation</th>
              <th className="text-center px-3 py-3 font-semibold text-slate-600 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'} hover:bg-blue-50/20`}>
                <td className={tdClass}>
                  <div className="font-bold text-slate-900 whitespace-nowrap">{s.firstName} {s.lastName}</div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">{s.tenantMatricule || s.employeeNumber || 'N/A'}</div>
                </td>
                <td className={tdClass}>{s.position || '—'}</td>
                <td className={tdClass}>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${s.staffType === 'PERMANENT' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                    {s.staffType}
                  </span>
                </td>
                {editingId === s.id ? (
                  <>
                    <td className={tdClass}><input value={editForm.qualifications} onChange={e => setEditForm({...editForm, qualifications: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass}>{s.phone || '—'}</td>
                    <td className={tdClass}>{s.email || '—'}</td>
                    <td className={tdClass}><input value={editForm.maritalStatus} onChange={e => setEditForm({...editForm, maritalStatus: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass}><input type="number" value={editForm.numberOfChildren} onChange={e => setEditForm({...editForm, numberOfChildren: parseInt(e.target.value) || 0})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass}><input value={editForm.cnssNumber} onChange={e => setEditForm({...editForm, cnssNumber: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass}><input value={editForm.ifuNumber} onChange={e => setEditForm({...editForm, ifuNumber: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass + ' text-right'}><input type="number" value={editForm.salary} onChange={e => setEditForm({...editForm, salary: parseFloat(e.target.value) || 0})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right" /></td>
                    <td className={tdClass}>{s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className={tdClass}><input value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full px-2 py-1 border border-slate-300 rounded text-sm" /></td>
                    <td className={tdClass + ' text-center whitespace-nowrap'}>
                      <button onClick={() => saveEdit(s.id)} className="p-1.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Enregistrer"><Save className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 ml-1" title="Annuler"><X className="h-3.5 w-3.5" /></button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className={tdClass}>{s.diploma || s.qualifications || '—'}</td>
                    <td className={tdClass}>{s.phone ? <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-slate-600 hover:text-[#1A2BA6] transition whitespace-nowrap"><Phone className="h-3 w-3 shrink-0" /> {s.phone}</a> : '—'}</td>
                    <td className={tdClass}>{s.email ? <a href={`mailto:${s.email}`} className="flex items-center gap-1 text-slate-600 hover:text-[#1A2BA6] transition whitespace-nowrap"><Mail className="h-3 w-3 shrink-0" /> {s.email}</a> : '—'}</td>
                    <td className={tdClass}>{s.maritalStatus || '—'}</td>
                    <td className={tdClass}>{s.numberOfChildren ?? '—'}</td>
                    <td className={tdClass + ' font-mono'}>{s.cnssNumber || '—'}</td>
                    <td className={tdClass + ' font-mono'}>{s.ifuNumber || '—'}</td>
                    <td className={tdClass + ' text-right font-bold'}>{new Intl.NumberFormat('fr-FR').format(s.salary || 0)} FCFA</td>
                    <td className={tdClass}>{s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className={tdClass}>{s.observation || s.notes || '—'}</td>
                    <td className={tdClass + ' text-center whitespace-nowrap'}>
                      <button onClick={() => startEdit(s)} className="p-1.5 rounded bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20" title="Modifier"><Edit2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="text-center py-12 text-slate-400">Aucun personnel trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
