/**
 * FederisCandidatesPage — Fichier national des candidats (Academia Federis)
 *
 * §8.4 du cahier des charges + refonte 2026-09-29 :
 *   - CATÉGORISATION PAR EXAMEN : les candidats au CEP, BEPC, BAC et CAP sont
 *     affichés dans LEUR PROPRE onglet — jamais de mélange. Chaque onglet
 *     regroupe les campagnes du type (sélecteur si plusieurs campagnes).
 *   - Registre par candidat : nom, matricule, école de provenance, centre
 *     d'examen, salle de composition, n° de table ET anonymat.
 *   - AFFECTATION AUX CENTRES EN 2 PHASES (refonte 2026-09-30) :
 *     Phase 1 — le patronat SÉLECTIONNE des candidats (cases à cocher) et
 *     les oriente vers UN centre (POST /federis/exams/:id/candidates/
 *     assign-center) ; un candidat ne peut plus se retrouver dans 2 centres.
 *     Phase 2 — GÉNÉRATION des numéros de table uniquement pour les candidats
 *     déjà affectés : POST /federis/exams/:id/assign-tables répartit chaque
 *     candidat dans les salles de SON centre, numéro ALIGNÉ sur la salle
 *     (format {code salle}-{n°} : S01-001, S01-002… S02-001…).
 *   - ANTI-DOUBLONS : une même identité ne peut plus être importée/envoyée
 *     deux fois (garde backend) ; les doublons existants sont signalés dans
 *     le registre avec purge en un clic (une ligne conservée par personne).
 *   - ANONYMATS : POST /federis/exams/:id/anonymats/generate — code anonyme
 *     par candidat pour la saisie des notes / le post-composition (les
 *     correcteurs ne voient plus les identités).
 *   - LISTE OFFICIELLE : PDF (GET /federis/exams/:id/pdf/candidats) et Excel
 *     (GET /federis/exams/:id/excel/candidats) générés 100 % côté backend
 *     (Puppeteer / ExcelJS — pattern Helm), téléchargés en blob authentifié.
 *   - IMPORT EXCEL : le fichier (.xlsx/.xls/.csv) est analysé côté client
 *     avec SheetJS puis envoyé en JSON à POST /federis/exams/:id/candidates/import
 *     — pour les écoles qui ne sont PAS sur Academia Helm (schoolName libre).
 *
 * Colonnes Excel attendues (en-têtes souples) :
 *   Prénom | Nom | Date de naissance | Sexe | École | Matricule
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { loadXlsx } from '@/lib/exports/xlsx-loader';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';
import { useFederisScope } from '@/lib/federis/scope-context';

// ── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  registrationNumber: string;
  matricule: string;
  tableNumber: string | null;
  anonymatCode?: string | null;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  status: string;
  school: string;
  center: { code: string; name: string } | null;
  room: { code: string; name: string } | null;
}

interface ImportReport {
  created: number;
  skipped: number;
  errors: string[];
  totalAfter?: number;
  quota?: { used: number; max: number };
}

/** Centre d'examen (sélecteur d'affectation — phase 1). */
interface CenterOption {
  id: string;
  code: string;
  name: string;
  status: string;
  roomsCount: number;
  roomsCapacity: number;
  assignedCandidates: number;
}

/** Groupe de doublons d'identité détecté par le backend (anti 2 centres). */
interface DuplicateGroup {
  key: string;
  count: number;
  candidates: Array<{ id: string; name: string; matricule: string; tableNumber: string | null }>;
}

interface AssignResult {
  assigned: number;
  skippedWithoutCenter?: number;
  unassigned: number;
  unplaced?: Array<{ name: string; centerCode: string | null; reason: string }>;
  message: string;
  perCenter?: Array<{
    centerCode: string;
    centerName: string;
    candidates: number;
    rooms: Array<{ code: string; capacity: number; occupancy: number }>;
  }>;
}

interface FederisCandidatesPageProps {
  tenantId?: string;
  userRole?: string | null;
}

