'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, RefreshCw, Search, IdCard, CheckCircle, QrCode, Trash2, Send, Layers, AlertCircle, X } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
const PRIMARY = '#1A2BA6';

export function StaffCardWorkspace() {
  const { tenant } = useModuleContext();
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [cards, setCards] = useState<Record<string, any[]>>({});
  const [modal, setModal] = useState<{ type: 'generateAll' | 'distribute' | 'revoke'; data?: any } | null>(null);

  const fetchStaff = useCallback(async () => {
    if (!tenant?.id) return;
    try { setLoading(true); const data = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id })); setStaffList(Array.isArray(data) ? data : []); } catch {} finally { setLoading(false); }
  }, [tenant?.id]);
  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  async function fetchCards(staffId: string) {
    if (!tenant?.id) return;
    try { const data = await hrFetch<any[]>(hrUrl(`staff/${staffId}/cards`, { tenantId: tenant.id })); setCards(prev => ({ ...prev, [staffId]: Array.isArray(data) ? data : [] })); } catch {}
  }
  async function handleGenerate(staffId: string) {
    if (!tenant?.id) return; setGenerating(staffId);
    try { await hrFetch(hrUrl(`staff/${staffId}/cards/generate`, { tenantId: tenant.id }), { method: 'POST', body: { cardType: 'PROFESSIONAL' } }); toast({ variant: 'success', title: 'Carte générée !' }); fetchCards(staffId); } catch (e: any) { toast({ variant: 'error', title: 'Erreur', description: e.message }); } finally { setGenerating(null); }
  }

  async function handleGenerateAll() {
    if (!tenant?.id) return;
    setGeneratingAll(true);
    try {
      const res = await hrFetch<any>(hrUrl('staff/cards/generate-all', { tenantId: tenant.id }), { method: 'POST', body: { cardType: 'PROFESSIONAL' } });
      toast({ variant: res.failed > 0 ? 'default' : 'success', title: `${res.generated} carte(s) générée(s)`, description: res.failed > 0 ? `${res.failed} échec(s)` : undefined });
      staffList.forEach(s => fetchCards(s.id));
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setGeneratingAll(false); setModal(null); }
  }

  async function handleDistributeAll() {
    if (!tenant?.id) return;
    setDistributing(true);
    try {
      const res = await hrFetch<any>(hrUrl('staff/cards/distribute', { tenantId: tenant.id }), { method: 'POST', body: {} });
      toast({ variant: res.failed > 0 ? 'default' : 'success', title: `${res.sent} email(s) envoyé(s)`, description: res.failed > 0 ? `${res.failed} échec(s)` : undefined });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setDistributing(false); setModal(null); }
  }

  async function handleDownload(cardId: string, name: string) {
    try {
      // Utiliser l'endpoint backend direct (évite CORS)
      window.open(hrUrl(`staff/cards/${cardId}/download`, { tenantId: tenant?.id }), '_blank');
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur téléchargement', description: e.message });
    }
  }
  async function handleRevoke(id: string, staffId: string) {
    if (!tenant?.id) return;
    try { await hrFetch(hrUrl(`staff/cards/${id}`, { tenantId: tenant.id }), { method: 'DELETE' }); toast({ variant: 'success', title: 'Carte révoquée' }); fetchCards(staffId); } catch {}
    setModal(null);
  }

  const filtered = staffList.filter(s => `${s.firstName} ${s.lastName} ${s.position || ''}`.toLowerCase().includes(search.toLowerCase()));
  const totalWithCards = staffList.filter(s => (cards[s.id] || []).some(c => c.status === 'ACTIVE')).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">Cartes professionnelles</h3>
          <p className="text-xs text-slate-500 mt-0.5">Générez des cartes avec QR code pour votre personnel.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModal({ type: 'generateAll' })} disabled={generatingAll || staffList.length === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
            {generatingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />} Tout générer ({staffList.length})
          </button>
          <button onClick={() => setModal({ type: 'distribute' })} disabled={distributing || totalWithCards === 0} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-emerald-600">
            {distributing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Distribuer ({totalWithCards})
          </button>
        </div>
      </div>
      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" /></div>
      <div className="space-y-3">
        {filtered.map(staff => {
          const sc = cards[staff.id] || []; const hasCard = sc.some(c => c.status === 'ACTIVE'); const activeCard = sc.find(c => c.status === 'ACTIVE');
          return (
            <motion.div key={staff.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">{staff.firstName?.[0]}{staff.lastName?.[0]}</div>
                <div className="min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{staff.firstName} {staff.lastName}</p><p className="text-xs text-slate-500 truncate">{staff.position || 'Personnel'} · {staff.tenantMatricule || staff.employeeNumber || 'N/A'}</p></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasCard && activeCard ? (<>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="h-3 w-3" /> Active</span>
                  {activeCard.id && <button onClick={() => handleDownload(activeCard.id, `${staff.firstName}_${staff.lastName}`)} className="p-1.5 rounded-lg bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20 transition" title="Télécharger PDF"><Download className="h-3.5 w-3.5" /></button>}
                  {activeCard.qrData && <a href={activeCard.qrData} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Profil public (QR)"><QrCode className="h-3.5 w-3.5" /></a>}
                  <button onClick={() => setModal({ type: 'revoke', data: { id: activeCard.id, staffId: staff.id, name: `${staff.firstName} ${staff.lastName}` } })} className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition" title="Révoquer"><Trash2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleGenerate(staff.id)} disabled={generating === staff.id} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50" title="Régénérer">{generating === staff.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Régénérer</button>
                </>) : (<button onClick={() => handleGenerate(staff.id)} disabled={generating === staff.id} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>{generating === staff.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <IdCard className="h-3.5 w-3.5" />}Générer</button>)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ─── Modal professionnel ─── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => !generatingAll && !distributing && setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header bleu Helm */}
              <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #1A2BA6 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    {modal.type === 'generateAll' ? <Layers className="h-5 w-5 text-white" /> : modal.type === 'distribute' ? <Send className="h-5 w-5 text-white" /> : <AlertCircle className="h-5 w-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">
                      {modal.type === 'generateAll' ? 'Génération en masse' : modal.type === 'distribute' ? 'Distribution par email' : 'Révocation de carte'}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5">
                      {modal.type === 'generateAll' ? `${staffList.length} personnels` : modal.type === 'distribute' ? `${totalWithCards} carte(s)` : 'Action irréversible'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {modal.type === 'generateAll' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">Toutes les anciennes cartes actives seront <strong>révoquées</strong> et de nouvelles cartes seront générées pour les {staffList.length} personnels actifs. Cette opération peut prendre quelques minutes.</p>
                  </div>
                )}
                {modal.type === 'distribute' && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2">
                    <Send className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800">Chaque personnel recevra sa carte professionnelle en <strong>pièce jointe</strong> par email, avec un lien public QR code. {totalWithCards} email(s) seront envoyés.</p>
                  </div>
                )}
                {modal.type === 'revoke' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">La carte de <strong>{modal.data?.name}</strong> sera <strong>révoquée</strong>. Le lien QR public ne fonctionnera plus. Cette action est irréversible.</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
                <button onClick={() => setModal(null)} disabled={generatingAll || distributing} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition">Annuler</button>
                {modal.type === 'generateAll' && (
                  <button onClick={handleGenerateAll} disabled={generatingAll} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: '#0D1F6E' }}>
                    {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} Tout générer
                  </button>
                )}
                {modal.type === 'distribute' && (
                  <button onClick={handleDistributeAll} disabled={distributing} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-emerald-600">
                    {distributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Distribuer
                  </button>
                )}
                {modal.type === 'revoke' && (
                  <button onClick={() => handleRevoke(modal.data?.id, modal.data?.staffId)} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 transition bg-red-600">
                    <Trash2 className="h-4 w-4" /> Révoquer
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
