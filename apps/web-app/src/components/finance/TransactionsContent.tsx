'use client';

import { useState, useEffect } from 'react';
import { Plus, Download, Eye, Smartphone } from 'lucide-react';
import { WhatsAppIcon, GmailIcon, SmsIcon } from './OfficialIcons';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import NewPaymentModal from './NewPaymentModal';
import { SchoolFeePaymentDialog } from './SchoolFeePaymentDialog';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
};

export default function TransactionsContent() {
  const { academicYear } = useModuleContext();
  const [whatsappMenuId, setWhatsappMenuId] = useState<string | null>(null);
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [onlineModalOpen, setOnlineModalOpen] = useState(false);

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
    setModalOpen(false);
    loadTransactions();
  };

  const handleOnlineSuccess = () => {
    setOnlineModalOpen(false);
    loadTransactions();
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
          <div className="flex items-center justify-between">
            <div></div>
            <div className="flex gap-2">
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau paiement
              </Button>
              <Button variant="outline" onClick={() => setOnlineModalOpen(true)}>
                <Smartphone className="w-4 h-4 mr-2" />
                Encaisser en ligne
              </Button>
            </div>
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
                transactions.map((t) => (
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
                          onClick={() => window.open(financeService.getReceiptPdfUrl(t.id), '_blank')}
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
      {onlineModalOpen && (
        <NewPaymentModal
          academicYearId={academicYear?.id ?? ''}
          accounts={accounts}
          onClose={() => setOnlineModalOpen(false)}
          onSuccess={handleSuccess}
          defaultPaymentMethod="FEEXPAY"
        />
      )}
    </div>
  );
}
