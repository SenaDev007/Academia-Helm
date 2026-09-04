/**
 * ============================================================================
 * IMPORT BILAN MODAL — Import en masse du bilan des encaissements
 * ============================================================================
 *
 * Modal permettant d'importer les paiements encaisses (bilan des encaissements)
 * depuis un fichier Excel (.xlsx), typiquement les fichiers "POINT" remplis
 * manuellement par les comptables des ecoles.
 *
 * Le template est une feuille par classe, pre-remplie avec les eleves.
 * L'admin saisit les montants encaisses par eleve (Arriere, Inscription,
 * Tranches 1-6) puis confirme l'import.
 *
 * Pour chaque ligne valide : une FinanceTransaction (type=PAYMENT) est creee
 * et allouee FIFO sur les AccountBreakdowns de l'eleve.
 *
 * Accessible depuis le module Finance > Bilan des encaissements.
 * ============================================================================
 */
'use client';

import { useState, useRef } from 'react';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, Receipt, UserCheck, UserX, HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface PreviewRow {
  rowIndex: number;
  sheetName: string;
  studentName: string;
  arrear: number;
  inscription: number;
  tranches: number[];
  total: number;
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
  summary: {
    totalAmount: number;
    bySheet: Record<string, number>;
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
  const [loading, setLoading] = useState(true);

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
    if (!academicYearId) {
      toast({ title: 'Erreur', description: 'Aucune année scolaire active', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch(
        `/api/finance/collection-summary/import/template?academicYearId=${encodeURIComponent(academicYearId)}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error('Erreur téléchargement template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-import-bilan-encaissements-academia-helm.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ Template téléchargé', description: 'Une feuille par classe, pré-remplie avec vos élèves.' });
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
    if (!fileDataUrl || !academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/collection-summary/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId }),
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
    if (!fileDataUrl || !academicYearId) return;
    setStep('importing');
    setLoading(true);
    try {
      const res = await fetch('/api/finance/collection-summary/import/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileDataUrl, academicYearId }),
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
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Template Excel bilan</p>
                    <p className="text-xs text-slate-500">Une feuille par classe, pré-remplie avec les élèves</p>
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
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">📋 Format du fichier</p>
                <ul className="text-xs text-slate-600 space-y-1.5">
                  <li><strong>Noms et Prénoms</strong> — format "NOM Prénom" (ex: "ADANDE Aïcha"). Matching insensible aux accents/casse.</li>
                  <li><strong>Arriéré</strong> — montant encaissé sur les arriérés (FCFA)</li>
                  <li><strong>Inscription</strong> — montant encaissé pour l'inscription (FCFA)</li>
                  <li><strong>Tranches 1 à 6</strong> — montants encaissés pour chaque tranche de scolarité (FCFA)</li>
                  <li><strong>Total</strong> — somme des colonnes (calculé automatiquement si vide)</li>
                </ul>
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
                  <p className="text-2xl font-bold text-blue-700">{preview.summary.studentsMatched}</p>
                  <p className="text-xs text-blue-600">Élèves matchés</p>
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-800">
                  Total à encaisser : {formatCurrency(preview.summary.totalAmount)}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {Object.entries(preview.summary.bySheet).map(([sheet, amount]) => (
                    <span key={sheet} className="text-xs bg-white px-2 py-1 rounded border border-blue-200 text-blue-800">
                      {sheet}: {formatCurrency(amount)}
                    </span>
                  ))}
                </div>
              </div>

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
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">#</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Élève (Excel)</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Match</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Feuille</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Arriéré</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Inscription</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Tranches</th>
                        <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.rows.slice(0, 100).map((row) => {
                        const tranchesSum = row.tranches.reduce((s, v) => s + v, 0);
                        return (
                          <tr key={`${row.sheetName}-${row.rowIndex}`} className={row.isValid ? '' : 'bg-rose-50/50'}>
                            <td className="px-3 py-2 text-xs text-slate-400">{row.rowIndex}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-800">{row.studentName}</span>
                              {row.resolvedStudentName && row.resolvedStudentName !== row.studentName && (
                                <span className="text-[10px] text-slate-500 ml-1 block">→ {row.resolvedStudentName}</span>
                              )}
                            </td>
                            <td className="px-3 py-2"><MatchBadge status={row.matchStatus} /></td>
                            <td className="px-3 py-2 text-xs text-slate-600">{row.sheetName}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono">{row.arrear > 0 ? formatCurrency(row.arrear) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono">{row.inscription > 0 ? formatCurrency(row.inscription) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono">{tranchesSum > 0 ? formatCurrency(tranchesSum) : '—'}</td>
                            <td className="px-3 py-2 text-right text-xs font-mono font-bold">{formatCurrency(row.total)}</td>
                          </tr>
                        );
                      })}
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
              <p className="text-sm text-slate-500 mt-1">Création des transactions + génération des reçus PDF</p>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-700">{runResult.imported}</p>
                  <p className="text-xs text-emerald-600">Importées</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-700">{runResult.skipped}</p>
                  <p className="text-xs text-slate-600">Ignorées (Total=0)</p>
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
