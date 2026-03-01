'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, Unlock } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-orange-100 text-orange-800',
  BLOCKED: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export default function StudentAccountsContent() {
  const { academicYear } = useModuleContext();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailAccount, setDetailAccount] = useState<any | null>(null);
  const [unblockReason, setUnblockReason] = useState('');
  const [unblockModal, setUnblockModal] = useState<string | null>(null);

  const loadAccounts = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (filterClassId) params.set('classId', filterClassId);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/finance/student-accounts?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [academicYear?.id, filterClassId, filterStatus]);

  useEffect(() => {
    fetch('/api/classes', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClasses(Array.isArray(d) ? d : []));
  }, []);

  const loadDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/finance/student-accounts/${id}`, { credentials: 'include' });
      if (res.ok) setDetailAccount(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnblock = async () => {
    if (!unblockModal || !unblockReason.trim()) return;
    try {
      const res = await fetch(`/api/finance/student-accounts/${unblockModal}/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: unblockReason }),
      });
      if (res.ok) {
        setUnblockModal(null);
        setUnblockReason('');
        loadAccounts();
        if (detailAccount?.id === unblockModal) loadDetail(unblockModal);
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    }
  };

  const formatXOF = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  return (
    <div className="space-y-6">
      <ModuleHeader title="Comptes élèves" description="Solde, total dû, payé et statut par élève et par année." icon="finance" />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/accounts" />
      <ModuleContentArea layout="custom">
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <span className="text-sm text-gray-600">Année : {academicYear?.label ?? '—'}</span>
          <Select value={filterClassId} onValueChange={setFilterClassId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtre Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtre Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="PAID">Payé</SelectItem>
              <SelectItem value="PARTIAL">Partiel</SelectItem>
              <SelectItem value="OVERDUE">En retard</SelectItem>
              <SelectItem value="BLOCKED">Bloqué</SelectItem>
              <SelectItem value="ACTIVE">Actif</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élève</TableHead>
              <TableHead>Total dû</TableHead>
              <TableHead>Payé</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">Chargement...</TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500">Aucun compte.</TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                  </TableCell>
                  <TableCell>{formatXOF(Number(a.totalDue))}</TableCell>
                  <TableCell>{formatXOF(Number(a.totalPaid))}</TableCell>
                  <TableCell>{formatXOF(Number(a.balance))}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-800'}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => loadDetail(a.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {a.isBlocked && (
                      <Button variant="ghost" size="icon" onClick={() => setUnblockModal(a.id)}>
                        <Unlock className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>
      {detailAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {detailAccount.student ? `${detailAccount.student.lastName} ${detailAccount.student.firstName}` : 'Détail compte'}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><span className="text-gray-600">Total dû :</span> {formatXOF(Number(detailAccount.totalDue))}</div>
              <div><span className="text-gray-600">Total payé :</span> {formatXOF(Number(detailAccount.totalPaid))}</div>
              <div><span className="text-gray-600">Solde :</span> {formatXOF(Number(detailAccount.balance))}</div>
              <div><span className="text-gray-600">Statut :</span> <Badge className={STATUS_COLORS[detailAccount.status]}>{detailAccount.status}</Badge></div>
              {Number(detailAccount.arrearsAmount) > 0 && (
                <div className="col-span-2"><span className="text-gray-600">Arriérés (année précédente) :</span> {formatXOF(Number(detailAccount.arrearsAmount))}</div>
              )}
            </div>
            <h4 className="font-medium mb-2">Détail par frais</h4>
            <ul className="space-y-2">
              {Number(detailAccount.arrearsAmount) > 0 && (
                <li className="flex justify-between text-sm">
                  <span>Arriéré</span>
                  <span>{formatXOF(Number(detailAccount.arrearsAmount))} — Non payé</span>
                </li>
              )}
              {detailAccount.breakdowns?.map((b: any) => (
                <li key={b.id} className="flex justify-between text-sm">
                  <span>{b.feeStructure?.name ?? b.feeStructureId}</span>
                  <span>{formatXOF(Number(b.initialAmount))} — Soldé: {formatXOF(Number(b.paidAmount))}</span>
                </li>
              ))}
            </ul>
            {detailAccount.transactions?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Dernières transactions</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {detailAccount.transactions.slice(0, 5).map((t: any) => (
                    <li key={t.id}>{t.receiptNumber} — {formatXOF(Number(t.amount))} — {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Button variant="outline" asChild><Link href="/app/finance/payments">Voir historique transactions</Link></Button>
              {(detailAccount.transactions?.find((t: any) => t.receiptUrl)?.receiptUrl) && (
                <Button variant="outline" onClick={() => window.open(detailAccount.transactions.find((t: any) => t.receiptUrl).receiptUrl, '_blank')}>Voir reçu</Button>
              )}
              <Button variant="outline" onClick={() => setDetailAccount(null)}>Fermer</Button>
              {detailAccount.isBlocked && (
                <Button onClick={() => { setUnblockModal(detailAccount.id); setDetailAccount(null); }}>Débloquer</Button>
              )}
            </div>
          </div>
        </div>
      )}
      {unblockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Levée de blocage</h3>
            <p className="text-sm text-gray-600 mb-2">Motif obligatoire (audit) :</p>
            <input
              className="w-full border rounded px-3 py-2 mb-4"
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder="Ex: accord de règlement"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setUnblockModal(null); setUnblockReason(''); }}>Annuler</Button>
              <Button onClick={handleUnblock} disabled={!unblockReason.trim()}>Débloquer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
