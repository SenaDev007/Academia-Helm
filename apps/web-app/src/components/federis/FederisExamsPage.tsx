/**
 * FederisExamsPage — Examens nationaux (Academia Federis)
 *
 * Données réelles via GET /federis/exams (année scolaire active du patronat).
 * Création (POST /federis/exams) et changement de statut (PATCH) réservés au
 * coordonnateur et à l'organisateur (canWrite 'exam_org' — la garde finale
 * est appliquée par l'API). Liens croisés vers Centres et Candidats.
 *
 * ⭐ SOUS-ONGLETS PAR EXAMEN NATIONAL (2026-09-29) :
 * CEP / BEPC / Baccalauréat / CAP — répartition des campagnes selon la
 * classe (CM2 → CEP, 3ème → BEPC, Terminale → Baccalauréat, Terminale CAP
 * → CAP). Dans chaque sous-onglet, le patronat consulte les LISTES
 * OFFICIELLES transmises par les écoles rattachées (adhésion acceptée) :
 * GET /federis/exams/:id/school-lists — candidats regroupés par école avec
 * les informations de l'établissement (ville, département, contact).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { useFederisPath } from '@/lib/federis/useFederisPath';
import { canWrite } from '@/lib/patronat/permissions';
import {
  useFederisExams,
  EXAM_STATUS_LABELS,
  EXAM_STATUS_STYLES,
} from '@/hooks/useFederisExams';
import { FedPage } from '@/components/federis/federis-motion';

interface FederisExamsPageProps {
  tenantId?: string;
  /** User.role de la session — normalisé pour les gardes d'écriture UI */
  userRole?: string | null;
}

// ── Sous-onglets : répartition des examens nationaux par classe ─────────────

const EXAM_TABS = [
  { id: 'ALL', label: 'Toutes', matchLevels: null as string[] | null },
  { id: 'CEP', label: 'CEP', matchLevels: ['CM2'] },
  { id: 'BEPC', label: 'BEPC', matchLevels: ['3EME'] },
  { id: 'BAC', label: 'Baccalauréat', matchLevels: ['TERMINALE'] },
  { id: 'CAP', label: 'CAP', matchLevels: ['CAP'] },
] as const;

/** Libellé lisible du niveau (classe) d'une campagne. */
const LEVEL_LABELS: Record<string, string> = {
  CM2: 'CM2 — CEP',
  '3EME': '3ème — BEPC',
  TERMINALE: 'Terminale — Baccalauréat',
  CAP: 'Terminale CAP — CAP',
};

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  REGISTERED: 'Inscrit',
  WITHDRAWN: 'Retiré',
  ABSENT: 'Absent',
  PASSED: 'Admis',
  FAILED: 'Ajourné',
};

// ── Types de la vue « listes officielles par école » ────────────────────────

interface SchoolListStudent {
  id: string;
  matricule: string | null;
  tableNumber: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  status: string;
  schoolClass: string | null;
  series: string | null;
  submittedAt: string | null;
  source: string | null;
  center: { code: string; name: string } | null;
}

interface SchoolListEntry {
  schoolTenantId: string | null;
  name: string;
  subdomain: string | null;
  tenantType: string | null;
  logo: string | null;
  city: string | null;
  department: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  students: SchoolListStudent[];
}

