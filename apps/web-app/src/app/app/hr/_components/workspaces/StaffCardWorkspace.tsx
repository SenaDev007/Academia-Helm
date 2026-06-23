'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Download, RefreshCw, Search, IdCard, CheckCircle, QrCode, Trash2, Send, Layers, AlertCircle, BadgeCheck, CreditCard } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
const PRIMARY = '#1A2BA6';

type CardMode = 'PROFESSIONAL' | 'BADGE';

export function StaffCardWorkspace() {
  const { tenant } = useModuleContext();
  const [mode, setMode] = useState<CardMode>('PROFESSIONAL');
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

  // Fetch cards for a staff member (both types)
  async function fetchCards(staffId: string) {
    if (!tenant?.id) return;
    try {
      const data = await hrFetch<any[]>(hrUrl(`staff/${staffId}/cards`, { tenantId: tenant.id }));
      setCards(prev => ({ ...prev, [staffId]: Array.isArray(data) ? data : [] }));
    } catch {}
  }

  // Fetch all cards on load
  useEffect(() => {
    if (!tenant?.id || staffList.length === 0) return;
    staffList.forEach(s => fetchCards(s.id));
  }, [tenant?.id, staffList.length]);

  async function handleGenerate(staffId: string, cardType: CardMode = mode) {
    if (!tenant?.id) return;
    setGenerating(staffId + cardType);
    try {
      await hrFetch(hrUrl(`staff/${staffId}/cards/generate`, { tenantId: tenant.id }), { method: 'POST', body: { cardType } });
      toast({ variant: 'success', title: cardType === 'BADGE' ? 'Badge généré !' : 'Carte générée !' });
      fetchCards(staffId);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally {
      setGenerating(null);
    }
  }

  async function handleGenerateAll() {
    if (!tenant?.id) return;
    setGeneratingAll(true);
    try {
      const res = await hrFetch<any>(hrUrl('staff/cards/generate-all', { tenantId: tenant.id }), { method: 'POST', body: { cardType: mode } });
      toast({ variant: res.failed > 0 ? 'default' : 'success', title: `${res.generated} ${mode === 'BADGE' ? 'badge(s)' : 'carte(s)'} générée(s)`, description: res.failed > 0 ? `${res.failed} échec(s)` : undefined });
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

  async function handleDownload(cardId: string) {
    try {
      window.open(hrUrl(`staff/cards/${cardId}/download`, { tenantId: tenant?.id }), '_blank');
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur téléchargement', description: e.message });
    }
  }

  async function handleRevoke(id: string, staffId: string) {
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl(`staff/cards/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: mode === 'BADGE' ? 'Badge révoqué' : 'Carte révoquée' });
      fetchCards(staffId);
    } catch {}
    setModal(null);
  }

  const filtered = staffList.filter(s => `${s.firstName} ${s.lastName} ${s.position || ''}`.toLowerCase().includes(search.toLowerCase()));

  // For each staff, find the active card of the current mode
  const getActiveCard = (staffId: string) => {
    const sc = cards[staffId] || [];
    return sc.find(c => c.status === 'ACTIVE' && c.cardType === mode);
  };

  const totalWithCards = staffList.filter(s => getActiveCard(s.id)).length;

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Mode selector: Carte vs Badge */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'BADGE' ? 'Badges d\'accès' : 'Cartes professionnelles'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'BADGE'
                ? 'Badges verticaux (portrait) avec lanière, photo et QR code pour le contrôle d\'accès.'
                : 'Cartes rectangulaires (paysage) recto-verso type pièce d\'identité avec photo, QR code et hologramme.'}
            </p>
          </div>
          {/* Toggle Carte / Badge */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setMode('PROFESSIONAL')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'PROFESSIONAL' ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CreditCard className="h-3.5 w-3.5" /> Carte
            </button>
            <button
              onClick={() => setMode('BADGE')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'BADGE' ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Badge
            </button>
          </div>
        </div>
      </div>

      {/* Visual preview of the difference */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-around gap-6 flex-wrap">
          {/* Card preview (landscape) */}
          <div className="flex flex-col items-center gap-2">
            <div className={`rounded-xl border-2 transition-all ${mode === 'PROFESSIONAL' ? 'border-[#1A2BA6] shadow-lg' : 'border-slate-200 opacity-50'}`}
              style={{ width: '192px', height: '120px', background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
              <div className="p-2 text-white text-[8px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">ÉCOLE</span>
                  <span className="text-amber-400">CARTE PRO</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">PH</div>
                  <div>
                    <p className="font-bold text-[9px]">Nom Prénom</p>
                    <p className="text-amber-400 text-[7px]">Fonction</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-600">Format paysage (paysage)</p>
            <p className="text-[9px] text-slate-400">Type pièce d'identité</p>
          </div>

          {/* Badge preview (portrait) */}
          <div className="flex flex-col items-center gap-2">
            <div className={`rounded-xl border-2 transition-all ${mode === 'BADGE' ? 'border-[#1A2BA6] shadow-lg' : 'border-slate-200 opacity-50'}`}
              style={{ width: '120px', height: '180px', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="w-8 h-2 bg-slate-200 mx-auto rounded-b-lg" />
              <div className="px-2 py-1 text-white text-center text-[7px]" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
                <div className="font-bold">ÉCOLE</div>
                <div className="text-amber-400">BADGE</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-1 py-1">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">PH</div>
                <p className="font-bold text-[8px] text-slate-900 text-center">Nom</p>
                <p className="text-[6px] text-blue-600">Fonction</p>
              </div>
              <div className="h-4 flex items-center justify-between px-2" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
                <div className="w-3 h-3 bg-white rounded-sm" />
                <span className="text-amber-400 text-[6px] font-bold">AH</span>
              </div>
            </div>
            <p className="text-[10px] font-bold text-slate-600">Format portrait (vertical)</p>
            <p className="text-[9px] text-slate-400">Type badge d'accès</p>
          </div>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" />
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

      {/* Staff list with card/badge status */}
      <div className="space-y-3">
        {filtered.map(staff => {
          const activeCard = getActiveCard(staff.id);
          const hasCard = !!activeCard;
          const isGenerating = generating === staff.id + mode;
          return (
            <motion.div key={staff.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {staff.photoUrl ? (
                  <img src={staff.photoUrl} alt={`${staff.firstName} ${staff.lastName}`} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">{staff.firstName?.[0]}{staff.lastName?.[0]}</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{staff.firstName} {staff.lastName}</p>
                  <p className="text-xs text-slate-500 truncate">{staff.position || 'Personnel'} · {staff.tenantMatricule || staff.employeeNumber || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasCard && activeCard ? (
                  <>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle className="h-3 w-3" /> {mode === 'BADGE' ? 'Badge actif' : 'Carte active'}
                    </span>
                    {activeCard.id && (
                      <button onClick={() => handleDownload(activeCard.id)} className="p-1.5 rounded-lg bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20 transition" title="Télécharger PDF">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {activeCard.qrData && (
                      <a href={activeCard.qrData} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition" title="Profil public (QR)">
                        <QrCode className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => setModal({ type: 'revoke', data: { id: activeCard.id, staffId: staff.id, name: `${staff.firstName} ${staff.lastName}` } })} className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition" title="Révoquer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleGenerate(staff.id)} disabled={isGenerating} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition disabled:opacity-50" title="Régénérer">
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Régénérer
                    </button>
                  </>
                ) : (
                  <button onClick={() => handleGenerate(staff.id)} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white rounded-lg shadow-sm disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                    {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'BADGE' ? <BadgeCheck className="h-3.5 w-3.5" /> : <IdCard className="h-3.5 w-3.5" />}
                    {mode === 'BADGE' ? 'Générer badge' : 'Générer carte'}
                  </button>
                )}
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
                      {modal.type === 'generateAll' ? `Génération en masse — ${mode === 'BADGE' ? 'Badges' : 'Cartes'}` : modal.type === 'distribute' ? 'Distribution par email' : 'Révocation'}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5">
                      {modal.type === 'generateAll' ? `${staffList.length} personnels` : modal.type === 'distribute' ? `${totalWithCards} ${mode === 'BADGE' ? 'badge(s)' : 'carte(s)'}` : 'Action irréversible'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {modal.type === 'generateAll' && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">Toutes les anciennes {mode === 'BADGE' ? 'badges' : 'cartes'} actifs seront <strong>révoqués</strong> et de nouveaux {mode === 'BADGE' ? 'badges' : 'cartes'} seront générés pour les {staffList.length} personnels actifs. Cette opération peut prendre quelques minutes.</p>
                  </div>
                )}
                {modal.type === 'distribute' && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2">
                    <Send className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800">Chaque personnel recevra sa {mode === 'BADGE' ? 'badge' : 'carte professionnelle'} en <strong>pièce jointe</strong> par email, avec un lien public QR code. {totalWithCards} email(s) seront envoyés.</p>
                  </div>
                )}
                {modal.type === 'revoke' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">La {mode === 'BADGE' ? 'badge' : 'carte'} de <strong>{modal.data?.name}</strong> sera <strong>révoqué(e)</strong>. Le lien QR public ne fonctionnera plus. Cette action est irréversible.</p>
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
