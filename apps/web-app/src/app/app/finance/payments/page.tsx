/**
 * ============================================================================
 * MODULE 4 - PAIEMENTS
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, Download, Filter } from 'lucide-react';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
  FormModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModal } from '@/hooks/useModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function PaymentsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { openFormModal, openReadOnlyModal, closeModal } = useModal();
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Charger depuis l'API
    setPayments([
      { id: '1', student: 'Jean Dupont', amount: 150000, method: 'CASH', date: '2024-11-15', receiptNumber: 'REC-2024-000001', status: 'completed' },
      { id: '2', student: 'Marie Curie', amount: 200000, method: 'MOBILE_MONEY', date: '2024-11-14', receiptNumber: 'REC-2024-000002', status: 'completed' },
      { id: '3', student: 'Pierre Martin', amount: 50000, method: 'TRANSFER', date: '2024-11-13', receiptNumber: 'REC-2024-000003', status: 'completed' },
    ]);
  }, []);

  const handleCreatePayment = (data: any) => {
    console.log('Creating payment:', data);
    setPayments([...payments, { id: String(payments.length + 1), status: 'completed', receiptNumber: `REC-2024-${String(payments.length + 1).padStart(6, '0')}`, ...data }]);
    closeModal();
  };

  const subModuleTabs = [
    { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees' },
    { id: 'payments', label: 'Paiements', path: '/app/finance/payments' },
    { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses' },
    { id: 'treasury', label: 'Trésorerie', path: '/app/finance/treasury' },
    { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection' },
  ];

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      CASH: 'Espèces',
      TRANSFER: 'Virement',
      MOBILE_MONEY: 'Mobile Money',
      CHEQUE: 'Chèque',
    };
    return labels[method] || method;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Paiements"
        description="Enregistrez et suivez tous les paiements des élèves."
        icon="payments"
        kpis={[
          { label: 'Paiements aujourd\'hui', value: '12', unit: '' },
          { label: 'Montant total', value: '2 450 000', unit: 'XOF' },
          { label: 'En attente', value: '3', unit: '' },
        ]}
        actions={[
          {
            label: 'Nouveau paiement',
            onClick: () => openFormModal({
              title: 'Enregistrer un paiement',
              size: 'lg',
              children: (
                <form onSubmit={(e) => { e.preventDefault(); handleCreatePayment({ student: (e.target as any).student.value, amount: parseFloat((e.target as any).amount.value), method: (e.target as any).method.value, date: (e.target as any).date.value }); }}>
                  <Input name="student" placeholder="Nom de l'élève" required className="mb-2" />
                  <Input name="amount" type="number" placeholder="Montant (XOF)" required className="mb-2" />
                  <Select name="method" defaultValue="CASH">
                    <SelectTrigger className="mb-2">
                      <SelectValue placeholder="Moyen de paiement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Espèces</SelectItem>
                      <SelectItem value="TRANSFER">Virement</SelectItem>
                      <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                      <SelectItem value="CHEQUE">Chèque</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="mb-4" />
                  <Button type="submit">Enregistrer</Button>
                </form>
              ),
            }),
            primary: true,
          },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/payments" />

      <ModuleContentArea
        layout="table"
        filters={
          <div className="flex space-x-2">
            <Input placeholder="Rechercher un paiement..." className="max-w-sm" />
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Moyen de paiement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="cash">Espèces</SelectItem>
                <SelectItem value="transfer">Virement</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        toolbar={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Exporter
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Élève</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Moyen</TableHead>
              <TableHead>N° Reçu</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{new Date(payment.date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell className="font-medium">{payment.student}</TableCell>
                <TableCell>{payment.amount.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell>{getMethodLabel(payment.method)}</TableCell>
                <TableCell className="font-mono text-sm">{payment.receiptNumber}</TableCell>
                <TableCell>
                  <Badge variant={payment.status === 'completed' ? 'default' : 'outline'}>
                    {payment.status === 'completed' ? 'Complété' : payment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                    title: `Paiement: ${payment.receiptNumber}`,
                    children: (
                      <div className="grid grid-cols-2 gap-4">
                        <div><strong>Élève:</strong> {payment.student}</div>
                        <div><strong>Date:</strong> {new Date(payment.date).toLocaleDateString('fr-FR')}</div>
                        <div><strong>Montant:</strong> {payment.amount.toLocaleString('fr-FR')} XOF</div>
                        <div><strong>Moyen:</strong> {getMethodLabel(payment.method)}</div>
                        <div><strong>N° Reçu:</strong> {payment.receiptNumber}</div>
                        <div><strong>Statut:</strong> {payment.status}</div>
                      </div>
                    ),
                    actions: [
                      { label: 'Télécharger le reçu', onClick: () => console.log('Download receipt') },
                    ],
                  })}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => console.log('Download receipt')}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
  );
}

