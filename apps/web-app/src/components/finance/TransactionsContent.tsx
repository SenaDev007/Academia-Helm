'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Smartphone, Calendar, FileSpreadsheet, FileText, Loader2, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppIcon, GmailIcon, HelmConnectIcon } from './OfficialIcons';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import NewPaymentModal from './NewPaymentModal';
import { SchoolFeePaymentDialog } from './SchoolFeePaymentDialog';
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
  // ⭐ whatsappMenuId state removed — WhatsApp dropdown is no longer rendered (button is grayed out)
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
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
  }, [academicYear?.id, currentPage]);

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
    loadTransactions();
    reloadAccounts();
    setModalRefreshTrigger((n) => n + 1);
  };

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
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau paiement
            </Button>
          </div>
        }
      >
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">Chargement...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                    Aucune transaction enregistrée.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50">
                    <TableCell className="font-mono text-xs">{t.receiptNumber}</TableCell>
                    <TableCell className="font-medium">
                      {t.studentAccount?.student
                        ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(t.amount)}</TableCell>
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
                          onClick={async () => {
                            try {
                              const res = await fetch(financeService.getReceiptPdfUrl(t.id));
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              setPreviewDoc({ filePath: url, fileName: `recu-${t.receiptNumber || t.id}.pdf`, mimeType: 'application/pdf' });
                            } catch (e: any) {
                              toast({ title: 'Erreur', description: 'Impossible de charger le reçu', variant: 'destructive' });
                            }
                          }}
                          title="Visualiser le reçu"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
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
                        {/* ⭐ WhatsApp button — GRAYED OUT (replaced by Yeshua Connect below)
                              Per user request: "Tu vas masquer le bouton WhatsApp qui est là
                              pour le moment, tu vas le masquer ou bien il faut le griser." */}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-7 w-7 opacity-30 cursor-not-allowed"
                          title="WhatsApp désactivé — utilisez Yeshua Connect"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 grayscale" />
                        </Button>
                        {/* ⭐ Yeshua Connect button — REPLACES the SMS button
                              Sends the receipt PDF + the same WhatsApp template wording
                              directly to the parent's Yeshua Connect chat account. */}
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
                              else toast({ title: 'Reçu envoyé', description: `Yeshua Connect envoyé au parent${s?.to ? ` (conv ${s.to.substring(0, 8)}...)` : ''}` });
                            } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                          }}
                          title="Envoyer par Yeshua Connect"
                        >
                          <HelmConnectIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
