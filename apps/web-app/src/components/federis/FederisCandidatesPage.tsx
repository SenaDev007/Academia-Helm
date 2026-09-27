/**
 * FederisCandidatesPage — Fichier national des candidats (Academia Federis)
 *
 * §8.4 du cahier des charges :
 *   - registre des candidats par examen (recherche)
 *   - IMPORT EXCEL : le fichier (.xlsx/.xls/.csv) est analysé côté client
 *     avec SheetJS (loader CDN — même pattern que les exports Helm), puis les
 *     lignes sont envoyées en JSON à POST /federis/exams/:id/candidates/import
 *     (validations + quota + doublons côté API)
 *   - AFFECTATION DES NUMÉROS DE TABLE : POST /federis/exams/:id/assign-tables
 *     répartit les candidats dans les salles (capacité) et attribue un numéro
 *     séquentiel par centre (001, 002, …)
 *
 * Colonnes Excel attendues (en-têtes souples) :
 *   Prénom | Nom | Date de naissance | Sexe | École | Matricule
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { loadXlsx } from '@/lib/exports/xlsx-loader';

interface Candidate {
  id: string;
  registrationNumber: string;
  matricule: string;
  tableNumber: string | null;
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

interface AssignResult {
  assigned: number;
  unassigned: number;
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

export default function FederisCandidatesPage({ userRole }: FederisCandidatesPageProps) {
  const { exams, examId, setExamId, loading: examsLoading } = useFederisExams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [withoutCenter, setWithoutCenter] = useState(0);
  const [withoutTable, setWithoutTable] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [assignResult, setAssignResult] = useState<AssignResult | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignOptions, setAssignOptions] = useState<{ orderBy: 'SCHOOL' | 'NAME'; numberingScope: 'CENTER' | 'EXAM' }>({
    orderBy: 'SCHOOL',
    numberingScope: 'CENTER',
  });

  const canManageCandidates = canWrite(userRole, 'candidates');
  const canOrganize = canWrite(userRole, 'exam_org');

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
      setError(err?.response?.data?.message ?? err?.message ?? 'Import impossible.');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Affectation des numéros de table ────────────────────────────────────
  const assignTables = async () => {
    if (!examId) return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    setAssignResult(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/assign-tables`, assignOptions, { timeout: 60000 });
      setAssignResult(res.data);
      setNotice(res.data?.message ?? 'Affectation terminée.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Affectation impossible.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-10 lg:p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-3xl lg:text-4xl font-black mb-2 italic tracking-tighter">Fichier national des candidats</h1>
            <p className="text-blue-100/70 font-medium max-w-xl">
              Registre des inscriptions, import Excel des candidatures et affectation des numéros
              de table par centre et par salle.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl font-black">{total}</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Candidats</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl font-black">{withoutTable}</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Sans table</p>
            </div>
            {importReport?.quota && (
              <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                <p className="text-2xl font-black">{importReport.quota.used}/{importReport.quota.max}</p>
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Quota plan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sélecteur d'examen + actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Examen</span>
        {examsLoading ? (
          <span className="text-sm font-bold text-gray-400">Chargement…</span>
        ) : exams.length === 0 ? (
          <span className="text-sm font-bold text-gray-400">Aucun examen — créez d&apos;abord une campagne.</span>
        ) : (
          <select
            value={examId ?? ''}
            onChange={(e) => setExamId(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-gray-50 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-900"
          >
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
              </option>
            ))}
          </select>
        )}

        {canManageCandidates && examId && (
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
                'px-5 py-2.5 bg-blue-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-800 transition-all text-center cursor-pointer',
                importing && 'opacity-50 pointer-events-none',
              )}
            >
              {importing ? 'Import en cours…' : 'Import Excel'}
            </label>
          </>
        )}
        {canOrganize && examId && (
          <button
            onClick={assignTables}
            disabled={assigning}
            className="px-5 py-2.5 bg-amber-500 text-blue-950 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-400 transition-all disabled:opacity-50"
          >
            {assigning ? 'Affectation…' : 'Affecter les numéros de table'}
          </button>
        )}
      </div>

      {/* Options d'affectation (coordonnateur / organisateur) */}
      {canOrganize && examId && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Répartition</span>
          <select
            value={assignOptions.orderBy}
            onChange={(e) => setAssignOptions({ ...assignOptions, orderBy: e.target.value as 'SCHOOL' | 'NAME' })}
            className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-900"
          >
            <option value="SCHOOL">Par école puis ordre alphabétique (mélange les écoles)</option>
            <option value="NAME">Ordre alphabétique pur</option>
          </select>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Numérotation</span>
          <select
            value={assignOptions.numberingScope}
            onChange={(e) => setAssignOptions({ ...assignOptions, numberingScope: e.target.value as 'CENTER' | 'EXAM' })}
            className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-900"
          >
            <option value="CENTER">Séquentielle par centre (001, 002…)</option>
            <option value="EXAM">Globale à l&apos;examen</option>
          </select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* Rapport d'import */}
      {importReport && (
        <div className="bg-white rounded-3xl border border-blue-100 shadow-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Rapport d&apos;import</h3>
            <button onClick={() => setImportReport(null)} className="text-xs font-bold text-gray-400 hover:text-gray-700">Fermer</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="bg-emerald-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-emerald-700">{importReport.created}</p>
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Créés</p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 text-center">
              <p className="text-2xl font-black text-amber-700">{importReport.skipped}</p>
              <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Ignorés</p>
            </div>
            {importReport.totalAfter !== undefined && (
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-blue-900">{importReport.totalAfter}</p>
                <p className="text-[9px] font-black text-blue-700 uppercase tracking-widest">Total examen</p>
              </div>
            )}
            {importReport.quota && (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-2xl font-black text-gray-700">{importReport.quota.used}/{importReport.quota.max}</p>
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Quota plan</p>
              </div>
            )}
          </div>
          {importReport.errors.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-5 max-h-48 overflow-y-auto space-y-1">
              {importReport.errors.map((errLine, i) => (
                <p key={i} className="text-xs font-semibold text-gray-600">{errLine}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Résultat d'affectation */}
      {assignResult && (
        <div className="bg-white rounded-3xl border border-amber-100 shadow-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Plan de salle &amp; numéros de table</h3>
            <button onClick={() => setAssignResult(null)} className="text-xs font-bold text-gray-400 hover:text-gray-700">Fermer</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(assignResult.perCenter ?? []).map((c) => (
              <div key={c.centerCode} className="bg-gray-50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-black text-gray-900">{c.centerName}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-blue-900 text-white px-2 py-1 rounded">
                    {c.centerCode}
                  </span>
                </div>
                <p className="text-xs font-bold text-blue-900 mb-3">{c.candidates} candidat(s)</p>
                <div className="space-y-1.5">
                  {c.rooms.map((r) => (
                    <div key={r.code} className="flex items-center justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
        </div>
      )}

      {/* Registre */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
            Registre de candidature
            {withoutCenter > 0 && (
              <span className="ml-3 text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-2.5 py-1 rounded">
                {withoutCenter} sans centre
              </span>
            )}
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, matricule, n° de table…)"
            className="px-5 py-3 bg-gray-50 rounded-xl text-xs font-bold w-full sm:w-72 outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Candidat</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Matricule</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">École</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Centre</th>
                <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Salle</th>
                <th className="px-6 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">N° de table</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-gray-400">Chargement…</td></tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-gray-400">
                    Aucun candidat. {canManageCandidates ? 'Importez votre fichier Excel de candidatures.' : ''}
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center font-black text-blue-900 text-sm shrink-0">
                          {c.firstName?.[0] ?? '?'}
                        </div>
                        <div>
                          <div className="text-sm font-black text-gray-900">{c.lastName} {c.firstName}</div>
                          <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                            {c.gender ?? '—'}
                            {c.dateOfBirth ? ` • ${new Date(c.dateOfBirth).toLocaleDateString('fr-FR')}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{c.matricule}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-blue-900">{c.school}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                      {c.center ? `${c.center.code} — ${c.center.name}` : <span className="text-gray-400">Non affecté</span>}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                      {c.room?.code ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {c.tableNumber ? (
                        <span className="inline-block bg-blue-900 text-white font-black text-sm px-3 py-1.5 rounded-xl">
                          {c.tableNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs font-bold">—</span>
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
        <div className="bg-blue-950 rounded-3xl p-8 text-white shadow-xl">
          <div className="flex items-center space-x-3 mb-4">
            <AppIcon name="library" size="menu" className="text-blue-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">Format du fichier d&apos;import</span>
          </div>
          <p className="text-xs text-blue-100/80 leading-relaxed font-medium">
            Fichier Excel (.xlsx, .xls) ou CSV — première ligne d&apos;en-têtes, une candidature par ligne.
            Colonnes reconnues : <span className="font-bold text-white">Prénom</span>,{' '}
            <span className="font-bold text-white">Nom</span>, Date de naissance, Sexe,{' '}
            <span className="font-bold text-white">École</span> (si rattachée au patronat, la liaison est
            automatique), Lieu de naissance, Matricule (généré automatiquement si vide), Téléphone, Email.
            Les doublons (même identité ou matricule existant) sont ignorés avec un rapport détaillé.
          </p>
        </div>
      )}
    </div>
  );
}
