/**
 * ============================================================================
 * IMPORT ELEVES MODAL — Import en masse d'élèves via Excel
 * ============================================================================
 *
 * Modal intégré permettant aux établissements d'importer leur liste d'élèves
 * depuis un fichier Excel (.xlsx).
 *
 * Workflow :
 *   1. L'admin télécharge le template Excel (bouton "Télécharger le template")
 *   2. L'admin remplit le template (une ligne par élève)
 *   3. L'admin upload le fichier → preview avec validation
 *   4. L'admin corrige les erreurs éventuelles et confirme l'import
 *   5. Le système crée Student + StudentEnrollment + StudentAccount
 *
 * Accessible depuis le module Élèves > Inscriptions.
 * ============================================================================
 */
'use client';

import { useState, useRef } from 'react';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, Users, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';

interface PreviewRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  schoolLevelName: string;
  className: string;
  isNewStudent: boolean | null;
  guardianName: string | null;
  errors: string[];
  isValid: boolean;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  summary: {
    newStudents: number;
    oldStudents: number;
    byLevel: Record<string, number>;
    byClass: Record<string, number>;
  };
}

interface ImportRunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    success: boolean;
    error?: string;
    studentId?: string;
  }>;
}

interface ImportElevesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportElevesModal({ open, onClose, onSuccess }: ImportElevesModalProps) {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importResult, setImportResult] = useState<ImportRunResult | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const reset = () => {
    setStep('upload');
    setFile(null);
    setFileDataUrl('');
    setPreview(null);
    setImportResult(null);
    setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ─── Télécharger le template ───
  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/students/import/template', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur téléchargement template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-eleves-academia-helm.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ Template téléchargé', description: 'Remplissez-le avec vos élèves, puis importez-le.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
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

