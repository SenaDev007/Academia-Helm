'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap, Plus, Search, Loader2, X, FileText, Download, ShieldCheck,
  Building2, User, Calendar, DollarSign, Info, AlertTriangle, CheckCircle2, Ban, FileCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#0A2A5E';
const GREEN = '#0b7a5a';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#0A2A5E] focus:ring-2 focus:ring-[#0A2A5E]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

const STAGE_STATUS: Record<string, { label: string; className: string }> = {
  DRAFT:    { label: 'Brouillon — assurance à souscrire', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  ACTIVE:   { label: 'En cours', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  ENDED:    { label: 'Terminé', className: 'bg-slate-100 text-slate-500 border border-slate-200' },
  CANCELLED:{ label: 'Annulé', className: 'bg-rose-50 text-rose-600 border border-rose-200' },
};

interface InternshipForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  position: string;
  typeStage: string;
  startDate: string;
  endDate: string;
  gratificationAmount: string;
  gratificationPeriodicite: string;
  etablissementOrigine: string;
  tuteurNom: string;
  assuranceSouscrite: boolean;
  assurancePoliceRef: string;
  assuranceCompagnie: string;
}

const EMPTY_FORM: InternshipForm = {
  firstName: '', lastName: '', email: '', phone: '', nationalId: '',
  position: '', typeStage: '', startDate: new Date().toISOString().split('T')[0], endDate: '',
  gratificationAmount: '', gratificationPeriodicite: 'mensuellement', etablissementOrigine: '',
  tuteurNom: '', assuranceSouscrite: false, assurancePoliceRef: '', assuranceCompagnie: '',
};

export function InternshipsWorkspace() {
  const { tenant } = useModuleContext();
  const [internships, setInternships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [staffList, setStaffList] = useState<any[]>([]);

  // Paramétrage école : types de stage suggérés (§6/§9 — jamais une liste figée)
  const [stageTypes, setStageTypes] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<InternshipForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  // Validation immédiate (ACTIVE) demandée depuis la modale
  const [wantActive, setWantActive] = useState(false);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInternships = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const params: Record<string, string> = { tenantId: tenant.id };
      if (filterStatus !== 'ALL') params.status = filterStatus;
      const result = await hrFetch<any[]>(hrUrl('internships', params));
      setInternships(Array.isArray(result) ? result : []);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de chargement', description: err?.message });
      setInternships([]);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, filterStatus]);

  useEffect(() => { fetchInternships(); }, [fetchInternships]);

  useEffect(() => {
    if (!tenant?.id) return;
    hrFetch<any>(hrUrl('contracts/settings', { tenantId: tenant.id }))
      .then((s) => setStageTypes(Array.isArray(s?.stageTypes) ? s.stageTypes : []))
      .catch(() => setStageTypes([]));
    hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }))
      .then((list) => setStaffList(Array.isArray(list) ? list.filter((s: any) => s.status !== 'ARCHIVED') : []))
      .catch(() => setStaffList([]));
  }, [tenant?.id]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setWantActive(false);
    setModalOpen(true);
  };

  const openEdit = (internship: any) => {
    setEditing(internship);
    setForm({
      firstName: internship.firstName || '',
      lastName: internship.lastName || '',
      email: internship.email || '',
      phone: internship.phone || '',
      nationalId: internship.nationalId || '',
      position: internship.position || '',
      typeStage: internship.typeStage || '',
      startDate: internship.startDate ? new Date(internship.startDate).toISOString().split('T')[0] : '',
      endDate: internship.endDate ? new Date(internship.endDate).toISOString().split('T')[0] : '',
      gratificationAmount: internship.gratificationAmount != null ? String(Number(internship.gratificationAmount)) : '',
      gratificationPeriodicite: internship.gratificationPeriodicite || 'mensuellement',
      etablissementOrigine: internship.etablissementOrigine || '',
      tuteurNom: internship.tuteurNom || '',
      assuranceSouscrite: internship.assuranceSouscrite === true,
      assurancePoliceRef: internship.assurancePoliceRef || '',
      assuranceCompagnie: internship.assuranceCompagnie || '',
    });
    setWantActive(internship.status === 'ACTIVE');
    setModalOpen(true);
  };

  const assuranceValide = form.assuranceSouscrite && !!form.assurancePoliceRef.trim();

  const handleSave = async () => {
    try {
      setSaving(true);
      const body: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        nationalId: form.nationalId.trim() || undefined,
        position: form.position.trim() || undefined,
        typeStage: form.typeStage.trim() || undefined,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        gratificationAmount: form.gratificationAmount ? parseFloat(form.gratificationAmount) : undefined,
        gratificationPeriodicite: form.gratificationPeriodicite.trim() || undefined,
        etablissementOrigine: form.etablissementOrigine.trim() || undefined,
        tuteurNom: form.tuteurNom.trim() || undefined,
        assuranceSouscrite: form.assuranceSouscrite,
        assurancePoliceRef: form.assurancePoliceRef.trim() || undefined,
        assuranceCompagnie: form.assuranceCompagnie.trim() || undefined,
      };
      if (wantActive) body.status = 'ACTIVE';

      if (editing) {
        await hrFetch(hrUrl(`internships/${editing.id}`, { tenantId: tenant.id }), { method: 'PUT', body });
        if (wantActive && editing.status !== 'ACTIVE') {
          await hrFetch(hrUrl(`internships/${editing.id}/status`, { tenantId: tenant.id }), {
            method: 'PUT', body: { status: 'ACTIVE' },
          });
        }
      } else {
        await hrFetch(hrUrl('internships', { tenantId: tenant.id }), { method: 'POST', body });
      }
      toast({ variant: 'success', title: editing ? 'Stage mis à jour' : 'Convention de stage créée' });
      setModalOpen(false);
      fetchInternships();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Enregistrement impossible', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (internship: any, status: string) => {
    try {
      await hrFetch(hrUrl(`internships/${internship.id}/status`, { tenantId: tenant.id }), {
        method: 'PUT', body: { status },
      });
      toast({ variant: 'success', title: 'Statut mis à jour', description: `${internship.firstName} ${internship.lastName} → ${STAGE_STATUS[status]?.label ?? status}` });
      fetchInternships();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Changement de statut impossible', description: err?.message });
    }
  };

  const generateConvention = async (internship: any) => {
    try {
      setGeneratingId(internship.id);
      await hrFetch(hrUrl(`internships/${internship.id}/convention`, { tenantId: tenant.id }), { method: 'POST' });
      toast({ variant: 'success', title: 'Convention générée', description: 'PDF scellé SHA-256, archivé, filigrane acronyme de l\u2019école.' });
      fetchInternships();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Génération impossible', description: err?.message });
    } finally {
      setGeneratingId(null);
    }
  };

  const downloadConvention = async (internship: any) => {
    try {
      setDownloadingId(internship.id);
      const res = await fetch(
        `/api/hr/internships/${internship.id}/convention/download?tenantId=${encodeURIComponent(tenant.id)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || 'Téléchargement impossible');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convention-stage-${internship.firstName}-${internship.lastName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Téléchargement impossible', description: err?.message });
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = internships.filter((s) =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    (s.etablissementOrigine || '').toLowerCase().includes(search.toLowerCase()),
  );

  const canSave =
    !!form.firstName.trim() && !!form.lastName.trim() && !!form.startDate && !!form.endDate &&
    new Date(form.endDate) > new Date(form.startDate) &&
    (!wantActive || assuranceValide);

  return (
    <div className="space-y-6 pb-12">
      {/* Bandeau pédagogique — un stagiaire n'est pas un salarié */}
      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
        <Info className="h-4 w-4 text-[#0A2A5E] shrink-0 mt-0.5" />
        <div>
          <strong>Flux stage séparé de l&apos;embauche salariée</strong> (Décret n°2018-196 du 23 mai 2018) :
          un stagiaire n&apos;est pas un salarié — pas de contrat de travail, pas de bulletin de paie, mais une
          <strong> gratification</strong> (si applicable) et une <strong>assurance accident du travail</strong> à la
          charge de l&apos;établissement d&apos;accueil (<strong>référence de police obligatoire avant validation</strong>).
          La convention est générée par le même moteur de documents que les contrats.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Stagiaires en cours', value: internships.filter((s) => s.status === 'ACTIVE').length },
          { label: 'Brouillons (assurance en attente)', value: internships.filter((s) => s.status === 'DRAFT').length },
          { label: 'Stages terminés', value: internships.filter((s) => s.status === 'ENDED').length },
          { label: 'Conventions générées', value: internships.filter((s) => s.terms?.conventionUrl).length },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{k.value}</p>
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
              placeholder="Rechercher un stagiaire, un établissement…"
              className={inputClass + ' pl-9'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="DRAFT">Brouillons</option>
            <option value="ACTIVE">En cours</option>
            <option value="ENDED">Terminés</option>
            <option value="CANCELLED">Annulés</option>
          </select>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus className="h-4 w-4" /> Nouvelle convention de stage
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
            <GraduationCap className="h-10 w-10 text-slate-300" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucun stagiaire enregistré</h3>
          <p className="text-sm text-slate-500 mt-2">
            Créez une convention de stage : identité, type (paramétrable), durée, gratification, tuteur et assurance.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((internship, idx) => {
            const st = STAGE_STATUS[internship.status] || { label: internship.status, className: 'bg-slate-100 text-slate-500 border border-slate-200' };
            const hasConvention = !!internship.terms?.conventionUrl;
            const assuranceManquante = internship.status === 'DRAFT' && (!internship.assuranceSouscrite || !internship.assurancePoliceRef);
            const mois = internship.startDate && internship.endDate
              ? Math.max(1, Math.round((new Date(internship.endDate).getTime() - new Date(internship.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
              : 0;
            return (
              <motion.div
                key={internship.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={cn(
                  'rounded-xl border bg-white shadow-sm hover:shadow-md transition-all overflow-hidden',
                  assuranceManquante ? 'border-amber-300' : 'border-slate-200',
                )}
              >
                <div className="p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                      {internship.firstName?.[0]}{internship.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm truncate">{internship.firstName} {internship.lastName}</h4>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider', st.className)}>{st.label}</span>
                        {internship.typeStage && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-500">{internship.typeStage}</span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium">{mois} mois</span>
                        {internship.gratificationAmount != null && Number(internship.gratificationAmount) > 0 && (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <DollarSign className="h-2.5 w-2.5" /> {formatCurrency(internship.gratificationAmount)}
                          </span>
                        )}
                      </div>
                      {internship.etablissementOrigine && (
                        <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <Building2 className="h-2.5 w-2.5" /> {internship.etablissementOrigine}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 flex-grow w-full md:max-w-lg">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Période</p>
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>
                          {internship.startDate ? new Date(internship.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'} →{' '}
                          {internship.endDate ? new Date(internship.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Assurance AT</p>
                      {internship.assuranceSouscrite && internship.assurancePoliceRef ? (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> Police {internship.assurancePoliceRef}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> À souscrire
                        </span>
                      )}
                    </div>
                    <div className="hidden md:block">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Tuteur</p>
                      <span className="text-[11px] font-medium text-slate-600">
                        {internship.tuteurNom || (internship.tuteur ? `${internship.tuteur.firstName} ${internship.tuteur.lastName}` : '—')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t md:border-none pt-3 md:pt-0 w-full md:w-auto">
                    {internship.status === 'DRAFT' && (
                      <button
                        onClick={() => changeStatus(internship, 'ACTIVE')}
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white transition whitespace-nowrap"
                        style={{ background: GREEN }}
                        title="Valider le stage (assurance obligatoire)"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                      </button>
                    )}
                    {internship.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => generateConvention(internship)}
                          disabled={generatingId === internship.id}
                          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-[#0A2A5E]/10 text-[#0A2A5E] hover:bg-[#0A2A5E]/20 transition whitespace-nowrap"
                          title="Générer la convention de stage (même moteur que les contrats)"
                        >
                          {generatingId === internship.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                          {hasConvention ? 'Régénérer' : 'Convention'}
                        </button>
                        <button
                          onClick={() => changeStatus(internship, 'ENDED')}
                          className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition whitespace-nowrap"
                          title="Marquer le stage terminé"
                        >
                          <Ban className="h-3.5 w-3.5" /> Terminer
                        </button>
                      </>
                    )}
                    {hasConvention && (
                      <button
                        onClick={() => downloadConvention(internship)}
                        disabled={downloadingId === internship.id}
                        className="flex-shrink-0 p-2 text-slate-400 hover:text-[#0A2A5E] transition-colors rounded-lg hover:bg-slate-50"
                        title="Télécharger la convention (PDF scellé SHA-256)"
                      >
                        {downloadingId === internship.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </button>
                    )}
                    {internship.status !== 'ENDED' && internship.status !== 'CANCELLED' && (
                      <button
                        onClick={() => openEdit(internship)}
                        className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition whitespace-nowrap"
                        style={{ color: PRIMARY }}
                      >
                        <User className="h-3.5 w-3.5" /> Modifier
                      </button>
                    )}
                  </div>
                </div>
                {hasConvention && (
                  <div className="px-4 md:px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                    <FileCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <p className="text-[10px] text-slate-500">
                      Convention générée le {internship.terms?.conventionGeneratedAt ? new Date(internship.terms.conventionGeneratedAt).toLocaleString('fr-FR') : '—'} —
                      empreinte SHA-256 : <span className="font-mono">{String(internship.terms?.conventionHash || '').slice(0, 16)}…</span>
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modale création/édition */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 text-white shrink-0" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><GraduationCap className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">{editing ? 'Modifier la convention de stage' : 'Nouvelle convention de stage'}</h3>
                  <p className="text-xs text-white/70">Décret n°2018-196 — flux distinct de l&apos;embauche salariée</p>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Prénom *</label>
                  <input className={inputClass} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input className={inputClass} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input className={inputClass} placeholder="Ex : 229 97 00 00 00" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type de stage</label>
                  <input
                    className={inputClass}
                    list="stage-types-list"
                    placeholder="Ex : Stage de fin d'études"
                    value={form.typeStage}
                    onChange={(e) => setForm({ ...form, typeStage: e.target.value })}
                  />
                  <datalist id="stage-types-list">
                    {stageTypes.map((t, i) => <option key={i} value={t} />)}
                  </datalist>
                  <p className="text-[10px] text-slate-400 mt-1">Suggestions de votre école — modifiables dans Paramètres RH (texte libre accepté).</p>
                </div>
                <div>
                  <label className={labelClass}>Établissement d&apos;origine</label>
                  <input
                    className={inputClass}
                    placeholder="École, université, centre de formation…"
                    value={form.etablissementOrigine}
                    onChange={(e) => setForm({ ...form, etablissementOrigine: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Date de début *</label>
                  <input type="date" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Date de fin *</label>
                  <input type="date" className={inputClass} min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Poste / mission du stage</label>
                <input
                  className={inputClass}
                  placeholder="Ex : Assistance pédagogique au primaire, suivi de bibliothèque…"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Gratification (FCFA)</label>
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    placeholder="0 = sans gratification"
                    value={form.gratificationAmount}
                    onChange={(e) => setForm({ ...form, gratificationAmount: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Si applicable selon la durée (Décret n°2018-196) — pas un salaire.</p>
                </div>
                <div>
                  <label className={labelClass}>Périodicité</label>
                  <input className={inputClass} placeholder="mensuellement…" value={form.gratificationPeriodicite} onChange={(e) => setForm({ ...form, gratificationPeriodicite: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Tuteur / référent au sein de l&apos;école</label>
                <input
                  className={inputClass}
                  list="tuteurs-list"
                  placeholder="Nom du tuteur (ou sélectionnez un membre du personnel)"
                  value={form.tuteurNom}
                  onChange={(e) => setForm({ ...form, tuteurNom: e.target.value })}
                />
                <datalist id="tuteurs-list">
                  {staffList.map((s) => (
                    <option key={s.id} value={`${s.firstName} ${s.lastName}`}>{s.position || 'Personnel'}</option>
                  ))}
                </datalist>
              </div>

              {/* Assurance — OBLIGATOIRE avant validation */}
              <div className="space-y-3 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Assurance accident du travail — obligatoire avant validation
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.assuranceSouscrite}
                    onChange={(e) => setForm({ ...form, assuranceSouscrite: e.target.checked })}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    L&apos;établissement a souscrit l&apos;assurance accident du travail pour ce stagiaire
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Référence de la police {wantActive && '*'}</label>
                    <input
                      className={inputClass}
                      placeholder="N° de police d'assurance"
                      value={form.assurancePoliceRef}
                      onChange={(e) => setForm({ ...form, assurancePoliceRef: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Compagnie</label>
                    <input
                      className={inputClass}
                      placeholder="Nom de la compagnie"
                      value={form.assuranceCompagnie}
                      onChange={(e) => setForm({ ...form, assuranceCompagnie: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={wantActive}
                    onChange={(e) => setWantActive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Valider le stage immédiatement (statut « En cours »)
                  </span>
                </label>
                {wantActive && !assuranceValide && (
                  <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> La validation exige l&apos;assurance souscrite + la référence de police.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
              <button
                type="button"
                disabled={saving || !canSave}
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: PRIMARY }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editing ? 'Enregistrer' : 'Créer la convention'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
