/**
 * ============================================================================
 * MODULE 4 - RECOUVREMENT
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell, Handshake, Phone, Mail, MessageSquare, Plus, Eye } from 'lucide-react';
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

export default function CollectionPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { openFormModal, openConfirmModal, openReadOnlyModal, closeModal } = useModal();
  const [arrears, setArrears] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Charger depuis l'API
    setArrears([
      { id: '1', student: 'Jean Dupont', fee: 'Scolarité Primaire', totalDue: 150000, totalPaid: 0, balanceDue: 150000, level: 'CRITICAL', lastPaymentDate: null },
      { id: '2', student: 'Marie Curie', fee: 'Scolarité Secondaire', totalDue: 200000, totalPaid: 50000, balanceDue: 150000, level: 'HIGH', lastPaymentDate: '2024-10-15' },
      { id: '3', student: 'Pierre Martin', fee: 'Inscription', totalDue: 50000, totalPaid: 0, balanceDue: 50000, level: 'MEDIUM', lastPaymentDate: null },
    ]);
  }, []);

  const handleSendReminder = (arrearId: string) => {
    console.log('Sending reminder for arrear:', arrearId);
    closeModal();
  };

  const handleCreatePromise = (arrearId: string) => {
    openFormModal({
      title: 'Enregistrer une promesse de paiement',
      children: (
        <form onSubmit={(e) => { e.preventDefault(); console.log('Creating promise:', { arrearId, amount: (e.target as any).amount.value, date: (e.target as any).date.value }); closeModal(); }}>
          <Input name="amount" type="number" placeholder="Montant promis (XOF)" required className="mb-2" />
          <Input name="date" type="date" required className="mb-4" />
          <Button type="submit">Enregistrer</Button>
        </form>
      ),
    });
  };

  const handleCreateAction = (arrearId: string) => {
    openFormModal({
      title: 'Enregistrer une action de recouvrement',
      children: (
        <form onSubmit={(e) => { e.preventDefault(); console.log('Creating action:', { arrearId, type: (e.target as any).type.value, notes: (e.target as any).notes.value }); closeModal(); }}>
          <Select name="type" defaultValue="CALL">
            <SelectTrigger className="mb-2">
              <SelectValue placeholder="Type d'action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CALL">Appel téléphonique</SelectItem>
              <SelectItem value="MEETING">Convocation parent</SelectItem>
              <SelectItem value="SUSPENSION">Suspension administrative</SelectItem>
              <SelectItem value="OTHER">Autre</SelectItem>
            </SelectContent>
          </Select>
          <Input name="notes" placeholder="Notes" className="mb-4" />
          <Button type="submit">Enregistrer</Button>
        </form>
      ),
    });
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const getLevelBadge = (level: string) => {
    const configs: Record<string, { variant: any; label: string; color: string }> = {
      CRITICAL: { variant: 'destructive' as const, label: 'Critique', color: 'red' },
      HIGH: { variant: 'default' as const, label: 'Élevé', color: 'orange' },
      MEDIUM: { variant: 'outline' as const, label: 'Moyen', color: 'yellow' },
      LOW: { variant: 'outline' as const, label: 'Faible', color: 'green' },
    };
    const config = configs[level] || { variant: 'outline' as const, label: level, color: 'gray' };
    return <Badge variant={config.variant} style={{ backgroundColor: config.color === 'red' ? '#dc2626' : config.color === 'orange' ? '#ea580c' : undefined }}>{config.label}</Badge>;
  };

  const criticalCount = arrears.filter(a => a.level === 'CRITICAL').length;
  const totalBalanceDue = arrears.reduce((sum, a) => sum + a.balanceDue, 0);

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Recouvrement"
        description="Identifiez, priorisez et recouvrez les impayés efficacement."
        icon="finance"
        kpis={[
          { label: 'Impayés critiques', value: String(criticalCount), unit: '' },
          { label: 'Montant total dû', value: totalBalanceDue.toLocaleString('fr-FR'), unit: 'XOF' },
          { label: 'Taux de recouvrement', value: '87%', unit: '' },
        ]}
        actions={[
          {
            label: 'Détecter les impayés',
            onClick: () => {
              console.log('Detecting arrears...');
              // TODO: Appel API
            },
            primary: true,
          },
        ]}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/collection" />

      <ModuleContentArea
        layout="table"
        filters={
          <div className="flex space-x-2">
            <Input placeholder="Rechercher un impayé..." className="max-w-sm" />
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Niveau de gravité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Type de frais</TableHead>
              <TableHead>Montant dû</TableHead>
              <TableHead>Montant payé</TableHead>
              <TableHead>Reste à payer</TableHead>
              <TableHead>Dernier paiement</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrears.map((arrear) => (
              <TableRow key={arrear.id}>
                <TableCell className="font-medium">{arrear.student}</TableCell>
                <TableCell>{arrear.fee}</TableCell>
                <TableCell>{arrear.totalDue.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell>{arrear.totalPaid.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell className="font-semibold text-red-600">{arrear.balanceDue.toLocaleString('fr-FR')} XOF</TableCell>
                <TableCell>{arrear.lastPaymentDate ? new Date(arrear.lastPaymentDate).toLocaleDateString('fr-FR') : 'Jamais'}</TableCell>
                <TableCell>{getLevelBadge(arrear.level)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleSendReminder(arrear.id)} title="Envoyer un rappel">
                      <Bell className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleCreatePromise(arrear.id)} title="Enregistrer une promesse">
                      <Handshake className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleCreateAction(arrear.id)} title="Action de recouvrement">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openReadOnlyModal({
                      title: `Impayé: ${arrear.student}`,
                      children: (
                        <div className="grid grid-cols-2 gap-4">
                          <div><strong>Élève:</strong> {arrear.student}</div>
                          <div><strong>Type de frais:</strong> {arrear.fee}</div>
                          <div><strong>Montant dû:</strong> {arrear.totalDue.toLocaleString('fr-FR')} XOF</div>
                          <div><strong>Montant payé:</strong> {arrear.totalPaid.toLocaleString('fr-FR')} XOF</div>
                          <div><strong>Reste à payer:</strong> {arrear.balanceDue.toLocaleString('fr-FR')} XOF</div>
                          <div><strong>Niveau:</strong> {arrear.level}</div>
                          <div><strong>Dernier paiement:</strong> {arrear.lastPaymentDate ? new Date(arrear.lastPaymentDate).toLocaleDateString('fr-FR') : 'Jamais'}</div>
                        </div>
                      ),
                    })}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
  );
}

