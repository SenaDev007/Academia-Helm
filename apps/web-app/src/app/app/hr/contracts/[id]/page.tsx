'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, FileText, Download, PenTool, Calendar, DollarSign,
  User, CheckCircle, Clock, AlertCircle, FileCheck, Loader2,
  RefreshCw, Shield, Hash, Briefcase, Building2, ExternalLink,
  Pencil, Eye, RotateCcw,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { getClientAuthorizationHeader, tryRefreshAccessToken } from '@/lib/auth/client-access-token';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ContractSignModal } from '../../_components/modals/ContractSignModal';
import { ContractEditModal } from '../../_components/modals/ContractEditModal';
import { ContractDocumentEditor } from '../../_components/modals/ContractDocumentEditor';
import { formatCurrency } from '@/lib/utils';
import { HRShell } from '../../_components/HRShell';

const PRIMARY = '#1A2BA6';

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: 'Contrat à Durée Indéterminée',
  CDD: 'Contrat à Durée Déterminée',
  VACATAIRE: 'Contrat de Vacation',
  STAGE: 'Convention de Stage',
  CONSULTANT: 'Contrat de Consultation',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  DRAFT:      { label: 'Brouillon',                       color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: FileText },
  PENDING:    { label: 'En attente de signature',         color: '#92400e', bg: '#fef3c7', border: '#fde68a', icon: Clock },
  ACTIVE:     { label: 'En vigueur',                      color: '#166534', bg: '#dcfce7', border: '#bbf7d0', icon: CheckCircle },
  EXPIRED:    { label: 'Expiré',                          color: '#475569', bg: '#f1f5f9', border: '#e2e8f0', icon: Clock },
  TERMINATED: { label: 'Résilié',                         color: '#991b1b', bg: '#fee2e2', border: '#fecaca', icon: AlertCircle },
  DELETED:    { label: 'Supprimé',                        color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: AlertCircle },
};

