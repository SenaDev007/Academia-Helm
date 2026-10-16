'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — IMPORT D'ÉLÈVES VIA EXCEL (modale)
 * ============================================================================
 *
 * Flux (pattern éprouvé du module Élèves des écoles, adapté au portail
 * enseignant autonome) :
 *   1. L'enseignant télécharge le template — une feuille par classe de son
 *      espace (ordre officiel : Mat 1 → Mat 2 → CI → CP → CE1 → CE2 → CM1 →
 *      CM2), 4 colonnes : Prénom / Nom / Sexe / Date de naissance.
 *   2. Il remplit chaque feuille (une ligne par élève) et uploade le fichier.
 *   3. Preview : validation complète côté serveur (lignes valides, erreurs,
 *      doublons déjà présents) SANS création.
 *   4. Import réel : seules les lignes valides sont créées (Student +
 *      ClassStudent, matricule ELV-<année>-<séquence>).
 *
 * Endpoints (JWT apiClient, direct api-server) :
 *   GET  /teacher-portal/students/import/template  (blob .xlsx)
 *   POST /teacher-portal/students/import/preview
 *   POST /teacher-portal/students/import/run
 *
 * ⚠️ Ces routes sont exclues du Service Worker (sw.js v4.20.0) : le template
 *    est un binaire et preview/run exigent l'état réel du serveur — hors
 *    ligne, la modale affiche l'erreur réseau honnêtement.
 */

import { useRef, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  RefreshCw,
} from 'lucide-react';
import apiClient from '@/lib/api/client';

interface PreviewRow {
  sheetName: string;
  rowIndex: number;
  firstName: string;
  lastName: string;
  gender: string | null;
  className: string;
  errors: string[];
  isValid: boolean;
  isExisting: boolean;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedExisting: number;
  sheetsProcessed: string[];
  unknownSheets: string[];
  summary: { byClass: Record<string, number> };
  rows: PreviewRow[];
}

interface RunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  skippedExisting: number;
  results: Array<{
    sheetName: string;
    rowIndex: number;
    studentName: string;
    status: 'created' | 'skipped' | 'error';
    error?: string;
    matricule?: string;
  }>;
}

interface ImportElevesProfModalProps {
  open: boolean;
  onClose: () => void;
  /** Appelé après un import réussi (au moins 1 élève créé) — rafraîchit la liste. */
  onImported: () => void;
}

