/**
 * ============================================================================
 * MODULE 4 - DÉPENSES
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Eye, CheckCircle, XCircle, Filter } from 'lucide-react';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModal } from '@/hooks/useModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';

export default function ExpensesPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { openFormModal, openConfirmModal, openReadOnlyModal, closeModal } = useModal();
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Charger depuis l'API
    setExpenses([
      { id: '1', category: 'Fournitures', description: 'Achat de fournitures scolaires', amount: 250000, date: '2024-11-15', status: 'approved', createdBy: 'Admin' },
      { id: '2', category: 'Maintenance', description: 'Réparation équipements', amount: 150000, date: '2024-11-14', status: 'pending', createdBy: 'Admin' },
      { id: '3', category: 'Services', description: 'Prestation de service', amount: 100000, date: '2024-11-13', status: 'approved', createdBy: 'Admin' },
    ]);
  }, []);

  const handleCreateExpense = (data: any) => {
    console.log('Creating expense:', data);
    setExpenses([...expenses, { id: String(expenses.length + 1), status: 'pending', createdBy: 'Moi', ...data }]);
    closeModal();
  };

  const handleApproveExpense = (id: string) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, status: 'approved' } : e));
    closeModal();
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      approved: { variant: 'default' as const, label: 'Approuvé' },
      pending: { variant: 'outline' as const, label: 'En attente' },
      rejected: { variant: 'destructive' as const, label: 'Rejeté' },
    };
    const config = variants[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Dépenses"
        description="Gérez les dépenses de l'établissement et leur processus d'approbation."
        icon="finance"
        kpis={[
          { label: 'Dépenses du mois', value: '1 890 000', unit: 'XOF' },
          { label: 'En attente', value: '5', unit: '' },
          { label: 'Approuvées', value: '23', unit: '' },
        ]}
        actions={[
          {
            label: 'Nouvelle dépense',
            onClick: () => openFormModal({
              title: 'Enregistrer une dépense',
              size: 'lg',
              children: (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateExpense({ category: (e.target as any).category.value, description: (e.target as any).description.value, amount: parseFloat((e.target as any).amount.value), date: (e.target as any).date.value, method: (e.target as any).method.value }); }}>
                  <Select name="category" defaultValue="Fournitures">
                    <SelectTrigger className="mb-2">
                      <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fournitures">Fournitures</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Services">Services</SelectItem>
                      <SelectItem value="Autres">Autres</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input name="description" placeholder="Description" required className="mb-2" />
                  <Input name="amount" type="number" placeholder="Montant (XOF)" required className="mb-2" />
                  <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="mb-2" />
                  <Select name="method" defaultValue="CASH">
                    <SelectTrigger className="mb-4">
                      <SelectValue placeholder="Moyen de paiement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Espèces</SelectItem>
                      <SelectItem value="TRANSFER">Virement</SelectItem>
                      <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit">Enregistrer</Button>
                </form>
              ),
            }),
            primary: true,
          },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/expenses" />

      <ModuleContentArea
        layout="table"
        filters={
          <div className="flex space-x-2">
            <Input placeholder="Rechercher une dépense..." className="max-w-sm" />
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvées</SelectItem>
                <SelectItem value="rejected">Rejetées</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="Fournitures">Fournitures</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Services">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Créé par</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{new Date(expense.date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell>{expense.amount.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell>{expense.createdBy}</TableCell>
                <TableCell>{getStatusBadge(expense.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                    title: `Dépense: ${expense.description}`,
                    children: (
                      <div className="grid grid-cols-2 gap-4">
                        <div><strong>Catégorie:</strong> {expense.category}</div>
                        <div><strong>Date:</strong> {new Date(expense.date).toLocaleDateString('fr-FR')}</div>
                        <div><strong>Montant:</strong> {expense.amount.toLocaleString('fr-FR')} XOF</div>
                        <div><strong>Statut:</strong> {expense.status}</div>
                        <div className="col-span-2"><strong>Description:</strong> {expense.description}</div>
                      </div>
                    ),
                  })}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {expense.status === 'pending' && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openConfirmModal({
                        title: 'Approuver la dépense',
                        message: `Êtes-vous sûr de vouloir approuver cette dépense de ${expense.amount.toLocaleString('fr-FR')} XOF ?`,
                        onConfirm: () => handleApproveExpense(expense.id),
                        type: 'success',
                      })}>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openConfirmModal({
                        title: 'Rejeter la dépense',
                        message: `Êtes-vous sûr de vouloir rejeter cette dépense ?`,
                        onConfirm: () => { setExpenses(expenses.map(e => e.id === expense.id ? { ...e, status: 'rejected' } : e)); closeModal(); },
                        type: 'danger',
                      })}>
                        <XCircle className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
  );
}