interface SchoolListsResponse {
  exam: {
    id: string;
    code: string;
    name: string;
    level: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  /** ⭐ Baccalauréat : listes catégorisées PAR SÉRIE (A1, C, D…). */
  hasSeries: boolean;
  totalSchools: number;
  totalCandidates: number;
  schools: SchoolListEntry[];
}

// ⭐ (2026-09-29) Plus AUCUN badge de type d'établissement (mixte / école /
//    ministère…) — seuls les logos des écoles sont affichés.

export default function FederisExamsPage({ userRole }: FederisExamsPageProps) {
  const { path: federisPath } = useFederisPath();
  const { exams, academicYear, loading, error, reload } = useFederisExams();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    examType: 'NATIONAL',
    level: 'CM2',
    startDate: '',
    endDate: '',
    description: '',
  });

  // ⭐ Sous-onglet actif (Toutes / CEP / BEPC / Baccalauréat / CAP)
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // ⭐ Vue « listes officielles par école » de la campagne sélectionnée
  const [listsExamId, setListsExamId] = useState<string | null>(null);
  const [schoolLists, setSchoolLists] = useState<SchoolListsResponse | null>(null);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsError, setListsError] = useState<string | null>(null);

  const canOrganize = canWrite(userRole, 'exam_org');

  // ── Filtrage des campagnes selon le sous-onglet ──────────────────────────
  const levelOf = (level: string | null | undefined) => (level ?? '').trim().toUpperCase();
  const filteredExams = exams.filter((exam) => {
    const tab = EXAM_TABS.find((t) => t.id === activeTab);
    if (!tab || !tab.matchLevels) return true;
    const lv = levelOf(exam.level);
    return tab.matchLevels.some((m) => lv === m || lv.startsWith(m));
  });

  // Compteurs par sous-onglet (badges)
  const tabCount = (tabId: string) => {
    const tab = EXAM_TABS.find((t) => t.id === tabId);
    if (!tab || !tab.matchLevels) return exams.length;
    return exams.filter((e) => {
      const lv = levelOf(e.level);
      return tab.matchLevels!.some((m) => lv === m || lv.startsWith(m));
    }).length;
  };

  // ── Chargement des listes officielles d'une campagne ─────────────────────
  const loadSchoolLists = useCallback(async (examId: string) => {
    setListsLoading(true);
    setListsError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/school-lists`, {
        timeout: 30000,
      });
      setSchoolLists(res.data ?? null);
    } catch (err: any) {
      setSchoolLists(null);
      setListsError(
        err?.response?.data?.message ?? 'Impossible de charger les listes officielles.',
      );
    } finally {
      setListsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (listsExamId) void loadSchoolLists(listsExamId);
  }, [listsExamId, loadSchoolLists]);

  const openSchoolLists = (examId: string) => {
    setListsExamId(examId);
    setSchoolLists(null);
    setListsError(null);
    // Ancre la vue listes (sous le tableau des campagnes)
    requestAnimationFrame(() => {
      document.getElementById('listes-officielles')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const closeSchoolLists = () => {
    setListsExamId(null);
    setSchoolLists(null);
    setListsError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    try {
      await apiClient.post('/federis/exams', form, { timeout: 20000 });
      setShowCreate(false);
      setForm({ code: '', name: '', examType: 'NATIONAL', level: 'CM2', startDate: '', endDate: '', description: '' });
      await reload();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (examId: string, status: string) => {
    try {
      await apiClient.patch(`/federis/exams/${examId}`, { status }, { timeout: 20000 });
      await reload();
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  const listsExam = exams.find((e) => e.id === listsExamId) ?? null;

  return (
    <FedPage className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Module examens</div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">Examens nationaux</h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            {academicYear
              ? `Campagnes de l'année scolaire ${academicYear}`
              : 'Gérez vos campagnes d\u2019examens inter-écoles'}
          </p>
        </div>
        {canOrganize && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="fed-btn-gold px-4 py-2.5 text-sm"
          >
            <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
            {showCreate ? 'Fermer' : 'Créer un examen'}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {formError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {formError}
        </div>
      )}

      {/* Formulaire de création */}
      {showCreate && canOrganize && (
        <form onSubmit={handleCreate} className="fed-card p-8 space-y-5">
          <h3 className="text-sm font-bold text-blue-900 uppercase">Nouvel examen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Code</label>
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="CEP-2027" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Nom</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="CEP Patronal 2027" className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Classe / examen</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold">
                <option value="CM2">CM2 — CEP</option>
                <option value="3EME">3ème — BEPC</option>
                <option value="TERMINALE">Terminale — Baccalauréat</option>
                <option value="CAP">Terminale CAP — CAP (filières techniques)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Début</label>
              <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Fin</label>
              <input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={creating}
              className="fed-btn-gold px-8 py-3 text-sm disabled:opacity-50">
              {creating ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      )}

      {/* ⭐ Sous-onglets par examen national — pattern onglets segmentés Helm */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {EXAM_TABS.map((tab) => {
          const active = activeTab === tab.id;
          const count = tabCount(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs whitespace-nowrap transition-all',
                active
                  ? 'bg-white shadow-sm text-blue-900 font-bold'
                  : 'text-slate-500 font-semibold hover:text-blue-900',
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  active ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Liste des examens (filtrée par sous-onglet) */}
      <div className="fed-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#f7f9fc]">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Examen</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Classe</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Dates</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Statut</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Centres</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Candidats</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement…</td></tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    {activeTab === 'ALL'
                      ? 'Aucun examen pour l\u2019année scolaire active.'
                      : `Aucune campagne ${EXAM_TABS.find((t) => t.id === activeTab)?.label} pour l\u2019année scolaire active.`}
                    {canOrganize ? ' Créez votre première campagne.' : ''}
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => (
                  <tr
                    key={exam.id}
                    className={cn('hover:bg-[#f7f9fc]', listsExamId === exam.id && 'bg-blue-50/60')}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-blue-900">{exam.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">{exam.code}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-blue-800">
                      {LEVEL_LABELS[levelOf(exam.level)] ?? exam.level}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                      {new Date(exam.startDate).toLocaleDateString('fr-FR')} → {new Date(exam.endDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {canOrganize ? (
                        <select
                          value={exam.status}
                          onChange={(e) => changeStatus(exam.id, e.target.value)}
                          className={cn('px-2.5 py-1.5 rounded text-[10px] font-bold uppercase border-none outline-none cursor-pointer', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}
                        >
                          {Object.keys(EXAM_STATUS_LABELS).map((s) => (
                            <option key={s} value={s}>{EXAM_STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={cn('px-2.5 py-1.5 rounded text-[10px] font-bold uppercase inline-block', EXAM_STATUS_STYLES[exam.status] ?? EXAM_STATUS_STYLES.DRAFT)}>
                          {EXAM_STATUS_LABELS[exam.status] ?? exam.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-blue-900">{exam.centersCount}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-blue-900">{exam.candidatesCount}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => (listsExamId === exam.id ? closeSchoolLists() : openSchoolLists(exam.id))}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                            listsExamId === exam.id
                              ? 'bg-blue-900 text-white'
                              : 'bg-gold-500/25 text-blue-900 hover:bg-blue-900 hover:text-white',
                          )}
                          title="Listes officielles transmises par les écoles rattachées"
                        >
                          Listes écoles
                        </button>
                        <Link href={federisPath(`/centers?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">
                          Centres
                        </Link>
                        <Link href={federisPath(`/candidates?exam=${exam.id}`)}
                          className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors">
                          Candidats
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⭐ LISTES OFFICIELLES PAR ÉCOLE — campagne sélectionnée ─────────── */}
      {listsExamId && (
        <section id="listes-officielles" className="space-y-4">
          {/* En-tête de la vue */}
          <div className="fed-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-blue-900 flex items-center gap-2">
                  <AppIcon name="classes" size="submenu" className="text-blue-900" />
                  Listes officielles des écoles
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {listsExam ? (
                    <>
                      <span className="font-bold text-blue-900">{listsExam.name}</span>{' '}
                      (<span className="uppercase">{listsExam.code}</span>) ·{' '}
                      {LEVEL_LABELS[levelOf(listsExam.level)] ?? listsExam.level}
                    </>
                  ) : (
                    'Chargement de la campagne…'
                  )}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Candidats présentés officiellement par les écoles rattachées (adhésion
                  acceptée) — transmis depuis le module Examen de chaque établissement
                  Academia Helm.
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {schoolLists && !listsLoading && (
                  <div className="hidden sm:flex items-center gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-blue-900">{schoolLists.totalSchools}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Écoles</div>
                    </div>
                    <div className="w-px h-8 bg-slate-200" />
                    <div>
                      <div className="text-xl font-bold text-blue-900">{schoolLists.totalCandidates}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase">Candidats</div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => listsExamId && loadSchoolLists(listsExamId)}
                  disabled={listsLoading}
                  className="px-3 py-2 bg-blue-50 text-blue-900 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors disabled:opacity-50"
                  title="Rafraîchir les listes officielles"
                >
                  <AppIcon name="refresh" size="submenu" />
                </button>
                <button
                  type="button"
                  onClick={closeSchoolLists}
                  className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>

          {/* Erreur de chargement */}
          {listsError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
              {listsError}
            </div>
          )}

          {/* Squelette de chargement */}
          {listsLoading && (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="fed-card p-6 space-y-3">
                  <div className="h-5 w-64 rounded bg-slate-100 animate-pulse" />
                  <div className="h-9 w-full rounded bg-slate-100 animate-pulse" />
                  <div className="h-9 w-11/12 rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {/* Aucune école / aucun candidat */}
          {!listsLoading && schoolLists && schoolLists.schools.length === 0 && (
            <div className="fed-card p-10 text-center">
              <AppIcon name="classes" size="submenu" className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 mt-2">Aucune liste transmise pour cette campagne</p>
              <p className="text-sm text-slate-500 max-w-lg mx-auto mt-1">
                Les écoles rattachées remplissent leur liste officielle dans leur module
                Examen (sous-onglet correspondant à cet examen), puis la transmettent.
                Elle apparaîtra ici automatiquement.
              </p>
            </div>
          )}

          {/* Carte par école : informations + liste officielle des élèves */}
          {!listsLoading && schoolLists && schoolLists.schools.length > 0 && (
            <div className="space-y-4">
              {schoolLists.schools.map((school) => (
                <div key={school.schoolTenantId ?? school.name} className="fed-card overflow-hidden">
                  {/* En-tête école — informations de l'établissement */}
                  <div className="px-6 py-4 bg-[#f7f9fc] border-b border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {school.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={school.logo}
                            alt={school.name}
                            className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200 bg-white flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-blue-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {school.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-blue-900">{school.name}</span>
                            {!school.schoolTenantId && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                                Saisie patronat
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {[school.city, school.department, school.phone, school.email]
                              .filter(Boolean)
                              .join(' · ') || 'Informations non partagées'}
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-center flex-shrink-0">
                        <span className="text-lg font-bold text-blue-900">{school.students.length}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">
                          candidat{school.students.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table des élèves (liste officielle) — ⭐ Baccalauréat :
                      liste catégorisée PAR SÉRIE, jamais un mélange. */}
                  {schoolLists.hasSeries ? (
                    <SchoolListBySeries students={school.students} />
                  ) : (
                    <SchoolListTable students={school.students} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </FedPage>
  );
}

/** Tableau plat d'une liste officielle (CEP / BEPC / CAP). */
function SchoolListTable({ students }: { students: SchoolListStudent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-white">
          <tr>
            <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">Matricule</th>
            <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">Élève</th>
            <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">Classe</th>
            <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase">Né(e) le</th>
            <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase">Table</th>
            <th className="px-4 py-2.5 text-center text-[9px] font-bold text-slate-400 uppercase">Centre</th>
            <th className="px-4 py-2.5 text-left text-[9px] font-bold text-slate-400 uppercase">Statut</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {students.map((st) => (
            <tr key={st.id} className="hover:bg-[#f7f9fc]">
              <td className="px-4 py-2.5 text-[11px] font-bold text-blue-800 whitespace-nowrap">
                {st.matricule ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                {st.lastName} {st.firstName}
                {st.gender && (
                  <span className="ml-1.5 text-[9px] font-bold text-slate-400">
                    {st.gender === 'F' ? 'F' : 'M'}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-600">
                {st.schoolClass ?? '—'}
                {st.series && (
                  <span className="ml-1 text-[9px] font-bold text-blue-700 uppercase">
                    Série {st.series}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-center text-xs text-slate-500 whitespace-nowrap">
                {st.dateOfBirth ? new Date(st.dateOfBirth).toLocaleDateString('fr-FR') : '—'}
              </td>
              <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                {st.tableNumber ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-center text-xs text-slate-500 whitespace-nowrap">
                {st.center ? `${st.center.code}` : '—'}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[9px] font-bold uppercase inline-block',
                    st.status === 'WITHDRAWN'
                      ? 'bg-red-50 text-red-700'
                      : st.status === 'PASSED'
                        ? 'bg-green-100 text-green-800'
                        : st.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-50 text-blue-800',
                  )}
                >
                  {CANDIDATE_STATUS_LABELS[st.status] ?? st.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ⭐ Liste officielle du BACCALAURÉAT — catégorisée PAR SÉRIE : chaque série
 * (A1, A2, C, D…) dispose de sa propre section avec son effectif, comme
 * l'envoi transmis par l'école (jamais un mélange).
 */
function SchoolListBySeries({ students }: { students: SchoolListStudent[] }) {
  const groups = useMemo(() => {
    const bySeries = new Map<string, SchoolListStudent[]>();
    for (const st of students) {
      const key = st.series ?? 'NON PRECISEE';
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key)!.push(st);
    }
    return [...bySeries.entries()]
      .map(([series, list]) => ({
        series,
        students: [...list].sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'),
        ),
      }))
      .sort((a, b) => {
        if (a.series === 'NON PRECISEE') return 1;
        if (b.series === 'NON PRECISEE') return -1;
        return a.series.localeCompare(b.series);
      });
  }, [students]);

  return (
    <div className="divide-y divide-slate-200">
      {groups.map((group) => (
        <div key={group.series}>
          <div className="px-4 py-2 bg-blue-900/[0.04] border-b border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">
              {group.series === 'NON PRECISEE' ? 'Série non précisée' : `Série ${group.series}`}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase">
              {group.students.length} candidat{group.students.length > 1 ? 's' : ''}
            </span>
          </div>
          <SchoolListTable students={group.students} />
        </div>
      ))}
    </div>
  );
}