export default function ImportElevesProfModal({
  open,
  onClose,
  onImported,
}: ImportElevesProfModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setFileName(null);
    setFileDataUrl('');
    setPreview(null);
    setRunResult(null);
    setLoading(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ─── Télécharger le template (blob .xlsx via apiClient + JWT) ───
  const handleDownloadTemplate = async () => {
    setError(null);
    try {
      const response = await apiClient.get(
        '/teacher-portal/students/import/template',
        { responseType: 'blob', timeout: 30000 },
      );
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-eleves-enseignant.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'Impossible de télécharger le template. Vérifiez votre connexion.',
      );
    }
  };

  // ─── Sélection du fichier (.xlsx → base64 data URL) ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.xlsx$/i)) {
      setError('Format invalide : sélectionnez un fichier Excel .xlsx (le template téléchargé).');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (5 Mo maximum).');
      return;
    }

    setFileName(selectedFile.name);
    setStep('upload');
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileDataUrl(event.target?.result as string);
    };
    reader.onerror = () => setError('Impossible de lire le fichier.');
    reader.readAsDataURL(selectedFile);
  };

  // ─── Preview : validation serveur sans création ───
  const handlePreview = async () => {
    if (!fileDataUrl || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post(
        '/teacher-portal/students/import/preview',
        { fileDataUrl },
        { timeout: 60000 },
      );
      const data: PreviewResult = response.data;
      if (!data || !Array.isArray(data.rows)) {
        throw new Error('Réponse de validation inattendue.');
      }
      setPreview(data);
      setStep('preview');
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'Impossible de valider le fichier. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Import réel ───
  const handleRun = async () => {
    if (!fileDataUrl || loading) return;
    setLoading(true);
    setError(null);
    setStep('importing');
    try {
      const response = await apiClient.post(
        '/teacher-portal/students/import/run',
        { fileDataUrl },
        { timeout: 120000 },
      );
      const data: RunResult = response.data;
      setRunResult(data);
      setStep('done');
      if (data?.succeeded > 0) onImported();
    } catch (e: any) {
      setStep('preview'); // retour à l'aperçu pour correction éventuelle
      setError(
        e?.response?.data?.message ||
          'L’import a échoué. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Rendu ───
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        {/* En-tête */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Importer mes élèves (Excel)
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Étape 1 : téléchargement + upload ── */}
          {(step === 'upload' || step === 'preview') && (
            <div className="space-y-4">
              <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-4">
                <p className="text-sm font-semibold text-teal-900">
                  1. Téléchargez le template
                </p>
                <p className="mt-1 text-xs text-teal-800/80">
                  Une feuille par classe de votre espace (Maternelle 1, Maternelle 2, CI, CP,
                  CE1, CE2, CM1, CM2…). Colonnes : Prénom, Nom, Sexe (M/F), Date de
                  naissance — les trois dernières sont optionnelles.
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={loading}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  Télécharger le template (.xlsx)
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  2. Importez le fichier rempli
                </p>
                <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center transition-colors hover:border-teal-400 hover:bg-teal-50/40">
                  <Upload className="h-7 w-7 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">
                    {fileName || 'Cliquez pour sélectionner votre fichier .xlsx'}
                  </span>
                  <span className="text-xs text-slate-400">
                    Vos élèves seront ajoutés aux classes selon les feuilles remplies.
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              </div>

              {fileDataUrl && step === 'upload' && (
                <button
                  onClick={handlePreview}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {loading ? 'Validation…' : 'Valider le fichier'}
                </button>
              )}
            </div>
          )}

          {/* ── Étape 2 : aperçu de la validation ── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Résumé */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{preview.totalRows}</p>
                  <p className="text-xs text-slate-500">lignes lues</p>
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-center">
                  <p className="text-lg font-bold text-teal-700">{preview.validRows}</p>
                  <p className="text-xs text-teal-600">à importer</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">
                    {preview.skippedExisting}
                  </p>
                  <p className="text-xs text-amber-600">déjà présents</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-lg font-bold text-red-700">{preview.invalidRows}</p>
                  <p className="text-xs text-red-600">en erreur</p>
                </div>
              </div>

              {preview.unknownSheets?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Feuilles ignorées (aucune classe correspondante) :{' '}
                  {preview.unknownSheets.join(', ')}
                </div>
              )}

              {/* Répartition par classe */}
              {Object.keys(preview.summary.byClass).length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Répartition des {preview.validRows} élève(s) à importer
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(preview.summary.byClass).map(([cls, count]) => (
                      <span
                        key={cls}
                        className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                      >
                        {cls} : {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Détail des lignes (scroll) */}
              {preview.rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5 font-semibold">Classe</th>
                        <th className="px-3 py-2.5 font-semibold">Prénom</th>
                        <th className="px-3 py-2.5 font-semibold">Nom</th>
                        <th className="px-3 py-2.5 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr
                          key={`${r.sheetName}-${r.rowIndex}-${i}`}
                          className={`border-b border-slate-100 last:border-0 ${
                            !r.isValid ? 'bg-red-50/60' : r.isExisting ? 'bg-amber-50/60' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 text-slate-600">{r.className}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {r.firstName}
                          </td>
                          <td className="px-3 py-2.5 text-slate-900">{r.lastName}</td>
                          <td className="px-3 py-2.5">
                            {!r.isValid ? (
                              <span className="text-xs font-medium text-red-700">
                                {r.errors[0]}
                              </span>
                            ) : r.isExisting ? (
                              <span className="text-xs font-medium text-amber-700">
                                Déjà présent — sera ignoré
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Prêt
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Étape 3 : import en cours ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              <p className="text-sm font-medium">Import de vos élèves en cours…</p>
              <p className="text-xs text-slate-400">Ne fermez pas cette fenêtre.</p>
            </div>
          )}

          {/* ── Étape 4 : résultat ── */}
          {step === 'done' && runResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-center">
                  <p className="text-lg font-bold text-teal-700">{runResult.succeeded}</p>
                  <p className="text-xs text-teal-600">élève(s) importé(s)</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                  <p className="text-lg font-bold text-amber-700">
                    {runResult.skippedExisting}
                  </p>
                  <p className="text-xs text-amber-600">déjà présents</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-lg font-bold text-red-700">{runResult.failed}</p>
                  <p className="text-xs text-red-600">échec(s)</p>
                </div>
              </div>

              {runResult.results.filter((r) => r.status === 'error').length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5 font-semibold">Classe</th>
                        <th className="px-3 py-2.5 font-semibold">Élève</th>
                        <th className="px-3 py-2.5 font-semibold">Erreur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runResult.results
                        .filter((r) => r.status === 'error')
                        .map((r, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2.5 text-slate-600">{r.sheetName}</td>
                            <td className="px-3 py-2.5 font-medium text-slate-900">
                              {r.studentName}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-red-700">{r.error}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                onClick={reset}
                className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-800"
              >
                <RefreshCw className="h-4 w-4" />
                Importer un autre fichier
              </button>
            </div>
          )}
        </div>

        {/* Pied : actions contextuelles */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            {step === 'done' ? 'Fermer' : 'Annuler'}
          </button>
          {step === 'preview' && preview && preview.validRows > 0 && (
            <button
              onClick={handleRun}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {loading
                ? 'Import…'
                : `Importer ${preview.validRows} élève(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
