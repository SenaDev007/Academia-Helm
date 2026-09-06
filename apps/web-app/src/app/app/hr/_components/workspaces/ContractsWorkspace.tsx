'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, FileText, Calendar, DollarSign, AlertCircle,
  FileCheck, Files, Download, PenTool, Loader2, X, FileX2,
  RefreshCw, AlertTriangle, HelpCircle, Lightbulb, BadgeCheck, History,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { ContractTerminationModal } from '../modals/ContractTerminationModal';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE:     { label: 'En vigueur',                className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  PENDING:    { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600 border border-amber-200' },
  DRAFT:      { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600 border border-amber-200' },
  EXPIRED:    { label: 'Expiré',                    className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  TERMINATED: { label: 'Résilié',                   className: 'bg-rose-50 text-rose-600 border border-rose-200' },
  DELETED:    { label: 'Supprimé',                  className: 'bg-slate-100 text-slate-400 border border-slate-200' },
};

// Fallback neutre — on n'utilise PLUS 'EXPIRED' comme défaut pour éviter qu'un
// contrat avec un statut inattendu (ou un nouveau statut backend non mappé) soit
// affiché à tort comme « Expiré ».
const STATUS_FALLBACK = {
  label: 'En attente',
  className: 'bg-amber-50 text-amber-600 border border-amber-200',
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

/** Test d'aide à la qualification (CDC §5) — embarqué dans la requalification. */
const DEFAULT_TEST_QUESTIONS = [
  {
    id: 'horaires',
    question: 'Cette personne doit-elle respecter des horaires fixés par l\u2019école ?',
    options: ['Oui', 'Non'] as [string, string],
    firstOptionMeaning: 'subordination' as const,
  },
  {
    id: 'instructions',
    question: 'Reçoit-elle des instructions directes sur la façon d\u2019exécuter son travail, ou définit-elle elle-même sa méthode ?',
    options: ['Reçoit des instructions', 'Définit elle-même sa méthode'] as [string, string],
    firstOptionMeaning: 'subordination' as const,
  },
  {
    id: 'refus',
    question: 'Peut-elle refuser une mission ponctuelle sans conséquence contractuelle ?',
    options: ['Non', 'Oui'] as [string, string],
    firstOptionMeaning: 'subordination' as const,
  },
];

export function ContractsWorkspace() {
  const { tenant } = useModuleContext();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Alertes de conformité (CDC §8) — visibles, jamais masquées
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Paramétrage école (motifs CDD en suggestions — §9)
  const [hrSettings, setHrSettings] = useState<any | null>(null);

  // New contract modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [modalForm, setModalForm] = useState({
    staffId: '',
    statutContractuel: 'SALARIE_DECLARE',
    contractType: 'CDD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    baseSalary: '150000',
    cddMotif: '',
    paymentMode: 'BANK',
    cnssNumber: '',
  });

  // Contract termination modal
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // ⭐ CDC — requalification / renouvellement / clôture CDD
  const [requalifyModal, setRequalifyModal] = useState<any | null>(null); // contract
  const [requalifyForm, setRequalifyForm] = useState({ newType: 'CDD', statut: 'SALARIE_DECLARE', endDate: '', cddMotif: '', baseSalary: '', justification: '', testAnswers: {} as Record<string, 0 | 1> });
  const [requalifyLoading, setRequalifyLoading] = useState(false);
  const [renewModal, setRenewModal] = useState<any | null>(null);
  const [renewForm, setRenewForm] = useState({ startDate: '', endDate: '', cddMotif: '' });
  const [renewLoading, setRenewLoading] = useState(false);
  const [closeModal, setCloseModal] = useState<any | null>(null);
  const [closeForm, setCloseForm] = useState({ remunerationBrute: '', montantAjuste: '', note: '' });
  const [closeLoading, setCloseLoading] = useState(false);
  const [closePreview, setClosePreview] = useState<any | null>(null);

  async function fetchContracts() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const queryParams: Record<string, string> = { tenantId: tenant.id };
      if (filterStatus !== 'ALL') queryParams.status = filterStatus;
      const result = await hrFetch<any[]>(hrUrl('contracts', queryParams));
      setContracts(result);
      // Also fetch staff to show those without contracts
      const staffResult = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
      setStaffList(staffResult.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_SIGNATURE' || s.status === 'PENDING_HIRE'));
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAlerts() {
    if (!tenant?.id) return;
    try {
      setAlertsLoading(true);
      const [alertsResult, settings] = await Promise.all([
        hrFetch<any[]>(hrUrl('contracts/alerts', { tenantId: tenant.id })),
        hrFetch<any>(hrUrl('contracts/settings', { tenantId: tenant.id })),
      ]);
      setAlerts(Array.isArray(alertsResult) ? alertsResult : []);
      setHrSettings(settings);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }

  useEffect(() => { fetchContracts(); fetchAlerts(); }, [tenant?.id, filterStatus]);

  // Fetch staff list when modal opens
  useEffect(() => {
    if (modalOpen && tenant?.id) {
      hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }))
        .then((list) => setStaffList(list.filter((s: any) => s.status === 'ACTIVE' || s.status === 'PENDING_SIGNATURE' || s.status === 'PENDING_HIRE')))
        .catch(() => {});
    }
  }, [modalOpen, tenant?.id]);

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setModalLoading(true);
      const body: any = {
        staffId: modalForm.staffId,
        statutContractuel: modalForm.statutContractuel,
        contractType: modalForm.statutContractuel === 'PRESTATAIRE_SERVICE' ? 'PRESTATION' : modalForm.contractType,
        startDate: new Date(modalForm.startDate).toISOString(),
        endDate: modalForm.contractType === 'CDD' && modalForm.endDate ? new Date(modalForm.endDate).toISOString() : null,
        baseSalary: parseFloat(modalForm.baseSalary),
        paymentMode: modalForm.paymentMode,
        status: 'PENDING',
      };
      if (modalForm.contractType === 'CDD' && modalForm.cddMotif.trim()) body.cddMotif = modalForm.cddMotif.trim();
      if (modalForm.statutContractuel === 'SALARIE_DECLARE' && modalForm.cnssNumber.trim()) {
        // Miroir serveur : le n° CNSS doit être sur la fiche avant la création
        await hrFetch(hrUrl(`staff/${modalForm.staffId}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: { cnssNumber: modalForm.cnssNumber.trim() },
        }).catch(() => {});
      }
      await hrFetch(hrUrl('contracts', { tenantId: tenant.id }), { method: 'POST', body });
      toast({ variant: 'success', title: 'Contrat créé avec succès' });
      setModalOpen(false);
      setModalForm({ staffId: '', statutContractuel: 'SALARIE_DECLARE', contractType: 'CDD', startDate: new Date().toISOString().split('T')[0], endDate: '', baseSalary: '150000', cddMotif: '', paymentMode: 'BANK', cnssNumber: '' });
      fetchContracts();
      fetchAlerts();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur lors de la création du contrat', description: err?.message });
    } finally {
      setModalLoading(false);
    }
  };

  const handleRequalify = async () => {
    if (!requalifyModal) return;
    try {
      setRequalifyLoading(true);
      const body: any = {
        newContractType: requalifyForm.newType,
        statutContractuel: requalifyForm.newType === 'PRESTATION' ? 'PRESTATAIRE_SERVICE' : requalifyForm.statut,
        justification: requalifyForm.justification.trim(),
      };
      if (requalifyForm.newType === 'CDD') {
        body.endDate = requalifyForm.endDate ? new Date(requalifyForm.endDate).toISOString() : null;
        body.cddMotif = requalifyForm.cddMotif.trim();
      }
      if (requalifyForm.baseSalary) body.baseSalary = parseFloat(requalifyForm.baseSalary);
      await hrFetch(hrUrl(`contracts/${requalifyModal.id}/requalify`, { tenantId: tenant.id }), {
        method: 'POST',
        body,
      });
      toast({ variant: 'success', title: 'Dossier requalifié', description: `Le dossier « ${requalifyModal.staff?.firstName} ${requalifyModal.staff?.lastName} » est désormais ${requalifyForm.newType}.` });
      setRequalifyModal(null);
      fetchContracts();
      fetchAlerts();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Requalification impossible', description: err?.message });
    } finally {
      setRequalifyLoading(false);
    }
  };

  const openRenewModal = async (contract: any) => {
    setRenewModal(contract);
    setRenewForm({
      startDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      endDate: '',
      cddMotif: contract.cddMotif || '',
    });
  };

  const handleRenew = async () => {
    if (!renewModal) return;
    try {
      setRenewLoading(true);
      const result = await hrFetch<any>(hrUrl(`contracts/${renewModal.id}/renew`, { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          startDate: new Date(renewForm.startDate).toISOString(),
          endDate: new Date(renewForm.endDate).toISOString(),
          cddMotif: renewForm.cddMotif.trim(),
        },
      });
      toast({
        variant: result?.depasseSeuil ? 'error' : 'success',
        title: result?.depasseSeuil ? 'CDD renouvelé — alerte conformité' : 'CDD renouvelé',
        description: result?.alerte || `Renouvellement n° ${result?.contract?.cddRenouvellements ?? '?'} créé (chaîne conservée).`,
      });
      setRenewModal(null);
      fetchContracts();
      fetchAlerts();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Renouvellement impossible', description: err?.message });
    } finally {
      setRenewLoading(false);
    }
  };

  const openCloseModal = async (contract: any) => {
    setCloseModal(contract);
    setCloseForm({ remunerationBrute: '', montantAjuste: '', note: '' });
    setClosePreview(null);
    try {
      // Estimation indicative côté interface : base = somme des bruts déjà saisis
      const chain = await hrFetch<any>(hrUrl(`contracts/staff/${contract.staffId}/cdd-chain`, { tenantId: tenant.id }));
      const months = contract.startDate && contract.endDate
        ? Math.max(1, Math.round((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
        : 1;
      setClosePreview({
        tauxPct: hrSettings?.indemniteFinContratPct ?? 6,
        estimation: Math.round(Number(contract.baseSalary) * months * (hrSettings?.indemniteFinContratPct ?? 6) / 100),
        months,
        seuil: chain?.seuilMois,
      });
    } catch {
      setClosePreview(null);
    }
  };

  const handleCloseCdd = async () => {
    if (!closeModal) return;
    try {
      setCloseLoading(true);
      const body: any = { note: closeForm.note.trim() || undefined };
      if (closeForm.remunerationBrute) body.remunerationBruteOverride = parseFloat(closeForm.remunerationBrute);
      if (closeForm.montantAjuste) body.montantAjuste = parseFloat(closeForm.montantAjuste);
      const result = await hrFetch<any>(hrUrl(`contracts/${closeModal.id}/close-cdd`, { tenantId: tenant.id }), {
        method: 'POST',
        body,
      });
      toast({
        variant: 'success',
        title: 'CDD clôturé — indemnité enregistrée',
        description: `Indemnité de fin de contrat : ${formatCurrency(result?.indemnite?.montantFinal)} (${result?.indemnite?.tauxPct} % de ${formatCurrency(result?.indemnite?.base)}).`,
      });
      setCloseModal(null);
      fetchContracts();
      fetchAlerts();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Clôture impossible', description: err?.message });
    } finally {
      setCloseLoading(false);
    }
  };

  const expiringSoon = contracts.filter((c) => {
    if (!c.endDate || c.status !== 'ACTIVE') return false;
    const diff = (new Date(c.endDate).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff <= 30;
  });

  const filteredContracts = contracts.filter(
    (c) =>
      `${c.staff?.firstName} ${c.staff?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.staff?.staffCode && c.staff.staffCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Staff without contracts (only show when filterStatus is ALL or ACTIVE, and no search query)
  const staffWithContractIds = new Set(contracts.map(c => c.staffId));
  const staffWithoutContracts = (filterStatus === 'ALL' || filterStatus === 'ACTIVE')
    ? staffList.filter(s =>
        !staffWithContractIds.has(s.id) &&
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const selectClass =
    'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 ' +
    'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition shadow-sm';

  const testSuggestion = (() => {
    let sub = 0, auto = 0, answered = 0;
    for (const q of DEFAULT_TEST_QUESTIONS) {
      const a = requalifyForm.testAnswers[q.id];
      if (a !== 0 && a !== 1) continue;
      answered++;
      const choseFirst = a === 0;
      const firstIsSub = q.firstOptionMeaning === 'subordination';
      if (choseFirst === firstIsSub) sub++;
      else auto++;
    }
    if (answered === 0 || sub === auto) return null;
    return sub > auto ? 'CDD' : 'PRESTATION';
  })();

  return (
    <div className="space-y-6 pb-12">
      {/* ⭐ CDC §8 — Panneau d'alertes de conformité (visibles, JAMAIS masquées) */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-amber-50">
            {alertsLoading ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Conformité contrats — {alerts.length} alerte{alerts.length > 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-amber-100 max-h-56 overflow-y-auto">
            {alerts.slice(0, 12).map((a, i) => (
              <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                <span className={cn('mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full', a.severity === 'critique' ? 'bg-rose-500' : 'bg-amber-500')} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800">{a.title}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{a.message}</p>
                </div>
                {a.action === 'REQUALIFIER' && a.contractId && (
                  <button
                    onClick={() => {
                      const c = contracts.find((x) => x.id === a.contractId) || a;
                      setRequalifyModal(c);
                      setRequalifyForm({ newType: 'CDD', statut: 'SALARIE_DECLARE', endDate: '', cddMotif: '', baseSalary: c.baseSalary ? String(Number(c.baseSalary)) : '', justification: '', testAnswers: {} });
                    }}
                    className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition whitespace-nowrap"
                  >
                    Requalifier
                  </button>
                )}
                {a.action === 'CLOTURER' && a.contractId && (
                  <button
                    onClick={() => {
                      const c = contracts.find((x) => x.id === a.contractId);
                      if (c) openCloseModal(c);
                    }}
                    className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 transition whitespace-nowrap"
                  >
                    Clôturer
                  </button>
                )}
                {a.action === 'RENOUVELER' && a.contractId && (
                  <button
                    onClick={() => {
                      const c = contracts.find((x) => x.id === a.contractId);
                      if (c) openRenewModal(c);
                    }}
                    className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition whitespace-nowrap"
                  >
                    Renouveler
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Contract Modal — CDC §4 : statut + type filtré (CDI/CDD | PRESTATION) */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><FileText className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Nouveau Contrat / Avenant</h3>
                  <p className="text-xs text-white/70">Statut contractuel d&apos;abord, puis le type filtré</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateContract} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Collaborateur</label>
                <select className={inputClass} value={modalForm.staffId} onChange={(e) => setModalForm({ ...modalForm, staffId: e.target.value })} required>
                  <option value="">Sélectionner un collaborateur…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.staffCode || s.position})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Statut contractuel *</label>
                  <select
                    className={inputClass}
                    value={modalForm.statutContractuel}
                    onChange={(e) => {
                      const statut = e.target.value;
                      setModalForm({
                        ...modalForm,
                        statutContractuel: statut,
                        contractType: statut === 'PRESTATAIRE_SERVICE' ? 'PRESTATION' : (modalForm.contractType === 'PRESTATION' ? 'CDD' : modalForm.contractType),
                      });
                    }}
                  >
                    <option value="SALARIE_DECLARE">Salarié déclaré (CNSS)</option>
                    <option value="SALARIE_NON_DECLARE">Salarié non déclaré</option>
                    <option value="PRESTATAIRE_SERVICE">Prestataire de services</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">Conditionne le gabarit, le document de paie et les retenues.</p>
                </div>
                <div>
                  <label className={labelClass}>Type de contrat *</label>
                  <select
                    className={inputClass}
                    value={modalForm.contractType}
                    onChange={(e) => setModalForm({ ...modalForm, contractType: e.target.value })}
                    disabled={modalForm.statutContractuel === 'PRESTATAIRE_SERVICE'}
                  >
                    {modalForm.statutContractuel === 'PRESTATAIRE_SERVICE' ? (
                      <option value="PRESTATION">Contrat de prestation de services</option>
                    ) : (
                      <>
                        <option value="CDD">CDD</option>
                        <option value="CDI">CDI</option>
                      </>
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {modalForm.statutContractuel === 'PRESTATAIRE_SERVICE'
                      ? 'Type unique imposé — nature juridique distincte.'
                      : 'Un salarié ne reçoit que CDI ou CDD (stage : flux « Stagiaires »).'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de début</label>
                  <input type="date" className={inputClass} value={modalForm.startDate} onChange={(e) => setModalForm({ ...modalForm, startDate: e.target.value })} required />
                </div>
                <div>
                  <label className={labelClass}>Date de fin{modalForm.contractType === 'CDI' ? ' (aucune pour un CDI)' : ' *'}</label>
                  <input
                    type="date"
                    className={inputClass}
                    min={modalForm.startDate || undefined}
                    value={modalForm.endDate}
                    onChange={(e) => setModalForm({ ...modalForm, endDate: e.target.value })}
                    required={modalForm.contractType === 'CDD'}
                    disabled={modalForm.contractType === 'CDI' || modalForm.statutContractuel === 'PRESTATAIRE_SERVICE'}
                  />
                </div>
              </div>
              {modalForm.contractType === 'CDD' && modalForm.statutContractuel !== 'PRESTATAIRE_SERVICE' && (
                <div>
                  <label className={labelClass}>Motif du CDD *</label>
                  <input
                    type="text"
                    list="cdd-motifs-ws"
                    className={inputClass}
                    placeholder="Ex : Remplacement d'un salarié absent…"
                    value={modalForm.cddMotif}
                    onChange={(e) => setModalForm({ ...modalForm, cddMotif: e.target.value })}
                    required
                  />
                  <datalist id="cdd-motifs-ws">
                    {(hrSettings?.cddMotifs ?? []).map((m: string, i: number) => (
                      <option key={i} value={m} />
                    ))}
                  </datalist>
                </div>
              )}
              {modalForm.statutContractuel === 'SALARIE_DECLARE' && (
                <div>
                  <label className={labelClass}>N° CNSS</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Obligatoire pour un salarié déclaré"
                    value={modalForm.cnssNumber}
                    onChange={(e) => setModalForm({ ...modalForm, cnssNumber: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Sera reporté sur la fiche du personnel avant création.</p>
                </div>
              )}
              <div>
                <label className={labelClass}>Salaire de base (Mensuel)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="number" className={inputClass + ' pl-9'} value={modalForm.baseSalary} onChange={(e) => setModalForm({ ...modalForm, baseSalary: e.target.value })} required min={0} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={modalLoading || !modalForm.staffId} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {modalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le contrat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⭐ CDC §10 — Modal de requalification d'un dossier « Vacataire » */}
      {requalifyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: '#b45309' }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><HelpCircle className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Requalifier le dossier « Vacataire »</h3>
                  <p className="text-xs text-white/70">{requalifyModal.staff?.firstName} {requalifyModal.staff?.lastName} — {requalifyModal.contractType}</p>
                </div>
              </div>
              <button onClick={() => setRequalifyModal(null)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                « Vacataire » n&apos;est pas une catégorie du Code du travail béninois : ce dossier doit être
                requalifié en <strong>CDD</strong> (subordination réelle) ou en <strong>contrat de prestation de
                services</strong> (autonomie). Le test ci-dessous vous aide à trancher — la décision vous
                appartient.
              </div>

              {/* Test d'aide à la décision (§10.2) */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
                <p className="text-xs font-bold text-[#1d4fa5] flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Test d&apos;aide à la décision (non bloquant)
                </p>
                {DEFAULT_TEST_QUESTIONS.map((q, idx) => (
                  <div key={q.id}>
                    <p className="text-[11px] font-semibold text-slate-700">{idx + 1}. {q.question}</p>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      {q.options.map((opt, oi) => (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setRequalifyForm((prev) => ({ ...prev, testAnswers: { ...prev.testAnswers, [q.id]: oi as 0 | 1 } }))}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition text-left',
                            requalifyForm.testAnswers[q.id] === oi
                              ? 'border-[#1d4fa5] bg-[#1d4fa5]/10 text-[#1d4fa5]'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {testSuggestion && (
                  <div className="rounded-lg bg-white border border-emerald-200 p-3 text-[11px] leading-relaxed text-slate-600">
                    <strong className="text-emerald-700">Suggestion : {testSuggestion === 'CDD' ? 'CDD (salarié — subordination)' : 'Contrat de prestation (autonomie)'}</strong>
                    <br />Vous choisissez librement ci-dessous.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nouvelle qualification *</label>
                  <select
                    className={inputClass}
                    value={requalifyForm.newType}
                    onChange={(e) => setRequalifyForm({ ...requalifyForm, newType: e.target.value })}
                  >
                    <option value="CDD">CDD (salarié)</option>
                    <option value="CDI">CDI (salarié)</option>
                    <option value="PRESTATION">Contrat de prestation de services</option>
                  </select>
                </div>
                {requalifyForm.newType !== 'PRESTATION' && (
                  <div>
                    <label className={labelClass}>Statut</label>
                    <select
                      className={inputClass}
                      value={requalifyForm.statut}
                      onChange={(e) => setRequalifyForm({ ...requalifyForm, statut: e.target.value })}
                      disabled={requalifyForm.newType === 'PRESTATION'}
                    >
                      <option value="SALARIE_DECLARE">Salarié déclaré (CNSS)</option>
                      <option value="SALARIE_NON_DECLARE">Salarié non déclaré</option>
                    </select>
                  </div>
                )}
              </div>
              {requalifyForm.newType === 'CDD' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date de fin du CDD *</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={requalifyForm.endDate}
                      onChange={(e) => setRequalifyForm({ ...requalifyForm, endDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Motif du CDD *</label>
                    <input
                      type="text"
                      list="cdd-motifs-rq"
                      className={inputClass}
                      placeholder="Ex : enseignement en vacation subordonnée…"
                      value={requalifyForm.cddMotif}
                      onChange={(e) => setRequalifyForm({ ...requalifyForm, cddMotif: e.target.value })}
                    />
                    <datalist id="cdd-motifs-rq">
                      {(hrSettings?.cddMotifs ?? []).map((m: string, i: number) => (
                        <option key={i} value={m} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}
              <div>
                <label className={labelClass}>Salaire / montant (FCFA)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="Salaire mensuel (salarié) ou montant/taux (prestation)"
                  value={requalifyForm.baseSalary}
                  onChange={(e) => setRequalifyForm({ ...requalifyForm, baseSalary: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Justification de la requalification *</label>
                <textarea
                  className={inputClass + ' min-h-[70px]'}
                  placeholder="Ex : suit l'emploi du temps de l'école et reçoit des instructions directes → salarié en CDD."
                  value={requalifyForm.justification}
                  onChange={(e) => setRequalifyForm({ ...requalifyForm, justification: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">10 caractères minimum — tracée sur le contrat et la fiche (staff_statut_changes si le statut change).</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white">
              <button type="button" onClick={() => setRequalifyModal(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
              <button
                type="button"
                disabled={requalifyLoading || requalifyForm.justification.trim().length < 10 || (requalifyForm.newType === 'CDD' && (!requalifyForm.endDate || !requalifyForm.cddMotif.trim()))}
                onClick={handleRequalify}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ background: '#b45309' }}
              >
                {requalifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} Requalifier le dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Modal renouvellement CDD (§4.3 — même chaîne, compteur + durée cumulée) */}
      {renewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><RefreshCw className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Renouveler le CDD</h3>
                  <p className="text-xs text-white/70">{renewModal.staff?.firstName} {renewModal.staff?.lastName} — renouvellement n° {(renewModal.cddRenouvellements ?? 0) + 1}</p>
                </div>
              </div>
              <button onClick={() => setRenewModal(null)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nouvelle date de début *</label>
                  <input type="date" className={inputClass} value={renewForm.startDate} onChange={(e) => setRenewForm({ ...renewForm, startDate: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Nouvelle date de fin *</label>
                  <input type="date" className={inputClass} min={renewForm.startDate || undefined} value={renewForm.endDate} onChange={(e) => setRenewForm({ ...renewForm, endDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Motif du CDD renouvelé *</label>
                <input
                  type="text"
                  list="cdd-motifs-rn"
                  className={inputClass}
                  value={renewForm.cddMotif}
                  onChange={(e) => setRenewForm({ ...renewForm, cddMotif: e.target.value })}
                />
                <datalist id="cdd-motifs-rn">
                  {(hrSettings?.cddMotifs ?? []).map((m: string, i: number) => (
                    <option key={i} value={m} />
                  ))}
                </datalist>
                <p className="text-[10px] text-slate-400 mt-1">
                  La durée cumulée (contrat initial + renouvellements) est recalculée : au-delà du seuil de
                  votre école ({hrSettings?.cddDureeMaxMois ?? 24} mois), la relation devient un CDI de plein droit.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={() => setRenewModal(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
              <button
                type="button"
                disabled={renewLoading || !renewForm.startDate || !renewForm.endDate || !renewForm.cddMotif.trim()}
                onClick={handleRenew}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: PRIMARY }}
              >
                {renewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Renouveler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Modal clôture CDD avec indemnité de fin de contrat (§8.4) */}
      {closeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: '#0b7a5a' }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><FileCheck className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Clôturer le CDD — indemnité de fin de contrat</h3>
                  <p className="text-xs text-white/70">{closeModal.staff?.firstName} {closeModal.staff?.lastName}</p>
                </div>
              </div>
              <button onClick={() => setCloseModal(null)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-800 leading-relaxed">
                À l&apos;expiration d&apos;un CDD (non renouvelé, non transformé en CDI), le salarié a droit à
                une indemnité égale à <strong>{closePreview?.tauxPct ?? hrSettings?.indemniteFinContratPct ?? 6} %</strong> de
                la rémunération totale brute versée pendant la durée du contrat. Vous pouvez ajuster le montant
                avant validation.
              </div>
              <div>
                <label className={labelClass}>Rémunération brute totale (base — FCFA)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder={closePreview ? `Estimation : ${closePreview.estimation.toLocaleString('fr-FR')} (${closePreview.months} mois × salaire)` : 'Somme des bruts versés (paie)'}
                  value={closeForm.remunerationBrute}
                  onChange={(e) => setCloseForm({ ...closeForm, remunerationBrute: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Vide = calcul automatique depuis la paie saisie (somme des bruts).</p>
              </div>
              <div>
                <label className={labelClass}>Montant de l&apos;indemnité (FCFA) — ajustable</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder={closePreview ? `${closePreview.estimation.toLocaleString('fr-FR')} (calculé)` : 'Calcul automatique'}
                  value={closeForm.montantAjuste}
                  onChange={(e) => setCloseForm({ ...closeForm, montantAjuste: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Vide = montant calculé (base × taux). L&apos;écart éventuel est tracé.</p>
              </div>
              <div>
                <label className={labelClass}>Note interne (optionnel)</label>
                <textarea
                  className={inputClass + ' min-h-[50px]'}
                  placeholder="Ex : prime exceptionnelle incluse dans la base…"
                  value={closeForm.note}
                  onChange={(e) => setCloseForm({ ...closeForm, note: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={() => setCloseModal(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
              <button
                type="button"
                disabled={closeLoading}
                onClick={handleCloseCdd}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ background: '#0b7a5a' }}
              >
                {closeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />} Clôturer et enregistrer l&apos;indemnité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contrats actifs', value: contracts.filter((c) => c.status === 'ACTIVE').length },
          { label: 'En attente de signature', value: contracts.filter((c) => c.status === 'DRAFT' || c.status === 'PENDING').length },
          { label: 'Échéances J-30', value: expiringSoon.length },
          { label: 'Dossiers à requalifier', value: contracts.filter((c) => c.needsRequalification).length },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={'text-xl font-bold mt-0.5 ' + (k.label === 'Dossiers à requalifier' && k.value > 0 ? 'text-amber-600' : 'text-slate-900')}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="relative flex-grow md:flex-grow-0 md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou matricule…"
              className={selectClass + ' pl-9 w-full'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ACTIVE">Contrats Actifs</option>
            <option value="DRAFT">En attente de signature</option>
            <option value="ALL">Historique Complet</option>
            <option value="EXPIRED">Expirés</option>
            <option value="TERMINATED">Terminés</option>
          </select>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-4 w-4" />
          Nouveau contrat / Avenant
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredContracts.length === 0 && staffWithoutContracts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
            <Files className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun contrat trouvé</h3>
          <p className="text-sm text-slate-500 mt-2">Commencez par générer un contrat pour un membre du personnel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredContracts.map((contract, idx) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              index={idx}
              tenantId={tenant.id}
              onTerminate={(c) => { setSelectedContract(c); setTerminationModalOpen(true); }}
              onRequalify={(c) => {
                setRequalifyModal(c);
                setRequalifyForm({ newType: 'CDD', statut: 'SALARIE_DECLARE', endDate: '', cddMotif: '', baseSalary: c.baseSalary ? String(Number(c.baseSalary)) : '', justification: '', testAnswers: {} });
              }}
              onRenew={openRenewModal}
              onCloseCdd={openCloseModal}
            />
          ))}
          {/* Staff without contracts - shown as "pending" entries */}
          {staffWithoutContracts.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-4 pb-1">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                  Personnel sans contrat ({staffWithoutContracts.length})
                </p>
              </div>
              {staffWithoutContracts.map((staff, idx) => (
                <PendingContractRow
                  key={staff.id}
                  staff={staff}
                  index={idx + filteredContracts.length}
                  onCreate={() => {
                    setModalForm({
                      ...modalForm,
                      staffId: staff.id,
                    });
                    setModalOpen(true);
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Contract Termination Modal */}
      <ContractTerminationModal
        isOpen={terminationModalOpen}
        onClose={() => { setTerminationModalOpen(false); setSelectedContract(null); }}
        onSuccess={fetchContracts}
        contract={selectedContract}
        tenantId={tenant?.id || ''}
      />
    </div>
  );
}

function ContractRow({
  contract, index, tenantId, onTerminate, onRequalify, onRenew, onCloseCdd,
}: {
  contract: any; index: number; tenantId: string;
  onTerminate: (contract: any) => void;
  onRequalify: (contract: any) => void;
  onRenew: (contract: any) => void;
  onCloseCdd: (contract: any) => void;
}) {
  const [generating, setGenerating] = useState(false);

  const isExpiringSoon = () => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return false;
    const diff = (new Date(contract.endDate).getTime() - Date.now()) / 86400000;
    return diff > 0 && diff <= 30;
  };
  // CDD échu non clôturé (§8.1) — tant qu'aucune indemnité n'est enregistrée
  const isCddEchuNonCloture = () => {
    if (contract.contractType !== 'CDD' || !contract.endDate) return false;
    if (!['ACTIVE', 'PENDING', 'DRAFT'].includes(contract.status)) return false;
    if (contract.terms?.indemniteFinContrat) return false;
    return new Date(contract.endDate).getTime() < Date.now();
  };
  const status = STATUS_CONFIG[contract.status] || STATUS_FALLBACK;
  const isSigned = !!contract.signedAt;
  const isCDD = contract.contractType === 'CDD';
  const needsRequalif = !!contract.needsRequalification;
  const indemniteEnregistree = !!contract.terms?.indemniteFinContrat;

  async function handleGeneratePdf() {
    try {
      setGenerating(true);
      await hrFetch(hrUrl(`contracts/${contract.id}/generate-pdf`, { tenantId }), { method: 'POST' });
      toast({ variant: 'success', title: 'PDF généré avec succès !' });
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur lors de la génération PDF.',
        description: err?.message || 'Erreur inconnue',
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden',
        needsRequalif
          ? 'border-amber-300 bg-amber-50/30'
          : isCddEchuNonCloture()
          ? 'border-rose-300 bg-rose-50/20'
          : isExpiringSoon() ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200',
      )}
    >
      <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {contract.staff?.photoUrl ? (
            <img
              src={contract.staff.photoUrl}
              alt={`${contract.staff?.firstName} ${contract.staff?.lastName}`}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-200"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
              {contract.staff?.firstName?.[0]}{contract.staff?.lastName?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{contract.staff?.firstName} {contract.staff?.lastName}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
                needsRequalif
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : contract.contractType === 'PRESTATION'
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500',
              )}>
                {contract.contractType}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">#{contract.staff?.staffCode}</span>
              {needsRequalif && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequalify(contract); }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 transition"
                  title="Requalifier ce dossier (CDD ou prestation)"
                >
                  À requalifier →
                </button>
              )}
              {isCDD && (contract.cddRenouvellements ?? 0) > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500 flex items-center gap-0.5" title="Renouvellements de la chaîne CDD">
                  <History className="h-2.5 w-2.5" /> Renouv. n°{contract.cddRenouvellements}
                </span>
              )}
              {indemniteEnregistree && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700" title="Indemnité de fin de contrat enregistrée">
                  Clôturé — indemnité {formatCurrency(contract.terms?.indemniteFinContrat?.montantFinal)}
                </span>
              )}
              {isSigned ? (
                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                  <PenTool className="h-2.5 w-2.5" /> Signé
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                  <PenTool className="h-2.5 w-2.5" /> Non signé
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 flex-grow w-full md:max-w-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Période</p>
            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{new Date(contract.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })} → {contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'Indéfini'}</span>
            </div>
            {isCDD && contract.cddMotif && (
              <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={contract.cddMotif}>Motif : {contract.cddMotif}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Salaire de base</p>
            <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600">
              <DollarSign className="h-3.5 w-3.5 shrink-0" />{formatCurrency(contract.baseSalary)}
            </div>
          </div>
          <div className="hidden md:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Statut</p>
            {isCddEchuNonCloture() ? (
              <div className="flex items-center gap-1 text-xs font-bold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> Échu non clôturé — CDI de plein droit</div>
            ) : isExpiringSoon() ? (
              <div className="flex items-center gap-1 text-xs font-bold text-amber-600 animate-pulse"><AlertCircle className="h-3.5 w-3.5" /> Expiration proche</div>
            ) : (
              <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', status.className)}>{status.label}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t md:border-none pt-3 md:pt-0 w-full md:w-auto">
          {/* ⭐ CDC §4.3/§8.4 — actions CDD : renouveler / clôturer */}
          {isCDD && !indemniteEnregistree && ['ACTIVE', 'PENDING', 'DRAFT'].includes(contract.status) && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRenew(contract); }}
              className="flex-shrink-0 p-2 text-[#1A2BA6] hover:bg-blue-50 transition-colors rounded-lg"
              title="Renouveler ce CDD (même chaîne, compteur + durée cumulée)"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          {isCDD && !indemniteEnregistree && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCloseCdd(contract); }}
              className="flex-shrink-0 p-2 text-emerald-600 hover:bg-emerald-50 transition-colors rounded-lg"
              title="Clôturer le CDD — indemnité de fin de contrat (6 %)"
            >
              <FileCheck className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleGeneratePdf}
            disabled={generating}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-[#1A2BA6] transition-colors rounded-lg hover:bg-slate-50"
            title="Générer PDF"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          </button>
          {contract.status === 'ACTIVE' && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTerminate(contract); }}
              className="flex-shrink-0 p-2 text-rose-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-rose-50"
              title="Résilier le contrat"
            >
              <FileX2 className="h-4 w-4" />
            </button>
          )}
          <Link href={`/app/hr/contracts/${contract.id}`} className="flex-grow md:flex-grow-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors" style={{ color: PRIMARY }}>
            <FileCheck className="h-4 w-4" /> Ouvrir le contrat
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

function PendingContractRow({ staff, index, onCreate }: { staff: any; index: number; onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {staff.photoUrl ? (
            <img
              src={staff.photoUrl}
              alt={`${staff.firstName} ${staff.lastName}`}
              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-amber-200"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 bg-amber-100 text-amber-700">
              {staff.firstName?.[0]}{staff.lastName?.[0]}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate">{staff.firstName} {staff.lastName}</h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-700">
                Aucun contrat
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {staff.position || 'Personnel'} · {staff.tenantMatricule || staff.employeeNumber || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t md:border-none pt-3 md:pt-0 w-full md:w-auto">
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-colors whitespace-nowrap"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" /> Créer un contrat
          </button>
        </div>
      </div>
    </motion.div>
  );
}
