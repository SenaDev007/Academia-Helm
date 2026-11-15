'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Smartphone, Calendar, FileSpreadsheet, FileText, Loader2, ChevronLeft, ChevronRight, MoreHorizontal, Layers, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useL } from '@/lib/i18n/bilingual';
import { WhatsAppIcon, GmailIcon, HelmConnectIcon, SmsIcon } from './OfficialIcons';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import NewPaymentModal from './NewPaymentModal';
import GeneralFeePaymentModal from './GeneralFeePaymentModal';
// ⭐ FIX 2026-09-07 : import mort SUPPRIMÉ — SchoolFeePaymentDialog n'était jamais
// rendu ici et son import cassait le build webpack : le fichier importe
// '@/services/fedapay.service' (module inexistant — renommé feexpay.service
// au commit 11a5b9ed sans mise à jour). Vercel échouait silencieusement depuis.
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { exportTransactionsToExcel } from '@/lib/exports/excel-exports';
import { transactionsFilename } from '@/lib/exports/filename-helpers';
import { PaymentMethodBadge } from './FedapayLogo';
import ShopSalesSection from './ShopSalesSection';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEDAPAY: 'FedaPay',
};

export default function TransactionsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { tenant } = useAppSession();
  // ⭐ Libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  // ⭐ SOUS-ONGLETS : « Tous les encaissements » | « Frais généraux »
  //    (exigence sept. 2026 : récupérer le paiement des frais généraux à part
  //    afin de savoir qui a payé). Le sous-onglet GENERAL filtre côté backend
  //    sur les transactions ayant au moins une allocation vers un frais
  //    général (feeType=GENERAL) et affiche la part imputée.
  const [subTab, setSubTab] = useState<'all' | 'general'>('all');
  // ⭐ 2026-09-16 — WhatsApp RÉACTIVÉ : dropdown 2 options (lien wa.me + API auto),
  //    même pattern que StudentAccountsContent. Reste disponible aux côtés de
  //    Helm Connect (l'utilisateur peut choisir son canal d'envoi).
  const [whatsappMenuId, setWhatsappMenuId] = useState<string | null>(null);
  // ⭐ PERF 2026-09-16 — feedback instantané : spinner sur le bouton Visualiser
  //    pendant le chargement du PDF (anti double-clic inclus).
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  // ⭐ Modal DÉDIÉ d'encaissement des frais généraux (exigence sept. 2026 :
  //    « un bouton pour ouvrir un modèle spécifique pour l'encaissement des
  //    frais généraux pour que les choses soient bien proprement séparées »).
  //    Le paiement est imputé uniquement aux frais GENERA (targetFeeType).
  const [generalModalOpen, setGeneralModalOpen] = useState(false);
  // ⭐ Incrémenté après chaque paiement réussi pour forcer le refresh des
  //    caisses ouvertes dans NewPaymentModal (qui ne rechargeait pas sinon).
  const [modalRefreshTrigger, setModalRefreshTrigger] = useState(0);
  // Filtre par période
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  // ⭐ Pagination serveur (pattern identique à StudentMovementsContent.tsx — Task 9-a)
  const PAGE_SIZE = 25;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const loadTransactions = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getTransactions({
        academicYearId: academicYear.id,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
        // ⭐ Sous-onglet Frais généraux : filtrer côté backend sur les
        //    transactions imputées à des frais généraux (feeType=GENERAL).
        ...(subTab === 'general' ? { feeType: 'GENERAL' } : {}),
      });
      // ⭐ Gérer la réponse paginée { data, total, page, totalPages } ou l'ancien format array
      const allItems = Array.isArray(data) ? data : (data?.data ?? []);
      setTransactions(allItems);
      setTotalTransactions(Array.isArray(data) ? data.length : (data?.total ?? 0));
      setTotalPages(Array.isArray(data) ? 1 : (data?.totalPages ?? 1));
    } catch (e: any) {
      // ⭐ Toast d'erreur (l'ancien code avalait l'erreur silencieusement)
      console.error(e);
      toast({
        title: 'Erreur de chargement',
        description: e?.message || 'Impossible de charger les transactions.',
        variant: 'destructive',
      });
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, currentPage, subTab]);

  useEffect(() => {
    if (!academicYear?.id) return;
    // ⭐ exportAll=true pour récupérer TOUS les comptes (le backend plafonne à 500 sans ce flag)
    financeService.getStudentAccounts({ academicYearId: academicYear.id, exportAll: 'true' })
      .then((d) => setAccounts(Array.isArray(d) ? d : (d?.items || d?.data || [])))
      .catch(() => setAccounts([]));
  }, [academicYear?.id]);

  /**
   * Recharge les comptes élèves depuis le backend.
   *
   * Appelé après un paiement réussi pour mettre à jour les soldes affichés
   * dans le sélecteur d'élèves du NewPaymentModal — sans cette mise à jour,
   * l'utilisateur devait fermer + rouvrir le modal pour voir les soldes
   * actualisés.
   */
  const reloadAccounts = () => {
    if (!academicYear?.id) return;
    financeService.getStudentAccounts({ academicYearId: academicYear.id, exportAll: 'true' })
      .then((d) => setAccounts(Array.isArray(d) ? d : (d?.items || d?.data || [])))
      .catch(() => {/* ignore — keep existing accounts */});
  };

  const handleSuccess = () => {
    // Recharger les transactions ET les comptes élèves sans fermer le modal
    // (le modal affiche le reçu, l'utilisateur le fermera manuellement).
    // ⭐ reloadAccounts() met à jour les soldes du sélecteur d'élèves pour
    //    permettre un second paiement sans devoir fermer/rouvrir le modal.
    // ⭐ setModalRefreshTrigger() force le rechargement des caisses ouvertes
    //    dans le modal (qui sinon ne rechargeait qu'au montage).
    // ⭐ 'finance-accounts-changed' → l'onglet « Frais généraux » (s'il est
    //    ouvert dans un autre onglet navigateur ou via navigation) recharge
    //    ses soldes automatiquement (déduction auto après encaissement).
    loadTransactions();
    reloadAccounts();
    setModalRefreshTrigger((n) => n + 1);
    window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
  };

  // ⭐ Succès d'un encaissement DÉDIÉ frais généraux : même rafraîchissement,
  //    + bascule automatique sur le sous-onglet « Frais généraux » (exigence
  //    utilisateur : « lorsqu'on encaisse, ça va au niveau du sous-onglet
  //    frais généraux avec une déduction automatique »).
  const handleGeneralSuccess = () => {
    setSubTab('general');
    handleSuccess();
  };

  // ⭐ Reset page à 1 quand on change de sous-onglet
  useEffect(() => { setCurrentPage(1); }, [subTab]);

  // Filtrage par période (date de création de la transaction)
  const filteredTransactions = useMemo(() => {
    if (!dateFrom && !dateTo) return transactions;
    return transactions.filter((t) => {
      const txDate = new Date(t.createdAt || t.date || '').getTime();
      if (Number.isNaN(txDate)) return false;
      if (dateFrom) {
        const fromTime = new Date(dateFrom + 'T00:00:00').getTime();
        if (txDate < fromTime) return false;
      }
      if (dateTo) {
        const toTime = new Date(dateTo + 'T23:59:59').getTime();
        if (txDate > toTime) return false;
      }
      return true;
    });
  }, [transactions, dateFrom, dateTo]);

  // Récupération des infos école pour l'entête des exports
  const schoolInfo = useMemo(() => ({
    name: tenant?.name || 'Établissement',
    logoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
    academicYear: academicYear?.name || '',
    schoolLevel: schoolLevel?.code || undefined,
    schoolAddress: tenant?.address || null,
    schoolPhone: tenant?.phone || null,
    schoolEmail: tenant?.email || null,
  }), [tenant, academicYear, schoolLevel]);

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      await exportTransactionsToExcel(filteredTransactions, {
        schoolName: schoolInfo.name,
        schoolLogoUrl: schoolInfo.logoUrl,
        academicYear: schoolInfo.academicYear,
        dateFrom,
        dateTo,
        schoolLevel: schoolInfo.schoolLevel,
        schoolAddress: schoolInfo.schoolAddress,
        schoolPhone: schoolInfo.schoolPhone,
        schoolEmail: schoolInfo.schoolEmail,
      });
      toast({ title: '✅ Export Excel généré', description: `${filteredTransactions.length} transaction(s) exportée(s).` });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      // Utiliser le backend Puppeteer pour un PDF professionnel (comme le module élève)
      const params = new URLSearchParams({ academicYearId: academicYear?.id || '' });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await fetch(`/api/finance/exports/transactions/pdf?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewDoc({
        filePath: url,
        fileName: transactionsFilename(dateFrom, dateTo, 'pdf'),
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const studentList = accounts
    .filter((a) => a.student)
    .map((a) => ({
      id: a.studentId,
      name: `${a.student.lastName} ${a.student.firstName}`,
      schoolLevelId: a.student.schoolLevelId,
    }));

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtre par période */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 px-1 py-0.5"
                  title="Date de début"
                />
                <span className="text-slate-400 text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 px-1 py-0.5"
                  title="Date de fin"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                    className="text-xs text-slate-500 hover:text-rose-600 ml-1"
                    title="Effacer le filtre"
                  >
                    ✕
                  </button>
                )}
              </div>
              {/* Boutons export */}
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                {exporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                )}
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null} className="border-rose-300 text-rose-700 hover:bg-rose-100">
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-1.5" />
                )}
                PDF
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* ⭐ Sous-onglet Frais généraux : bouton DÉDIÉ en premier (flux
                  séparé du paiement standard — imputation GENERAL uniquement) */}
              {subTab === 'general' && (
                <Button onClick={() => setGeneralModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Layers className="w-4 h-4 mr-2" />
                  {L('Encaisser des frais généraux', 'Collect general fees')}
                </Button>
              )}
              <Button onClick={() => setModalOpen(true)} variant={subTab === 'general' ? 'outline' : 'default'}>
                <Plus className="w-4 h-4 mr-2" />
                {L('Nouveau paiement', 'New payment')}
              </Button>
            </div>
          </div>
        }
      >
        {/* ⭐ SOUS-ONGLETS : Tous les encaissements | Frais généraux */}
        <div className="mb-4 flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setSubTab('all')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition',
              subTab === 'all'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Coins className="w-4 h-4" />
            {L('Tous les encaissements', 'All collections')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('general')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition',
              subTab === 'general'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Layers className="w-4 h-4" />
            {L('Frais généraux', 'General fees')}
          </button>
        </div>

        {/* Bandeau explicatif du sous-onglet Frais généraux */}
        {subTab === 'general' && (
          <p className="mb-3 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
            <Layers className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              {L(
                'Encaissements imputés aux frais généraux uniquement. "Part frais généraux" = montant alloué à ces frais dans chaque encaissement ; le reste du reçu est imputé aux autres frais. Les soldes par élève se déduisent automatiquement dans l\u2019onglet « Frais généraux ».',
                'Collections allocated to general fees only. "General fees share" = the amount allocated to these fees in each receipt; the remainder is allocated to other fees. Per-student balances update automatically in the "General fees" tab.',
              )}
            </span>
          </p>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                {/* ⭐ Sous-onglet Frais généraux : part imputée aux frais généraux */}
                {subTab === 'general' && (
                  <TableHead className="text-right">{L('Part frais généraux', 'General fees share')}</TableHead>
                )}
                <TableHead>Méthode</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={subTab === 'general' ? 8 : 7} className="text-center text-gray-500 py-8">Chargement...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={subTab === 'general' ? 8 : 7} className="text-center text-gray-500 py-12">
                    {subTab === 'general' ? (
                      <div className="flex flex-col items-center gap-2">
                        <Layers className="w-10 h-10 text-slate-300" />
                        <p>{L("Aucun encaissement de frais généraux pour l'instant.", 'No general fees collection yet.')}</p>
                        <Button
                          size="sm"
                          onClick={() => setGeneralModalOpen(true)}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Layers className="w-4 h-4 mr-2" />
                          {L('Encaisser des frais généraux', 'Collect general fees')}
                        </Button>
                        <p className="text-xs text-slate-400 max-w-md">
                          {L(
                            "Utilisez le bouton dédié ci-dessus : l'encaissement sera imputé uniquement aux frais généraux de l'élève, apparaîtra dans ce sous-onglet et se déduira automatiquement dans l'onglet « Frais généraux ».",
                            'Use the dedicated button above: the collection will be allocated to the student\'s general fees only, appear in this sub-tab, and be deducted automatically in the "General fees" tab.',
                          )}
                        </p>
                      </div>
                    ) : (
                      L('Aucune transaction enregistrée.', 'No transaction recorded.')
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((t) => {
                  // ⭐ Sous-onglet Frais généraux : somme des allocations vers
                  //    les breakdowns GENERAL de la transaction (le backend
                  //    inclut `allocations` quand feeType=GENERAL est demandé).
                  const generalAllocations = subTab === 'general'
                    ? (t.allocations ?? []).filter((a: any) => a.accountBreakdown?.feeStructure?.feeType === 'GENERAL')
                    : [];
                  const generalShare = generalAllocations.reduce((s: number, a: any) => s + Number(a.amount ?? 0), 0);
                  const generalFeeNames = Array.from(new Set(
                    generalAllocations.map((a: any) => a.accountBreakdown?.feeStructure?.name).filter(Boolean)
                  ));
                  return (
                  <TableRow key={t.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs">{t.receiptNumber}</TableCell>
                    <TableCell className="font-medium">
                      {t.studentAccount?.student
                        ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(t.amount)}</TableCell>
                    {subTab === 'general' && (
                      <TableCell className="text-right">
                        <span className="font-semibold text-indigo-700">{formatCurrency(generalShare)}</span>
                        {generalFeeNames.length > 0 && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            {generalFeeNames.map((n: string) => (<div key={n}>{n}</div>))}
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <PaymentMethodBadge method={t.paymentMethod} methodLabel={METHOD_LABELS[t.paymentMethod]} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.type === 'REVERSAL' ? 'destructive' : 'default'}>
                        {t.type === 'REVERSAL' ? 'Annulation' : 'Paiement'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                          disabled={viewingId !== null}
                          onClick={async () => {
                            if (viewingId) return;
                            setViewingId(t.id);
                            try {
                              const res = await fetch(financeService.getReceiptPdfUrl(t.id));
                              // ⭐ FIX 2026-09-16 — ne pas nourrir le preview avec une
                              //    réponse d'erreur JSON (ex-500 trigger clôture) :
                              //    message clair au lieu d'un PDF illisible.
                              if (!res.ok) {
                                const j: any = await res.json().catch(() => null);
                                toast({
                                  title: 'Reçu indisponible',
                                  description: j?.message || `Erreur serveur (HTTP ${res.status})`,
                                  variant: 'destructive',
                                });
                                return;
                              }
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              setPreviewDoc({ filePath: url, fileName: `recu-${t.receiptNumber || t.id}.pdf`, mimeType: 'application/pdf' });
                            } catch (e: any) {
                              toast({ title: 'Erreur', description: 'Impossible de charger le reçu', variant: 'destructive' });
                            } finally {
                              setViewingId(null);
                            }
                          }}
                          title="Visualiser le reçu"
                        >
                          {viewingId === t.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            : <Eye className="w-3.5 h-3.5 text-slate-600" />}
                        </Button>
                        <a
                          href={financeService.getReceiptPdfUrl(t.id)}
                          download={`recu-${t.receiptNumber || t.id}.pdf`}
                          title="Télécharger le reçu PDF"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-indigo-100 hover:shadow-sm cursor-pointer transition-all duration-150"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                          onClick={async () => {
                            try {
                              const r = await financeService.resendReceipt(t.id, ['email']);
                              const s = r?.channels?.email;
                              if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' }); else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                              else toast({ title: 'Reçu envoyé', description: `Email envoyé${s?.to ? ` à ${s.to}` : ''}` });
                            } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                          }}
                          title="Envoyer par email"
                        >
                          <GmailIcon className="w-3.5 h-3.5" />
                        </Button>
                        {/* ⭐ 15/11/2026 (retour promoteur — tous les canaux) :
                            SMS via Termii (reçu court) aux côtés d'Email,
                            WhatsApp et Helm Connect. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                          onClick={async () => {
                            try {
                              const r = await financeService.resendReceipt(t.id, ['sms']);
                              const s = r?.channels?.sms;
                              if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason || s.error || 'Aucun téléphone parent', variant: 'destructive' });
                              else if (s?.status === 'failed') toast({ title: 'Échec d\'envoi SMS', description: s.error || 'Échec de l\'envoi SMS (vérifiez la configuration Termii : SMS_PROVIDER=termii + TERMII_API_KEY)', variant: 'destructive' });
                              else toast({ title: 'Reçu envoyé', description: `SMS envoyé${s?.to ? ` à ${s.to}` : ''}` });
                            } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                          }}
                          title="Envoyer par SMS (Termii)"
                        >
                          <SmsIcon className="w-3.5 h-3.5" />
                        </Button>
                        {/* ⭐ 2026-09-16 — WhatsApp RÉACTIVÉ (demande promoteur) : dropdown
                            avec 2 options (lien wa.me + envoi API auto), même pattern que
                            StudentAccountsContent. Complémentaire de Helm Connect ci-dessous. */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => setWhatsappMenuId(whatsappMenuId === t.id ? null : t.id)}
                            title="Envoyer par WhatsApp"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </Button>
                          {whatsappMenuId === t.id && (
                            <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-full sm:w-[180px]">
                              <button
                                className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
                                onClick={async () => {
                                  setWhatsappMenuId(null);
                                  try {
                                    const data = await financeService.getWhatsAppLink(t.id);
                                    if (data?.url) {
                                      window.open(data.url, '_blank');
                                      toast({ title: 'WhatsApp ouvert', description: 'Cliquez sur Envoyer dans WhatsApp.' });
                                    } else {
                                      toast({ title: 'Pas de téléphone', description: 'Aucun numéro de parent trouvé.', variant: 'destructive' });
                                    }
                                  } catch (e: any) {
                                    toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                                  }
                                }}
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                                Envoi rapide (lien)
                              </button>
                              <button
                                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center gap-2"
                                onClick={async () => {
                                  setWhatsappMenuId(null);
                                  try {
                                    const r = await financeService.resendReceipt(t.id, ['whatsapp']);
                                    const s = r?.channels?.whatsapp;
                                    if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' });
                                    else if (s?.status === 'failed') toast({ title: 'Échec d\'envoi', description: s.error || 'Échec de l\'envoi', variant: 'destructive' });
                                    else toast({ title: 'Reçu envoyé', description: `WhatsApp envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                  } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                                }}
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5 opacity-60" />
                                Envoi auto (API)
                              </button>
                            </div>
                          )}
                        </div>
                        {/* ⭐ Helm Connect button — REPLACES the SMS button
                              Sends the receipt PDF + the same WhatsApp template wording
                              directly to the parent's Helm Connect chat account. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
                          onClick={async () => {
                            try {
                              const r = await financeService.resendReceipt(t.id, ['helm_connect']);
                              const s = r?.channels?.helm_connect;
                              if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.error || 'Aucun parent lié à cet élève', variant: 'destructive' });
                              else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                              else toast({ title: 'Reçu envoyé', description: `Helm Connect envoyé au parent${s?.to ? ` (conv ${s.to.substring(0, 8)}...)` : ''}` });
                            } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                          }}
                          title="Envoyer par Helm Connect"
                        >
                          <HelmConnectIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* ⭐ Pagination serveur — pattern identique à StudentMovementsContent.tsx */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              Affichage <strong className="text-slate-700">
                {totalTransactions > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalTransactions)}` : '0'}
              </strong> sur <strong className="text-slate-700">{totalTransactions}</strong> transaction(s)
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Précédent
              </button>
              <div className="flex items-center gap-0.5">
                {(() => {
                  const pages: (number | 'ellipsis')[] = [];
                  const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
                  add(1);
                  if (currentPage - 1 > 2) pages.push('ellipsis');
                  for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) add(p);
                  if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
                  if (totalPages > 1) add(totalPages);
                  return pages.map((p, i) => {
                    if (p === 'ellipsis') {
                      return (
                        <span key={`e-${i}`} className="px-2 text-slate-400">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </span>
                      );
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        disabled={loading}
                        className={cn(
                          'min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50',
                          p === currentPage
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                        )}
                      >
                        {p}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Suivant
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Section Ventes Boutique — lien Boutique ↔ Finance */}
        {academicYear?.id && (
          <div className="mt-4">
            <ShopSalesSection
              academicYearId={academicYear.id}
              refreshTrigger={modalRefreshTrigger}
              onGoToShop={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/app/shop';
                }
              }}
            />
          </div>
        )}
      </ModuleContentArea>
      {modalOpen && (
        <NewPaymentModal
          academicYearId={academicYear?.id ?? ''}
          accounts={accounts}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
          refreshTrigger={modalRefreshTrigger}
        />
      )}

      {/* ⭐ Modal DÉDIÉ — encaissement des frais généraux uniquement (flux
          séparé du paiement standard, exigence sept. 2026). Après succès :
          bascule sur le sous-onglet « Frais généraux » + déduction auto. */}
      {generalModalOpen && (
        <GeneralFeePaymentModal
          academicYearId={academicYear?.id ?? ''}
          accounts={accounts}
          onClose={() => setGeneralModalOpen(false)}
          onSuccess={handleGeneralSuccess}
          refreshTrigger={modalRefreshTrigger}
        />
      )}

      {/* Modal de visualisation du reçu PDF ou du rapport PDF */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => {
            if (previewDoc.filePath.startsWith('blob:')) URL.revokeObjectURL(previewDoc.filePath);
            setPreviewDoc(null);
          }}
        />
      )}
    </div>
  );
}
