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
  Loader2,
  HandCoins,
  FileBadge2,
  X,
  Calendar,
  CalendarDays,
  ReceiptText,
  BadgeCheck,
  CheckCheck,
  Eye,
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
  // ⭐ 125 — plus jamais « En attente » : les lignes naissent désormais
  // CALCULÉES (la génération calcule les taxes) ; ce libellé ne sert
  // qu'aux très vieilles lignes jamais recalculées.
  PENDING: 'À calculer',
  FAILED: 'Échec',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
};

// ⭐ 125 — TYPE DE CONTRAT de l'employé (défini à l'embauche) affiché dans la
//    colonne Employé : visibilité immédiate sur qui est CDI / CDD / Vacataire…
const CONTRACT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  CDI:         { label: 'CDI',           className: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  CDD:         { label: 'CDD',           className: 'bg-violet-50 text-violet-700 border border-violet-200' },
  VACATAIRE:   { label: 'Vacataire',     className: 'bg-purple-50 text-purple-600 border border-purple-100' },
  STAGE:       { label: 'Stage',         className: 'bg-sky-50 text-sky-700 border border-sky-200' },
  CONSULTANT:  { label: 'Consultant',    className: 'bg-teal-50 text-teal-700 border border-teal-200' },
  PRESTATAIRE: { label: 'Prestataire',    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
};

export default function PayrollDetailPage() {
  const { id } = useParams();
  const { tenant, academicYear } = useModuleContext();
  const [period, setPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payingItem, setPayingItem] = useState<string | null>(null);
  const [payingAll, setPayingAll] = useState(false);
  // Documents de paie officiels FP/EP
  const [issuingItem, setIssuingItem] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registerDocs, setRegisterDocs] = useState<any[]>([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  // ⭐ 162 — VISIONNEUSE INTÉGRÉE (retour promoteur : « l'aperçu doit ouvrir au
  //    sein de l'application, pas un écran externe ») : le bulletin (PDF) et
  //    les documents FP/EP (HTML — identité école complète, logo en filigrane
  //    DROIT, QR) s'affichent dans un modal IN-APP ; « Télécharger »
  //    télécharge le fichier localement — plus jamais de nouvel onglet.
  const [viewer, setViewer] = useState<{
    kind: 'html' | 'pdf';
    url?: string;
    srcDoc?: string;
    title: string;
    fileName?: string;
  } | null>(null);
  // ⭐ 22/11/2026 — bascule du mode de calcul « présences » de la période
  const [togglingAttendance, setTogglingAttendance] = useState(false);

  // ⭐ 22/11/2026 — libellé de la PÉRIODE pour les noms de fichiers de
  //    téléchargement (« Novembre 2026 ») : nom de la période d'abord,
  //    repli mois/année dérivés de startDate (même règle que l'en-tête).
  const periodNameForFile = () =>
    period?.name
    || (period?.startDate
      ? new Date(period.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : '');

  // ⭐ 22/11/2026 — NOM DE FICHIER PROFESSIONNEL (retour promoteur) :
  //    « Fiche de paie <Prénom(s) NOM> <Période>.pdf » /
  //    « État de paiement <Prénom(s) NOM> <Période>.pdf » /
  //    « Bulletin de paie <Prénom(s) NOM> <Période>.pdf ».
  const payrollFileName = (typeLabel: string, staffName: string) =>
    `${typeLabel} ${String(staffName || 'personnel').replace(/\s+/g, ' ').trim()} ${periodNameForFile()}`
      .replace(/\s+/g, ' ')
      .trim() + '.pdf';

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

  // ⭐ 22/11/2026 — BASCULE « TENIR COMPTE DES PRÉSENCES » : la RH choisit
  //    librement de prorater la base par les pointages (mode présences) OU
  //    de payer la base + indemnités sans en tenir compte. Le changement
  //    recalcule immédiatement les lignes existantes de la période.
  const handleToggleAttendanceMode = async () => {
    if (!period) return;
    const next = !period.attendanceBased;
    const confirmed = window.confirm(
      next
        ? 'Activer le calcul de la paie sur les PRÉSENCES ?\n\nLa base de chaque ligne sera proratée par les pointages de la période ' +
        '(indemnités, heures supplémentaires et primes inchangées). Un personnel sans AUCUN pointage sur la période n\u2019est pas pénalisé.'
        : 'Revenir au calcul sur le SALAIRE DE BASE + indemnités, SANS tenir compte des présences ?',
    );
    if (!confirmed) return;
    try {
      setTogglingAttendance(true);
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/attendance-mode`, {
        tenantId: tenant.id,
      }), {
        method: 'PUT',
        body: { attendanceBased: next },
      });
      // Recalcul immédiat si des lignes existent déjà (applique le mode).
      const hasItems = (period.payrolls?.length || 0) > 0;
      if (hasItems) {
        await hrFetch<any>(hrUrl(`payroll/periods/${id}/calculate`, {
          tenantId: tenant.id,
        }), { method: 'POST' });
      }
      toast({
        variant: 'success',
        title: `Mode « présences » ${next ? 'activé' : 'désactivé'}`,
        description: hasItems ? 'Lignes de paie recalculées avec le nouveau mode.' : 'Le mode s\u2019appliquera à la génération des lignes.',
      });
      fetchPayroll();
    } catch (error: any) {
      toast({ variant: 'error', title: 'Impossible de changer le mode de calcul', description: error?.message });
    } finally {
      setTogglingAttendance(false);
    }
  };

  // ⭐ 125 — Marquer le salaire d'UN employé comme PERÇU (remis en espèces /
  //    virement) : remplace l'ancien bouton FedaPay (intégration payout
  //    désactivée) — l'école confirme que l'employé a reçu son argent.
  const handleMarkReceived = async (itemId: string, staffName: string, amount: number) => {
    if (!academicYear?.id) {
      toast({ variant: 'error', title: 'Année académique requise', description: 'Sélectionnez une année académique active.' });
      return;
    }
    const confirmed = window.confirm(
      `Confirmer que ${staffName} a bien perçu son salaire de ${formatCurrency(amount)} ?`,
    );
    if (!confirmed) return;

    try {
      setPayingItem(itemId);
      const result = await hrFetch<any>(hrUrl(`payroll/items/${itemId}/manual-validate`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { academicYearId: academicYear.id },
      });
      toast({
        variant: 'success',
        title: 'Salaire perçu',
        description: result?.message || `${formatCurrency(amount)} perçu par ${staffName}`,
      });
      fetchPayroll();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur de validation',
        description: err?.message || 'Impossible de marquer le salaire comme perçu',
      });
    } finally {
      setPayingItem(null);
    }
  };

  // ⭐ 125 — Marquer TOUS les salaires de la période comme PERÇUS (groupé).
  //    Chaque employé reçoit son paiement COMPLETED ; quand toutes les lignes
  //    sont perçues, le lot passe PAID — plus aucun badge « Brouillon ».
  const handleMarkAllReceived = async () => {
    const unpaidCount = (period?.payrolls || []).filter(
      (p: any) => p.salaryPayment?.status !== 'COMPLETED' && p.status !== 'PAID',
    ).length;
    const confirmed = window.confirm(
      `Confirmer que les ${unpaidCount} employé(s) restant(s) ont déjà perçu leur salaire ?\n\n` +
      `Chaque ligne sera marquée « Payé » et le lot sera clôturé.`,
    );
    if (!confirmed) return;
    try {
      setPayingAll(true);
      const result = await hrFetch<any>(hrUrl(`payroll/periods/${id}/validate-all`, { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
        },
      });
      toast({
        variant: result?.errors?.length ? 'warning' : 'success',
        title: 'Salaires marqués comme perçus',
        description: result?.message || 'Tous les salaires de la période sont perçus.',
      });
      fetchPayroll();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur',
        description: err?.message || 'Impossible de marquer les salaires comme perçus',
      });
    } finally {
      setPayingAll(false);
    }
  };

  // ─── Documents de paie officiels FP/EP (RH Bénin) ──
  // Fiche de paie (FP) pour les salariés, état de paiement (EP) pour les
  // prestataires — le type est dérivé du statut contractuel, jamais choisi ici.

  // ─── Bulletin générique (personnel hérité SANS statut contractuel) ──
  const handlePreviewPayslip = async (itemId: string, staffName?: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/items/${itemId}/payslip-pdf`, { tenantId: tenant.id }), { method: 'POST' });
      if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        // ⭐ 162 — VISIONNEUSE IN-APP : l'aperçu s'ouvre DANS l'application
        //    (modal intégré) — plus jamais d'onglet/« écran externe ». Le
        //    bouton Télécharger du modal enregistre le fichier localement.
        setViewer({
          kind: 'pdf',
          url,
          title: 'Aperçu du bulletin de paie',
          fileName: payrollFileName('Bulletin de paie', staffName || 'personnel'),
        });
      } else {
        toast({ variant: 'info', title: 'Aperçu du bulletin', description: 'Le PDF sera généré par le serveur.' });
      }
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur lors de la génération de l\'aperçu', description: error?.message });
    }
  };

  const handleDownloadPayslip = async (itemId: string, staffName: string) => {
    try {
      const response = await fetch(`/api/hr/payroll/items/${itemId}/payslip-pdf?tenantId=${tenant.id}`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Erreur téléchargement');
      // ⭐ 22/11/2026 — nom PROFESSIONNEL : « Bulletin de paie <employé> <période>.pdf »
      const fileName = payrollFileName('Bulletin de paie', staffName);
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
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
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      toast({ variant: 'success', title: 'Téléchargement du bulletin lancé.' });
    } catch (error: any) {
      toast({ variant: 'error', title: 'Erreur lors du téléchargement', description: error?.message });
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

  const handlePreviewDocument = async (itemId: string, docLabel?: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/documents/preview/${itemId}`, { tenantId: tenant.id }), {
        method: 'POST',
      });
      if (result?.html) {
        // ⭐ 162 — VISIONNEUSE IN-APP : la fiche de paie (FP) / l'état de
        //    paiement (EP) s'affiche DANS l'application — bandeau école
        //    complet (maternelle/primaire ou niveau secondaire selon le
        //    personnel), logo en FILIGRANE DIAGONAL, QR de vérification.
        //    Plus d'onglet externe : « l'aperçu doit ouvrir au sein de
        //    l'application » (retour promoteur).
        setViewer({
          kind: 'html',
          srcDoc: result.html,
          title: docLabel ? `Aperçu — ${docLabel}` : 'Aperçu du document de paie',
        });
      } else {
        toast({ variant: 'info', title: 'Aperçu indisponible', description: 'Aucun rendu retourné.' });
      }
    } catch (error: any) {
      toast({ variant: 'error', title: 'Aperçu impossible', description: error?.message });
    }
  };

  // ⭐ 162 — fermeture de la visionneuse (libération du blob PDF).
  const closeViewer = () => {
    if (viewer?.kind === 'pdf' && viewer.url) {
      try { URL.revokeObjectURL(viewer.url); } catch { /* noop */ }
    }
    setViewer(null);
  };

  // ⭐ 22/11/2026 — téléchargement FP/EP : le nom de fichier suit le type
  //    réel du document (« Fiche de paie… » / « État de paiement… »),
  //    l'employé ET la période. Le Content-Disposition du serveur (RFC 5987)
  //    est utilisé en priorité ; repli construit côté client avec les
  //    métadonnées du document.
  const handleDownloadDocument = async (
    docId: string,
    meta?: { documentType?: string | null; staffName?: string | null },
  ) => {
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
      // Nom serveur (filename*=UTF-8'') sinon construction client.
      const cd = response.headers.get('content-disposition') || '';
      const cdMatch = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = cdMatch
        ? decodeURIComponent(cdMatch[1]).trim()
        : payrollFileName(
            meta?.documentType === 'ETAT_DE_PAIEMENT' ? 'État de paiement' : 'Fiche de paie',
            meta?.staffName || '',
          );
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ variant: 'success', title: `Téléchargement lancé — ${fileName}`, description: 'Intégrité SHA-256 vérifiée.' });
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
      let docs = await hrFetch<any[]>(hrUrl('payroll/documents', {
        tenantId: tenant.id,
        periodYear,
        periodMonth,
      }));
      // ⭐ 125 — REpli : si le filtre mois ne renvoie RIEN alors que des
      //    documents existent (lots hérités avec mois stocké décalé), on
      //    élargit à l'année entière — le registre ne doit JAMAIS montrer
      //    « aucun document » quand des FP/EP ont été émis.
      if (!docs || docs.length === 0) {
        docs = await hrFetch<any[]>(hrUrl('payroll/documents', {
          tenantId: tenant.id,
          periodYear,
        }));
      }
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
  // ⭐ 17/11/2026 — composition du brut : les INDEMNITÉS sont incluses dans le
  //    salaire réel (brut = base + Σ indemnités + heures supp + primes).
  //    Lignes héritées sans allowancesTotal → résidu brut − base − h.sup − primes.
  const itemAllowances = (p: any) =>
    p.allowancesTotal != null
      ? Number(p.allowancesTotal)
      : Math.max(
          0,
          Number(p.grossSalary) - Number(p.baseSalary) - Number(p.overtimeAmount || 0) - Number(p.bonuses || 0),
        );
  const totalAllowances = period.payrolls?.reduce((acc: number, p: any) => acc + itemAllowances(p), 0) || 0;
  const totalDeductions = period.payrolls?.reduce(
    (acc: number, p: any) => acc + Number(p.cnssEmployee) + Number(p.irppAmount) + Number(p.otherDeductions || 0), 0) || 0;
  const docsIssued = period.payrolls?.filter((p: any) => p.payrollDocument).length || 0;
  const nonDeclares = period.payrolls?.filter((p: any) => p.staff?.statutContractuel === 'SALARIE_NON_DECLARE').length || 0;
  // ⭐ 125 — salariés restant à percevoir (pour le bouton groupé « Marquer tout perçu »)
  const unpaidCount = (period.payrolls || []).filter(
    (p: any) => p.salaryPayment?.status !== 'COMPLETED' && p.status !== 'PAID',
  ).length;
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
                {/* ⭐ 22/11/2026 — mode de calcul de la période : badge visible */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap',
                    period.attendanceBased
                      ? 'bg-teal-50 text-teal-700 border-teal-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200',
                  )}
                  title={period.attendanceBased
                    ? 'La base de chaque ligne est proratée par les présences pointées de la période'
                    : 'Salaire de base + indemnités, sans tenir compte des présences'}
                >
                  <CalendarDays className="h-3 w-3" />
                  {period.attendanceBased ? 'Présences' : 'Base + indemnités'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(period.startDate).toLocaleDateString('fr-FR')} → {new Date(period.endDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* ⭐ 22/11/2026 — BASCULE « TENIR COMPTE DES PRÉSENCES » : la RH
                choisit librement le mode de calcul de la paie de la période
                (proratation de la base par les pointages, ou base +
                indemnités sans en tenir compte). */}
            {['OPEN', 'CALCULATED'].includes(period.status) && (
              <button
                onClick={handleToggleAttendanceMode}
                disabled={togglingAttendance || processing}
                className={cn(
                  'flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all font-bold text-xs disabled:opacity-50 border',
                  period.attendanceBased
                    ? 'bg-teal-50 text-teal-700 border-teal-300 hover:bg-teal-100'
                    : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100',
                )}
                title={period.attendanceBased
                  ? 'Désactiver : revenir au salaire de base + indemnités, sans tenir compte des présences'
                  : 'Activer : prorater la base de chaque ligne par les présences pointées de la période'}
              >
                {togglingAttendance ? <Loader2 size={14} className="animate-spin" /> : <CalendarDays size={14} />}
                {togglingAttendance
                  ? 'Application…'
                  : period.attendanceBased
                    ? 'Présences : activé'
                    : 'Présences : désactivé'}
              </button>
            )}
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
            {(period.status === 'CALCULATED' || period.status === 'VALIDATED' || (period.status === 'PAID' && unpaidCount > 0)) && (
              <>
                {unpaidCount > 0 && (
                  <button
                    onClick={handleMarkAllReceived}
                    disabled={payingAll || processing}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm transition-all font-bold text-xs disabled:opacity-50"
                    title="Confirmer que tous les employés ont reçu leur salaire (espèces / virement)"
                  >
                    {payingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                    {payingAll ? 'Enregistrement...' : `Marquer tout perçu (${unpaidCount})`}
                  </button>
                )}
                <button
                  onClick={handleCalculateAll}
                  disabled={processing}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-bold text-xs disabled:opacity-50"
                  title="Recalculer toutes les lignes (taxes/CNSS) et rafraîchir les déclarations"
                >
                  <Calculator size={14} className={processing ? 'animate-spin' : ''} />
                  Recalculer
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
            {
              label: 'Masse brute',
              value: formatCurrency(totalGross),
              sub: totalAllowances > 0 ? `dont indemnités ${formatCurrency(totalAllowances)}` : null,
            },
            { label: 'Retenues (CNSS/ITS/AIB)', value: formatCurrency(totalDeductions) },
            { label: 'Net à payer', value: formatCurrency(totalNet), accent: 'text-emerald-600' },
            { label: 'Agents', value: `${period.payrolls?.length || 0} ligne(s)` },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className={cn('text-base font-bold text-slate-900 mt-0.5', k.accent)}>{k.value}</p>
              {k.sub && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{k.sub}</p>}
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
                  {['Employé', 'Salaire Brut', ...(period.attendanceBased ? ['Présences'] : []), 'Retenues', 'Net à Payer', 'Statut Ligne', 'Paiement'].map((h) => (
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
                            {/* ⭐ 125 — TYPE DE CONTRAT visible sur CHAQUE ligne
                                (œil immédiat : CDI / CDD / Vacataire / …) */}
                            {(() => {
                              const ct = payroll.staff?.contractType;
                              if (!ct) return null;
                              const ctInfo = CONTRACT_TYPE_LABELS[ct] || { label: ct, className: 'bg-slate-50 text-slate-500 border border-slate-200' };
                              return (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${ctInfo.className}`}>
                                  {ctInfo.label}
                                </span>
                              );
                            })()}
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
                      {/* ⭐ 17/11/2026 — composition du SALAIRE RÉEL : base +
                          indemnités (par type au survol) + heures supp + primes. */}
                      {(() => {
                        const base = Number(payroll.baseSalary);
                        const overtime = Number(payroll.overtimeAmount || 0);
                        const bonuses = Number(payroll.bonuses || 0);
                        const indem = itemAllowances(payroll);
                        const detail = Array.isArray(payroll.allowancesDetail)
                          ? payroll.allowancesDetail.filter((a: any) => Number(a?.amount) > 0)
                          : [];
                        const parts: string[] = [];
                        if (base > 0) parts.push(`Base ${formatCurrency(base)}`);
                        if (indem > 0) parts.push(`Indemn. ${formatCurrency(indem)}`);
                        if (overtime > 0) parts.push(`H.sup ${formatCurrency(overtime)}`);
                        if (bonuses > 0) parts.push(`Primes ${formatCurrency(bonuses)}`);
                        return (
                          <div className="flex flex-col">
                            <span
                              className="text-xs font-bold text-slate-700"
                              title={detail.length > 0
                                ? detail.map((a: any) => `${a.label}: ${formatCurrency(a.amount)}`).join('\n')
                                : undefined}
                            >
                              {formatCurrency(payroll.grossSalary)}
                            </span>
                            {parts.length > 0 && (
                              <span className="text-[8px] text-slate-400 font-medium mt-0.5">
                                {parts.join(' · ')}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    {/* ⭐ 22/11/2026 — colonne PRÉSENCES (mode « présences »
                        uniquement) : jours pointés / ouvrés + taux de base
                        appliqué — le lien présences ↔ paie est visible. */}
                    {period.attendanceBased && (
                      <td className="px-4 py-2.5">
                        {(() => {
                          const att = payroll.attendanceDetail;
                          if (!att || att.mode !== 'ATTENDANCE') {
                            return <span className="text-[10px] text-slate-400">—</span>;
                          }
                          const pct = Math.round(Number(att.ratio ?? 1) * 1000) / 10;
                          return (
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                                {att.daysPresent}/{att.daysExpected} j
                                {att.noRecords ? <span className="text-slate-400 font-medium"> · aucun pointage</span> : null}
                              </span>
                              <span className={cn('text-[8px] font-bold whitespace-nowrap', pct >= 100 ? 'text-emerald-600' : pct >= 75 ? 'text-amber-600' : 'text-red-500')}>
                                {pct} % de base
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    )}
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
                      {/* ⭐ 125 — colonne Paiement : plus de simple tiret « — » ;
                          chaque ligne affiche explicitement Perçu (avec date) /
                          Non perçu / En cours / Échec. */}
                      {payroll.salaryPayment?.status === 'COMPLETED' || payroll.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <BadgeCheck size={13} /> Perçu
                          {payroll.salaryPayment?.paymentDate && (
                            <span className="text-[8px] font-medium text-slate-400">
                              {new Date(payroll.salaryPayment.paymentDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                          <HandCoins size={12} className="opacity-60" /> Non perçu
                        </span>
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
                        {/* ⭐ 125 — Marquer le salaire comme PERÇU (individuel) */}
                        {payroll.salaryPayment?.status !== 'COMPLETED' && payroll.status !== 'PAID' &&
                         ['CALCULATED', 'VALIDATED'].includes(period.status) && (
                          <button
                            onClick={() => handleMarkReceived(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`, Number(payroll.netSalary))}
                            disabled={payingItem === payroll.id}
                            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50"
                            title="Marquer comme perçu (espèces / virement)"
                          >
                            {payingItem === payroll.id ? <Loader2 size={12} className="animate-spin" /> : <HandCoins size={12} />}
                            Perçu
                          </button>
                        )}
                        {statut ? (
                          /* ── Personnel AVEC statut contractuel → documents officiels FP/EP ──
                             ⭐ 125 — ICÔNES DIFFÉRENCIÉES par type de document :
                               Fiche de paie (FP)  → FileText  (bleu #1A2BA6)
                               État de paiement (EP) → ReceiptText (vert émeraude)
                             L'aperçu ET le téléchargement suivent la même couleur. */
                          <>
                          {doc ? (
                            <>
                              {/* ⭐ 162 — APERÇU TOUJOURS VISIBLE (même après
                                  émission) : le RH voit le gabarit ACTUEL —
                                  identité école complète (maternelle/primaire
                                  ou secondaire), logo en filigrane, QR —
                                  directement DANS l'application. */}
                              <button
                                onClick={() => handlePreviewDocument(payroll.id, doc.documentType === 'ETAT_DE_PAIEMENT' ? 'état de paiement' : 'fiche de paie')}
                                disabled={payroll.status === 'PENDING'}
                                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${doc.documentType === 'ETAT_DE_PAIEMENT'
                                  ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:text-[#1A2BA6] hover:bg-blue-50'}`}
                                title={`Aperçu ${doc.documentType === 'ETAT_DE_PAIEMENT' ? 'de l\u2019état de paiement' : 'de la fiche de paie'} (dans l\u2019application — gabarit actuel, filigrane + QR)`}
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                onClick={() => handleDownloadDocument(doc.id, {
                                  documentType: doc.documentType,
                                  staffName: `${payroll.staff?.firstName} ${payroll.staff?.lastName}`,
                                })}
                                className={`p-1.5 rounded-lg transition-colors ${doc.documentType === 'ETAT_DE_PAIEMENT' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#1A2BA6] hover:bg-blue-50'}`}
                                title={`Télécharger ${doc.documentType === 'ETAT_DE_PAIEMENT' ? 'l\u2019état de paiement' : 'la fiche de paie'} (${payroll.staff?.firstName} ${payroll.staff?.lastName} — ${monthLabel}) — PDF scellé)`}
                              >
                                {doc.documentType === 'ETAT_DE_PAIEMENT' ? <ReceiptText size={15} /> : <FileText size={15} />}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handlePreviewDocument(payroll.id, statut === 'PRESTATAIRE_SERVICE' ? 'état de paiement' : 'fiche de paie')}
                                disabled={payroll.status === 'PENDING'}
                                className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${statut === 'PRESTATAIRE_SERVICE'
                                  ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                  : 'text-slate-400 hover:text-[#1A2BA6] hover:bg-blue-50'}`}
                                title={payroll.status === 'PENDING'
                                  ? 'Calculez d\u2019abord la ligne'
                                  : statut === 'PRESTATAIRE_SERVICE'
                                    ? 'Aperçu de l\u2019état de paiement (EP — prestataire)'
                                    : 'Aperçu de la fiche de paie (FP — salarié)'}
                              >
                                {statut === 'PRESTATAIRE_SERVICE' ? <ReceiptText size={15} /> : <FileText size={15} />}
                              </button>
                              <button
                                onClick={() => handleIssueDocument(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`)}
                                disabled={issuingItem === payroll.id || payroll.status === 'PENDING'}
                                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50 ${statut === 'PRESTATAIRE_SERVICE' ? 'bg-emerald-600' : ''}`}
                                style={statut === 'PRESTATAIRE_SERVICE' ? undefined : { backgroundColor: PRIMARY }}
                                title={payroll.status === 'PENDING' ? 'Calculez d\u2019abord la ligne (impossible sur PENDING)' : 'Émettre le document officiel (immuable, numéroté, scellé)'}
                              >
                                {issuingItem === payroll.id ? <Loader2 size={12} className="animate-spin" /> : statut === 'PRESTATAIRE_SERVICE' ? <ReceiptText size={12} /> : <FileText size={12} />}
                                Émettre {statut === 'PRESTATAIRE_SERVICE' ? 'EP' : 'FP'}
                              </button>
                            </>
                          )}
                          </>
                        ) : (
                          /* ── Personnel SANS statut → boutons historiques (bulletin générique) ── */
                          <>
                            <button onClick={() => handlePreviewPayslip(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Aperçu du bulletin (dans l'application)">
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
                    <td colSpan={period.attendanceBased ? 8 : 7} className="px-4 py-12 text-center text-slate-400">
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
              Le <strong>salaire brut</strong> intègre les indemnités assignées à chaque agent (survolez le brut pour
              le détail par type : base + indemnités + heures supplémentaires + primes). Chaque ligne applique ensuite le
              moteur fiscal dérivé du <strong>type de contrat</strong> défini à l'embauche :
              fiche de paie (FP) pour les salariés — CNSS si déclarés, ITS progressif — et état de paiement (EP) pour
              les prestataires (retenue AIB à la source). Les montants alimentent automatiquement les déclarations
              CNSS / IST / AIB de l'onglet « CNSS &amp; Cotisations ».
              {period.attendanceBased ? (
                <>
                  {' '}Mode <strong>présences</strong> actif : le <strong>salaire de base</strong> de chaque ligne est proraté
                  par les pointages de la période (colonne Présences — jours pointés / jours ouvrés) ; les indemnités,
                  heures supplémentaires et primes restent entiers ; un personnel sans aucun pointage n'est pas pénalisé.
                </>
              ) : (
                <>
                  {' '}Mode <strong>base + indemnités</strong> : les présences pointées ne modifient pas le salaire — la
                  bascule « Présences » de l'en-tête permet à la RH d'en tenir compte à tout moment.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* ── ⭐ 162 — VISIONNEUSE INTÉGRÉE : l'aperçu (bulletin PDF / document
        FP-EP HTML) s'ouvre AU SEIN DE L'APPLICATION — plus d'onglet externe.
        « Télécharger » enregistre le fichier localement avec son nom
        professionnel (Fiche de paie / État de paiement / Bulletin · employé · période). ── */}
    {viewer && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-4xl h-[88vh] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 text-white flex items-center justify-between shrink-0" style={{ background: PRIMARY }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                {viewer.kind === 'pdf' ? <FileText className="h-5 w-5" /> : <FileBadge2 className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-bold text-base">{viewer.title}</h3>
                <p className="text-white/70 text-xs mt-0.5">
                  {viewer.kind === 'pdf'
                    ? 'Aperçu intégré du bulletin — bouton « Télécharger » pour enregistrer le PDF'
                    : 'Aperçu intégré du document officiel — identité de l\u2019école, logo en filigrane et QR de vérification'}
                </p>
              </div>
            </div>
            <button onClick={closeViewer} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-grow bg-slate-100 overflow-hidden">
            {viewer.kind === 'html' ? (
              <iframe
                title={viewer.title}
                srcDoc={viewer.srcDoc}
                className="w-full h-full border-0 bg-white"
              />
            ) : (
              <iframe
                title={viewer.title}
                src={viewer.url}
                className="w-full h-full border-0"
              />
            )}
          </div>
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <p className="text-[10px] text-slate-500 leading-relaxed max-w-[58%]">
              {viewer.kind === 'html'
                ? 'Prévisualisation du gabarit officiel. Le PDF téléchargé est scellé (SHA-256) : les données financières restent figées, le rendu (identité de l\u2019école, logo en filigrane, QR) est actualisé au gabarit courant si nécessaire.'
                : 'Aperçu du bulletin tel qu\u2019il sera imprimé — en-tête et pied de page répétés sur chaque page.'}
            </p>
            <div className="flex items-center gap-2">
              {viewer.kind === 'pdf' && viewer.url && (
                <a
                  href={viewer.url}
                  download={viewer.fileName || 'bulletin-de-paie.pdf'}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Download size={14} /> Télécharger
                </a>
              )}
              <button onClick={closeViewer} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-100 transition">
                Fermer
              </button>
            </div>
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
                            onClick={() => handleDownloadDocument(d.id, {
                              documentType: d.documentType,
                              staffName: `${d.staff?.firstName} ${d.staff?.lastName}`,
                            })}
                            className={`p-1.5 rounded-lg transition-colors ${isEP ? 'text-emerald-600 hover:bg-emerald-50' : 'text-[#1A2BA6] hover:bg-blue-50'}`}
                            title={`Télécharger le PDF émis (${isEP ? 'état de paiement' : 'fiche de paie'} — ${d.staff?.firstName} ${d.staff?.lastName} — vérification SHA-256 incluse)`}
                          >
                            {isEP ? <ReceiptText size={14} /> : <FileText size={14} />}
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
