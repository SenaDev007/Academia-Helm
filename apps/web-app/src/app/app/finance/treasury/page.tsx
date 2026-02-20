/**
 * ============================================================================
 * MODULE 4 - TRÉSORERIE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, CheckCircle, Eye, BarChart2 } from 'lucide-react';
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

export default function TreasuryPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { openFormModal, openConfirmModal, openReadOnlyModal, closeModal } = useModal();
  const [closures, setClosures] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Charger depuis l'API
    setClosures([
      { id: '1', date: '2024-11-15', openingBalance: 500000, totalCollected: 450000, totalSpent: 200000, closingBalance: 750000, validated: true },
      { id: '2', date: '2024-11-14', openingBalance: 300000, totalCollected: 600000, totalSpent: 150000, closingBalance: 750000, validated: true },
      { id: '3', date: '2024-11-13', openingBalance: 250000, totalCollected: 500000, totalSpent: 450000, closingBalance: 300000, validated: false },
    ]);
  }, []);

  const handleCreateClosure = (data: any) => {
    console.log('Creating closure:', data);
    const openingBalance = parseFloat(data.openingBalance);
    const totalCollected = parseFloat(data.totalCollected);
    const totalSpent = parseFloat(data.totalSpent);
    const closingBalance = openingBalance + totalCollected - totalSpent;
    setClosures([...closures, { id: String(closures.length + 1), validated: false, closingBalance, ...data }]);
    closeModal();
  };

  const handleValidateClosure = (id: string) => {
    setClosures(closures.map(c => c.id === id ? { ...c, validated: true } : c));
    closeModal();
  };

  const subModuleTabs = [
    { id: 'fees', label: 'Configuration des frais', path: '/app/finance/fees' },
    { id: 'payments', label: 'Paiements', path: '/app/finance/payments' },
    { id: 'expenses', label: 'Dépenses', path: '/app/finance/expenses' },
    { id: 'treasury', label: 'Trésorerie', path: '/app/finance/treasury' },
    { id: 'collection', label: 'Recouvrement', path: '/app/finance/collection' },
  ];

  const totalCollected = closures.reduce((sum, c) => sum + c.totalCollected, 0);
  const totalSpent = closures.reduce((sum, c) => sum + c.totalSpent, 0);
  const netCashFlow = totalCollected - totalSpent;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Trésorerie"
        description="Suivez la trésorerie et effectuez les clôtures journalières."
        icon="finance"
        kpis={[
          { label: 'Solde actuel', value: closures[0]?.closingBalance?.toLocaleString('fr-FR') || '0', unit: 'XOF' },
          { label: 'Recettes 30j', value: totalCollected.toLocaleString('fr-FR'), unit: 'XOF' },
          { label: 'Dépenses 30j', value: totalSpent.toLocaleString('fr-FR'), unit: 'XOF' },
          { label: 'Flux net', value: netCashFlow.toLocaleString('fr-FR'), unit: 'XOF', color: netCashFlow >= 0 ? 'green' : 'red' },
        ]}
        actions={[
          {
            label: 'Nouvelle clôture',
            onClick: () => openFormModal({
              title: 'Créer une clôture journalière',
              size: 'lg',
              children: (
                <form onSubmit={(e) => { e.preventDefault(); handleCreateClosure({ date: (e.target as any).date.value, openingBalance: (e.target as any).openingBalance.value, totalCollected: (e.target as any).totalCollected.value, totalSpent: (e.target as any).totalSpent.value }); }}>
                  <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required className="mb-2" />
                  <Input name="openingBalance" type="number" placeholder="Solde d'ouverture (XOF)" required className="mb-2" />
                  <Input name="totalCollected" type="number" placeholder="Total encaissé (XOF)" required className="mb-2" />
                  <Input name="totalSpent" type="number" placeholder="Total dépensé (XOF)" required className="mb-4" />
                  <Button type="submit">Créer</Button>
                </form>
              ),
            }),
            primary: true,
          },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/treasury" />

      <ModuleContentArea
        layout="table"
        filters={
          <div className="flex space-x-2">
            <Input placeholder="Rechercher une clôture..." className="max-w-sm" />
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="validated">Validées</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="quarter">Ce trimestre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        toolbar={
          <Button variant="outline">
            <BarChart2 className="mr-2 h-4 w-4" /> Statistiques
          </Button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Solde d'ouverture</TableHead>
              <TableHead>Encaissé</TableHead>
              <TableHead>Dépensé</TableHead>
              <TableHead>Solde de clôture</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => (
              <TableRow key={closure.id}>
                <TableCell>{new Date(closure.date).toLocaleDateString('fr-FR')}</TableCell>
                <TableCell>{closure.openingBalance.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell className="text-green-600 font-medium">+{closure.totalCollected.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell className="text-red-600 font-medium">-{closure.totalSpent.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell className="font-semibold">{closure.closingBalance.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell>
                  <Badge variant={closure.validated ? 'default' : 'outline'}>
                    {closure.validated ? 'Validée' : 'En attente'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                    title: `Clôture du ${new Date(closure.date).toLocaleDateString('fr-FR')}`,
                    children: (
                      <div className="grid grid-cols-2 gap-4">
                        <div><strong>Date:</strong> {new Date(closure.date).toLocaleDateString('fr-FR')}</div>
                        <div><strong>Statut:</strong> {closure.validated ? 'Validée' : 'En attente'}</div>
                        <div><strong>Solde d'ouverture:</strong> {closure.openingBalance.toLocaleString('fr-FR')} XOF</div>
                        <div><strong>Total encaissé:</strong> {closure.totalCollected.toLocaleString('fr-FR')} XOF</div>
                        <div><strong>Total dépensé:</strong> {closure.totalSpent.toLocaleString('fr-FR')} XOF</div>
                        <div><strong>Solde de clôture:</strong> {closure.closingBalance.toLocaleString('fr-FR')} XOF</div>
                      </div>
                    ),
                  })}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {!closure.validated && (
                    <Button variant="ghost" size="icon" onClick={() => openConfirmModal({
                      title: 'Valider la clôture',
                      message: `Êtes-vous sûr de vouloir valider la clôture du ${new Date(closure.date).toLocaleDateString('fr-FR')} ?`,
                      onConfirm: () => handleValidateClosure(closure.id),
                      type: 'success',
                    })}>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
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

