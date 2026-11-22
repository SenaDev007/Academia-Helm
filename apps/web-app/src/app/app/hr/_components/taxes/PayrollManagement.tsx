'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, FileText, Download, Eye, Printer } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

// ⭐ 156 — Séparation visuelle des colonnes AVEC sous-colonnes (groupes
//    « Indemnités & Avantages » / « Retenues ») : bordure épaisse en tête de
//    groupe + séparateurs fins ENTRE les sous-colonnes — on voit clairement
//    que le groupe est UNE colonne composée de sous-colonnes distinctes.
const GRP_HEAD = 'border-l-[3px] border-l-white/60';   // en-tête : début de groupe
const GRP_HEAD_SUB = 'border-l border-l-white/25';      // en-tête : entre sous-colonnes
const GRP_BODY = 'border-l-[3px] border-l-slate-300';  // corps : début de groupe
const GRP_BODY_SUB = 'border-l border-l-slate-100';    // corps : entre sous-colonnes

export function PayrollManagement() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [staffType, setStaffType] = useState<'PERMANENT' | 'VACATAIRE'>('PERMANENT');

  const loadData = async () => {
    if (!tenant?.id || !currentYear?.id) return;
    try {
      setLoading(true);
      // ⭐ 125 — staffType transmis : la vue « Permanents » ne montre QUE les
      //    fiches des permanents (et « Vacataires » que les vacataires).
      // ⭐ 156 — sémantique fiscale : permanents = déclarés CNSS ; vacataires =
      //    prestataires & non déclarés (dérivation côté serveur).
      const res = await hrFetch<any[]>(hrUrl('taxes/payroll/payslips', { tenantId: tenant.id, academicYearId: currentYear.id, period, staffType }));
      setPayslips(Array.isArray(res) ? res : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [tenant?.id, currentYear?.id, period, staffType]);

  const handleGenerate = async () => {
    if (!tenant?.id || !currentYear?.id) return;
    setGenerating(true);
    try {
      const res = await hrFetch<any>(hrUrl('taxes/payroll/generate', { tenantId: tenant.id }), {
        method: 'POST', body: { academicYearId: currentYear.id, period, staffType },
      });
      toast({ variant: 'success', title: `${res.payslipsCount} fiche(s) générée(s)`, description: `Brut: ${formatCurrency(res.totalGross)} · Net: ${formatCurrency(res.totalNet)}` });
      loadData();
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur', description: e.message }); }
    finally { setGenerating(false); }
  };

  const viewPayslipPdf = (id: string) => window.open(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }), '_blank');
  const printPayslipPdf = (id: string) => { const w = window.open(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }), '_blank'); w?.addEventListener('load', () => w.print()); };

  const downloadPayslipPdf = async (id: string, name: string) => {
    try {
      const res = await fetch(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // ⭐ 161 — nom de fichier fourni par le module Paie (Fiche de paie FP /
      // État de paiement EP) — l'ancien nom « Fiche_paie_… » était faux pour
      // les vacataires (prestataires → état de paiement).
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename\*=UTF-8''([^;\r\n]+)/i);
      const serverName = m ? decodeURIComponent(m[1]).replace(/\.pdf$/i, '') : null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${serverName || `Fiche_paie_${name}`}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur PDF', description: e.message }); }
  };

  // ─── ⭐ 156 — COLONNES D'INDEMNITÉS DYNAMIQUES ─────────────────────────────
  // L'employeur définit lui-même les types d'indemnités (onglet Indemnités /
  // embauche : logement, transport, salissure, gratifications…). L'état de
  // paiement affiche désormais UNE COLONNE PAR TYPE réellement versé sur la
  // période — plus AUCUNE rubrique « avantage prime de salaire + gratification »
  // codée en dur. Le détail vient des lignes de paie (figé au calcul) avec
  // repli sur les indemnités actives du personnel.
  const allowanceCols = useMemo(() => {
    const map = new Map<string, { code: string; label: string }>();
    for (const p of payslips) {
      for (const d of (Array.isArray(p.allowancesDetail) ? p.allowancesDetail : [])) {
        if (d?.code && !map.has(d.code)) map.set(d.code, { code: d.code, label: d?.label || d.code });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [payslips]);

  const allowanceAmount = (p: any, code: string) =>
    (Array.isArray(p.allowancesDetail) ? p.allowancesDetail : [])
      .filter((d: any) => d?.code === code)
      .reduce((s: number, d: any) => s + Number(d?.amount || 0), 0);

  // Repli quand la période n'a aucun type d'indemnité : une colonne unique
  // « Indemnités & avantages » regroupant les rubriques de la fiche.
  const hasDynamicCols = allowanceCols.length > 0;
  const fallbackAvantages = (p: any) =>
    Number(p.indemnites || 0) + Number(p.gratificationsEtrennes || 0) + Number(p.primeSalissures || 0);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const totalGross = payslips.reduce((s, p) => s + Number(p.salaireBrut), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalRetenues), 0);
  const totalNet = payslips.reduce((s, p) => s + Number(p.netAPayer), 0);
  const sumBy = (fn: (p: any) => number) => payslips.reduce((s, p) => s + fn(p), 0);

  // Largeur totale : noms et montants TOUJOURS sur une seule ligne
  const nCols = hasDynamicCols ? allowanceCols.length : 1;
  const permMinWidth = 1640 + nCols * 120;
  const vacMinWidth = 1500 + nCols * 120;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">États de paiement &amp; Fiches de paie</h3>
          <p className="text-xs text-slate-500 mt-0.5">Calculs automatiques (CNSS, ITS, VPS) avec taux configurables</p>
          <p className="text-[11px] text-slate-400 mt-1">
            <span className="font-semibold text-blue-600">Permanents</span> = déclarés à la CNSS ·
            <span className="font-semibold text-purple-600"> Vacataires</span> = prestataires / non déclarés
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Période</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type personnel</label>
            <select value={staffType} onChange={e => setStaffType(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]">
              <option value="PERMANENT">Permanents (déclarés CNSS)</option>
              <option value="VACATAIRE">Vacataires (prestataires &amp; non déclarés)</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Générer fiches
          </button>
          <button onClick={() => window.open(hrUrl('taxes/export/payslips', { tenantId: tenant?.id, academicYearId: currentYear?.id, period }), '_blank')} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {payslips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Salaire brut total</p><p className="text-lg font-bold text-slate-900">{formatCurrency(totalGross)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Retenues totales</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Net à payer total</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p></div>
        </div>
      )}

      {/* ─── Tableau État de paiement — PERMANENTS ─── */}
      {staffType === 'PERMANENT' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-bold text-slate-700">PERSONNELS PERMANENTS (déclarés CNSS) — État de paiement</p>
            <p className="text-[10px] text-slate-400">
              {hasDynamicCols
                ? `${allowanceCols.length} type(s) d'indemnité défini(s) par l'école : ${allowanceCols.map(c => c.label).join(' · ')}`
                : 'Aucune indemnité sur la période — colonne « Indemnités & avantages » unique'}
            </p>
          </div>
          <table className="w-full text-xs" style={{ minWidth: `${permMinWidth}px` }}>
            <thead>
              {/* Rangée 1 — colonnes simples + EN-TÊTES DE GROUPES (fond plus foncé) */}
              <tr className="bg-[#15247e] text-white">
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[250px]">Nom et Prénoms</th>
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap">Sit. Matrim.</th>
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap">Date recrut.</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right whitespace-nowrap">Salaire</th>
                <th colSpan={nCols} className={`px-2 py-1.5 text-center whitespace-nowrap uppercase text-[10px] tracking-wide ${GRP_HEAD}`}>Indemnités &amp; Avantages</th>
                <th rowSpan={2} className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>Salaire Brut</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right whitespace-nowrap">ITS Brut</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right whitespace-nowrap">ITS Net</th>
                <th colSpan={5} className={`px-2 py-1.5 text-center whitespace-nowrap uppercase text-[10px] tracking-wide ${GRP_HEAD}`}>Retenues</th>
                <th rowSpan={2} className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>Net à payer</th>
                <th rowSpan={2} className="px-1 py-1.5"></th>
              </tr>
              {/* Rangée 2 — SOUS-COLONNES dynamiques (types définis par l'école) */}
              <tr className="bg-[#1A2BA6] text-white">
                {hasDynamicCols ? allowanceCols.map((col, i) => (
                  <th key={col.code} title={col.label} className={`px-2 py-1.5 text-center font-semibold leading-tight max-w-[128px] ${i === 0 ? GRP_HEAD : GRP_HEAD_SUB}`}>
                    <span className="block whitespace-normal normal-case text-[10px]">{col.label}</span>
                  </th>
                )) : (
                  <th className={`px-2 py-1.5 text-center font-semibold whitespace-nowrap ${GRP_HEAD}`}>Indemnités &amp; avantages</th>
                )}
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>CNSS</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>CNSS Patr.</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>VPS</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>Avance/Opp.</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>Taxes R/T</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-3 py-1.5 font-bold text-slate-900 whitespace-nowrap">{p.staff?.firstName} {p.staff?.lastName}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{p.staff?.maritalStatus || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{p.staff?.hireDate ? new Date(p.staff.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(Number(p.salaireBase))}</td>
                  {hasDynamicCols ? allowanceCols.map((col, idx) => (
                    <td key={col.code} className={`px-3 py-1.5 text-right whitespace-nowrap ${idx === 0 ? GRP_BODY : GRP_BODY_SUB}`}>
                      {formatCurrency(allowanceAmount(p, col.code))}
                    </td>
                  )) : (
                    <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(fallbackAvantages(p))}</td>
                  )}
                  <td className={`px-3 py-1.5 text-right font-bold whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(Number(p.salaireBrut))}</td>
                  {/* ⭐ 156 — ITS Brut : l'ITS sur le brut intégral (barème réel) —
                      l'ancienne colonne affichait le salaire brut par erreur */}
                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-slate-500">{formatCurrency(Number(p.itsBrut ?? p.itsNet ?? 0))}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap text-red-600">{formatCurrency(Number(p.itsNet))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY}`}>{formatCurrency(Number(p.cnssOuvriere))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-slate-500 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.cnssPatronale))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.vps))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.avanceAcompte) + Number(p.opposition))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.taxesRadioTele))}</td>
                  <td className={`px-3 py-1.5 text-right font-bold whitespace-nowrap text-emerald-600 ${GRP_BODY}`}>{formatCurrency(Number(p.netAPayer))}</td>
                  <td className="px-1 py-1.5 whitespace-nowrap"><button onClick={() => viewPayslipPdf(p.id)} className="p-1 rounded bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20" title="Visualiser"><Eye className="h-3 w-3" /></button><button onClick={() => printPayslipPdf(p.id)} className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 ml-0.5" title="Imprimer"><Printer className="h-3 w-3" /></button><button onClick={() => downloadPayslipPdf(p.id, `${p.staff?.firstName}_${p.staff?.lastName}`)} className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 ml-0.5" title="Télécharger"><Download className="h-3 w-3" /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="px-3 py-1.5 text-right whitespace-nowrap">TOTAL</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(sumBy(p => Number(p.salaireBase)))}</td>
                {hasDynamicCols ? allowanceCols.map((col, idx) => (
                  <td key={col.code} className={`px-3 py-1.5 text-right whitespace-nowrap ${idx === 0 ? GRP_BODY : GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => allowanceAmount(p, col.code)))}</td>
                )) : (
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(sumBy(fallbackAvantages))}</td>
                )}
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(totalGross)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(sumBy(p => Number(p.itsBrut ?? p.itsNet ?? 0)))}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(sumBy(p => Number(p.itsNet)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(sumBy(p => Number(p.cnssOuvriere)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.cnssPatronale)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.vps)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.avanceAcompte) + Number(p.opposition)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.taxesRadioTele)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap text-emerald-600 ${GRP_BODY}`}>{formatCurrency(totalNet)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Tableau État de paiement — VACATAIRES ─── */}
      {staffType === 'VACATAIRE' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-bold text-slate-700">PERSONNELS VACATAIRES (prestataires &amp; non déclarés) — État de paiement</p>
            <p className="text-[10px] text-slate-400">
              {hasDynamicCols
                ? `${allowanceCols.length} type(s) d'indemnité défini(s) par l'école : ${allowanceCols.map(c => c.label).join(' · ')}`
                : 'Aucune indemnité sur la période — colonne « Indemnités & avantages » unique'}
            </p>
          </div>
          <table className="w-full text-xs" style={{ minWidth: `${vacMinWidth}px` }}>
            <thead>
              {/* Rangée 1 — colonnes simples + EN-TÊTES DE GROUPES */}
              <tr className="bg-[#15247e] text-white">
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap min-w-[250px]">Nom et Prénoms</th>
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap">Sit. Matrim.</th>
                <th rowSpan={2} className="px-3 py-1.5 text-left whitespace-nowrap">Date recrut.</th>
                <th rowSpan={2} className="px-3 py-1.5 text-right whitespace-nowrap">Salaire</th>
                <th colSpan={nCols} className={`px-2 py-1.5 text-center whitespace-nowrap uppercase text-[10px] tracking-wide ${GRP_HEAD}`}>Indemnités &amp; Avantages</th>
                <th rowSpan={2} className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>Salaire Brut</th>
                <th colSpan={3} className={`px-2 py-1.5 text-center whitespace-nowrap uppercase text-[10px] tracking-wide ${GRP_HEAD}`}>Retenues</th>
                <th rowSpan={2} className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>Net à payer</th>
                <th rowSpan={2} className="px-3 py-1.5 text-center whitespace-nowrap">CIN°</th>
                <th rowSpan={2} className="px-3 py-1.5 text-center whitespace-nowrap">Signature</th>
                <th rowSpan={2} className="px-1 py-1.5"></th>
              </tr>
              {/* Rangée 2 — SOUS-COLONNES dynamiques */}
              <tr className="bg-[#1A2BA6] text-white">
                {hasDynamicCols ? allowanceCols.map((col, i) => (
                  <th key={col.code} title={col.label} className={`px-2 py-1.5 text-center font-semibold leading-tight max-w-[128px] ${i === 0 ? GRP_HEAD : GRP_HEAD_SUB}`}>
                    <span className="block whitespace-normal normal-case text-[10px]">{col.label}</span>
                  </th>
                )) : (
                  <th className={`px-2 py-1.5 text-center font-semibold whitespace-nowrap ${GRP_HEAD}`}>Indemnités &amp; avantages</th>
                )}
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD}`}>Avance / salaire</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>Opposition / Assurance</th>
                <th className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_HEAD_SUB}`}>Taxes Radio/Télé</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-3 py-1.5 font-bold text-slate-900 whitespace-nowrap">{p.staff?.firstName} {p.staff?.lastName}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{p.staff?.maritalStatus || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{p.staff?.hireDate ? new Date(p.staff.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(Number(p.salaireBase))}</td>
                  {hasDynamicCols ? allowanceCols.map((col, idx) => (
                    <td key={col.code} className={`px-3 py-1.5 text-right whitespace-nowrap ${idx === 0 ? GRP_BODY : GRP_BODY_SUB}`}>
                      {formatCurrency(allowanceAmount(p, col.code))}
                    </td>
                  )) : (
                    <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(fallbackAvantages(p))}</td>
                  )}
                  <td className={`px-3 py-1.5 text-right font-bold whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(Number(p.salaireBrut))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY}`}>{formatCurrency(Number(p.avanceAcompte))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.opposition))}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap text-red-600 ${GRP_BODY_SUB}`}>{formatCurrency(Number(p.taxesRadioTele))}</td>
                  <td className={`px-3 py-1.5 text-right font-bold whitespace-nowrap text-emerald-600 ${GRP_BODY}`}>{formatCurrency(Number(p.netAPayer))}</td>
                  <td className="px-3 py-1.5 text-center font-mono text-slate-400 whitespace-nowrap">{p.staff?.tenantMatricule || '—'}</td>
                  <td className="px-3 py-1.5 text-center text-slate-300 italic text-[10px]">Signature</td>
                  <td className="px-1 py-1.5 whitespace-nowrap"><button onClick={() => viewPayslipPdf(p.id)} className="p-1 rounded bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20" title="Visualiser"><Eye className="h-3 w-3" /></button><button onClick={() => printPayslipPdf(p.id)} className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 ml-0.5" title="Imprimer"><Printer className="h-3 w-3" /></button><button onClick={() => downloadPayslipPdf(p.id, `${p.staff?.firstName}_${p.staff?.lastName}`)} className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 ml-0.5" title="Télécharger"><Download className="h-3 w-3" /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="px-3 py-1.5 text-right whitespace-nowrap">TOTAL</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">{formatCurrency(sumBy(p => Number(p.salaireBase)))}</td>
                {hasDynamicCols ? allowanceCols.map((col, idx) => (
                  <td key={col.code} className={`px-3 py-1.5 text-right whitespace-nowrap ${idx === 0 ? GRP_BODY : GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => allowanceAmount(p, col.code)))}</td>
                )) : (
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(sumBy(fallbackAvantages))}</td>
                )}
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(totalGross)}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY}`}>{formatCurrency(sumBy(p => Number(p.avanceAcompte)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.opposition)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap ${GRP_BODY_SUB}`}>{formatCurrency(sumBy(p => Number(p.taxesRadioTele)))}</td>
                <td className={`px-3 py-1.5 text-right whitespace-nowrap text-emerald-600 ${GRP_BODY}`}>{formatCurrency(totalNet)}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {payslips.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            Aucune fiche pour cette période — cliquez sur « Générer fiches ».
            {staffType === 'VACATAIRE' && ' (Les vacataires sont les prestataires et personnels non déclarés à la CNSS.)'}
          </p>
        </div>
      )}
    </div>
  );
}
