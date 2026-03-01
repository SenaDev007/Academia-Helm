'use client';

import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import NewPaymentModal from './NewPaymentModal';

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
};

export default function TransactionsContent() {
  const { academicYear } = useModuleContext();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const loadTransactions = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/transactions?academicYearId=${academicYear.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      }
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
    fetch(`/api/finance/student-accounts?academicYearId=${academicYear.id}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAccounts(Array.isArray(d) ? d : []));
  }, [academicYear?.id]);

  const formatXOF = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({ id: t.id, label: t.label, path: t.path, icon: <t.icon className="w-4 h-4" /> }));

  const handleSuccess = () => {
    setModalOpen(false);
    loadTransactions();
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Encaissements"
        description="Paiements avec reçu AH-YYYY-NNNNNN et imputation prioritaire."
        icon="finance"
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau paiement
          </Button>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">Chargement...</TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">Aucune transaction.</TableCell>
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
                  <TableCell>{formatXOF(Number(t.amount))}</TableCell>
                  <TableCell>{METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'REVERSAL' ? 'destructive' : 'default'}>{t.type}</Badge>
                  </TableCell>
                  <TableCell>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—'}</TableCell>
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
    </div>
  );
}