/** Ordre canonique des types d'examen (catégorisation — jamais de mélange). */
const EXAM_TYPES: Array<{ type: 'CEP' | 'BEPC' | 'BAC' | 'CAP'; label: string }> = [
  { type: 'CEP', label: 'CEP' },
  { type: 'BEPC', label: 'BEPC' },
  { type: 'BAC', label: 'Baccalauréat' },
  { type: 'CAP', label: 'CAP' },
];

/** Mapping souple des en-têtes Excel → champs candidat. */
function mapRow(row: Record<string, any>): Record<string, string | undefined> {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const found = Object.keys(row).find(
        (k) => k.toLowerCase().trim() === key.toLowerCase(),
      );
      if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') {
        return String(row[found]).trim();
      }
    }
    return undefined;
  };
  return {
    firstName: get('Prénom', 'Prenom', 'FirstName', 'first_name', 'PRENOM'),
    lastName: get('Nom', 'LastName', 'last_name', 'NOM', 'Nom de famille'),
    dateOfBirth: get('Date de naissance', 'DateNaissance', 'date_of_birth', 'DATE NAISSANCE', 'Naissance'),
    gender: get('Sexe', 'Gender', 'SEXE', 'Genre'),
    placeOfBirth: get('Lieu de naissance', 'LieuNaissance'),
    schoolName: get('École', 'Ecole', 'School', 'Établissement', 'Etablissement', 'ECOLE'),
    matricule: get('Matricule', 'MATRICULE'),
    phone: get('Téléphone', 'Telephone', 'Phone', 'TEL'),
    email: get('Email', 'E-mail', 'MAIL'),
  };
}

