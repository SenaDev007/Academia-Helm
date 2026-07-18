/**
 * ============================================================================
 * IMPORT OVERRIDES MODAL — Import en masse de personnalisations de frais
 * ============================================================================
 *
 * Modal permettant d'importer en masse les personnalisations de frais
 * (FeeOverride) pour plusieurs élèves depuis un fichier Excel (.xlsx).
 *
 * Cas d'usage : bourses, réductions sociales, tarifs négociés, exonérations.
 *
 * Workflow :
 *   1. L'admin télécharge le template Excel (bouton "Télécharger le template")
 *   2. L'admin remplit le template (une ligne par élève × type de frais)
 *   3. L'admin upload le fichier → preview avec validation
 *   4. L'admin corrige les erreurs éventuelles et confirme l'import
 *   5. Le système crée ou met à jour les FeeOverride + recalcule les comptes
 *
 * Accessible depuis le module Finance > Personnalisations.
 * ============================================================================
 */
'use client';

import { useState, useRef } from 'react';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';

interface PreviewRow {
  rowIndex: number;
  matricule: string | null;
  studentName: string;
  feeType: string;
  customAmount: number;
  reason: string;
  errors: string[];
  isValid: boolean;
  existingOverrideId?: string;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  summary: {
    totalCustomAmount: number;
    studentsAffected: number;
    willBeCreated: number;
    willBeUpdated: number;
    byFeeType: Record<string, number>;
  };
}

interface RunResult {
  total: number;
  created: number;
  updated: number;
  errors: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    feeType: string;
    action: 'CREATED' | 'UPDATED' | 'ERROR';
    error?: string;
  }>;
}

interface ImportOverridesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  OTHER: 'Autre',
};

export default function ImportOverridesModal({ open, onClose, onSuccess }: ImportOverridesModalProps) {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!academicYear?.id) {
      toast({ title: 'Erreur', description: 'Aucune année scolaire active', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(
        `/api/finance/fee-structures/overrides/import/template?academicYearId=${encodeURIComponent(academicYear.id)}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Erreur téléchargement template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-personnalisations-academia-helm.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ Template téléchargé', description: 'Remplissez-le avec vos personnalisations, puis importez-le.' });
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
    const reader = new FileReader();
    reader.onload = (event) => setFileDataUrl(event.target?.result as string);
    reader.readAsDataURL(selectedFile);
  };

  // ─── Preview ───
  const handlePreview = async () => {
    if (!fileDataUrl || !academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/fee-structures/overrides/import/preview', {
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
    if (!fileDataUrl || !academicYear?.id) return;
    setStep('importing');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/fee-structures/overrides/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId: academicYear.id }),
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
        description: `${data.created} créé(s), ${data.updated} mis à jour, ${data.errors} échec(s).`,
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import de personnalisations</h2>
              <p className="text-xs text-violet-100">Bourses, réductions, cas sociaux — import en masse</p>
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
              <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-violet-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Template Excel personnalisations</p>
                    <p className="text-xs text-slate-500">Une feuille "Personnalisations" avec 5 colonnes</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="border-violet-300 text-violet-700 hover:bg-violet-100">
                  <Download className="w-4 h-4 mr-1.5" /> Télécharger
                </Button>
              </div>

              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-violet-400 hover:bg-violet-50/50 transition-colors cursor-pointer"
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
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">📋 Format du fichier</p>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li><strong>Matricule</strong> — recommandé pour identifier précisément l'élève (optionnel si nom fourni)</li>
                  <li><strong>Nom élève</strong> — format "NOM Prénom" ou "Prénom NOM" (résolution insensible aux accents/casse)</li>
                  <li><strong>Type de frais</strong> — INSCRIPTION, REINSCRIPTION, TUITION, CANTEEN, EXAMEN, OTHER</li>
                  <li><strong>Montant personnalisé</strong> — en FCFA, doit être &gt; 0</li>
                  <li><strong>Motif</strong> — obligatoire (ex: "Bourse excellence", "Cas social", "Réduction direction")</li>
                </ul>
                <p className="text-xs text-violet-700 mt-3 font-medium">🔄 Si une personnalisation existe déjà pour (élève × type de frais), elle sera MISE À JOUR (pas de doublon).</p>
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
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-violet-700">{preview.summary.studentsAffected}</p>
                  <p className="text-xs text-violet-600">Élèves affectés</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">{preview.summary.willBeCreated} création(s)</p>
                    <p className="text-xs text-emerald-600">Nouvelles personnalisations</p>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{preview.summary.willBeUpdated} mise(s) à jour</p>
                    <p className="text-xs text-blue-600">Personnalisations existantes</p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-sm font-semibold text-violet-800">
                  Total personnalisé : {formatCurrency(preview.summary.totalCustomAmount)}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(preview.summary.byFeeType).map(([type, count]) => (
                    <span key={type} className="text-xs bg-white px-2 py-1 rounded border border-violet-200 text-violet-800">
                      {FEE_TYPE_LABELS[type] || type}: {count}
                    </span>
                  ))}
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
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Type</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Montant</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Motif</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 100).map((row) => (
                        <tr key={row.rowIndex} className={row.isValid ? '' : 'bg-rose-50/50'}>
                          <td className="px-3 py-2 text-xs text-slate-400">{row.rowIndex}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{row.studentName}</span>
                            {row.matricule && (
                              <span className="text-[10px] text-slate-400 ml-1">({row.matricule})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{FEE_TYPE_LABELS[row.feeType] || row.feeType}</td>
                          <td className="px-3 py-2 text-right text-xs font-mono">{formatCurrency(row.customAmount)}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[200px] truncate" title={row.reason}>{row.reason}</td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              row.existingOverrideId ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">MAJ</span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">CRÉER</span>
                              )
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

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>← Retour</Button>
                <Button
                  onClick={handleImport}
                  disabled={preview.validRows === 0 || loading}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Importer {preview.validRows} personnalisation(s)
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-violet-600 animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-800">Import en cours...</p>
              <p className="text-sm text-slate-500 mt-1">Création/mise à jour des personnalisations + recalcul des comptes</p>
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
                  {runResult.created} créé(s), {runResult.updated} mis à jour
                  {runResult.errors > 0 && `, ${runResult.errors} échec(s)`}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{runResult.created}</p>
                  <p className="text-xs text-emerald-600">Créés</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">{runResult.updated}</p>
                  <p className="text-xs text-blue-600">Mis à jour</p>
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
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {runResult.results.filter((r) => r.action === 'ERROR').map((r) => (
                          <tr key={r.rowIndex}>
                            <td className="px-3 py-2 text-xs text-slate-400">Ligne {r.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.studentName}</td>
                            <td className="px-3 py-2 text-xs text-slate-600">{FEE_TYPE_LABELS[r.feeType] || r.feeType}</td>
                            <td className="px-3 py-2 text-xs text-rose-600">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleClose} className="bg-violet-600 hover:bg-violet-700 text-white">Terminer</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
