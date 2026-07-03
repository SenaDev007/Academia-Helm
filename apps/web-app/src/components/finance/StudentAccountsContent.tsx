'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, Unlock, UserCog } from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { classesService } from '@/services/classes.service';
import { formatCurrency } from '@/lib/utils';
import { filterAndSortClasses } from '@/lib/finance/class-sort';
import { Label } from '@/components/ui/label';

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
  const { toast } = useToast();
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
      const data = await financeService.getStudentAccounts(Object.fromEntries(params.entries()));
      setAccounts(Array.isArray(data) ? data : []);
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
    classesService.getAll({})
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

  const loadDetail = async (id: string) => {
    try {
      const data = await financeService.getStudentAccountDetails(id);
      setDetailAccount(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnblock = async () => {
    if (!unblockModal || !unblockReason.trim()) return;
    try {
      await financeService.unblockStudentAccount(unblockModal, { reason: unblockReason });
      setUnblockModal(null);
      setUnblockReason('');
      toast({ title: 'Compte débloqué', description: 'Le compte a été débloqué avec succès.' });
      loadAccounts();
      if (detailAccount?.id === unblockModal) loadDetail(unblockModal);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <p className="text-sm text-slate-600">
            Solde, total dû, payé et statut par élève et par année.
          </p>
        }
      >
        <div className="mb-4 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filterAndSortClasses(classes).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Statut</Label>
            <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="PAID">Payé</SelectItem>
                <SelectItem value="PARTIAL">Partiel</SelectItem>
                <SelectItem value="OVERDUE">En retard</SelectItem>
                <SelectItem value="BLOCKED">Bloqué</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead className="text-right">Total dû</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">Chargement...</TableCell>
              </TableRow>
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-12">Aucun compte élève.</TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => {
                // Détecter si l'élève a au moins une personnalisation (override)
                // Un breakdown est "personnalisé" si son initialAmount != feeStructure.totalAmount
                const hasOverride = (a.breakdowns ?? []).some((b: any) => {
                  const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
                  const initial = Number(b.initialAmount ?? 0);
                  return Math.abs(fsTotal - initial) > 0.01;
                });
                return (
                <TableRow key={a.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div>
                        {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                      </div>
                      {hasOverride && (
                        <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50" title="Cet élève a une personnalisation de frais">
                          <UserCog className="w-3 h-3 mr-1" />Personnalisé
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(a.totalDue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.totalPaid)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(a.balance)}</TableCell>
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
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </ModuleContentArea>
      {detailAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {detailAccount.student ? `${detailAccount.student.lastName} ${detailAccount.student.firstName}` : 'Détail compte'}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><span className="text-gray-600">Total dû :</span> {formatCurrency(detailAccount.totalDue)}</div>
              <div><span className="text-gray-600">Total payé :</span> {formatCurrency(detailAccount.totalPaid)}</div>
              <div><span className="text-gray-600">Solde :</span> {formatCurrency(detailAccount.balance)}</div>
              <div><span className="text-gray-600">Statut :</span> <Badge className={STATUS_COLORS[detailAccount.status]}>{detailAccount.status}</Badge></div>
              {Number(detailAccount.arrearsAmount) > 0 && (
                <div className="col-span-2"><span className="text-gray-600">Arriérés (année précédente) :</span> {formatCurrency(detailAccount.arrearsAmount)}</div>
              )}
            </div>
            <h4 className="font-medium mb-2">Détail par frais</h4>
            <ul className="space-y-2">
              {Number(detailAccount.arrearsAmount) > 0 && (
                <li className="flex justify-between text-sm">
                  <span>Arriéré</span>
                  <span>{formatCurrency(detailAccount.arrearsAmount)} — Non payé</span>
                </li>
              )}
              {detailAccount.breakdowns?.map((b: any) => {
                const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
                const initial = Number(b.initialAmount ?? 0);
                const isOverridden = Math.abs(fsTotal - initial) > 0.01;
                return (
                  <li key={b.id} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {b.feeStructure?.name ?? b.feeStructureId}
                      {isOverridden && (
                        <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 bg-purple-50 ml-1" title={`Personnalisé: ${formatCurrency(fsTotal)} → ${formatCurrency(initial)}`}>
                          <UserCog className="w-2.5 h-2.5 mr-0.5" />Pers.
                        </Badge>
                      )}
                    </span>
                    <span className={isOverridden ? 'text-purple-700' : ''}>
                      {isOverridden && <span className="line-through text-slate-400 mr-1">{formatCurrency(fsTotal)}</span>}
                      {formatCurrency(initial)} — Soldé: {formatCurrency(b.paidAmount)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* Section Personnalisations — liste les overrides de l'élève pour cette année */}
            {detailAccount.overrides?.length > 0 && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-purple-900">
                  <UserCog className="w-4 h-4" />
                  Personnalisations appliquées ({detailAccount.overrides.length})
                </h4>
                <ul className="space-y-2">
                  {detailAccount.overrides.map((o: any) => {
                    const original = Number(o.feeStructure?.totalAmount ?? 0);
                    const custom = Number(o.customAmount ?? 0);
                    const reduction = Math.max(0, original - custom);
                    const reductionPct = original > 0 ? Math.round((reduction / original) * 100) : 0;
                    return (
                      <li key={o.id} className="text-sm bg-white rounded p-2 border border-purple-100">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{o.feeStructure?.name ?? '—'}</p>
                            <p className="text-xs text-slate-500">
                              {o.feeStructure?.class?.name ? `Classe: ${o.feeStructure.class.name} · ` : ''}
                              {reduction > 0 ? `Réduction: ${formatCurrency(reduction)} (${reductionPct}%)` : 'Aucune réduction'}
                            </p>
                            <p className="text-xs text-slate-500 italic mt-0.5">Motif: {o.reason}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-xs text-slate-400 line-through">{formatCurrency(original)}</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(custom)}</p>
                          </div>
                        </div>
                        {o.creator && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Par {o.creator.firstName || ''} {o.creator.lastName || ''} · {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {detailAccount.transactions?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Dernières transactions</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {detailAccount.transactions.slice(0, 5).map((t: any) => (
                    <li key={t.id}>{t.receiptNumber} — {formatCurrency(t.amount)} — {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Link href="/app/finance/payments" className={buttonVariants({ variant: 'outline' })}>Voir historique transactions</Link>
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