/** Téléchargement authentifié (blob) — pattern FederisQuestionBankPage. */
async function downloadFile(
  url: string,
  filename: string,
  mime: string,
  timeout = 120000,
): Promise<void> {
  const res = await apiClient.get(url, { responseType: 'blob', timeout });
  const blob = new Blob([res.data], { type: mime });
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export default function FederisCandidatesPage({ userRole }: FederisCandidatesPageProps) {
  const { exams, examId, setExamId, loading: examsLoading } = useFederisExams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [withoutCenter, setWithoutCenter] = useState(0);
  const [withoutTable, setWithoutTable] = useState(0);
  const [withoutAnonymat, setWithoutAnonymat] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [assignResult, setAssignResult] = useState<AssignResult | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignOrderBy, setAssignOrderBy] = useState<'SCHOOL' | 'NAME'>('SCHOOL');

  // ⭐ Phase 1 — affectation manuelle aux centres (2026-09-30)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [centersLoading, setCentersLoading] = useState(false);
  const [targetCenterId, setTargetCenterId] = useState('');
  const [assigningCenter, setAssigningCenter] = useState(false);

  // ⭐ Confirmation avant génération des numéros de table (phase 2)
  const [confirmTables, setConfirmTables] = useState(false);

  // ⭐ Doublons d'identité (une même personne dans plusieurs centres)
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [duplicatesCount, setDuplicatesCount] = useState(0);
  const [purging, setPurging] = useState(false);

  const [generatingAnonymats, setGeneratingAnonymats] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  // ★ 2026-10-01 — AGRÉGATION NATIONALE : lecture seule sauf délégation
  const { canWrite: scopeCanWrite } = useFederisScope();
  const canManageCandidates = canWrite(userRole, 'candidates') && scopeCanWrite;
  const canOrganize = canWrite(userRole, 'exam_org') && scopeCanWrite;

  // ── Catégorisation par type d'examen (CEP / BEPC / BAC / CAP) ───────────
  const examsByType = useMemo(() => {
    const map = new Map<string, typeof exams>();
    for (const ex of exams) {
      const key = ex.examType ?? 'CEP';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    }
    return map;
  }, [exams]);

  const selectedExam = exams.find((e) => e.id === examId) ?? null;
  const activeType = selectedExam?.examType ?? null;
  const activeTypeExams = activeType ? (examsByType.get(activeType) ?? []) : [];

  /** Changement d'onglet CEP/BEPC/BAC/CAP → première campagne du type. */
  const switchType = (type: string) => {
    const first = (examsByType.get(type) ?? [])[0];
    if (first) setExamId(first.id);
  };

  // ── Chargement du registre ──────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!examId) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/candidates`, {
        params: search ? { q: search } : undefined,
        timeout: 20000,
      });
      setCandidates(res.data?.candidates ?? []);
      setTotal(res.data?.total ?? 0);
      setWithoutCenter(res.data?.withoutCenter ?? 0);
      setWithoutTable(res.data?.withoutTable ?? 0);
      setWithoutAnonymat(res.data?.withoutAnonymat ?? 0);
      setDuplicates(res.data?.duplicates ?? []);
      setDuplicatesCount(res.data?.duplicatesCount ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les candidats.');
    } finally {
      setLoading(false);
    }
  }, [examId, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // ⭐ Centres de l'examen (sélecteur d'affectation — phase 1)
  const loadCenters = useCallback(async () => {
    if (!examId) {
      setCenters([]);
      return;
    }
    setCentersLoading(true);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/centers`, { timeout: 20000 });
      setCenters(res.data?.centers ?? []);
    } catch {
      setCenters([]);
    } finally {
      setCentersLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void loadCenters();
  }, [loadCenters]);

  // Changement de campagne → réinitialise la sélection et les panneaux
  useEffect(() => {
    setSelectedIds(new Set());
    setTargetCenterId('');
    setConfirmTables(false);
  }, [examId]);

  // ── Import Excel ────────────────────────────────────────────────────────
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !examId) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    setImportReport(null);
    try {
      const XLSX = await loadXlsx();
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const rows = rawRows.map(mapRow).filter((r) => r.firstName || r.lastName);

      if (rows.length === 0) {
        setError('Aucune ligne exploitable dans le fichier. Colonnes attendues : Prénom, Nom, Date de naissance, Sexe, École, Matricule.');
        return;
      }

      const res = await apiClient.post(
        `/federis/exams/${examId}/candidates/import`,
        { rows },
        { timeout: 120000 },
      );
      setImportReport({
        created: res.data?.created ?? 0,
        skipped: res.data?.skipped ?? 0,
        errors: res.data?.errors ?? [],
        totalAfter: res.data?.totalAfter,
        quota: res.data?.quota,
      });
      setNotice(`${res.data?.created ?? 0} candidat(s) importé(s)${res.data?.skipped ? `, ${res.data.skipped} ligne(s) ignorée(s)` : ''}.`);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? err?.message ?? 'Import impossible.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Phase 1 : sélection + affectation manuelle au centre ────────────────
  const toggleCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected =
    candidates.length > 0 && candidates.every((c) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (candidates.length > 0 && candidates.every((c) => next.has(c.id))) {
        for (const c of candidates) next.delete(c.id);
      } else {
        for (const c of candidates) next.add(c.id);
      }
      return next;
    });
  };

  /** Affecte la sélection à un centre — centerId null = retrait d'affectation. */
  const applyCenter = async (centerId: string | null) => {
    if (!examId || selectedIds.size === 0) return;
    if (centerId === null) {
      const withCenter = candidates.filter(
        (c) => selectedIds.has(c.id) && c.center,
      ).length;
      if (
        withCenter > 0 &&
        !window.confirm(
          `Retirer ${withCenter} candidat(s) de leur centre d'examen ? Leurs salles et numéros de table seront réinitialisés.`,
        )
      )
        return;
    }
    setAssigningCenter(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/candidates/assign-center`,
        { candidateIds: Array.from(selectedIds), centerId },
        { timeout: 60000 },
      );
      setNotice(res.data?.message ?? 'Affectation enregistrée.');
      setSelectedIds(new Set());
      setTargetCenterId('');
      await Promise.all([load(), loadCenters()]);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Affectation impossible.');
    } finally {
      setAssigningCenter(false);
    }
  };

  /** Purge des doublons d'identité (une ligne conservée par personne). */
  const purgeDuplicates = async () => {
    if (!examId || duplicatesCount === 0) return;
    if (
      !window.confirm(
        `Supprimer les lignes en double (${duplicatesCount} groupe(s) détecté(s)) ? Pour chaque personne, une seule inscription est conservée (la plus complète).`,
      )
    )
      return;
    setPurging(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/candidates/purge-duplicates`,
        {},
        { timeout: 60000 },
      );
      setNotice(res.data?.message ?? 'Doublons purgés.');
      await Promise.all([load(), loadCenters()]);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Purge impossible.');
    } finally {
      setPurging(false);
    }
  };

  // ── Phase 2 : génération des numéros de table (après confirmation) ──────
  const runAssignTables = async () => {
    if (!examId) return;
    setConfirmTables(false);
    setAssigning(true);
    setError(null);
    setNotice(null);
    setAssignResult(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/assign-tables`,
        { orderBy: assignOrderBy },
        { timeout: 60000 },
      );
      setAssignResult(res.data);
      setNotice(res.data?.message ?? 'Affectation terminée.');
      await Promise.all([load(), loadCenters()]);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Affectation impossible.');
    } finally {
      setAssigning(false);
    }
  };

  // ── Génération des anonymats (post-composition) ─────────────────────────
  const generateAnonymats = async (regenerate: boolean) => {
    if (!examId) return;
    setGeneratingAnonymats(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/anonymats/generate`,
        { regenerate },
        { timeout: 60000 },
      );
      setNotice(res.data?.message ?? 'Anonymats générés.');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Génération impossible.');
    } finally {
      setGeneratingAnonymats(false);
    }
  };

  // ── Exports de la liste officielle (backend : PDF Puppeteer / Excel ExcelJS) ──
  const exportList = async (kind: 'pdf' | 'excel') => {
    if (!examId || !selectedExam) return;
    setExporting(kind);
    setError(null);
    try {
      if (kind === 'pdf') {
        await downloadFile(
          `/federis/exams/${examId}/pdf/candidats`,
          `Liste_Officielle_Candidats_${selectedExam.code}.pdf`,
          'application/pdf',
        );
        setNotice('Liste officielle PDF générée — téléchargement lancé.');
      } else {
        await downloadFile(
          `/federis/exams/${examId}/excel/candidats`,
          `Liste_Candidats_${selectedExam.code}.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
        setNotice('Classeur Excel généré — téléchargement lancé.');
      }
    } catch (err: any) {
      let msg = err?.response?.data?.message ?? err?.message ?? 'Export impossible.';
      if (err?.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          msg = parsed?.message ?? msg;
        } catch { /* garde le brut */ }
      }
      setError((Array.isArray(msg) ? msg.join(' ') : String(msg)));
    } finally {
      setExporting(null);
    }
  };

  // ── Onglets visibles : uniquement les types avec au moins une campagne ──
  const visibleTypes = EXAM_TYPES.filter((t) => (examsByType.get(t.type) ?? []).length > 0);
  const typeCount = (type: string) =>
    (examsByType.get(type) ?? []).reduce((sum, ex) => sum + (ex.candidatesCount ?? 0), 0);

  return (
    <FedPage className="space-y-8">
      {/* En-tête — style Helm : titre + description + KPI */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Module candidats</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Fichier national des candidats</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Registre des candidats par examen — matricules, écoles, centres, salles et numéros de table.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900"><FedCountUp value={total} /></p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Candidats</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900"><FedCountUp value={withoutCenter} /></p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Sans centre</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900"><FedCountUp value={withoutTable} /></p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Sans table</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900"><FedCountUp value={withoutAnonymat} /></p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Sans anonymat</p>
          </div>
          {importReport?.quota && (
            <div className="fed-card px-6 py-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importReport.quota.used}/{importReport.quota.max}</p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">Quota plan</p>
            </div>
          )}
        </div>
      </div>

      {/* ⭐ Onglets de catégorisation : CEP | BEPC | BAC | CAP — jamais de mélange */}
      {examsLoading ? (
        <div className="fed-card px-6 py-4 text-sm font-bold text-slate-400">Chargement des campagnes…</div>
      ) : visibleTypes.length === 0 ? (
        <div className="fed-card px-6 py-8 text-center">
          <p className="text-sm font-bold text-slate-500">
            Aucun examen — créez d&apos;abord une campagne dans le module Examens.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Catégorisation par examen">
          {visibleTypes.map((t) => {
            const isActive = activeType === t.type;
            return (
              <button
                key={t.type}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchType(t.type)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                  isActive
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'ml-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {typeCount(t.type)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sélecteur de campagne (si plusieurs campagnes du même type) + actions */}
      {examId && (
        <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Campagne</span>
          {activeTypeExams.length === 1 ? (
            <span className="text-sm font-bold text-blue-900">
              {selectedExam?.code} — {selectedExam?.name}
            </span>
          ) : (
            <select
              value={examId ?? ''}
              onChange={(e) => setExamId(e.target.value)}
              className="fed-input-light flex-1 !w-auto font-bold px-4 py-2.5"
            >
              {activeTypeExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
                </option>
              ))}
            </select>
          )}

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {canManageCandidates && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFile}
                  disabled={importing}
                  className="hidden"
                  id="federis-candidates-import"
                />
                <label
                  htmlFor="federis-candidates-import"
                  className={cn(
                    'fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase text-center cursor-pointer',
                    importing && 'opacity-50 pointer-events-none',
                  )}
                >
                  {importing ? 'Import en cours…' : 'Import Excel'}
                </label>
                <button
                  onClick={() => generateAnonymats(false)}
                  disabled={generatingAnonymats}
                  className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
                >
                  {generatingAnonymats ? 'Génération…' : 'Générer les anonymats'}
                </button>
                {withoutAnonymat < total && (
                  <button
                    onClick={() => generateAnonymats(true)}
                    disabled={generatingAnonymats}
                    title="Réattribuer une nouvelle série complète d'anonymats"
                    className="px-4 py-2.5 text-[10px] font-bold uppercase rounded-xl border border-blue-200 text-blue-900 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Régénérer
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => exportList('pdf')}
              disabled={exporting !== null || total === 0}
              className="px-5 py-2.5 text-[10px] font-bold uppercase rounded-xl bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 disabled:opacity-50"
            >
              {exporting === 'pdf' ? 'PDF…' : 'Liste PDF'}
            </button>
            <button
              onClick={() => exportList('excel')}
              disabled={exporting !== null || total === 0}
              className="px-5 py-2.5 text-[10px] font-bold uppercase rounded-xl bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 disabled:opacity-50"
            >
              {exporting === 'excel' ? 'Excel…' : 'Liste Excel'}
            </button>
            {canOrganize && (
              <button
                onClick={() => setConfirmTables(true)}
                disabled={assigning || total === 0}
                title="Numérotation alignée sur le centre et la salle (ex. S01-001) — uniquement pour les candidats déjà affectés à un centre"
                className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {assigning ? 'Affectation…' : 'Générer les n° de table'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ⭐ PHASE 1 — Affectation manuelle des candidats aux centres */}
      {canOrganize && examId && (
        <div className="fed-card px-6 py-5 border-l-4 border-l-blue-900 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-blue-900 uppercase">
              Étape 1 — Affectation des candidats aux centres
            </span>
            <span className="text-[9px] font-semibold text-slate-400 uppercase">
              (le n° de table ne peut être généré qu’après cette étape)
            </span>
          </div>
          {selectedIds.size === 0 ? (
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">
              Cochez les candidats dans le registre ci-dessous (ou « tout sélectionner »), puis
              attribuez-leur un centre d’accueil : chaque candidat est orienté vers UN seul
              centre, au choix du patronat. Les numéros de table — format{' '}
              <span className="font-bold text-blue-900">{'{salle}-{n°}'}</span> (ex. S01-001) —
              seront générés à l’étape 2 dans les salles de leur centre.
            </p>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-blue-900 shrink-0">
                {selectedIds.size} candidat(s) sélectionné(s)
              </span>
              <select
                value={targetCenterId}
                onChange={(e) => setTargetCenterId(e.target.value)}
                disabled={assigningCenter || centersLoading}
                className="fed-input-light px-4 py-2.5 text-xs font-bold !w-auto min-w-72"
              >
                <option value="">
                  {centersLoading ? 'Chargement des centres…' : '— Choisir le centre d’accueil —'}
                </option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name} ({c.assignedCandidates} affecté(s) ·{' '}
                    {c.roomsCount} salle(s) · {c.roomsCapacity} places)
                  </option>
                ))}
              </select>
              <button
                onClick={() => void applyCenter(targetCenterId || null)}
                disabled={!targetCenterId || assigningCenter}
                className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {assigningCenter ? 'Affectation…' : 'Affecter au centre'}
              </button>
              <button
                onClick={() => void applyCenter(null)}
                disabled={assigningCenter}
                title="Retirer les candidats sélectionnés de leur centre actuel"
                className="px-4 py-2.5 text-[10px] font-bold uppercase rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Retirer du centre
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[10px] font-bold uppercase text-slate-400 hover:text-slate-700"
              >
                Tout désélectionner
              </button>
            </div>
          )}
          {centers.length === 0 && !centersLoading && (
            <p className="text-[11px] text-amber-700 font-semibold">
              Aucun centre pour cet examen — créez d’abord vos centres et salles dans « Centres,
              salles &amp; Surveillants ».
            </p>
          )}
        </div>
      )}

      {/* Options de répartition (étape 2) */}
      {canOrganize && examId && (
        <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Étape 2 — Répartition dans les salles</span>
          <select
            value={assignOrderBy}
            onChange={(e) => setAssignOrderBy(e.target.value as 'SCHOOL' | 'NAME')}
            className="fed-input-light px-4 py-2 text-xs font-bold !w-auto"
          >
            <option value="SCHOOL">Par école puis ordre alphabétique (mélange les écoles)</option>
            <option value="NAME">Ordre alphabétique pur</option>
          </select>
          <span className="text-[10px] font-semibold text-slate-500">
            Numérotation : <span className="font-bold text-blue-900">{'{code salle}-{n°}'}</span>{' '}
            (ex. S01-001, S01-002… S02-001) — la série redémarre dans chaque salle, uniquement
            pour les candidats déjà affectés à un centre.
          </span>
          {withoutCenter > 0 && (
            <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-700 px-2.5 py-1 rounded">
              {withoutCenter} sans centre — ignorés à l’étape 2
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* ⭐ Doublons d'identité — un même candidat ne doit jamais figurer deux
          fois sur un examen (sinon 2 centres après génération des n° de table) */}
      {duplicatesCount > 0 && canManageCandidates && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm font-bold text-amber-800">
              {duplicatesCount} doublon(s) d’identité détecté(s) — un même candidat figure
              plusieurs fois sur cet examen (il peut donc apparaître dans plusieurs centres).
            </p>
            <button
              onClick={() => void purgeDuplicates()}
              disabled={purging}
              className="shrink-0 px-4 py-2 text-[10px] font-bold uppercase rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {purging ? 'Purge…' : 'Purger les doublons'}
            </button>
          </div>
          <div className="space-y-1">
            {duplicates.slice(0, 5).map((g) => (
              <p key={g.key} className="text-[11px] font-semibold text-amber-700">
                {g.candidates[0]?.name} — {g.count} inscriptions ({g.candidates.map((c) => c.matricule).join(' · ')})
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ⭐ Confirmation avant génération des numéros de table */}
      {confirmTables && canOrganize && examId && (
        <div className="fed-card p-6 border-l-4 border-l-amber-500 space-y-4">
          <h3 className="text-sm font-bold text-blue-900 uppercase">
            Étape 2 — Générer les numéros de table
          </h3>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            Chaque candidat déjà affecté à un centre reçoit une salle de composition et un
            numéro aligné sur son centre et sa salle :{' '}
            <span className="font-bold text-blue-900">{'{code salle}-{n°}'}</span> (ex. S01-001,
            S01-002…). Les candidats sans centre ne seront PAS numérotés.
          </p>
          <div className="grid grid-cols-3 gap-3 max-w-lg">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-900">{total - withoutCenter}</p>
              <p className="text-[9px] font-bold text-blue-700 uppercase">Avec centre</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-amber-700">{withoutCenter}</p>
              <p className="text-[9px] font-bold text-amber-600 uppercase">Sans centre</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-slate-700">
                {centers.reduce((s, c) => s + c.roomsCapacity, 0)}
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase">Places en salles</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void runAssignTables()}
              disabled={assigning || total - withoutCenter === 0}
              className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
            >
              {assigning ? 'Génération…' : 'Confirmer la génération'}
            </button>
            <button
              onClick={() => setConfirmTables(false)}
              disabled={assigning}
              className="px-5 py-2.5 text-[10px] font-bold uppercase rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
          {total - withoutCenter === 0 && (
            <p className="text-[11px] text-amber-700 font-bold">
              Aucun candidat n’est encore affecté à un centre — réalisez d’abord l’étape 1.
            </p>
          )}
        </div>
      )}

      {/* Rapport d'import */}
      {importReport && (
        <div className="fed-card p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-blue-900 uppercase">Rapport d&apos;import</h3>
            <button onClick={() => setImportReport(null)} className="text-xs font-bold text-slate-400 hover:text-slate-700">Fermer</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{importReport.created}</p>
              <p className="text-[9px] font-bold text-emerald-600 uppercase">Créés</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{importReport.skipped}</p>
              <p className="text-[9px] font-bold text-amber-600 uppercase">Ignorés</p>
            </div>
            {importReport.totalAfter !== undefined && (
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-900">{importReport.totalAfter}</p>
                <p className="text-[9px] font-bold text-blue-700 uppercase">Total examen</p>
              </div>
            )}
            {importReport.quota && (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-700">{importReport.quota.used}/{importReport.quota.max}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Quota plan</p>
              </div>
            )}
          </div>
          {importReport.errors.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-5 max-h-48 overflow-y-auto space-y-1">
              {importReport.errors.map((errLine, i) => (
                <p key={i} className="text-xs font-semibold text-slate-600">{errLine}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Résultat d'affectation */}
      {assignResult && (
        <div className="fed-card p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-blue-900 uppercase">Plan de salle &amp; numéros de table</h3>
            <button onClick={() => setAssignResult(null)} className="text-xs font-bold text-slate-400 hover:text-slate-700">Fermer</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(assignResult.perCenter ?? []).map((c) => (
              <div key={c.centerCode} className="bg-[#f7f9fc] border border-blue-100 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-blue-900">{c.centerName}</span>
                  <span className="text-[9px] font-bold uppercase bg-blue-900 text-white px-2.5 py-1 rounded-full">
                    {c.centerCode}
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-900 mb-3">{c.candidates} candidat(s)</p>
                <div className="space-y-1.5">
                  {c.rooms.map((r) => (
                    <div key={r.code} className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                      <span>Salle {r.code}</span>
                      <span>{r.occupancy} / {r.capacity}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {assignResult.unassigned > 0 && (
            <p className="mt-4 text-xs font-bold text-red-600">
              {assignResult.unassigned} candidat(s) sans place — ajoutez des salles (page Centres et salles).
            </p>
          )}
          {(assignResult.skippedWithoutCenter ?? 0) > 0 && (
            <p className="mt-2 text-xs font-bold text-amber-600">
              {assignResult.skippedWithoutCenter} candidat(s) sans centre — non numéroté(s) :<br />
              réalisez d’abord l’étape 1 (sélection → Affecter au centre).
            </p>
          )}
          {(assignResult.unplaced ?? []).length > 0 && (
            <div className="mt-2 bg-red-50 rounded-xl p-4 max-h-40 overflow-y-auto space-y-1">
              {(assignResult.unplaced ?? []).slice(0, 15).map((u, i) => (
                <p key={i} className="text-[11px] font-semibold text-red-700">
                  {u.name}
                  {u.centerCode ? ` (centre ${u.centerCode})` : ''} — {u.reason}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registre */}
      <div className="fed-card overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-blue-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-blue-900 uppercase">
            Registre de candidature {activeType ? `— ${EXAM_TYPES.find((t) => t.type === activeType)?.label ?? activeType}` : ''}
            {selectedExam && <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">{selectedExam.code}</span>}
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, matricule, n° de table, anonymat…)"
            className="fed-input-light px-5 py-3 text-xs font-bold w-full sm:w-80"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#f7f9fc]">
              <tr>
                {canOrganize && (
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      title="Sélectionner / désélectionner tous les candidats affichés"
                      className="w-4 h-4 rounded border-slate-300 text-blue-900"
                    />
                  </th>
                )}
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Candidat</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Matricule</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">École de provenance</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Centre</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Salle</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">N° de table</th>
                <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Anonymat</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={canOrganize ? 8 : 7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement…</td></tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={canOrganize ? 8 : 7} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    Aucun candidat. {canManageCandidates ? 'Importez votre fichier Excel de candidatures ou attendez les listes officielles des écoles rattachées.' : ''}
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id} className={cn('hover:bg-[#f7f9fc]', selectedIds.has(c.id) && 'bg-blue-50/60')}>
                    {canOrganize && (
                      <td className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleCandidate(c.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-900"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center font-bold text-blue-900 text-sm shrink-0">
                          {c.firstName?.[0] ?? '?'}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-blue-900">{c.lastName} {c.firstName}</div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">
                            {c.gender ?? '—'}
                            {c.dateOfBirth ? ` • ${new Date(c.dateOfBirth).toLocaleDateString('fr-FR')}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-600">{c.matricule}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-blue-900">{c.school}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                      {c.center ? `${c.center.code} — ${c.center.name}` : <span className="text-slate-400">Non affecté</span>}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                      {c.room?.code ?? <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {c.tableNumber ? (
                        <span className="inline-block bg-blue-900 text-white font-bold text-sm px-3 py-1.5 rounded-xl">
                          {c.tableNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {c.anonymatCode ? (
                        <span className="inline-block bg-amber-50 border border-amber-200 text-amber-800 font-mono font-bold text-sm px-3 py-1.5 rounded-xl">
                          {c.anonymatCode}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs font-bold">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aide format import */}
      {canManageCandidates && (
        <div className="fed-card p-6">
          <div className="flex items-center space-x-3 mb-3">
            <AppIcon name="library" size="menu" className="text-blue-800" />
            <span className="text-xs font-semibold text-gray-500 uppercase">Format du fichier d&apos;import</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Fichier Excel (.xlsx, .xls) ou CSV — première ligne d&apos;en-têtes, une candidature par ligne.
            Colonnes reconnues : <span className="font-semibold text-gray-900">Prénom</span>,{' '}
            <span className="font-semibold text-gray-900">Nom</span>, Date de naissance, Sexe,{' '}
            <span className="font-semibold text-gray-900">École</span> (si rattachée au patronat, la liaison est
            automatique — sinon l&apos;école est conservée telle quelle, pour les établissements non présents sur
            Academia Helm), Lieu de naissance, Matricule (généré automatiquement selon le format défini dans
            Paramètres si vide), Téléphone, Email. Les doublons (même identité ou matricule existant) sont
            ignorés avec un rapport détaillé.
          </p>
        </div>
      )}
    </FedPage>
  );
}
