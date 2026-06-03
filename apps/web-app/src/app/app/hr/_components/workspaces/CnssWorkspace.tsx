'use client';

import { useState, useEffect } from 'react';
import { Plus, Shield, Clock, FileText, CheckCircle2, ChevronRight, Settings, AlertCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

export function CnssWorkspace() {
  const { tenant, academicYear } = useModuleContext();
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [activeRate, setActiveRate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        // Load CNSS declarations
        const decls = await hrFetch<any[]>(hrUrl('cnss/declarations'));
        setDeclarations(decls);

        // Load active rate via BFF route (country-aware)
        const countryCode = (tenant as any)?.country?.code || 'BJ';
        const rate = await hrFetch<any>(hrUrl('cnss/rates/active', { countryCode }));
        setActiveRate(rate);
      } catch (err) {
        console.error('Error loading CNSS data:', err);
        toast({ variant: 'error', title: 'Erreur: chargement des données CNSS' });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tenant?.id]);

  async function handleCreateDeclaration(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id || !academicYear?.id) return;
    try {
      setGenerating(true);
      await hrFetch<any>(hrUrl('cnss/declarations'), {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          month: periodStart?.substring(0, 7) || new Date().toISOString().substring(0, 7),
        },
      });
      // Refresh
      const decls = await hrFetch<any[]>(hrUrl('cnss/declarations'));
      setDeclarations(decls);
      setIsCreateOpen(false);
      toast({ variant: 'success', title: 'Déclaration créée avec succès' });
    } catch (err) {
      console.error('Error creating declaration:', err);
      toast({ variant: 'error', title: 'Erreur: création de la déclaration' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateStatus(id: string, status: 'GENERATED' | 'SUBMITTED' | 'PAID') {
    if (!confirm('Confirmer cette action ? Elle est irréversible.')) return;
    try {
      await hrFetch<any>(hrUrl(`cnss/declarations/${id}/finalize`), {
        method: 'PUT',
        body: { status },
      });
      // Refresh
      const decls = await hrFetch<any[]>(hrUrl('cnss/declarations'));
      setDeclarations(decls);
      toast({ variant: 'success', title: 'Statut mis à jour avec succès' });
    } catch (err) {
      console.error('Error finalising declaration:', err);
      toast({ variant: 'error', title: 'Erreur: mise à jour du statut' });
    }
  }

  const STATUS_LABEL: Record<string, { label: string; className: string }> = {
    DRAFT: { label: 'Brouillon', className: 'bg-slate-100 text-slate-700' },
    GENERATED: { label: 'Généré', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
    SUBMITTED: { label: 'Déclaré', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
    PAID: { label: 'Payé', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Rate Strip */}
      {activeRate && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">Taux de cotisation CNSS Actif</p>
              <p className="text-xs text-slate-500">Part patronale: {activeRate.employerRate}% · Part salariale: {activeRate.employeeRate}%</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold bg-indigo-50 text-[#1A2BA6] px-2.5 py-1 rounded-full border border-indigo-100">
              Plage de calcul active
            </span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-base font-bold text-slate-900">Déclarations CNSS</h3>
        <button
          onClick={() => {
            const startStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
            const endStr = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
            setPeriodStart(startStr);
            setPeriodEnd(endStr);
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-4 w-4" /> Générer une déclaration
        </button>
      </div>

      {/* Grid of declarations */}
      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl" />)}</div>
      ) : declarations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <Shield className="h-10 w-10 text-slate-300 mb-3" />
          <h4 className="text-base font-bold text-slate-800">Aucune déclaration CNSS</h4>
          <p className="text-sm text-slate-500 mt-1">Générez votre première déclaration mensuelle pour commencer le suivi.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {declarations.map((decl) => {
            const status = STATUS_LABEL[decl.status] || STATUS_LABEL.DRAFT;
            return (
              <div key={decl.id} className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/50 transition">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">
                      Déclaration du {(() => { const [y, m] = decl.month.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('fr-FR'); })()} au {(() => { const [y, m] = decl.month.split('-').map(Number); return new Date(y, m, 0).toLocaleDateString('fr-FR'); })()}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Générée le {new Date(decl.createdAt).toLocaleDateString('fr-FR')} · {decl.lines?.length || 0} employé(s) inclus
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="flex flex-col items-end">
                    <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border', status.className)}>
                      {status.label}
                    </span>
                    {decl.status === 'PAID' && (
                      <span className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Règlement validé
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {decl.status === 'DRAFT' && (
                      <button
                        onClick={() => handleUpdateStatus(decl.id, 'GENERATED')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                      >
                        Générer
                      </button>
                    )}
                    {decl.status === 'GENERATED' && (
                      <button
                        onClick={() => handleUpdateStatus(decl.id, 'SUBMITTED')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        Déclarer à la CNSS
                      </button>
                    )}
                    {decl.status === 'SUBMITTED' && (
                      <button
                        onClick={() => handleUpdateStatus(decl.id, 'PAID')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition"
                      >
                        Enregistrer paiement
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base">Générer la déclaration CNSS</h3>
            </div>
            <form onSubmit={handleCreateDeclaration} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Début de période</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Fin de période</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-6">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">Annuler</button>
                <button type="submit" disabled={generating} className="px-4 py-2 text-white rounded-lg text-sm font-semibold" style={{ backgroundColor: PRIMARY }}>
                  {generating ? 'Génération...' : 'Lancer la génération'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
