'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, Landmark, Wallet, RefreshCw, CheckCircle, Clock, Download, ChevronDown, ChevronUp, Eye, Printer } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

const DECLARATION_TYPES = [
  { value: 'IST', label: 'IST — Impôt sur Salaires', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  { value: 'CNSS', label: 'CNSS — Sécurité Sociale', icon: Landmark, color: 'text-purple-600', bg: 'bg-purple-50' },
  { value: 'AIB', label: 'AIB — Impôt Bénéfices', icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' },
];

export function TaxDeclarations() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('IST');
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [expandedDecl, setExpandedDecl] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id || !currentYear?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('taxes/declarations', { tenantId: tenant.id, academicYearId: currentYear.id }));
        setDeclarations(Array.isArray(res) ? res : []);
      } catch (e: any) {
        toast({ variant: 'error', title: 'Erreur', description: e.message });
      } finally { setLoading(false); }
    })();
  }, [tenant?.id, currentYear?.id]);

  const generateDeclaration = async () => {
    if (!tenant?.id || !currentYear?.id) return;
    setGenerating(selectedType);
    try {
      let endpoint = '';
      let body: any = { academicYearId: currentYear.id, period };
      if (selectedType === 'IST') endpoint = 'taxes/declarations/ist/generate';
      else if (selectedType === 'CNSS') {
        const d = new Date(period + '-01');
        const quarter = `T${Math.ceil((d.getMonth() + 1) / 3)}`;
        body.period = `${period.substring(0, 4)}-${quarter}`;
        endpoint = 'taxes/declarations/cnss/generate';
      } else if (selectedType === 'AIB') {
        endpoint = 'taxes/declarations/aib/generate';
        body.baseAchats = 0; body.basePrestations = 0;
      }
      await hrFetch(hrUrl(endpoint, { tenantId: tenant.id }), { method: 'POST', body });
      toast({ variant: 'success', title: 'Déclaration générée', description: `${selectedType} — ${body.period}` });
      const res = await hrFetch<any[]>(hrUrl('taxes/declarations', { tenantId: tenant.id, academicYearId: currentYear.id }));
      setDeclarations(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setGenerating(null); }
  };

  const updateStatus = async (id: string, status: string) => {
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl(`taxes/declarations/${id}/status`, { tenantId: tenant.id }), { method: 'PUT', body: { status } });
      toast({ variant: 'success', title: status === 'PAID' ? 'Déclaration marquée payée' : 'Déclaration soumise' });
      const res = await hrFetch<any[]>(hrUrl('taxes/declarations', { tenantId: tenant.id, academicYearId: currentYear?.id }));
      setDeclarations(Array.isArray(res) ? res : []);
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur', description: e.message }); }
  };

  const viewPdf = (id: string) => window.open(hrUrl(`taxes/declarations/${id}/pdf`, { tenantId: tenant?.id }), '_blank');
  const printPdf = (id: string) => { const w = window.open(hrUrl(`taxes/declarations/${id}/pdf`, { tenantId: tenant?.id }), '_blank'); w?.addEventListener('load', () => w.print()); };

  const downloadPdf = async (id: string, type: string, p: string) => {
    try {
      const res = await fetch(hrUrl(`taxes/declarations/${id}/pdf`, { tenantId: tenant?.id }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}_${p}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur PDF', description: e.message }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const filteredDeclarations = declarations.filter(d => d.type === selectedType);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Déclarations fiscales</h3>
        <p className="text-xs text-slate-500 mt-0.5">IST, AIB, CNSS — calculs automatiques basés sur les taux configurables</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {DECLARATION_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.value} onClick={() => setSelectedType(t.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold transition ${selectedType === t.value ? 'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              <Icon className={`h-4 w-4 ${selectedType === t.value ? t.color : 'text-slate-400'}`} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-900 mb-4">Générer une déclaration {selectedType}</h4>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Période</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" />
          </div>
          <button onClick={generateDeclaration} disabled={generating === selectedType} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
            {generating === selectedType ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Générer
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Les taux utilisés sont ceux définis dans l'onglet « Paramètres ».</p>
      </div>

      <div className="space-y-3">
        {filteredDeclarations.map(decl => {
          const data = decl.data as any || {};
          const isDraft = decl.status === 'DRAFT';
          const isSubmitted = decl.status === 'SUBMITTED';
          const isPaid = decl.status === 'PAID';
          const isExpanded = expandedDecl === decl.id;

          return (
            <div key={decl.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Header card */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{decl.type} — {decl.period}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? 'bg-emerald-50 text-emerald-700' : isSubmitted ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isPaid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {isPaid ? 'Payée' : isSubmitted ? 'Soumise' : 'Brouillon'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Créée le {new Date(decl.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-slate-900">{formatCurrency(Number(decl.totalAmount || 0))}</p>
                    <button onClick={() => viewPdf(decl.id)} className="p-1.5 rounded-lg bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20 transition" title="Visualiser"><Eye className="h-4 w-4" /></button>
                    <button onClick={() => printPdf(decl.id)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Imprimer"><Printer className="h-4 w-4" /></button>
                    <button onClick={() => downloadPdf(decl.id, decl.type, decl.period)} className="p-1.5 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition" title="Télécharger PDF"><Download className="h-4 w-4" /></button>
                    <button onClick={() => setExpandedDecl(isExpanded ? null : decl.id)} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Détails">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {isDraft && <button onClick={() => updateStatus(decl.id, 'SUBMITTED')} className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Soumettre</button>}
                  {isSubmitted && <button onClick={() => updateStatus(decl.id, 'PAID')} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Marquer payée</button>}
                </div>
              </div>

              {/* Détails expansés */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/50 p-5 space-y-4">
                  {/* ─── CNSS : détail nominatif ─── */}
                  {decl.type === 'CNSS' && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase">Déclaration nominative trimestrielle</h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200">
                          <thead className="bg-[#1A2BA6] text-white">
                            <tr>
                              <th rowSpan={2} className="px-2 py-1 text-left">N°</th>
                              <th rowSpan={2} className="px-2 py-1 text-left">N° Immat.</th>
                              <th rowSpan={2} className="px-2 py-1 text-left">Nom et Prénoms</th>
                              <th colSpan={3} className="px-2 py-1 text-center border-l border-r border-white/20">Durée travail (jours ouvrables)</th>
                              <th rowSpan={2} className="px-2 py-1 text-center">Jours assimilés</th>
                              <th colSpan={3} className="px-2 py-1 text-center border-l border-r border-white/20">Rémunération (FCFA)</th>
                              <th rowSpan={2} className="px-2 py-1 text-right">Salaire brut trimestriel</th>
                            </tr>
                            <tr>
                              <th className="px-2 py-1 text-center">1er mois</th>
                              <th className="px-2 py-1 text-center">2ème mois</th>
                              <th className="px-2 py-1 text-center">3ème mois</th>
                              <th className="px-2 py-1 text-center">1er mois</th>
                              <th className="px-2 py-1 text-center">2ème mois</th>
                              <th className="px-2 py-1 text-center">3ème mois</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(data.staffDetails || []).map((s: any, i: number) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="px-2 py-1">{i + 1}</td>
                                <td className="px-2 py-1 font-mono">{s.cnssNumber || '—'}</td>
                                <td className="px-2 py-1 font-semibold">{s.name}</td>
                                <td className="px-2 py-1 text-center">{s.daysMonth1 || 0}</td>
                                <td className="px-2 py-1 text-center">{s.daysMonth2 || 0}</td>
                                <td className="px-2 py-1 text-center">{s.daysMonth3 || 0}</td>
                                <td className="px-2 py-1 text-center">{s.totalDaysAssimilés || 0}</td>
                                <td className="px-2 py-1 text-right">{formatCurrency(s.salaryMonth1 || 0)}</td>
                                <td className="px-2 py-1 text-right">{formatCurrency(s.salaryMonth2 || 0)}</td>
                                <td className="px-2 py-1 text-right">{formatCurrency(s.salaryMonth3 || 0)}</td>
                                <td className="px-2 py-1 text-right font-bold">{formatCurrency(s.grossSalary || 0)}</td>
                              </tr>
                            ))}
                            <tr className="bg-slate-100 font-bold">
                              <td colSpan={10} className="px-2 py-1 text-right">Total salaire S =</td>
                              <td className="px-2 py-1 text-right">{formatCurrency(data.totalSalary || 0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Calculs cotisations */}
                      <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Calcul des cotisations</h6>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">Cotisations familiales (S × {data.rates?.familiales || 9}%)</span><span className="font-bold">{formatCurrency(data.cotisationsFamiliales || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Risques professionnels (S × {data.rates?.risques || 1}%)</span><span className="font-bold">{formatCurrency(data.risquesPro || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Assurance vieillesse (S × {data.rates?.vieillesse || 0}%)</span><span className="font-bold">{formatCurrency(data.assuranceVieillesse || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Part patronale (S × {data.rates?.patronale || 6.4}%)</span><span className="font-bold">{formatCurrency(data.partPatronale || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Part ouvrière (S × {data.rates?.ouvriere || 3.6}%)</span><span className="font-bold">{formatCurrency(data.partOuvriere || 0)}</span></div>
                          <div className="flex justify-between border-t border-slate-200 pt-2"><span className="font-bold text-slate-700">Total des cotisations</span><span className="font-bold text-[#1A2BA6]">{formatCurrency(data.totalCotisations || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Majorations</span><span className="font-bold">{formatCurrency(data.majorations || 0)}</span></div>
                          <div className="flex justify-between bg-amber-50 px-2 py-1 rounded"><span className="font-bold text-amber-800">TOTAL À PAYER</span><span className="font-bold text-amber-800">{formatCurrency(data.totalAPayer || data.totalCotisations || 0)}</span></div>
                        </div>
                      </div>

                      {/* Mode de paiement */}
                      <div className="mt-3 bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Mode de paiement</h6>
                        <div className="flex gap-4 text-xs">
                          <label className="flex items-center gap-1"><input type="radio" name={`pay-${decl.id}`} defaultChecked={data.payment?.mode === 'VIREMENT'} /> Virement</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`pay-${decl.id}`} defaultChecked={data.payment?.mode === 'CHEQUE'} /> Chèque</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`pay-${decl.id}`} defaultChecked={data.payment?.mode === 'ESPECES'} /> Espèces</label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─── IST : formulaire complet ─── */}
                  {decl.type === 'IST' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Liquidation des impôts sur salaires</h6>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">1. Nombre de salariés</span><span className="font-bold">{data.staffCount || 0}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">2. Montant brut des salaires</span><span className="font-bold">{formatCurrency(data.totalGrossSalary || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">3. Montant de l'IRPP</span><span className="font-bold">{formatCurrency(data.irpp || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">4. Montant du V.P.S. (Ligne 2 × {data.vpsRate || 4}%)</span><span className="font-bold">{formatCurrency(data.vps || 0)}</span></div>
                          <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-bold">5. Total des impôts sur salaires</span><span className="font-bold text-[#1A2BA6]">{formatCurrency(data.totalIST || 0)}</span></div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Paiement</h6>
                        <div className="flex gap-4 text-xs mb-2">
                          <label className="flex items-center gap-1"><input type="radio" name={`istpay-${decl.id}`} defaultChecked={data.payment?.mode === 'ESPECES'} /> Espèces</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`istpay-${decl.id}`} defaultChecked={data.payment?.mode === 'CHEQUE'} /> Chèque</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`istpay-${decl.id}`} defaultChecked={data.payment?.mode === 'VIREMENT'} /> Virement</label>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-slate-500">N° chèque:</span> <span className="font-mono">{data.payment?.chequeNumber || '—'}</span></div>
                          <div><span className="text-slate-500">Banque:</span> <span>{data.payment?.bank || '—'}</span></div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Pénalités</h6>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between"><span className="text-slate-500">IRPP — motif: {data.penalties?.irppReason || '—'}</span><span className="font-bold">{formatCurrency(data.penalties?.irpp || 0)}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">VPS — motif: {data.penalties?.vpsReason || '—'}</span><span className="font-bold">{formatCurrency(data.penalties?.vps || 0)}</span></div>
                          <div className="flex justify-between border-t border-slate-200 pt-1"><span className="font-bold">Montant total pénalités</span><span className="font-bold text-red-600">{formatCurrency(data.penalties?.total || 0)}</span></div>
                        </div>
                      </div>

                      <div className="bg-slate-100 rounded-lg p-3 text-xs">
                        <div className="flex justify-between"><span className="text-slate-500">N° de quittance:</span><span className="font-mono">{data.quittanceNumber || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Date de soumission:</span><span>{data.submissionDate || '—'}</span></div>
                      </div>
                    </div>
                  )}

                  {/* ─── AIB : bordereau complet ─── */}
                  {decl.type === 'AIB' && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Liquidation des droits</h6>
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-slate-200"><th className="text-left py-1">Nature</th><th className="text-right">Base</th><th className="text-center">Taux</th><th className="text-right">Montant</th></tr></thead>
                          <tbody>
                            <tr className="border-b border-slate-100"><td className="py-1">Achat de marchandises — AIB {data.rates?.achats || 1}%</td><td className="text-right">{formatCurrency(data.baseAchats || 0)}</td><td className="text-center">{data.rates?.achats || 1}%</td><td className="text-right font-bold">{formatCurrency(data.aibAchats || 0)}</td></tr>
                            <tr className="border-b border-slate-100"><td className="py-1">Prestation de services — AIB {data.rates?.prestations || 5}%</td><td className="text-right">{formatCurrency(data.basePrestations || 0)}</td><td className="text-center">{data.rates?.prestations || 5}%</td><td className="text-right font-bold">{formatCurrency(data.aibPrestations || 0)}</td></tr>
                            <tr className="bg-slate-100 font-bold"><td colSpan={3} className="py-1 text-right">Montant total à reverser:</td><td className="text-right text-[#1A2BA6]">{formatCurrency(data.totalAIB || 0)}</td></tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Section IV — Détail prestataires */}
                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Section IV — Détail des prélèvements d'AIB</h6>
                        {(data.prestataires || []).length === 0 ? (
                          <p className="text-xs text-slate-400">Aucun prestataire enregistré.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead><tr className="border-b border-slate-200"><th className="text-left py-1">Nom et adresse du prestataire</th><th className="text-left">N° IFU</th><th className="text-right">Base</th><th className="text-right">Prélèvement</th></tr></thead>
                            <tbody>
                              {(data.prestataires || []).map((p: any, i: number) => (
                                <tr key={i} className="border-b border-slate-100"><td className="py-1">{p.name}<br/><span className="text-slate-400">{p.address}</span></td><td className="font-mono">{p.ifu}</td><td className="text-right">{formatCurrency(p.base || 0)}</td><td className="text-right font-bold">{formatCurrency(p.prelevement || 0)}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="bg-white rounded-lg border border-slate-200 p-4">
                        <h6 className="text-xs font-bold text-slate-700 mb-2">Paiement</h6>
                        <div className="flex gap-4 text-xs mb-2">
                          <label className="flex items-center gap-1"><input type="radio" name={`aibpay-${decl.id}`} defaultChecked={data.payment?.mode === 'ESPECES'} /> Espèces</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`aibpay-${decl.id}`} defaultChecked={data.payment?.mode === 'CHEQUE'} /> Chèque</label>
                          <label className="flex items-center gap-1"><input type="radio" name={`aibpay-${decl.id}`} defaultChecked={data.payment?.mode === 'VIREMENT'} /> Virement</label>
                        </div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between"><span className="text-slate-500">N° quittance:</span><span className="font-mono">{data.quittanceNumber || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Date d'émission:</span><span>{data.emissionDate || '—'}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Pénalité:</span><span className="font-bold">{formatCurrency(data.penalty || 0)}</span></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredDeclarations.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucune déclaration {selectedType} pour cette année</p>
          </div>
        )}
      </div>
    </div>
  );
}
