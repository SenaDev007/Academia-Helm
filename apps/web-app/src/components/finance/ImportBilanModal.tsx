/**
 * ============================================================================
 * IMPORT BILAN MODAL — Import en masse du bilan des encaissements
 * ============================================================================
 *
 * Modal permettant d'importer les paiements encaissés (bilan des encaissements)
 * depuis un fichier Excel (.xlsx).
 *
 * ⭐ DEUX FORMATS ACCEPTÉS (auto-détectés à l'upload) :
 *   1. FORMAT « POINT » — le standard des fichiers tenus par les écoles :
 *      une feuille par classe (nom de la feuille = classe), en-têtes sur les
 *      lignes 4-5, tranches de scolarité P1..P6, ligne TOTAL en fin de
 *      tableau. Le total encaissé par élève = Inscript + Unif + Tenue + P1..P6.
 *   2. Format SIMPLE — le template plat généré par Academia Helm
 *      (Noms | Arriéré | Inscription | Tranches 1-6 | Total).
 *
 * ⭐ SÉLECTEUR D'ANNÉE SCOLAIRE : permet de cibler l'année active OU une
 *   année antérieure (utile pour l'onboarding des nouvelles écoles qui
 *   réinjectent leur historique). Si l'année lue dans le fichier ne
 *   correspond pas à l'année sélectionnée, un avertissement s'affiche.
 *
 * Pour chaque ligne valide : une FinanceTransaction (type=PAYMENT) est créée
 * et allouée FIFO sur les AccountBreakdowns de l'élève.
 *
 * Accessible depuis le module Finance > Bilan des encaissements.
 * ============================================================================
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, Receipt, UserCheck, UserX, HelpCircle, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ResponsiveTableWrapper from '@/components/ui/tables/ResponsiveTableWrapper';
import { useToast } from '@/components/ui/use-toast';
import { getAcademicYears } from '@/services/settings.service';

interface PreviewRow {
  rowIndex: number;
  sheetName: string;
  /** ⭐ Classe détectée (sections multi-classes dans une même feuille) */
  className?: string;
  studentName: string;
  arrear: number;
  arrearNote?: string;
  inscription: number;
  tranches: number[];
  total: number;
  // ⭐ Enrichissement format POINT
  format?: 'POINT' | 'SIMPLE';
  unif?: number;
  tenue?: number;
  fraisGeneraux?: number;
  scolaritePayee?: number;
  reste?: number;
  notes?: string[];
  matchStatus: 'MATCHED' | 'FUZZY' | 'NOT_FOUND';
  matchScore: number;
  resolvedStudentName?: string;
  errors: string[];
  isValid: boolean;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  sheetsProcessed: string[];
  sheetInfo?: Record<string, { format: 'POINT' | 'SIMPLE'; yearLabel?: string; classFee?: number; sections?: string[] }>;
  yearMismatch?: {
    targetYear: string;
    sheets: Array<{ sheet: string; detected: string }>;
  } | null;
  summary: {
    totalAmount: number;
    bySheet: Record<string, number>;
    byClass?: Record<string, number>;
    studentsMatched: number;
    studentsNotFound: number;
  };
}

interface RunResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  results: Array<{
    rowIndex: number;
    sheetName: string;
    studentName: string;
    success: boolean;
    transactionId?: string;
    amount?: number;
    error?: string;
  }>;
}

interface ImportBilanModalProps {
  open: boolean;
  onClose: () => void;
  academicYearId: string;
  onSuccess?: () => void;
}

