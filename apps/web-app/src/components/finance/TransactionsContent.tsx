'use client';

import { useState, useEffect } from 'react';
import { Plus, Smartphone } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import NewPaymentModal from './NewPaymentModal';
import { SchoolFeePaymentDialog } from './SchoolFeePaymentDialog';
import { financeService } from '@/services/finance.service';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';
import { formatCurrency } from '@/lib/utils';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEEXPAY: 'FeexPay',
};

export default function TransactionsContent() {
  const { academicYear, tenantId } = useModuleContext();
  const syncStatuses = useEntitySyncStatusBatch('PAYMENT', tenantId ?? undefined);
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

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({ id: t.id, label: t.label, path: t.path, icon: <t.icon className="w-4 h-4" /> }));

  const handleSuccess = () => {
    setModalOpen(false);
    loadTransactions();
  };

  const handleOnlineSuccess = () => {
    setOnlineModalOpen(false);
    loadTransactions();
  };

  // Build student list from accounts for the online payment dialog
  const studentList = accounts
    .filter((a) => a.student)
    .map((a) => ({
      id: a.studentId,
      name: `${a.student.lastName} ${a.student.firstName}`,
      schoolLevelId: a.student.schoolLevelId,
    }));

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Encaissements"
        description="Paiements avec reçu AH-YYYY-NNNNNN et imputation prioritaire."
        icon="finance"
        actions={
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
        }
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/payments" />
      <ModuleContentArea layout="custom">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reçu</TableHead>
              <TableHead>Élève</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Sync</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">Chargement...</TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">Aucune transaction.</TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-sm">{t.receiptNumber}</TableCell>
                  <TableCell>
                    {t.studentAccount?.student
                      ? `${t.studentAccount.student.lastName} ${t.studentAccount.student.firstName}`
                      : '—'}
                  </TableCell>
                  <TableCell>{formatCurrency(t.amount)}</TableCell>
                  <TableCell>{METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'REVERSAL' ? 'destructive' : 'default'}>{t.type}</Badge>
                  </TableCell>
                  <TableCell>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—'}</TableCell>
                  <TableCell className="text-center">
                    <EntitySyncIndicator variant="dot" status={syncStatuses[t.id] ?? 'UNKNOWN'} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
        <SchoolFeePaymentDialog
          isOpen={onlineModalOpen}
          onClose={() => setOnlineModalOpen(false)}
          onSuccess={handleOnlineSuccess}
          students={studentList}
          academicYearId={academicYear?.id}
        />
      )}
    </div>
  );
}