    // Convertir en base64 data URL
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setFileDataUrl(dataUrl);
    };
    reader.readAsDataURL(selectedFile);
  };

  // ─── Preview (valider le fichier) ───
  const handlePreview = async () => {
    if (!fileDataUrl || !academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/students/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId: academicYear.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || 'Erreur lors de la validation');
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
      setStep('preview');
      if (data.invalidRows > 0) {
        toast({
          title: '⚠️ Validation terminée',
          description: `${data.validRows} ligne(s) valide(s), ${data.invalidRows} ligne(s) avec erreur(s).`,
        });
      } else {
        toast({
          title: '✅ Validation réussie',
          description: `${data.validRows} élève(s) prêt(s) à être importés.`,
        });
      }
    } catch (e: any) {
      toast({ title: 'Erreur validation', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Import réel ───
  const handleImport = async () => {
    if (!fileDataUrl || !academicYear?.id) return;
    setStep('importing');
    setLoading(true);
    try {
      const res = await fetch('/api/students/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId: academicYear.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || 'Erreur lors de l\'import');
      }
      const data: ImportRunResult = await res.json();
      setImportResult(data);
      setStep('done');
      if (data.failed === 0) {
        toast({ title: '✅ Import terminé', description: `${data.succeeded} élève(s) importé(s) avec succès.` });
      } else {
        toast({
          title: 'Import terminé avec erreurs',
          description: `${data.succeeded} réussi(s), ${data.failed} échec(s).`,
          variant: 'destructive',
        });
      }
      onSuccess();
    } catch (e: any) {
      toast({ title: 'Erreur import', description: e.message, variant: 'destructive' });
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import en masse d'élèves</h2>
              <p className="text-xs text-indigo-100">Importez votre liste d'élèves depuis un fichier Excel</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── Étape 1 : Upload ─── */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Bouton télécharger template */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Template Excel</p>
                    <p className="text-xs text-slate-500">Téléchargez le modèle à remplir</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                  <Download className="w-4 h-4 mr-1.5" />
                  Télécharger
                </Button>
              </div>

              {/* Zone upload */}
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
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

              {/* Instructions */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">📋 Instructions</p>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li>1. Téléchargez le template Excel</li>
                  <li>2. Remplissez une ligne par élève (supprimez les lignes d'exemple)</li>
                  <li>3. Indiquez "Nouvel élève" ou "Ancien élève" pour chaque élève</li>
                  <li>4. Les colonnes obligatoires sont : Prénom, Nom, Date de naissance, Sexe, Niveau, Classe, Type d'élève</li>
                  <li>5. Uploadez le fichier rempli et vérifiez le preview</li>
                  <li>6. Confirmez l'import — les élèves et leurs comptes financiers sont créés automatiquement</li>
                </ul>
              </div>

              {/* Bouton valider */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Annuler</Button>
                <Button onClick={handlePreview} disabled={!fileDataUrl || loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1.5" />}
                  Valider le fichier
                </Button>
              </div>
            </div>
          )}

          {/* ─── Étape 2 : Preview ─── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Statistiques */}
              <div className="grid grid-cols-4 gap-3">
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
                  <p className="text-2xl font-bold text-blue-700">
                    {preview.summary.newStudents + preview.summary.oldStudents}
                  </p>
                  <p className="text-xs text-blue-600">À importer</p>
                </div>
              </div>

              {/* Répartition nouveaux/anciens */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{preview.summary.newStudents} nouvel(s) élève(s)</p>
                    <p className="text-xs text-emerald-600">Paieront les frais d'inscription</p>
                  </div>
                </div>
                <div className="flex-1 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{preview.summary.oldStudents} ancien(s) élève(s)</p>
                    <p className="text-xs text-amber-600">Paieront les frais de réinscription</p>
                  </div>
                </div>
              </div>

              {/* Tableau preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Élève</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Classe</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-600 text-xs">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 100).map((row) => (
                        <tr key={row.rowIndex} className={row.isValid ? '' : 'bg-rose-50/50'}>
                          <td className="px-3 py-2 text-xs text-slate-400">{row.rowIndex}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{row.lastName} {row.firstName}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{row.schoolLevelName} — {row.className}</td>
                          <td className="px-3 py-2 text-center">
                            {row.isNewStudent === true ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Nouvel</span>
                            ) : row.isNewStudent === false ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Ancien</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> OK
                              </span>
                            ) : (
                              <span className="text-xs text-rose-600 flex items-start gap-1" title={row.errors.join('\n')}>
                                <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{row.errors.join('; ')}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {preview.rows.length > 100 && (
                  <div className="p-2 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
                    100 premières lignes affichées sur {preview.rows.length}
                  </div>
                )}
              </div>

              {preview.invalidRows > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    <strong>{preview.invalidRows} ligne(s) avec erreur(s).</strong> Les lignes invalides seront ignorées lors de l'import.
                    Vous pouvez corriger le fichier et le ré-uploader, ou importer uniquement les lignes valides.
                  </p>
                </div>
              )}

              {/* Boutons */}
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  ← Retour
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={preview.validRows === 0 || loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Importer {preview.validRows} élève(s)
                </Button>
              </div>
            </div>
          )}

          {/* ─── Étape 3 : Importing ─── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-800">Import en cours...</p>
              <p className="text-sm text-slate-500 mt-1">Création des élèves, inscriptions et comptes financiers</p>
            </div>
          )}

          {/* ─── Étape 4 : Done ─── */}
          {step === 'done' && importResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                {importResult.failed === 0 ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-3" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-amber-500 mb-3" />
                )}
                <h3 className="text-xl font-bold text-slate-900">Import terminé</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {importResult.succeeded} élève(s) importé(s) avec succès
                  {importResult.failed > 0 && `, ${importResult.failed} échec(s)`}
                </p>
              </div>

              {/* Détails */}
              {importResult.failed > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-rose-50 border-b border-rose-100">
                    <p className="text-sm font-semibold text-rose-800">Détails des échecs</p>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {importResult.results.filter((r) => !r.success).map((r) => (
                          <tr key={r.rowIndex}>
                            <td className="px-3 py-2 text-xs text-slate-400">Ligne {r.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.studentName}</td>
                            <td className="px-3 py-2 text-xs text-rose-600">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  Terminer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
