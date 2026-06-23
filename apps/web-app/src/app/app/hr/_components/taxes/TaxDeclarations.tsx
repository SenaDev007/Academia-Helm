'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, Landmark, Wallet, RefreshCw, CheckCircle, Clock, Download } from 'lucide-react';
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
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

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
        // Pour CNSS, convertir period en format trimestre
        const quarter = `T${Math.ceil(new Date(period + '-01').getMonth() / 3 + 1)}`;
        body.period = `${period.substring(0, 4)}-${quarter}`;
        endpoint = 'taxes/declarations/cnss/generate';
      } else if (selectedType === 'AIB') {
        endpoint = 'taxes/declarations/aib/generate';
        body.baseAchats = 0;
        body.basePrestations = 0;
      }

      await hrFetch(hrUrl(endpoint, { tenantId: tenant.id }), { method: 'POST', body });
      toast({ variant: 'success', title: 'Déclaration générée', description: `${selectedType} — ${body.period}` });

      // Recharger
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
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  // Filtrer par type sélectionné
  const filteredDeclarations = declarations.filter(d => d.type === selectedType);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Déclarations fiscales</h3>
        <p className="text-xs text-slate-500 mt-0.5">IST, AIB, CNSS — calculs automatiques basés sur les taux configurables</p>
      </div>

      {/* Sélecteur type + période */}
      <div className="flex items-center gap-3 flex-wrap">
        {DECLARATION_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.value}
              onClick={() => setSelectedType(t.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-bold transition ${selectedType === t.value ? 'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <Icon className={`h-4 w-4 ${selectedType === t.value ? t.color : 'text-slate-400'}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Génération */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-900 mb-4">Générer une déclaration {selectedType}</h4>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Période</label>
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
            />
          </div>
          <button
            onClick={generateDeclaration}
            disabled={generating === selectedType}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50"
          >
            {generating === selectedType ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">Les taux utilisés sont ceux définis dans l'onglet « Paramètres ».</p>
      </div>

      {/* Liste déclarations */}
      <div className="space-y-3">
        {filteredDeclarations.map(decl => {
          const data = decl.data as any || {};
          const isDraft = decl.status === 'DRAFT';
          const isSubmitted = decl.status === 'SUBMITTED';
          const isPaid = decl.status === 'PAID';

          return (
            <div key={decl.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{decl.type} — {decl.period}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isPaid ? 'bg-emerald-50 text-emerald-700' :
                      isSubmitted ? 'bg-blue-50 text-blue-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {isPaid ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {isPaid ? 'Payée' : isSubmitted ? 'Soumise' : 'Brouillon'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Créée le {new Date(decl.createdAt).toLocaleDateString('fr-FR')}
                    {decl.submittedAt && ` · Soumise le ${new Date(decl.submittedAt).toLocaleDateString('fr-FR')}`}
                    {decl.paidAt && ` · Payée le ${new Date(decl.paidAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
                <p className="text-lg font-bold text-slate-900">{formatCurrency(Number(decl.totalAmount || 0))}</p>
              </div>

              {/* Détails calculs */}
              {decl.type === 'IST' && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Salariés</span><span className="font-bold">{data.staffCount || 0}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Salaire brut total</span><span className="font-bold">{formatCurrency(data.totalGrossSalary || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">VPS ({data.vpsRate || 0}%)</span><span className="font-bold">{formatCurrency(data.vps || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">IRPP ({data.irppRate || 0}%)</span><span className="font-bold">{formatCurrency(data.irpp || 0)}</span></div>
                </div>
              )}
              {decl.type === 'CNSS' && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Salaire total (trimestre)</span><span className="font-bold">{formatCurrency(data.totalSalary || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Familiales ({data.rates?.familiales || 0}%)</span><span className="font-bold">{formatCurrency(data.cotisationsFamiliales || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Risques pro ({data.rates?.risques || 0}%)</span><span className="font-bold">{formatCurrency(data.risquesPro || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Part patronale ({data.rates?.patronale || 0}%)</span><span className="font-bold">{formatCurrency(data.partPatronale || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Part ouvrière ({data.rates?.ouvriere || 0}%)</span><span className="font-bold">{formatCurrency(data.partOuvriere || 0)}</span></div>
                </div>
              )}
              {decl.type === 'AIB' && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-slate-500">Base achats</span><span className="font-bold">{formatCurrency(data.baseAchats || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">AIB achats ({data.rates?.achats || 0}%)</span><span className="font-bold">{formatCurrency(data.aibAchats || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Base prestations</span><span className="font-bold">{formatCurrency(data.basePrestations || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">AIB prestations ({data.rates?.prestations || 0}%)</span><span className="font-bold">{formatCurrency(data.aibPrestations || 0)}</span></div>
                </div>
              )}

              {/* Actions */}
              {isDraft && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(decl.id, 'SUBMITTED')} className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">Soumettre</button>
                </div>
              )}
              {isSubmitted && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(decl.id, 'PAID')} className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">Marquer payée</button>
                </div>
              )}
            </div>
          );
        })}
        {filteredDeclarations.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Aucune déclaration {selectedType} pour cette année</p>
            <p className="text-xs text-slate-400 mt-1">Générez une déclaration ci-dessus pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
