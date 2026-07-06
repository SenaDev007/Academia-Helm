'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, Smartphone, Calendar, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { WhatsAppIcon, GmailIcon, SmsIcon } from './OfficialIcons';
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

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEEXPAY: 'FeexPay',
};

export default function TransactionsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { tenant } = useAppSession();
  const [whatsappMenuId, setWhatsappMenuId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  // Filtre par période
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  const loadTransactions = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getTransactions({ academicYearId: academicYear.id });
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [academicYear?.id]);

  useEffect(() => {
    if (!academicYear?.id) return;
    financeService.getStudentAccounts({ academicYearId: academicYear.id })
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]));
  }, [academicYear?.id]);

  const handleSuccess = () => {
    // Recharger les transactions sans fermer le modal
    // (le modal affiche le reçu, l'utilisateur le fermera manuellement)
    loadTransactions();
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
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null}>
                {exporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                )}
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
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
                      <Badge variant="outline">{METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}</Badge>
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
                        {/* WhatsApp : dropdown avec 2 options */}
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
                            <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]">
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
                                  } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
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
                                    else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                          onClick={async () => {
                            try {
                              const r = await financeService.resendReceipt(t.id, ['sms']);
                              const s = r?.channels?.sms;
                              if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' }); else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                              else toast({ title: 'Reçu envoyé', description: `SMS envoyé${s?.to ? ` à ${s.to}` : ''}` });
                            } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                          }}
                          title="Envoyer par SMS"
                        >
                          <SmsIcon className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ModuleContentArea>
      {modalOpen && (
        <NewPaymentModal
          academicYearId={academicYear?.id ?? ''}
          accounts={accounts}
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
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
