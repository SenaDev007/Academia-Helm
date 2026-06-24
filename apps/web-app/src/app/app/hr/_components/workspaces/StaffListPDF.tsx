'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download, Printer, FileText } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

export function StaffListPDF() {
  const { tenant } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
        setStaff(Array.isArray(res) ? res : []);
      } catch (e: any) {
        toast({ variant: 'error', title: 'Erreur', description: e.message });
      } finally { setLoading(false); }
    })();
  }, [tenant?.id]);

  const departments = Array.from(new Set(staff.map(s => s.department || 'Non classé').filter(Boolean)));
  const filtered = departmentFilter === 'ALL' ? staff : staff.filter(s => (s.department || 'Non classé') === departmentFilter);

  // Group by department
  const grouped = departments.reduce<Record<string, any[]>>((acc, dept) => {
    acc[dept] = staff.filter(s => (s.department || 'Non classé') === dept);
    return acc;
  }, {});

  function generatePDF() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const N = '#0b2f73', B = '#1d4fa5', G = '#f5b335';
    const rows = (departmentFilter === 'ALL' ? Object.entries(grouped) : [[departmentFilter, filtered]])
      .map(([dept, members]) => `
        <tr><td colspan="6" style="background:${N};color:#fff;padding:6px 8px;font-weight:bold;font-size:11px;">${dept} (${members.length})</td></tr>
        ${members.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:4px 8px;text-align:center">${i + 1}</td>
          <td style="padding:4px 8px;font-weight:bold">${s.firstName || ''} ${s.lastName || ''}</td>
          <td style="padding:4px 8px">${s.position || '—'}</td>
          <td style="padding:4px 8px;font-family:monospace">${s.tenantMatricule || s.employeeNumber || '—'}</td>
          <td style="padding:4px 8px">${s.phone || '—'}</td>
          <td style="padding:4px 8px">${s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
        </tr>`).join('')}
      `).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Liste du personnel</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
.header{text-align:center;margin-bottom:15px;border-bottom:3px solid ${G};padding-bottom:10px}
.header h1{color:${N};font-size:16px}.header h2{font-size:12px;color:${B};margin-top:3px}
table{width:100%;border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left;font-size:10px}
th{background:${N};color:#fff}.footer{margin-top:20px;text-align:center;font-size:9px;color:#999;border-top:1px solid #ddd;padding-top:8px}
@media print{body{padding:10px}}
</style></head><body>
<div class="header">
<h1>LISTE DU PERSONNEL</h1>
<h2>Année académique ${new Date().getFullYear()}</h2>
<p style="font-size:10px;margin-top:3px">Date: ${new Date().toLocaleDateString('fr-FR')}</p>
</div>
<table>
<thead><tr>
<th style="width:30px">N°</th>
<th>Nom et Prénoms</th>
<th>Fonction</th>
<th>Matricule</th>
<th>Téléphone</th>
<th>Embauche</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<div class="footer">
<p>Total: ${filtered.length} personnel(s)</p>
<p>Généré par Academia Helm — Plateforme de pilotage éducatif</p>
</div>
</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Liste du personnel</h3>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} personnel(s) — classé(s) par département</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold">
            <option value="ALL">Tous les départements</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 transition whitespace-nowrap">
            <FileText className="h-4 w-4" /> Générer PDF
          </button>
          <button onClick={generatePDF} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition whitespace-nowrap">
            <Printer className="h-4 w-4" /> Imprimer
          </button>
        </div>
      </div>

      {/* Tableau par département */}
      <div className="space-y-4">
        {(departmentFilter === 'ALL' ? Object.entries(grouped) : [[departmentFilter, filtered]]).map(([dept, members]) => (
          <div key={dept} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
              <p className="text-xs font-bold text-slate-700">{dept} <span className="text-slate-400">({members.length})</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#1A2BA6] text-white">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap">N°</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Nom et Prénoms</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Fonction</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Matricule</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Téléphone</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Embauche</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((s, i) => (
                    <tr key={s.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 font-bold text-slate-900 whitespace-nowrap">{s.firstName} {s.lastName}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{s.position || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{s.tenantMatricule || s.employeeNumber || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{s.phone || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">{s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                    </tr>
                  ))}
                  {members.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Aucun personnel dans ce département</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
