/**
 * ============================================================================
 * HR MODULE - PAYROLL DETAIL PAGE (REFACTORED 16/11/2026)
 * ============================================================================
 *
 * Refonte visuelle — alignement sur le design des autres onglets RH :
 *  - plus de double en-tête : le ModuleHeader géant (titre text-3xl + grosses
 *    KPI cards) est remplacé par un en-tête compact et une bande de KPI à la
 *    PayrollWorkspace (libellés text-[10px], valeurs text-base) ;
 *  - typographie du tableau resserrée (en-têtes text-[10px] uppercase,
 *    cellules text-xs/text-sm, bordures slate-200) ;
 *  - PRIMARY #1A2BA6, cartes blanches rounded-xl border-slate-200, cohérentes
 *    avec AllowancesWorkspace / CnssWorkspace / staff/[id].
 *
 * Le moteur métier (génération → calcul fiscal par statut contractuel →
 * documents FP/EP immuables) est inchangé : seules la mise en page et la
 * hiérarchie visuelle changent.
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Calculator,
  CheckCircle2,
  FileText,
  Download,
  RefreshCcw,
  User,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Send,
  Loader2,
  Wallet,
  HandCoins,
  FileBadge2,
  Eye,
  X,
  Calendar,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from '@/components/ui/toast';
import { HRShell } from '../../_components/HRShell';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

// ─── Maps de libellés français pour les statuts (alignés sur PayrollWorkspace STATUS_CONFIG) ───
const PERIOD_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  CALCULATED: 'Calculé',
  VALIDATED: 'Validé',
  PAID: 'Payé',
  CLOSED: 'Clôturé',
  DRAFT: 'Brouillon',
};

const STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-blue-50 text-[#1A2BA6] border border-blue-200',
  CALCULATED: 'bg-amber-50 text-amber-600 border border-amber-200',
  VALIDATED: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  PAID: 'bg-emerald-600 text-white border border-emerald-600',
  CLOSED: 'bg-slate-100 text-slate-600 border border-slate-200',
  DRAFT: 'bg-slate-100 text-slate-600 border border-slate-200',
};

// ─── Statut contractuel RH Bénin (dérive le document de paie FP/EP) ───
const STATUT_LABELS: Record<string, { label: string; className: string }> = {
  SALARIE_DECLARE: { label: 'Déclaré CNSS', className: 'bg-blue-50 text-blue-700 border border-blue-200' },
  SALARIE_NON_DECLARE: { label: 'Non déclaré', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  PRESTATAIRE_SERVICE: { label: 'Prestataire', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

const PAYROLL_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  CALCULATED: 'Calculé',
  VALIDATED: 'Validé',
  PAID: 'Payé',
  PENDING: 'En attente',
  FAILED: 'Échec',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

export default function PayrollDetailPage() {
  const { id } = useParams();
  const { tenant, academicYear } = useModuleContext();
  const [period, setPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payingItem, setPayingItem] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);
  const [showPayAllConfirm, setShowPayAllConfirm] = useState(false);
  // Documents de paie officiels FP/EP
  const [issuingItem, setIssuingItem] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerDocs, setRegisterDocs] = useState<any[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);

  const fetchPayroll = async () => {
    if (!tenant?.id || !id) return;
    try {
      setLoading(true);
      const result = await hrFetch<any>(hrUrl(`payroll/periods/${id}`, { tenantId: tenant.id }));
      setPeriod(result);
    } catch (error) {
      console.error('Error fetching payroll detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [tenant?.id, id]);

  const handleGeneratePayrolls = async () => {
    try {
      setProcessing(true);
      // Opération au niveau PÉRIODE (le lot sous-jacent est résolu côté API)
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/generate`, {
        tenantId: tenant.id,
        ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
      }), { method: 'POST' });
      toast({ variant: 'success', title: 'Lignes de paie générées avec succès' });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur lors de la génération', description: error?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculatePayrollLine = async (lineId: string) => {
    try {
      // POST /items/:id/calculate with academicYearId as query param
      await hrFetch<any>(hrUrl(`payroll/items/${lineId}/calculate`, {
        tenantId: tenant.id,
        ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
      }), { method: 'POST' });
      toast({ variant: 'success', title: 'Calcul fiscal effectué' });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur de calcul', description: error?.message });
    }
  };

  const handleCalculateAll = async () => {
    try {
      setProcessing(true);
      // POST periods/:id/calculate (niveau période)
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/calculate`, {
        tenantId: tenant.id,
      }), { method: 'POST' });
      toast({ variant: 'success', title: 'Calcul global terminé' });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur lors du calcul global', description: error?.message });
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateAndPay = async () => {
    try {
      setProcessing(true);
      // PUT periods/:id/status (niveau période)
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/status`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: 'PAID' },
      });
      toast({ variant: 'success', title: 'Paie validée et marquée comme payée' });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur lors de la validation', description: error?.message });
    } finally {
      setProcessing(false);
    }
  };

  // ─── Paiement individuel via FedaPay ──
  const handlePaySalary = async (itemId: string, staffName: string, amount: number) => {
    if (!academicYear?.id) {
      toast({ variant: 'error', title: 'Année académique requise', description: 'Sélectionnez une année académique active.' });
      return;
    }
    const confirmed = window.confirm(
      `Confirmer le paiement de ${formatCurrency(amount)} à ${staffName} via Mobile Money ?\n\nLe paiement sera initié depuis le compte FedaPay de l'école vers le numéro Mobile Money du personnel.`,
    );
    if (!confirmed) return;

    try {
      setPayingItem(itemId);
      const result = await hrFetch<any>(hrUrl(`payroll/items/${itemId}/pay`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { academicYearId: academicYear.id },
      });
      if (result?.success) {
        toast({
          variant: 'success',
          title: 'Paiement initié',
          description: result.message || `Paiement de ${formatCurrency(amount)} envoyé à ${staffName}`,
        });
      } else {
        toast({
          variant: 'error',
          title: 'Échec du paiement',
          description: result?.message || 'Erreur inconnue',
        });
      }
      fetchPayroll();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur de paiement',
        description: err?.message || 'Impossible d\'initier le paiement',
      });
    } finally {
      setPayingItem(null);
    }
  };

  // ─── Paiement groupé via FedaPay ──
  const handlePayAll = async () => {
    setShowPayAllConfirm(false);
    try {
      setPayingAll(true);
      const result = await hrFetch<any>(hrUrl(`payroll/batches/${id}/pay-all`, { tenantId: tenant.id }), {
        method: 'POST',
      });
      toast({
        variant: result.failed > 0 ? 'warning' : 'success',
        title: result.failed === 0
          ? `Paiement groupé terminé — ${result.success} salarié(s) payés`
          : `Paiement partiel — ${result.success} réussis, ${result.failed} échecs`,
        description: `Total: ${result.total} lignes traitées`,
      });
      fetchPayroll();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur lors du paiement groupé',
        description: err?.message,
      });
    } finally {
      setPayingAll(false);
    }
  };

  // ─── Validation manuelle du paiement (espèces / hors FedaPay) ──
  const handleManualValidate = async (itemId: string, staffName: string, amount: number) => {
    if (!academicYear?.id) {
      toast({ variant: 'error', title: 'Année académique requise', description: 'Sélectionnez une année académique active.' });
      return;
    }
    const note = window.prompt(
      `Validation manuelle du paiement de ${formatCurrency(amount)} à ${staffName}.\n\n` +
      `Cette option est utilisée quand le paiement a été fait en espèces ou par virement ` +
      `(hors FedaPay Mobile Money).\n\n` +
      `Ajoutez une note (optionnel) :`,
      'Paiement en espèces',
    );
    // user cancelled
    if (note === null) return;

    try {
      setPayingItem(itemId);
      const result = await hrFetch<any>(hrUrl(`payroll/items/${itemId}/manual-validate`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { academicYearId: academicYear.id, note: note || undefined },
      });
      toast({
        variant: 'success',
        title: 'Paiement validé manuellement',
        description: result.message || `${formatCurrency(amount)} validé pour ${staffName} (espèces)`,
      });
      fetchPayroll();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur de validation',
        description: err?.message || 'Impossible de valider le paiement',
      });
    } finally {
      setPayingItem(null);
    }
  };

  // ─── Documents de paie officiels FP/EP (RH Bénin) ──
  // Fiche de paie (FP) pour les salariés, état de paiement (EP) pour les
  // prestataires — le type est dérivé du statut contractuel, jamais choisi ici.

  // ─── Bulletin générique (personnel hérité SANS statut contractuel) ──
  const handlePreviewPayslip = async (itemId: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/items/${itemId}/payslip-pdf`, { tenantId: tenant.id }), { method: 'POST' });
      if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast({ variant: 'info', title: 'Aperçu du bulletin', description: 'Le PDF sera généré par le serveur.' });
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors de la génération de l\'aperçu' });
    }
  };

  const handleDownloadPayslip = async (itemId: string, staffName: string) => {
    try {
      const response = await fetch(`/api/hr/payroll/items/${itemId}/payslip-pdf?tenantId=${tenant.id}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erreur téléchargement');
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bulletin_${staffName.replace(/\s+/g, '_')}.pdf`;
        link.click();
        URL.revokeObjectURL(link.href);
      } else {
        const data = await response.json();
        if (data?.pdfBase64) {
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `bulletin_${staffName.replace(/\s+/g, '_')}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast({ variant: 'success', title: 'Téléchargement du bulletin lancé.' });
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors du téléchargement' });
    }
  };

  const handleIssueDocument = async (itemId: string, staffName: string) => {
    const confirmed = window.confirm(
      `Émettre le document de paie officiel de ${staffName} pour cette période ?\n\n` +
      `Le document est immuable : numéroté séquentiellement (FP/EP), scellé par empreinte ` +
      `SHA-256 et archivé. Toute erreur exigera un document rectificatif.`,
    );
    if (!confirmed) return;
    try {
      setIssuingItem(itemId);
      const result = await hrFetch<any>(hrUrl(`payroll/documents/issue/${itemId}`, { tenantId: tenant.id }), {
        method: 'POST',
      });
      toast({
        variant: 'success',
        title: `Document émis : ${result?.document?.documentNumber}`,
        description: 'PDF archivé et scellé (SHA-256) — téléchargeable depuis le registre.',
      });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Émission impossible', description: error?.message });
    } finally {
      setIssuingItem(null);
    }
  };

  const handlePreviewDocument = async (itemId: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/documents/preview/${itemId}`, { tenantId: tenant.id }), {
        method: 'POST',
      });
      if (result?.html) {
        const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        toast({ variant: 'info', title: 'Aperçu indisponible', description: 'Aucun rendu retourné.' });
      }
    } catch (error: any) {
      toast({ variant: 'error', title: 'Aperçu impossible', description: error?.message });
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    try {
      const response = await fetch(`/api/hr/payroll/documents/${docId}/download?tenantId=${tenant.id}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Erreur téléchargement');
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `document-paie.pdf`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ variant: 'success', title: 'Téléchargement lancé (intégrité vérifiée).' });
    } catch (error: any) {
      toast({ variant: 'error', title: 'Téléchargement impossible', description: error?.message });
    }
  };

  const openDocumentsRegister = async () => {
    try {
      setShowRegister(true);
      setRegisterLoading(true);
      // ⭐ Filtre sur le mois RÉEL de la période (period.month « 2026-11 »),
      //    pas sur la date décalée par le fuseau.
      const monthKey = period?.month || new Date(period?.startDate || Date.now()).toISOString().substring(0, 7);
      const [periodYear, periodMonth] = monthKey.split('-').map(Number);
      const docs = await hrFetch<any[]>(hrUrl('payroll/documents', {
        tenantId: tenant.id,
        periodYear,
        periodMonth,
      }));
      setRegisterDocs(docs || []);
    } catch (error: any) {
      toast({ variant: 'error', title: 'Registre indisponible', description: error?.message });
    } finally {
      setRegisterLoading(false);
    }
  };

  if (loading) {
    return (
      <HRShell activeId="payroll" title="Paie" titleEn="Payroll" description="Périodes de paie, calculs fiscaux et bulletins." descriptionEn="Payroll periods, tax calculations and payslips.">
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse" />)}</div>
      </HRShell>
    );
  }
  if (!period) {
    return (
      <HRShell activeId="payroll" title="Paie" titleEn="Payroll" description="Périodes de paie, calculs fiscaux et bulletins." descriptionEn="Payroll periods, tax calculations and payslips.">
        <div className="p-8 text-center text-sm text-red-500">Période introuvable.</div>
      </HRShell>
    );
  }

  const totalNet = period.payrolls?.reduce((acc: number, p: any) => acc + Number(p.netSalary), 0) || 0;
  const totalGross = period.payrolls?.reduce((acc: number, p: any) => acc + Number(p.grossSalary), 0) || 0;
  const totalDeductions = period.payrolls?.reduce(
    (acc: number, p: any) => acc + Number(p.cnssEmployee) + Number(p.irppAmount) + Number(p.otherDeductions || 0), 0) || 0;
  const docsIssued = period.payrolls?.filter((p: any) => p.payrollDocument).length || 0;
  const nonDeclares = period.payrolls?.filter((p: any) => p.staff?.statutContractuel === 'SALARIE_NON_DECLARE').length || 0;
  // ⭐ Libellé = NOM de la période (« Novembre 2026 ») — la date seule
  //    décalait le mois d'un cran selon le fuseau du poste.
  const monthLabel = period.name
    || new Date(period.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const statusClass = STATUS_CLASS[period.status] || STATUS_CLASS.OPEN;

  return (
    <HRShell activeId="payroll" title="Paie" titleEn="Payroll" description="Périodes de paie, calculs fiscaux et bulletins." descriptionEn="Payroll periods, tax calculations and payslips.">
    <div className="space-y-6 pb-12">
      {/* ─── Retour + en-tête compact (aligné staff/[id] & autres onglets) ─── */}
      <div className="px-4 sm:px-6 pt-2">
        <Link href="/app/hr/payroll" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#1A2BA6] transition-colors">
          <ArrowLeft size={16} /> Retour à la liste
        </Link>
      </div>

      <div className="px-4 sm:px-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
              {monthLabel.substring(0, 3).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base capitalize">{monthLabel}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', statusClass)}>
                  {PERIOD_STATUS_LABELS[period.status] || period.status}
                </span>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(period.startDate).toLocaleDateString('fr-FR')} → {new Date(period.endDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={openDocumentsRegister}
              className="flex items-center gap-2 px-4 py-2 rounded-xl hover:opacity-90 transition font-bold text-xs text-white"
              style={{ backgroundColor: PRIMARY }}
              title="Registre des fiches de paie (FP) et états de paiement (EP) émis"
            >
              <FileBadge2 size={14} />
              Documents émis
              <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[9px]">{docsIssued}</span>
            </button>
            {period.status === 'OPEN' && (
              <>
                <button
                  onClick={handleGeneratePayrolls}
                  disabled={processing}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-xs disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={processing ? 'animate-spin' : ''} />
                  Générer les lignes
                </button>
                <button
                  onClick={handleCalculateAll}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 text-white rounded-xl hover:opacity-90 shadow-sm transition-all font-bold text-xs disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Calculator size={14} />
                  Calculer Tout (Taxes/CNSS)
                </button>
              </>
            )}
            {(period.status === 'CALCULATED' || period.status === 'VALIDATED') && (
              <>
                <button
                  onClick={() => setShowPayAllConfirm(true)}
                  disabled={payingAll || processing}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all font-bold text-xs disabled:opacity-50"
                >
                  {payingAll ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {payingAll ? 'Paiement en cours...' : 'Payer Tout (FedaPay)'}
                </button>
                <button
                  onClick={handleValidateAndPay}
                  disabled={processing}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-xs disabled:opacity-50"
                  title="Marquer comme payé sans FedaPay (paiement manuel)"
                >
                  <ShieldCheck size={14} />
                  Marquer Payé
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bande de KPI compacte (style PayrollWorkspace) ─── */}
      <div className="px-4 sm:px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Masse brute', value: formatCurrency(totalGross) },
            { label: 'Retenues (CNSS/ITS/AIB)', value: formatCurrency(totalDeductions) },
            { label: 'Net à payer', value: formatCurrency(totalNet), accent: 'text-emerald-600' },
            { label: 'Agents', value: `${period.payrolls?.length || 0} ligne(s)` },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={cn('text-base font-bold text-slate-900 mt-0.5', k.accent)}>{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ⭐ CDC §8.3 — bandeau de non-conformité déclarative visible à CHAQUE
          étape ultérieure du dossier (ici : la paie), sans bloquer l'usage. */}
      {nonDeclares > 0 && (
        <div className="mx-4 sm:mx-6">
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 leading-relaxed">
              <strong>Salariés non déclarés à la CNSS dans cette période</strong> ({nonDeclares}) :
              fiches de paie avec ITS uniquement, sans cotisations CNSS — la régularisation reste due. Ce bandeau
              est affiché en permanence (le risque n&apos;est jamais masqué) ; la régularisation passe par la
              procédure tracée de changement de statut sur la fiche du personnel.
            </div>
          </div>
        </div>
      )}

      {/* ─── Tableau des lignes de paie (typographie resserrée) ─── */}
      <div className="px-4 sm:px-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Employé', 'Salaire Brut', 'Retenues', 'Net à Payer', 'Statut Ligne', 'Paiement'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {period.payrolls?.map((payroll: any) => {
                  const deductions = Number(payroll.cnssEmployee) + Number(payroll.irppAmount) + Number(payroll.otherDeductions || 0);
                  const isVacataire = payroll.staff?.contractType === 'VACATAIRE';
                  const isPrestataire = payroll.staff?.statutContractuel === 'PRESTATAIRE_SERVICE';
                  const statut = payroll.staff?.statutContractuel || null;
                  const statutInfo = statut ? STATUT_LABELS[statut] : null;
                  const doc = payroll.payrollDocument || null;
                  return (
                  <tr key={payroll.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <User size={15} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 block truncate">
                            {payroll.staff?.firstName} {payroll.staff?.lastName}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase">{payroll.staff?.employeeNumber || payroll.staff?.staffCode}</span>
                            {isVacataire && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 border border-purple-100">VACATAIRE</span>
                            )}
                            {statutInfo && (
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${statutInfo.className}`}>{statutInfo.label}</span>
                            )}
                            {doc && (
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded font-mono ${doc.documentType === 'ETAT_DE_PAIEMENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                {doc.documentNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold text-slate-700">{formatCurrency(payroll.grossSalary)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {(isVacataire || isPrestataire) ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-red-500 font-bold">-{formatCurrency(deductions)}</span>
                          <span className="text-[8px] text-slate-400 font-medium">
                            {isPrestataire ? 'AIB (retenue à la source)' : 'Aucune (Vacataire)'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-red-500 font-bold">-{formatCurrency(deductions)}</span>
                          <span className="text-[8px] text-slate-400 font-medium">
                            CNSS: {formatCurrency(payroll.cnssEmployee)} · ITS: {formatCurrency(payroll.irppAmount)}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-black text-emerald-600">{formatCurrency(payroll.netSalary)}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border whitespace-nowrap',
                        payroll.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        payroll.status === 'PAID' ? 'bg-blue-50 text-[#1A2BA6] border-blue-200' :
                        payroll.status === 'CALCULATED' ? 'bg-cyan-50 text-cyan-700 border-cyan-200' :
                        payroll.status === 'DRAFT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-500 border-slate-200'
                      )}>
                        {PAYROLL_STATUS_LABELS[payroll.status] || payroll.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {payroll.salaryPayment?.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <CheckCircle2 size={12} /> Payé
                        </span>
                      ) : payroll.salaryPayment?.status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600">
                          <Loader2 size={12} className="animate-spin" /> En cours
                        </span>
                      ) : payroll.salaryPayment?.status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                          <AlertCircle size={12} /> Échec
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        {period.status === 'OPEN' && (
                          <button
                            onClick={() => handleCalculatePayrollLine(payroll.id)}
                            className="p-1.5 text-slate-400 hover:text-[#1A2BA6] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Calculer taxes"
                          >
                            <Calculator size={15} />
                          </button>
                        )}
                        {/* Bouton Paiement individuel via FedaPay */}
                        {(period.status === 'CALCULATED' || period.status === 'VALIDATED') &&
                         payroll.salaryPayment?.status !== 'COMPLETED' && (
                          <>
                          <button
                            onClick={() => handlePaySalary(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`, Number(payroll.netSalary))}
                            disabled={payingItem === payroll.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                            title="Payer via FedaPay (Mobile Money)"
                          >
                            {payingItem === payroll.id ? <Loader2 size={12} className="animate-spin" /> : <Wallet size={12} />}
                            Payer
                          </button>
                          <button
                            onClick={() => handleManualValidate(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`, Number(payroll.netSalary))}
                            disabled={payingItem === payroll.id}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all disabled:opacity-50 border border-slate-200"
                            title="Valider manuellement (paiement en espèces / hors FedaPay)"
                          >
                            {payingItem === payroll.id ? <Loader2 size={12} className="animate-spin" /> : <HandCoins size={12} />}
                            Valider
                          </button>
                          </>
                        )}
                        {statut ? (
                          /* ── Personnel AVEC statut contractuel → documents officiels FP/EP ──
                             (les anciens boutons « bulletin » génériques sont masqués : risque
                             juridique de confusion fiche de paie / état de paiement) */
                          <>
                          {doc ? (
                            <button
                              onClick={() => handleDownloadDocument(doc.id)}
                              className={`p-1.5 rounded-lg transition-colors ${doc.documentType === 'ETAT_DE_PAIEMENT' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#1A2BA6] hover:bg-blue-50'}`}
                              title={`Télécharger ${doc.documentNumber} (PDF scellé)`}
                            >
                              <FileBadge2 size={15} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePreviewDocument(payroll.id)}
                                disabled={payroll.status === 'PENDING'}
                                className="p-1.5 text-slate-400 hover:text-[#1A2BA6] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
                                title={payroll.status === 'PENDING' ? 'Calculez d\u2019abord la ligne' : 'Aperçu du document (fiche ou état selon le statut)'}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => handleIssueDocument(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`)}
                                disabled={issuingItem === payroll.id || payroll.status === 'PENDING'}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                                style={{ backgroundColor: PRIMARY }}
                                title={payroll.status === 'PENDING' ? 'Calculez d\u2019abord la ligne (impossible sur PENDING)' : 'Émettre le document officiel (immuable, numéroté, scellé)'}
                              >
                                {issuingItem === payroll.id ? <Loader2 size={12} className="animate-spin" /> : <FileBadge2 size={12} />}
                                Émettre {statut === 'PRESTATAIRE_SERVICE' ? 'EP' : 'FP'}
                              </button>
                            </>
                          )}
                          </>
                        ) : (
                          /* ── Personnel SANS statut → boutons historiques (bulletin générique) ── */
                          <>
                            <button onClick={() => handlePreviewPayslip(payroll.id)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Aperçu Bulletin">
                              <FileText size={15} />
                            </button>
                            <button onClick={() => handleDownloadPayslip(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`)} className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" title="Télécharger PDF">
                              <Download size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {(!period.payrolls || period.payrolls.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <AlertCircle className="mx-auto mb-2 opacity-20" size={32} />
                      <p className="text-xs">Aucune ligne de paie générée pour cette période.</p>
                      {period.status === 'OPEN' && (
                        <div className="mt-3">
                          <button onClick={handleGeneratePayrolls} className="text-xs font-bold hover:underline" style={{ color: PRIMARY }}>
                            Lancer la génération automatique →
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Chaque ligne applique le moteur fiscal dérivé du <strong>type de contrat</strong> défini à l'embauche :
              fiche de paie (FP) pour les salariés — CNSS si déclarés, ITS progressif — et état de paiement (EP) pour
              les prestataires (retenue AIB à la source). Les montants alimentent automatiquement les déclarations
              CNSS / IST / AIB de l'onglet « CNSS &amp; Cotisations ».
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Modal de confirmation pour le paiement groupé */}
    {showPayAllConfirm && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 text-white" style={{ background: PRIMARY }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <Send className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Paiement groupé via FedaPay</h3>
                <p className="text-white/70 text-xs mt-0.5">Vérification avant envoi</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                Vous êtes sur le point de payer <strong>{period.payrolls?.length || 0} salarié(s)</strong> via FedaPay Mobile Money.
              </p>
              <p className="text-sm font-bold text-blue-900 mt-2">
                Montant total : {formatCurrency(totalNet)}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Chaque salarié recevra son salaire net sur son numéro Mobile Money configuré.
                Les salariés sans numéro Mobile Money seront ignorés (échec).
              </p>
            </div>
          </div>
          <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={() => setShowPayAllConfirm(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              onClick={handlePayAll}
              disabled={payingAll}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-emerald-600"
            >
              {payingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Confirmer le paiement groupé
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Registre des documents de paie émis (FP fiches / EP états) ── */}
    {showRegister && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-5 text-white flex items-center justify-between" style={{ background: PRIMARY }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <FileBadge2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Documents de paie émis</h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {monthLabel} · FP = fiches de paie · EP = états de paiement (prestataires)
                </p>
              </div>
            </div>
            <button onClick={() => setShowRegister(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-grow">
            {registerLoading ? (
              <div className="p-10 text-center text-slate-400 animate-pulse text-sm">Chargement du registre…</div>
            ) : registerDocs.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="mx-auto mb-3 opacity-20" size={40} />
                <p className="text-sm text-slate-500">
                  Aucun document émis pour cette période.<br />
                  <span className="text-xs">Émettez les fiches / états ligne par ligne (« Émettre FP/EP »).</span>
                </p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    {['N° document', 'Type', 'Personnel', 'Net', 'Émis le', 'Empreinte'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                    <th className="px-4 py-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registerDocs.map((d: any) => {
                    const snapshot = d.snapshot || {};
                    const net = snapshot.kind === 'FICHE_DE_PAIE' ? snapshot.net : snapshot.decompte?.net;
                    const isEP = d.documentType === 'ETAT_DE_PAIEMENT';
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-mono text-[10px] font-bold text-slate-800">{d.documentNumber}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${isEP ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-[#1A2BA6] border border-blue-200'}`}>
                            {isEP ? 'État de paiement' : 'Fiche de paie'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                          {d.staff?.firstName} {d.staff?.lastName}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-bold text-slate-900 text-right">
                          {net != null ? formatCurrency(net) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-500">
                          {d.issuedAt ? new Date(d.issuedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400" title={d.contentHash}>
                          {d.contentHash ? `${d.contentHash.slice(0, 10)}…` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDownloadDocument(d.id)}
                            className={`p-1.5 rounded-lg transition-colors ${isEP ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#1A2BA6] hover:bg-blue-50'}`}
                            title="Télécharger le PDF émis (vérification SHA-256 incluse)"
                          >
                            <FileBadge2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-500">
              Documents immuables : numéro séquentiel annuel (FP-2026-000001 / EP-2026-000001),
              snapshot figé à l'émission, PDF scellé par SHA-256. Les fiches de paie (FP) concernent
              les salariés (déclarés ou non) ; les états de paiement (EP) les prestataires de services
              (retenue AIB, aucune affiliation CNSS).
            </p>
          </div>
        </div>
      </div>
    )}
    </HRShell>
  );
}