// Defensive fallback so a new/unexpected status never crashes the page
const STATUS_FALLBACK: { label: string; color: string; bg: string; border: string; icon: any } = {
  label: 'Inconnu',
  color: '#92400e',
  bg: '#fef3c7',
  border: '#fde68a',
  icon: AlertCircle,
};

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useModuleContext();
  const contractId = params.id as string;

  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [docEditorOpen, setDocEditorOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (tenant?.id && contractId) fetchContract();
  }, [tenant?.id, contractId]);

  async function fetchContract() {
    try {
      setLoading(true);
      const data = await hrFetch<any>(hrUrl(`contracts/${contractId}`, { tenantId: tenant.id }));
      setContract(data);
      // Reset PDF preview so it's re-fetched with fresh data
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', title: 'Impossible de charger le contrat.' });
    } finally {
      setLoading(false);
    }
  }

  async function loadPdfPreview() {
    if (!tenant?.id || !contractId) return;
    try {
      setLoadingPreview(true);
      let response = await fetch(`/api/hr/contracts/${contractId}/pdf?tenantId=${tenant.id}`, {
        method: 'GET',
        headers: { ...getClientAuthorizationHeader() },
        credentials: 'include',
        cache: 'no-store',
      });

      // On 401, attempt token refresh once before giving up
      if (response.status === 401) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
          response = await fetch(`/api/hr/contracts/${contractId}/pdf?tenantId=${tenant.id}`, {
            method: 'GET',
            headers: { ...getClientAuthorizationHeader() },
            credentials: 'include',
            cache: 'no-store',
          });
        }
      }

      if (!response.ok) {
        // Try generating first, then retry
        await hrFetch<any>(hrUrl(`contracts/${contractId}/generate-pdf`, { tenantId: tenant.id }), { method: 'POST' });
        const retryResponse = await fetch(`/api/hr/contracts/${contractId}/pdf?tenantId=${tenant.id}`, {
          method: 'GET',
          headers: { ...getClientAuthorizationHeader() },
          credentials: 'include',
          cache: 'no-store',
        });
        if (!retryResponse.ok) throw new Error('Impossible de charger l\'aperçu.');
        const blob = await retryResponse.blob();
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(URL.createObjectURL(blob));
      } else {
        const blob = await response.blob();
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(URL.createObjectURL(blob));
      }
      toast({ variant: 'success', title: 'Aperçu chargé.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', title: 'Impossible de charger l\'aperçu du PDF.' });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGeneratePdf() {
    if (!contract) return;
    try {
      setGenerating(true);
      await hrFetch<any>(hrUrl(`contracts/${contractId}/generate-pdf`, { tenantId: tenant.id }), { method: 'POST' });
      toast({ variant: 'success', title: 'PDF généré avec succès !' });
      fetchContract();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la génération PDF.' });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    if (!contract) return;
    try {
      setGenerating(true);

      // Download existing PDF via GET /pdf endpoint with proper auth headers
      let response = await fetch(`/api/hr/contracts/${contractId}/pdf?tenantId=${tenant.id}`, {
        method: 'GET',
        headers: {
          ...getClientAuthorizationHeader(),
        },
        credentials: 'include',
      });

      // On 401, attempt token refresh once before giving up
      if (response.status === 401) {
        const refreshed = await tryRefreshAccessToken();
        if (refreshed) {
          response = await fetch(`/api/hr/contracts/${contractId}/pdf?tenantId=${tenant.id}`, {
            method: 'GET',
            headers: {
              ...getClientAuthorizationHeader(),
            },
            credentials: 'include',
          });
        }
      }

      if (!response.ok) {
        // Try to parse error message from response
        let errorMsg = 'Erreur lors du téléchargement PDF.';
        try {
          const errData = await response.json();
          errorMsg = errData?.message || errData?.error || errorMsg;
        } catch { /* binary response, ignore parse error */ }
        throw new Error(errorMsg);
      }

      // Try to get as blob (binary PDF) first
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const staffName = `${contract.staff?.lastName}_${contract.staff?.firstName}`.replace(/\s+/g, '_');
        link.download = `Contrat_${staffName}_${contract.contractType}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        // If the response is JSON (e.g., contains a pdfUrl), use it
        const data = await response.json();
        if (data.pdfUrl) {
          const link = document.createElement('a');
          link.href = data.pdfUrl;
          const staffName = `${contract.staff?.lastName}_${contract.staff?.firstName}`.replace(/\s+/g, '_');
          link.download = `Contrat_${staffName}_${contract.contractType}.pdf`;
          link.click();
        }
      }
      toast({ variant: 'success', title: 'Téléchargement du PDF lancé.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du téléchargement PDF.';
      toast({ variant: 'error', title: msg });
    } finally {
      setGenerating(false);
    }
  }

  /**
   * Réactive un contrat EXPIRED non signé → PENDING pour qu'il puisse être signé.
   * Appelle le backend PUT /hr/contracts/:id/reactivate.
   */
  async function handleReactivate() {
    if (!contract) return;
    try {
      setReactivating(true);
      await hrFetch<any>(hrUrl(`contracts/${contractId}/reactivate`, { tenantId: tenant.id }), { method: 'PUT' });
      toast({ variant: 'success', title: 'Contrat réactivé. Vous pouvez maintenant le signer.' });
      fetchContract();
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', title: 'Erreur lors de la réactivation du contrat.' });
    } finally {
      setReactivating(false);
    }
  }

  if (loading) {
    return (
      <HRShell activeId="contracts" title="Contrats" description="Suivi des contrats, avenants, échéances et historique contractuel.">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: PRIMARY }} />
            <p className="text-sm text-slate-500 font-medium">Chargement du contrat…</p>
          </div>
        </div>
      </HRShell>
    );
  }

  if (!contract) {
    return (
      <HRShell activeId="contracts" title="Contrats" description="Suivi des contrats, avenants, échéances et historique contractuel.">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <AlertCircle className="h-12 w-12 text-rose-400" />
          <p className="text-slate-600 font-medium">Contrat introuvable.</p>
          <button onClick={() => router.push('/app/hr/contracts')} className="text-sm font-semibold" style={{ color: PRIMARY }}>
            ← Retour aux contrats
          </button>
        </div>
      </HRShell>
    );
  }

  const status = STATUS_CONFIG[contract.status] || STATUS_FALLBACK;
  const StatusIcon = status?.icon || AlertCircle;
  const pdfUrl = (contract.terms as any)?.pdfUrl;
  const isSigned = !!contract.signedAt;
  const contractTypeLabel = CONTRACT_TYPE_LABELS[contract.contractType] || contract.contractType;
  const signatureData = (contract.terms as any)?.signatureData;
  // Un contrat non signé peut être signé qu'il soit PENDING ou ACTIVE (la plupart sont PENDING avant signature).
  // On exclut uniquement les statuts finaux (EXPIRED, TERMINATED, DELETED) qui nécessitent une réactivation.
  const canSign = !isSigned && (contract.status === 'PENDING' || contract.status === 'ACTIVE' || contract.status === 'DRAFT');
  // Un contrat EXPIRED non signé peut être réactivé → repasse en PENDING
  const canReactivate = !isSigned && contract.status === 'EXPIRED';

  const daysUntilExpiry = contract.endDate
    ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <HRShell activeId="contracts" title="Contrats" description="Suivi des contrats, avenants, échéances et historique contractuel.">
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        <ContractSignModal
          isOpen={signModalOpen}
          onClose={() => setSignModalOpen(false)}
          onSuccess={fetchContract}
          contract={contract}
        />
        <ContractEditModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={fetchContract}
          contract={contract}
        />
        <ContractDocumentEditor
          isOpen={docEditorOpen}
          onClose={() => setDocEditorOpen(false)}
          onSuccess={fetchContract}
          contract={contract}
        />

      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-3">
        <Link
          href="/app/hr/contracts"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#1A2BA6] transition"
        >
          <ArrowLeft className="h-4 w-4" /> Contrats
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-800 truncate max-w-xs">
          {contract.staff?.firstName} {contract.staff?.lastName}
        </span>
      </div>

      {/* Hero header card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden shadow-sm border border-slate-200"
      >
        {/* Banner */}
        <div className="relative px-6 py-6 text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, #2B3FCA 100%)` }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute right-6 top-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-white/30 blur-2xl" />
          </div>
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-lg font-bold border border-white/20">
                {contract.staff?.firstName?.[0]}{contract.staff?.lastName?.[0]}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
                  {contractTypeLabel}
                </p>
                <h1 className="text-xl font-bold">
                  {contract.staff?.firstName} {contract.staff?.lastName}
                </h1>
                <p className="text-sm text-white/70 mt-0.5">
                  {contract.staff?.position || 'Personnel'} · #{contract.staff?.staffCode}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ backgroundColor: status.bg, color: status.color, border: `1px solid ${status.border}` }}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {status.label}
              </span>
              {isSigned && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <PenTool className="h-3.5 w-3.5" /> Signé électroniquement
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="bg-white px-6 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleDownloadPdf}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-60 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger le PDF
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            Régénérer
          </button>
          {!isSigned && (
            <button
              onClick={() => setDocEditorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 rounded-xl shadow-sm transition"
              title="Modifier l'intégralité du document (articles, clauses…)"
            >
              <Pencil className="h-4 w-4" />
              Éditer le document
            </button>
          )}
          {!isSigned && (
            <button
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-xl transition"
              title="Modifier les informations du contrat (dates, salaire, mode de règlement…)"
            >
              <FileText className="h-4 w-4" />
              Modifier les infos
            </button>
          )}
          {canReactivate && (
            <button
              onClick={handleReactivate}
              disabled={reactivating}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl transition"
              title="Réactiver ce contrat expiré pour le signer"
            >
              {reactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Réactiver
            </button>
          )}
          {canSign && (
            <button
              onClick={() => setSignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition"
            >
              <PenTool className="h-4 w-4" />
              Signer le contrat
            </button>
          )}
        </div>
      </motion.div>

      {/* Reactivation helper banner for unsigned EXPIRED contracts */}
      {canReactivate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800"
        >
          <RotateCcw className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold">Contrat expiré non signé</p>
            <p className="text-xs mt-0.5">
              Ce contrat a été marqué « Expiré » automatiquement (probablement car un nouveau contrat a été créé pour
              ce même employé). Si vous souhaitez malgré tout le signer, cliquez sur <strong>Réactiver</strong> ci-dessus :
              le contrat repassera en <strong>attente de signature</strong> et le bouton « Signer le contrat » apparaîtra.
            </p>
          </div>
        </motion.div>
      )}

      {/* Expiry warning */}
      {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800"
        >
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold">Expiration imminente</p>
            <p className="text-xs mt-0.5">Ce contrat expire dans <strong>{daysUntilExpiry} jour(s)</strong>. Pensez à le renouveler ou à préparer un avenant.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Contract Info — left 2 cols */}
        <div className="md:col-span-2 space-y-5">

          {/* Contract details card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-slate-900">Détails du Contrat</h2>
            </div>
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-5">
              {[
                {
                  label: 'Type de contrat',
                  value: contractTypeLabel,
                  icon: FileCheck,
                },
                {
                  label: 'Référence',
                  value: `CONTRAT-${contractId.substring(0, 8).toUpperCase()}`,
                  icon: Hash,
                },
                {
                  label: 'Date de prise d\'effet',
                  value: new Date(contract.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
                  icon: Calendar,
                },
                {
                  label: 'Date de fin',
                  value: contract.endDate
                    ? new Date(contract.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Durée indéterminée',
                  icon: Calendar,
                },
                {
                  label: 'Salaire mensuel brut',
                  value: formatCurrency(contract.baseSalary),
                  icon: DollarSign,
                  highlight: true,
                },
                {
                  label: 'Mode de règlement',
                  value: { BANK: 'Virement bancaire', CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money' }[contract.paymentMode as string] || contract.paymentMode,
                  icon: Briefcase,
                },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {item.label}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <item.icon className={`h-3.5 w-3.5 shrink-0 ${item.highlight ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`text-sm font-semibold ${item.highlight ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signature status card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <PenTool className="h-4 w-4" style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-slate-900">Statut de Signature</h2>
            </div>
            <div className="p-5">
              {isSigned ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Contrat signé électroniquement</p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Par <strong>{contract.signedBy}</strong> le{' '}
                        {new Date(contract.signedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        {' '}à {new Date(contract.signedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {signatureData && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Signature enregistrée</p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 inline-block">
                        <img
                          src={signatureData}
                          alt="Signature"
                          className="max-h-20 max-w-[200px] object-contain"
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p>Signature électronique certifiée. La méthode, la date et les métadonnées sont archivées.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center py-6 gap-3">
                  <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                    <PenTool className="h-6 w-6 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Signature en attente</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Le contrat doit être signé par l'employé(e) pour être pleinement exécutoire.
                    </p>
                  </div>
                  {canSign && (
                    <button
                      onClick={() => setSignModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 transition mt-2"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      <PenTool className="h-4 w-4" />
                      Procéder à la signature
                    </button>
                  )}
                  {canReactivate && (
                    <button
                      onClick={handleReactivate}
                      disabled={reactivating}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-60 transition mt-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {reactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Réactiver le contrat
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Staff card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <User className="h-4 w-4" style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-slate-900">Employé(e)</h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
                >
                  {contract.staff?.firstName?.[0]}{contract.staff?.lastName?.[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">
                    {contract.staff?.firstName} {contract.staff?.lastName}
                  </p>
                  <p className="text-xs text-slate-500">{contract.staff?.position || 'Poste non défini'}</p>
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                {[
                  { label: 'Matricule', value: contract.staff?.staffCode },
                  { label: 'Email', value: contract.staff?.email },
                  { label: 'Téléphone', value: contract.staff?.phone },
                ].filter(i => i.value).map(item => (
                  <div key={item.label} className="flex justify-between text-xs">
                    <span className="text-slate-400 font-semibold">{item.label}</span>
                    <span className="text-slate-700 font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
              <Link
                href={`/app/hr/staff/${contract.staff?.id}`}
                className="flex items-center gap-1.5 text-xs font-bold mt-2 hover:underline"
                style={{ color: PRIMARY }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Voir la fiche complète
              </Link>
            </div>
          </div>

          {/* PDF card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-slate-900">Document PDF</h2>
            </div>
            <div className="p-5 space-y-3">
              {pdfUrl ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">Contrat PDF généré</p>
                      <p className="text-[10px] text-slate-400">
                        {(contract.terms as any)?.pdfGeneratedAt
                          ? new Date((contract.terms as any).pdfGeneratedAt).toLocaleDateString('fr-FR')
                          : 'Récemment'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadPdf}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl border transition"
                    style={{ borderColor: PRIMARY, color: PRIMARY }}
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 mb-3">Aucun PDF généré pour l'instant.</p>
                  <button
                    onClick={handleGeneratePdf}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 transition"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Générer le PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Employer */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="h-4 w-4" style={{ color: PRIMARY }} />
              <h2 className="text-sm font-bold text-slate-900">Établissement</h2>
            </div>
            <div className="p-5 space-y-1.5">
              <p className="font-semibold text-slate-800 text-sm">{contract.tenant?.name}</p>
              <p className="text-xs text-slate-500">{contract.tenant?.schools?.address || contract.tenant?.slug || 'Adresse non renseignée'}</p>
              {contract.academicYear && (
                <p className="text-xs text-slate-400">Année scolaire : {contract.academicYear.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Section — In-app visualization */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" style={{ color: PRIMARY }} />
            <h2 className="text-sm font-bold text-slate-900">Aperçu du Contrat</h2>
          </div>
          <div className="flex items-center gap-2">
            {pdfPreviewUrl && (
              <button
                onClick={loadPdfPreview}
                disabled={loadingPreview}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                title="Recharger l'aperçu"
              >
                {loadingPreview ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </button>
            )}
            {!pdfPreviewUrl && (
              <button
                onClick={loadPdfPreview}
                disabled={loadingPreview}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl hover:opacity-90 disabled:opacity-60 transition"
                style={{ backgroundColor: PRIMARY }}
              >
                {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Charger l&apos;aperçu
              </button>
            )}
          </div>
        </div>
        <div className="p-5">
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              className="w-full rounded-xl border border-slate-200 bg-slate-50"
              style={{ height: '600px' }}
              title="Aperçu du contrat PDF"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileText className="h-7 w-7 text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Aperçu non chargé</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Cliquez sur le bouton &quot;Charger l&apos;aperçu&quot; ci-dessus pour visualiser le contrat au format PDF directement dans l&apos;application.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
      </div>
    </HRShell>
  );
}
