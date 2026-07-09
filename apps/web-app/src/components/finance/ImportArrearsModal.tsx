/**
 * ============================================================================
 * IMPORT ARRIERES MODAL — Import en masse d'arriérés via Excel
 * ============================================================================
 *
 * Modal permettant d'importer les arriérés des élèves sur une ou plusieurs
 * années scolaires depuis un fichier Excel (.xlsx).
 *
 * Un élève peut avoir des arriérés sur plusieurs années → une ligne par
 * (élève × année scolaire) dans le fichier.
 *
 * Accessible depuis le module Finance > Recouvrement & Arriérés.
 * ============================================================================
 */
'use client';

import { useState, useRef } from 'react';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface ArrearsPreviewRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  matricule: string | null;
  academicYearLabel: string;
  totalDue: number;
  totalPaid: number;
  notes: string | null;
  errors: string[];
  isValid: boolean;
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ArrearsPreviewRow[];
  summary: {
    totalArrearsAmount: number;
    byYear: Record<string, number>;
    studentsAffected: number;
  };
}

interface RunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    academicYear: string;
    success: boolean;
    error?: string;
  }>;
}

interface ImportArrearsModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ImportArrearsModal({ open, onClose, onSuccess }: ImportArrearsModalProps) {
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

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/finance/arrears-import/template', { credentials: 'include' });
      if (!res.ok) throw new Error('Erreur téléchargement template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-arrieres-academia-helm.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ Template téléchargé', description: 'Remplissez-le avec les arriérés de vos élèves.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

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

  const handlePreview = async () => {
    if (!fileDataUrl) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/arrears-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Erreur validation');
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

  const handleImport = async () => {
    if (!fileDataUrl) return;
    setStep('importing');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/arrears-import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl }),
      });
      if (!res.ok) throw new Error('Erreur import');
      const data: RunResult = await res.json();
      setRunResult(data);
      setStep('done');
      toast({
        title: data.failed === 0 ? '✅ Import terminé' : 'Import terminé avec erreurs',
        description: `${data.succeeded} réussi(s), ${data.failed} échec(s).`,
        variant: data.failed > 0 ? 'destructive' : 'default',
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Import d'arriérés</h2>
              <p className="text-xs text-amber-100">Importez les arriérés des élèves sur une ou plusieurs années</p>
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
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Template Excel arriérés</p>
                    <p className="text-xs text-slate-500">Une ligne par élève × année scolaire</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="border-amber-300 text-amber-700 hover:bg-amber-100">
                  <Download className="w-4 h-4 mr-1.5" /> Télécharger
                </Button>
              </div>

              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-amber-400 hover:bg-amber-50/50 transition-colors cursor-pointer"
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
                  <li><strong>Prénom</strong> — prénom de l'élève (obligatoire)</li>
                  <li><strong>Nom</strong> — nom de famille (obligatoire)</li>
                  <li><strong>Matricule</strong> — optionnel mais recommandé pour identifier précisément l'élève</li>
                  <li><strong>Année scolaire</strong> — label exact (ex: 2023-2024) — doit exister dans l'établissement (obligatoire)</li>
                  <li><strong>Montant total dû</strong> — en FCFA (obligatoire)</li>
                  <li><strong>Montant déjà payé</strong> — en FCFA (obligatoire, 0 si rien payé)</li>
                  <li><strong>Notes</strong> — optionnel (ex: "Scolarité 3e trimestre impayée")</li>
                </ul>
                <p className="text-xs text-amber-700 mt-3 font-medium">⚠️ Un élève peut avoir plusieurs lignes (une par année scolaire). Ex: Marie AKOVI peut avoir des arriérés sur 2023-2024 ET 2024-2025.</p>
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
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-700">{preview.summary.studentsAffected}</p>
                  <p className="text-xs text-amber-600">Élèves affectés</p>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800">
                  Total arriérés à importer : {formatCurrency(preview.summary.totalArrearsAmount)}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(preview.summary.byYear).map(([year, amount]) => (
                    <span key={year} className="text-xs bg-white px-2 py-1 rounded border border-amber-200 text-amber-800">
                      {year}: {formatCurrency(amount)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Élève</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Année</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Dû</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Payé</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 100).map((row) => (
                        <tr key={row.rowIndex} className={row.isValid ? '' : 'bg-rose-50/50'}>
                          <td className="px-3 py-2 text-xs text-slate-400">{row.rowIndex}</td>
                          <td className="px-3 py-2 font-medium text-slate-800">{row.lastName} {row.firstName}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{row.academicYearLabel}</td>
                          <td className="px-3 py-2 text-right text-xs font-mono">{formatCurrency(row.totalDue)}</td>
                          <td className="px-3 py-2 text-right text-xs font-mono text-emerald-700">{formatCurrency(row.totalPaid)}</td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
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

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>← Retour</Button>
                <Button onClick={handleImport} disabled={preview.validRows === 0 || loading} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Importer {preview.validRows} arriéré(s)
                </Button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-12 h-12 text-amber-600 animate-spin mb-4" />
              <p className="text-lg font-semibold text-slate-800">Import en cours...</p>
              <p className="text-sm text-slate-500 mt-1">Création des arriérés et mise à jour des comptes</p>
            </div>
          )}

          {step === 'done' && runResult && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8">
                {runResult.failed === 0 ? (
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-3" />
                ) : (
                  <AlertCircle className="w-16 h-16 text-amber-500 mb-3" />
                )}
                <h3 className="text-xl font-bold text-slate-900">Import terminé</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {runResult.succeeded} arriéré(s) importé(s) avec succès
                  {runResult.failed > 0 && `, ${runResult.failed} échec(s)`}
                </p>
              </div>
              {runResult.failed > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-rose-50 border-b border-rose-100">
                    <p className="text-sm font-semibold text-rose-800">Détails des échecs</p>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {runResult.results.filter((r) => !r.success).map((r) => (
                          <tr key={r.rowIndex}>
                            <td className="px-3 py-2 text-xs text-slate-400">Ligne {r.rowIndex}</td>
                            <td className="px-3 py-2 font-medium text-slate-800">{r.studentName} ({r.academicYear})</td>
                            <td className="px-3 py-2 text-xs text-rose-600">{r.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleClose} className="bg-amber-600 hover:bg-amber-700 text-white">Terminer</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
