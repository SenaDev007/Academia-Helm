'use client';

/**
 * ============================================================================
 * EDUC MASTER IMPORT WORKSPACE — Interopérabilité > Importation Educ Master
 * ============================================================================
 *
 * Permet à l'école d'importer les notes des élèves dans le template Excel
 * Educ Master (format officiel du MEMP — Ministère de l'Enseignement Maternel
 * et Primaire / Secondaire du Bénin).
 *
 * Flux :
 *   1. L'utilisateur sélectionne une classe + une période (trimestre)
 *   2. L'utilisateur uploade le fichier Excel template Educ Master
 *      (téléchargé depuis emp.educmaster.bj)
 *   3. Le backend parse le fichier et retourne la liste des élèves du fichier
 *      + les feuilles (matières pour secondaire / classe pour primaire)
 *   4. Le backend matche les élèves du fichier avec ceux du système (par
 *      matricule, par nom exact, puis par similarité Levenshtein)
 *   5. L'utilisateur valide manuellement les matchs faibles (confidence < 0.95)
 *      et corrige les erreurs de mapping
 *   6. Le backend remplit le fichier Excel avec les notes des élèves pour la
 *      période sélectionnée et retourne le fichier rempli en téléchargement
 *
 * ⭐ Non disponible pour la maternelle (l'import n'a pas de sens pour le
 *    système qualitatif TS/S/PS).
 *
 * ⭐ Format secondaire : une feuille par matière (ANGLAIS, MATHS GENE, etc.)
 *    avec colonnes Matricule | Nom | Prénoms | Moy. interro | Devoir 1 | Devoir 2
 *
 * ⭐ Format primaire : une seule feuille "Notes - {Classe}" avec colonnes
 *    fusionnées par matière (Dictée, Math, etc.), chaque matière ayant 2
 *    colonnes : Note obtenue | Note perfectionnement
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle,
  Download, ArrowRight, ArrowLeft, RefreshCw, Link2, Unlink, Sparkles,
  Users, FileText, ListChecks,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '@/app/app/exams/sub-modules';
import { useExamSubModules, useExamScope } from '@/app/app/exams/layout';
import { filterClassesForLevel } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

// ─── Types ──────────────────────────────────────────────────────────────

interface SheetInfo {
  name: string;
  subject?: string;
  columns: string[];
  rowCount: number;
}

interface ExcelStudent {
  row: number;
  sheetName: string;
  matricule: string;
  nom: string;
  prenoms: string;
}

interface OurStudent {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

interface MatchResult {
  excel: ExcelStudent;
  our: OurStudent | null;
  confidence: number;
  reason: string;
  manualValidated: boolean;
}

interface ParseResult {
  format: 'secondaire' | 'primaire';
  sheets: SheetInfo[];
  students: ExcelStudent[];
  warnings: string[];
}

interface MatchResponse {
  matches: MatchResult[];
  ourStudents: OurStudent[];
  unmatchedExcel: ExcelStudent[];
  unmatchedOur: OurStudent[];
}

// ─── Confidence helper ──────────────────────────────────────────────────

function confidenceBadge(confidence: number): { cls: string; label: string } {
  if (confidence >= 0.95) return { cls: 'bg-emerald-100 text-emerald-700 border-emerald-300', label: 'Match exact' };
  if (confidence >= 0.85) return { cls: 'bg-blue-100 text-blue-700 border-blue-300', label: 'Match fort' };
  if (confidence >= 0.7) return { cls: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Match probable' };
  if (confidence >= 0.6) return { cls: 'bg-orange-100 text-orange-700 border-orange-300', label: 'Match faible' };
  return { cls: 'bg-red-100 text-red-700 border-red-300', label: 'Aucun match' };
}

function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    'matricule': 'Matricule identique',
    'exact_name': 'Nom identique',
    'fuzzy_name_strong': 'Nom similaire (fort)',
    'fuzzy_name_weak': 'Nom similaire (faible)',
    'no_match': 'Aucun match',
  };
  return map[reason] || reason;
}

// ─── Component ──────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'download';

export default function EducMasterImportWorkspace() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isMaternelle = scopeLevel === 'MATERNELLE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');

  const [step, setStep] = useState<Step>('upload');
  const [parsing, setParsing] = useState(false);
  const [matching, setMatching] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uploaded file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  // Parse result
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Match result
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);

  // Manual overrides: { excelMatricule: ourStudentId }
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);

  // Load classes
  useEffect(() => {
    if (!academicYear?.id || !schoolLevelUuid) return;
    (async () => {
      try {
        const res = await fetch(`/api/all-classes?academicYearId=${academicYear.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const all = Array.isArray(data) ? data : [];
          const filtered = filterClassesForLevel(all, schoolLevelUuid, scopeLang);
          filtered.sort((a: any, b: any) => {
            const idxA = pedagogicalSortIndex(a.name);
            const idxB = pedagogicalSortIndex(b.name);
            return idxA !== idxB ? idxA - idxB : (a.name || '').localeCompare(b.name || '', 'fr');
          });
          setClasses(filtered);
          if (filtered.length > 0 && !selectedClassId) setSelectedClassId(filtered[0].id);
        }
      } catch { setClasses([]); }
    })();
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  // Load periods
  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.items || []);
          setPeriods(list);
          if (list.length > 0) setSelectedPeriodId(list[0].id);
        }
      } catch { setPeriods([]); }
    })();
  }, [academicYear?.id]);

  // ─── Step 1: handle file upload + parse ───────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setUploadedFileName(file.name);
    setError(null);
  };

  const parseUploadedFile = async () => {
    if (!uploadedFile) {
      setError('Veuillez sélectionner un fichier Excel.');
      return;
    }
    if (!selectedClassId || !academicYear?.id) {
      setError('Veuillez sélectionner une classe.');
      return;
    }
    setParsing(true);
    setError(null);
    try {
      // Read file as base64
      const base64 = await fileToBase64(uploadedFile);
      const response = await apiClient.post('/exams/educ-master/parse', {
        fileBase64: base64,
        fileName: uploadedFile.name,
        classId: selectedClassId,
        academicYearId: academicYear.id,
      });
      const result: ParseResult = response.data;
      setParseResult(result);

      // Auto-trigger match
      await matchStudents(result.students);
      setStep('mapping');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors du parsing');
    } finally {
      setParsing(false);
    }
  };

  const matchStudents = async (excelStudents: ExcelStudent[]) => {
    if (!selectedClassId || !academicYear?.id) return;
    setMatching(true);
    try {
      const response = await apiClient.post('/exams/educ-master/match', {
        classId: selectedClassId,
        academicYearId: academicYear.id,
        excelStudents,
      });
      setMatchResult(response.data);
      // Initialize overrides from auto-match (high confidence)
      const initialOverrides: Record<string, string> = {};
      for (const m of response.data.matches as MatchResult[]) {
        if (m.our && m.confidence >= 0.95) {
          initialOverrides[m.excel.matricule] = m.our.id;
        }
      }
      setOverrides(initialOverrides);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Erreur lors du matching');
    } finally {
      setMatching(false);
    }
  };

  // ─── Step 2: mapping overrides ─────────────────────────────────────────

  const setOverride = (excelMat: string, ourId: string) => {
    setOverrides(prev => ({ ...prev, [excelMat]: ourId }));
  };

  const clearOverride = (excelMat: string) => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[excelMat];
      return next;
    });
  };

  // ─── Step 3: fill Excel and download ────────────────────────────────────

  const fillExcel = async () => {
    if (!uploadedFile || !selectedClassId || !academicYear?.id || !selectedPeriodId) {
      setError('Veuillez sélectionner une classe et une période.');
      return;
    }
    // Build student mapping from overrides + auto-match
    const studentMapping: Record<string, string> = {};
    if (matchResult) {
      for (const m of matchResult.matches) {
        const ourId = overrides[m.excel.matricule] || (m.our && m.confidence >= 0.95 ? m.our.id : null);
        if (ourId) studentMapping[m.excel.matricule] = ourId;
      }
    }
    if (Object.keys(studentMapping).length === 0) {
      setError('Aucun élève à mapper. Veuillez valider au moins un match.');
      return;
    }

    setFilling(true);
    setError(null);
    try {
      const base64 = await fileToBase64(uploadedFile);
      const response = await apiClient.post('/exams/educ-master/fill', {
        fileBase64: base64,
        fileName: uploadedFile.name,
        classId: selectedClassId,
        academicYearId: academicYear.id,
        periodId: selectedPeriodId,
        level: scopeLevel || 'PRIMAIRE',
        studentMapping,
      }, { responseType: 'blob', timeout: 120000 });

      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = uploadedFile.name.replace(/\.xlsx$/i, '').replace(/[^\w\-]/g, '_');
      link.download = `${safeName}_rempli.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setStep('download');
    } catch (err: any) {
      // Try to read error message from blob
      let errorMsg = err.message || 'Erreur lors du remplissage';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorMsg = json.error || errorMsg;
        } catch { /* ignore */ }
      }
      setError(errorMsg);
    } finally {
      setFilling(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setUploadedFile(null);
    setUploadedFileName('');
    setParseResult(null);
    setMatchResult(null);
    setOverrides({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (isMaternelle) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700 mb-2">
          Importation Educ Master non disponible pour la maternelle
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          L'importation des notes vers la plateforme Educ Master n'est pas disponible
          pour le niveau maternelle car le système d'évaluation est qualitatif
          (TS / S / PS) et non chiffré.
        </p>
      </div>
    );
  }

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';
  const matchedCount = matchResult ? matchResult.matches.filter(m => overrides[m.excel.matricule]).length : 0;
  const totalExcel = matchResult ? matchResult.matches.length : 0;

  return (
    <div className="space-y-4">
      {/* ─── En-tête + classe + période ─── */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]"
            >
              <option value="">— Sélectionner une classe —</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Période (trimestre)</label>
            <select
              value={selectedPeriodId}
              onChange={e => setSelectedPeriodId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]"
            >
              <option value="">— Sélectionner —</option>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span className={cn('px-2 py-1 rounded-full font-bold',
              step === 'upload' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
              1. Upload
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className={cn('px-2 py-1 rounded-full font-bold',
              step === 'mapping' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
              2. Mapping élèves
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
            <span className={cn('px-2 py-1 rounded-full font-bold',
              step === 'download' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500')}>
              3. Téléchargement
            </span>
          </div>
        </div>
      </div>

      {/* ─── Error display ─── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">
            <p className="font-semibold mb-1">Erreur</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* ─── Step 1: Upload ─── */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Téléverser le template Educ Master
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Téléchargez le template Excel Educ Master depuis{' '}
            <a href="https://emp.educmaster.bj" target="_blank" rel="noopener noreferrer"
               className="text-blue-600 hover:underline">
              emp.educmaster.bj
            </a>{' '}
            pour votre classe, puis téléversez-le ici. Le système remplira
            automatiquement les notes des élèves pour la période sélectionnée.
          </p>

          {!selectedClassId || !selectedPeriodId ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Veuillez sélectionner une classe et une période avant de téléverser le fichier.
            </div>
          ) : (
            <>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadedFile ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
                    <p className="font-semibold text-slate-800">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-500">
                      {(uploadedFile.size / 1024).toFixed(1)} Ko · cliquez pour changer
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-12 h-12 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">
                      Cliquez pour sélectionner un fichier Excel (.xlsx)
                    </p>
                    <p className="text-xs text-slate-500">
                      Template Educ Master téléchargé depuis emp.educmaster.bj
                    </p>
                  </div>
                )}
              </div>

              {uploadedFile && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={parseUploadedFile}
                    disabled={parsing || matching}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {parsing || matching ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyse en cours...</>
                    ) : (
                      <><ArrowRight className="w-4 h-4 mr-2" /> Analyser et mapper les élèves</>
                    )}
                  </Button>
                </div>
              )}

              {/* Info box */}
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                <p className="font-semibold mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Formats supportés
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Secondaire</strong> : une feuille par matière (ANGLAIS, MATHS GENE, FRANCAIS, etc.) avec colonnes Matricule | Nom | Prénoms | Moy. interro | Devoir 1 | Devoir 2</li>
                  <li><strong>Primaire</strong> : une feuille « Notes - {selectedClassName || 'Classe'} » avec colonnes par matière (Dictée, Math, etc.) chacune avec Note obtenue + Note perfectionnement</li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── Step 2: Mapping ─── */}
      {step === 'mapping' && parseResult && matchResult && (
        <div className="space-y-4">
          {/* Parse summary */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Fichier analysé : {uploadedFileName}
            </h3>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{parseResult.format === 'secondaire' ? 'Secondaire' : 'Primaire'}</p>
                <p className="text-xs text-slate-600">Format détecté</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{parseResult.sheets.length}</p>
                <p className="text-xs text-slate-600">Feuilles ({parseResult.format === 'secondaire' ? 'matières' : 'classe'})</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{parseResult.students.length}</p>
                <p className="text-xs text-slate-600">Élèves dans le fichier</p>
              </div>
            </div>
            {parseResult.warnings.length > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                {parseResult.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}
          </div>

          {/* Match summary */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Mapping des élèves — {matchedCount} / {totalExcel} mappés
            </h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">
                  {matchResult.matches.filter(m => m.confidence >= 0.95).length}
                </p>
                <p className="text-xs text-emerald-600">Matchs exacts</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <Sparkles className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">
                  {matchResult.matches.filter(m => m.confidence >= 0.6 && m.confidence < 0.95).length}
                </p>
                <p className="text-xs text-amber-600">Matchs flous (à valider)</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-red-700">
                  {matchResult.matches.filter(m => !m.our).length}
                </p>
                <p className="text-xs text-red-600">Aucun match</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <Link2 className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{matchResult.unmatchedOur.length}</p>
                <p className="text-xs text-blue-600">Dans notre système, pas dans le fichier</p>
              </div>
            </div>

            {/* Match table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ListChecks className="w-4 h-4" /> Tableau de mapping
                </h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-xs">Fichier Excel (Matricule / Nom / Prénoms)</TableHead>
                    <TableHead className="text-xs text-center">Confiance</TableHead>
                    <TableHead className="text-xs">→ Notre système (sélection manuelle)</TableHead>
                    <TableHead className="text-xs text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchResult.matches.map((m, idx) => {
                    const override = overrides[m.excel.matricule];
                    const isMapped = !!override;
                    const conf = confidenceBadge(m.confidence);
                    return (
                      <TableRow key={`${m.excel.matricule}-${idx}`} className={cn(
                        idx % 2 === 1 && 'bg-slate-50/60',
                        isMapped && 'bg-emerald-50/40',
                        !m.our && !isMapped && 'bg-red-50/30',
                      )}>
                        <TableCell className="text-xs">
                          <div className="font-mono text-[10px] text-slate-500">{m.excel.matricule || '—'}</div>
                          <div className="font-semibold">{m.excel.nom}</div>
                          <div className="text-slate-600">{m.excel.prenoms}</div>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border', conf.cls)}>
                            {conf.label}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-1">{reasonLabel(m.reason)}</div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <select
                            value={override || ''}
                            onChange={e => e.target.value ? setOverride(m.excel.matricule, e.target.value) : clearOverride(m.excel.matricule)}
                            className={cn(
                              'px-2 py-1 text-xs border rounded w-full',
                              isMapped ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300',
                            )}
                          >
                            <option value="">— Aucun (ne pas remplir) —</option>
                            {matchResult.ourStudents.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.fullName} {s.matricule ? `(${s.matricule})` : ''}
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {isMapped ? (
                            <button
                              onClick={() => clearOverride(m.excel.matricule)}
                              className="p-1.5 rounded hover:bg-red-100"
                              title="Démapper"
                            >
                              <Unlink className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Button onClick={reset} variant="outline" className="border-slate-300">
              <ArrowLeft className="w-4 h-4 mr-2" /> Recommencer
            </Button>
            <Button
              onClick={fillExcel}
              disabled={filling || matchedCount === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {filling ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Remplissage en cours...</>
              ) : (
                <><Download className="w-4 h-4 mr-2" /> Remplir et télécharger le fichier ({matchedCount} élèves)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Download (success) ─── */}
      {step === 'download' && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Fichier rempli avec succès !
          </h3>
          <p className="text-sm text-slate-600 mb-4 max-w-md mx-auto">
            Le fichier Excel a été rempli avec les notes des {matchedCount} élèves
            mappés pour la période <strong>{periods.find(p => p.id === selectedPeriodId)?.name || ''}</strong>.
            Le téléchargement devrait démarrer automatiquement.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={reset} variant="outline" className="border-slate-300">
              <RefreshCw className="w-4 h-4 mr-2" /> Refaire un import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: convert File to base64 ──────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URI prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
