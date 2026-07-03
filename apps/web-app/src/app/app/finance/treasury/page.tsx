/**
 * SOUS-MODULE 6 — Clôture & Trésorerie (FinanceDailyClosure)
 * Calcul auto, type MANUAL/AUTO, rapprochement caisse, anomalie.
 * + Ventilation : transfert des caisses secondaires vers le coffre-fort.
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { CheckCircle, Eye, ArrowLeftRight, Safe, Loader2, Wallet } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation, ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function TreasuryPage() {
  const confirmDialog = useConfirmDialog();
  const { toast } = useToast();
  const { academicYear } = useModuleContext();
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalClosure, setModalClosure] = useState(false);
  const [detailClosure, setDetailClosure] = useState<any | null>(null);
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0]);
  const [physicalAmount, setPhysicalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Ventilation
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [ventilating, setVentilating] = useState(false);
  const [ventilatingId, setVentilatingId] = useState<string | null>(null);

  const loadClosures = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getTreasuryClosures(academicYear.id);
      setClosures(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  // Charger les caisses pour la ventilation
  const loadCashRegisters = async () => {
    try {
      const data = await financeService.getCashRegisters({ isActive: true });
      setCashRegisters(Array.isArray(data) ? data : []);
    } catch {
      setCashRegisters([]);
    }
  };

  useEffect(() => {
    loadClosures();
    loadCashRegisters();
  }, [academicYear?.id]);

  // Caisse principale (coffre-fort) = code MAIN ou première
  const mainRegister = useMemo(() => {
    return cashRegisters.find((r) => r.code?.toUpperCase() === 'MAIN') || cashRegisters[0] || null;
  }, [cashRegisters]);

  // Caisses secondaires ouvertes avec solde > 0 (candidates à la ventilation)
  const ventilableRegisters = useMemo(() => {
    if (!mainRegister) return [];
    return cashRegisters.filter((r) => r.id !== mainRegister.id && r.isOpen && Number(r.currentBalance || 0) > 0);
  }, [cashRegisters, mainRegister]);

  // Total à ventiler
  const totalToVentilate = useMemo(() => {
    return ventilableRegisters.reduce((sum, r) => sum + Number(r.currentBalance || 0), 0);
  }, [ventilableRegisters]);

  // Ventiler une caisse individuelle vers le coffre-fort
  const handleVentilateOne = async (reg: any) => {
    if (!mainRegister) return;
    const amount = Number(reg.currentBalance || 0);
    if (amount <= 0) return;
    const ok = await confirmDialog.warning(
      `Transférer ${formatCurrency(amount)} XOF de "${reg.code} — ${reg.name}" vers le coffre-fort "${mainRegister.code} — ${mainRegister.name}" ?`,
      'Transférer',
    );
    if (!ok) return;
    setVentilatingId(reg.id);
    try {
      await financeService.transferCashRegister({
        fromId: reg.id,
        toId: mainRegister.id,
        amount,
        note: `Ventilation clôture — ${reg.name} → Coffre-fort`,
      });
      toast({ title: '✅ Transfert réussi', description: `${formatCurrency(amount)} XOF transférés vers le coffre-fort.` });
      await loadCashRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setVentilatingId(null);
    }
  };

  // Ventiler TOUTES les caisses secondaires vers le coffre-fort
  const handleVentilateAll = async () => {
    if (!mainRegister || ventilableRegisters.length === 0) return;
    const ok = await confirmDialog.warning(
      `Consolider ${ventilableRegisters.length} caisse(s) vers le coffre-fort ? Total : ${formatCurrency(totalToVentilate)} XOF.`,
      'Tout consolider',
    );
    if (!ok) return;
    setVentilating(true);
    let successCount = 0;
    let failCount = 0;
    for (const reg of ventilableRegisters) {
      try {
        await financeService.transferCashRegister({
          fromId: reg.id,
          toId: mainRegister.id,
          amount: Number(reg.currentBalance || 0),
          note: `Ventilation clôture — ${reg.name} → Coffre-fort`,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setVentilating(false);
    if (failCount === 0) {
      toast({ title: '✅ Consolidation réussie', description: `${successCount} caisse(s) consolidée(s) vers le coffre-fort.` });
    } else {
      toast({ title: 'Partiellement réussi', description: `${successCount} réussis, ${failCount} échecs.`, variant: 'destructive' });
    }
    await loadCashRegisters();
  };

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id) return;
    setSubmitting(true);
    try {
      await financeService.createTreasuryClosure({
        academicYearId: academicYear.id,
        date: closureDate,
        physicalAmount: physicalAmount ? Number(physicalAmount) : undefined,
        validate: true,
      });
      setModalClosure(false);
      setPhysicalAmount('');
      loadClosures();
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string) => {
    try {
      await financeService.validateTreasuryClosure(id);
      loadClosures();
    } catch (e) {
      console.error(e);
    }
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const totalNet = closures.reduce((s, c) => s + Number(c.netBalance ?? 0), 0);

  return (
    <>
    {confirmDialog.dialog}
    <div className="space-y-6">
      <ModuleHeader
        title="Clôture & Trésorerie"
        description="Clôture journalière (calcul auto), rapprochement caisse, type Manuel/Auto, anomalie."
        icon="finance"
        kpis={[
          { label: 'Solde cumulé', value: formatCurrency(totalNet) },
          { label: 'Clôtures', value: String(closures.length) },
          { label: 'Année', value: academicYear?.label ?? '—' },
        ]}
        actions={<Button onClick={() => setModalClosure(true)}>Clôturer la journée</Button>}
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/treasury" />

      {/* === SECTION VENTILATION === */}
      {cashRegisters.length > 0 && mainRegister && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
              Ventilation vers le coffre-fort
            </h3>
            {ventilableRegisters.length > 0 && (
              <Button
                onClick={handleVentilateAll}
                disabled={ventilating}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {ventilating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Consolidation...</>
                ) : (
                  <><ArrowLeftRight className="w-4 h-4 mr-2" />Tout consolider ({formatCurrency(totalToVentilate)})</>
                )}
              </Button>
            )}
          </div>

          {ventilableRegisters.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-4 text-center">
              ✅ Aucune caisse secondaire à ventiler. Toutes les caisses sont vides ou fermées.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Coffre-fort (destination) */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-900 to-indigo-900 text-white rounded-lg">
                <div className="flex items-center gap-2">
                  <Safe className="w-5 h-5" />
                  <div>
                    <p className="text-sm font-semibold">{mainRegister.code} — {mainRegister.name}</p>
                    <p className="text-xs text-slate-400">Coffre-fort (destination)</p>
                  </div>
                </div>
                <p className="text-lg font-bold">{formatCurrency(Number(mainRegister.currentBalance || 0))}</p>
              </div>

              {/* Caisses à ventiler */}
              {ventilableRegisters.map((reg) => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{reg.code} — {reg.name}</p>
                      <p className="text-xs text-slate-500">{reg.location || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">{formatCurrency(Number(reg.currentBalance || 0))}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVentilateOne(reg)}
                      disabled={ventilatingId === reg.id || ventilating}
                      className="text-indigo-600 hover:bg-indigo-50"
                    >
                      {ventilatingId === reg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <><ArrowLeftRight className="w-3.5 h-3.5 mr-1" />Transférer</>
                      )}
                    </Button>
                  </div>
                </div>
              ))}

              <p className="text-xs text-slate-400 mt-2">
                💡 La ventilation transfère l'intégralité du solde de chaque caisse secondaire vers le coffre-fort. Vous pouvez ventiler individuellement ou tout consolider en une fois.
              </p>
            </div>
          )}
        </div>
      )}

      {modalClosure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold mb-4">Clôture journalière</h3>
            <p className="text-sm text-gray-600 mb-4">Encaissements et dépenses du jour sont calculés automatiquement. Saisissez le montant physique caisse pour le rapprochement.</p>
            <form onSubmit={handleCreateClosure}>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} required className="mb-4" />
              <label className="block text-sm font-medium mb-1">Montant physique caisse (XOF, optionnel)</label>
              <Input type="number" value={physicalAmount} onChange={(e) => setPhysicalAmount(e.target.value)} placeholder="Rapprochement" className="mb-4" />
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'En cours…' : 'Valider clôture'}</Button>
                <Button type="button" variant="outline" onClick={() => setModalClosure(false)}>Annuler</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailClosure && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full">
            <h3 className="font-semibold mb-4">Clôture {new Date(detailClosure.date).toLocaleDateString('fr-FR')}</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div><strong>Type:</strong> {detailClosure.closureType}</div>
              <div><strong>Validée:</strong> {detailClosure.validatedById ? 'Oui' : 'Non'}</div>
              <div><strong>Encaissements:</strong> {formatCurrency(detailClosure.totalIncome ?? 0)}</div>
              <div><strong>Dépenses:</strong> {formatCurrency(detailClosure.totalExpense ?? 0)}</div>
              <div><strong>Solde:</strong> {formatCurrency(detailClosure.netBalance ?? 0)}</div>
              {detailClosure.physicalAmount != null && <div><strong>Montant physique:</strong> {formatCurrency(detailClosure.physicalAmount)}</div>}
              {detailClosure.discrepancy != null && <div><strong>Écart:</strong> {formatCurrency(detailClosure.discrepancy)}</div>}
              {detailClosure.anomalyNote && <div className="col-span-2"><strong>Anomalie:</strong> {detailClosure.anomalyNote}</div>}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setDetailClosure(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}

      <ModuleContentArea layout="table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Encaissements</TableHead>
              <TableHead>Dépenses</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Anomalie</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Chargement…</TableCell></TableRow>
            ) : closures.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Aucune clôture.</TableCell></TableRow>
            ) : (
              closures.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    {c.closureType === 'AUTO' ? (
                      <Badge variant="outline" className={c.anomalyDetected ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>Auto</Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-800">Manuel</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-green-600">{formatCurrency(c.totalIncome ?? 0)}</TableCell>
                  <TableCell className="text-red-600">{formatCurrency(c.totalExpense ?? 0)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(c.netBalance ?? 0)}</TableCell>
                  <TableCell>{c.anomalyDetected ? <span className="text-red-600">Oui</span> : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDetailClosure(c)}><Eye className="h-4 w-4" /></Button>
                    {!c.validatedById && (
                      <Button variant="ghost" size="icon" onClick={async () => { const ok = await confirmDialog.warning(`La clôture du ${new Date(c.date).toLocaleDateString('fr-FR')} sera validée définitivement.`, 'Valider la clôture'); if (ok) handleValidate(c.id); }}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>
    </div>
    </>
  );
}