export default function ImportBilanModal({ open, onClose, academicYearId, onSuccess }: ImportBilanModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);

  // ⭐ Sélecteur d'année scolaire cible (année active par défaut, ou une
  // année antérieure pour l'onboarding des nouvelles écoles)
  const [years, setYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>(academicYearId || '');

  useEffect(() => {
    if (!open) return;
    // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : à l'ouverture (et si
    //    l'année du contexte change), la cible PAR DÉFAUT est l'année du
    //    CONTEXTE (sélecteur global du header) — pas l'année active serveur
    //    ni une sélection stale d'une session précédente de la modale.
    //    L'utilisateur peut ensuite choisir une autre année dans la modale.
    if (academicYearId) setSelectedYearId(academicYearId);
    getAcademicYears()
      .then((d: any) => {
        const yrs = Array.isArray(d) ? d : (d?.data ?? []);
        setYears(yrs);
        if (!selectedYearId && !academicYearId) {
          const active = yrs.find((y: any) => y.isActive) || yrs[0];
          if (active?.id) setSelectedYearId(active.id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, academicYearId]);

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setFile(null);
    setFileDataUrl('');
    setPreview(null);
    setRunResult(null);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ─── Télécharger le template ───
  const handleDownloadTemplate = async () => {
    if (!selectedYearId) {
      toast({ title: 'Erreur', description: 'Aucune année scolaire sélectionnée', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(
        `/api/finance/collection-summary/import/template?academicYearId=${encodeURIComponent(selectedYearId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('Template download failed:', res.status, errText);
        throw new Error(`Erreur téléchargement template (${res.status})`);
      }
      const blob = await res.blob();
      if (!blob || blob.size === 0) throw new Error('Template vide ou introuvable');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-bilan-encaissements-academia-helm.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ Template téléchargé', description: 'Une feuille par classe.' });
    } catch (e: any) {
      console.error('handleDownloadTemplate error:', e);
      toast({ title: 'Erreur', description: e.message || 'Erreur téléchargement template', variant: 'destructive' });
    }
  };

  // ─── Upload fichier ───
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: 'Format invalide', description: 'Veuillez sélectionner un fichier Excel (.xlsx)', variant: 'destructive' });
      return;
    }
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => setFileDataUrl(event.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  // ─── Preview ───
  const handlePreview = async () => {
    if (!fileDataUrl || !selectedYearId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/collection-summary/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId: selectedYearId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || 'Erreur lors de la validation');
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
      setStep('preview');
      toast({
        title: data.invalidRows > 0 ? '⚠️ Validation terminée' : '✅ Validation réussie',
        description: `${data.validRows} ligne(s) valide(s), ${data.invalidRows} avec erreur(s).`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur validation', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Import réel ───
  const handleImport = async () => {
    if (!fileDataUrl || !selectedYearId) return;
    setStep('importing');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/collection-summary/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId: selectedYearId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || 'Erreur lors de l\'import');
      }
      const data: RunResult = await res.json();
      setRunResult(data);
      setStep('done');
      toast({
        title: data.errors === 0 ? '✅ Import terminé' : 'Import terminé avec erreurs',
        description: `${data.imported} importé(s), ${data.skipped} ignoré(s), ${data.errors} échec(s).`,
        variant: data.errors > 0 ? 'destructive' : 'default',
      });
      if (onSuccess) onSuccess();
    } catch (e: any) {
      toast({ title: 'Erreur import', description: e.message, variant: 'destructive' });
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';

  const MatchBadge = ({ status }: { status: PreviewRow['matchStatus'] }) => {
    if (status === 'MATCHED') {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
          <UserCheck className="w-3 h-3" /> Match
        </span>
      );
    }
    if (status === 'FUZZY') {
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 inline-flex items-center gap-1">
          <HelpCircle className="w-3 h-3" /> Flou
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 inline-flex items-center gap-1">
        <UserX className="w-3 h-3" /> ?
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-700 to-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import du bilan des encaissements</h2>
              <p className="text-xs text-blue-100">Importez les paiements encaisses depuis un fichier Excel "POINT"</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* ⭐ Sélecteur d'année scolaire cible */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">Année scolaire cible</p>
                    <p className="text-xs text-slate-500 mb-2">
                      Choisissez l'année sur laquelle importer les encaissements — l'année active ou une année antérieure (onboarding d'une nouvelle école).
                    </p>
                    <select
                      value={selectedYearId}
                      onChange={(e) => setSelectedYearId(e.target.value)}
                      className="w-full sm:w-72 border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {years.length === 0 && <option value="">Chargement des années…</option>}
                      {years.map((y: any) => (
                        <option key={y.id} value={y.id}>
                          {y.name || y.label} {y.isActive ? '(active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Template Excel bilan</p>
                    <p className="text-xs text-slate-500">Une feuille par classe</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="border-blue-300 text-blue-700 hover:bg-blue-100">
                  <Download className="w-4 h-4 mr-1.5" /> Télécharger
                </Button>
              </div>

              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} Ko</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-10 h-10 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Cliquez pour sélectionner un fichier Excel</p>
                    <p className="text-xs text-slate-400">Formats acceptés : .xlsx, .xls</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">📋 Formats acceptés (détection automatique)</p>
                <div className="space-y-2">
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <p className="text-xs font-bold text-blue-800 mb-1">Fichier « POINT » des écoles (reconnu automatiquement)</p>
                    <ul className="text-xs text-slate-600 space-y-1">
                      <li>• <strong>Une feuille par classe</strong> — le nom de la feuille doit être le nom de la classe (ex: "CP A", "Maternelle 1").</li>
                      <li>• <strong>Ou plusieurs classes par feuille</strong> (« point financier ») — une ligne-titre par classe (ex: MATERNELLE, CI, CP, CE1...) au-dessus des élèves de la classe.</li>
                      <li>• En-têtes sur les lignes 4-5 : <strong>N° | Noms et Prénoms | Arriéré | Tél | Inscript | Unif | Tenue de Sport | Total frais Généraux | Scolarité P1 P2 P3 ... | Total Scolarité | Reste | Total des payements</strong>.</li>
                      <li>• Les tranches de scolarité <strong>P1..P8</strong> sont importées comme montants encaissés (jusqu'à 8 tranches selon les fichiers).</li>
                      <li>• Total encaissé importé = Inscript + Unif + Tenue de Sport + P1 + ... + P8.</li>
                      <li>• La colonne « Arriéré » (année antérieure) est <strong>informative</strong> — utilisez l'import dédié des arriérés pour la solder.</li>
                      <li>• Textes type "ABD", "FONDE" ou une école d'origine sont ignorés (non numériques).</li>
                      <li>• Si le fichier mentionne une année différente de l'année cible, un avertissement s'affiche (import feuille par feuille sur la bonne année).</li>
                    </ul>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded-lg">
                    <p className="text-xs font-bold text-slate-700 mb-1">Template Academia Helm (simple)</p>
                    <p className="text-xs text-slate-600">Noms et Prénoms | Arriéré | Inscription | Tranche 1..6 | Total — en-tête en ligne 1.</p>
                  </div>
                </div>
                <p className="text-xs text-blue-700 mt-3 font-medium">🏦 Pour chaque ligne valide : une FinanceTransaction (type=PAYMENT) est créée et allouée FIFO sur les AccountBreakdowns. Reçu PDF généré automatiquement.</p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Annuler</Button>
                <Button onClick={handlePreview} disabled={!fileDataUrl || loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1.5" />}
                  Valider le fichier
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-800">{preview.totalRows}</p>
                  <p className="text-xs text-slate-500">Total lignes</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{preview.validRows}</p>
                  <p className="text-xs text-emerald-600">Valides</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-rose-700">{preview.invalidRows}</p>
                  <p className="text-xs text-rose-600">Erreurs</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{preview.summary.studentsMatched}</p>
                  <p className="text-xs text-blue-600">Élèves matchés</p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-800">
                  Total à encaisser : {formatCurrency(preview.summary.totalAmount)}
                </p>
                {/* ⭐ Totaux par classe (sections détectées) — prioritaire sur les feuilles */}
                {preview.summary.byClass && Object.keys(preview.summary.byClass).length > 0 && (
                  <div className="mt-1">
                    <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">Par classe</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(preview.summary.byClass).map(([cls, amount]) => (
                        <span key={cls} className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                          {cls}: {formatCurrency(amount)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(preview.summary.bySheet).map(([sheet, amount]) => (
                    <span key={sheet} className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                      {sheet}{preview.sheetInfo?.[sheet]?.format === 'POINT' ? ' · POINT' : ''}: {formatCurrency(amount)}
                    </span>
                  ))}
                </div>
              </div>

              {preview.yearMismatch && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>Année scolaire différente détectée dans le fichier.</strong> Le fichier mentionne «&nbsp;
                    {Array.from(new Set(preview.yearMismatch.sheets.map((s) => s.detected))).join(', ')}
                    &nbsp;» alors que l'année cible sélectionnée est «&nbsp;{preview.yearMismatch.targetYear}&nbsp;»
                    (feuilles concernées&nbsp;: {preview.yearMismatch.sheets.map((s) => s.sheet).join(', ')}).
                    Vérifiez l'année cible avant d'importer, ou corrigez la ligne « ANNEE SCOLAIRE » du fichier.
                  </p>
                </div>
              )}

              {preview.summary.studentsNotFound > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>{preview.summary.studentsNotFound} élève(s) non matché(s)</strong> — vérifiez l'orthographe
                    ou saisissez le matricule. Les lignes non matchées seront ignorées.
                  </p>
                </div>
              )}

              {/* Tableau preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <ResponsiveTableWrapper minWidth="900px">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Élève (Excel)</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Match</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Classe</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Feuille</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Frais gén. (Inscr+Unif+Tenue)</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Scolarité (P1-P8)</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Arriéré (info)</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 100).map((row) => {
                        const tranchesSum = row.scolaritePayee ?? row.tranches.reduce((s, v) => s + v, 0);
                        const fraisGen = row.fraisGeneraux ?? row.inscription;
                        return (
                          <tr key={`${row.sheetName}-${row.rowIndex}`} className={row.isValid ? '' : 'bg-rose-50/50'}>
                            <td className="px-3 py-2 text-xs text-slate-400">{row.rowIndex}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-800">{row.studentName}</span>
                              {row.resolvedStudentName && row.resolvedStudentName !== row.studentName && (
                                <span className="text-[10px] text-slate-500 ml-1 block">→ {row.resolvedStudentName}</span>
                              )}
                              {row.arrearNote && (
                                <span className="text-[10px] text-amber-600 ml-1 block">Arriéré : {row.arrearNote} (non importé)</span>
                              )}
                            </td>
                            <td className="px-3 py-2"><MatchBadge status={row.matchStatus} /></td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {row.className ? (
                                <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{row.className}</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.sheetName}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono">{fraisGen > 0 ? formatCurrency(fraisGen) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono">{tranchesSum > 0 ? formatCurrency(tranchesSum) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono text-amber-700">{row.arrear > 0 ? formatCurrency(row.arrear) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono font-bold">{formatCurrency(row.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </ResponsiveTableWrapper>
                {preview.rows.length > 100 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                    100 premières lignes affichées sur {preview.rows.length}
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500">
                💡 La colonne « Arriéré » est informative (année antérieure) : elle n'est pas incluse dans le total importé. Utilisez l'import des arriérés pour la prendre en compte.
              </p>

              {preview.invalidRows > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>{preview.invalidRows} ligne(s) avec erreur(s).</strong> Les lignes invalides seront ignorées.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>← Retour</Button>
                <Button
                  onClick={handleImport}
                  disabled={preview.validRows === 0 || loading}
                  className="bg-blue-700 hover:bg-blue-800 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Importer {preview.validRows} encaissement(s)
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-blue-700 animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-800">Import en cours...</p>
              <p className="text-sm text-slate-500 mt-1">Création des transactions — ne fermez pas cette fenêtre</p>
              <p className="text-xs text-slate-400 mt-3 text-center max-w-md">L'import de plusieurs centaines d'élèves peut prendre 1 à 3 minutes.<br/>Si une erreur de connexion survient, cliquez à nouveau sur « Importer » : les lignes déjà importées seront ignorées, aucun doublon ne sera créé.</p>
            </div>
          )}

          {step === 'done' && runResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                {runResult.errors === 0 ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-3" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-amber-500 mb-3" />
                )}
                <h3 className="text-xl font-bold text-slate-900">Import terminé</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {runResult.imported} transaction(s) créée(s), {runResult.skipped} ignorée(s)
                  {runResult.errors > 0 && `, ${runResult.errors} échec(s)`}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{runResult.imported}</p>
                  <p className="text-xs text-emerald-600">Importées</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-700">{runResult.skipped}</p>
                  <p className="text-xs text-slate-600">Ignorées (Total=0 ou déjà importées)</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-rose-700">{runResult.errors}</p>
                  <p className="text-xs text-rose-600">Échecs</p>
                </div>
              </div>

              {runResult.errors > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-rose-50 border-b border-rose-100">
                    <p className="text-sm font-semibold text-rose-800">Détails des échecs</p>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <ResponsiveTableWrapper>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {runResult.results.filter((r) => !r.success && r.error).map((r) => (
                          <tr key={`${r.sheetName}-${r.rowIndex}`}>
                            <td className="px-3 py-2 text-xs text-slate-400">Ligne {r.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.studentName}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{r.sheetName}</td>
                            <td className="px-3 py-2 text-xs text-rose-600">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </ResponsiveTableWrapper>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose} className="bg-blue-700 hover:bg-blue-800 text-white">Terminer</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
