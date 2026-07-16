/**
 * ============================================================================
 * SHOP PAYMENTS & WALLET - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Wallet, CreditCard, Banknote, History, Search, Filter, ArrowUpRight, ArrowDownLeft, Plus, Smartphone, User } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface SaleItem {
  id?: string;
  refNo?: string;
  reference?: string;
  type?: string;
  direction?: string;
  customerName?: string;
  clientName?: string;
  studentName?: string;
  method?: string;
  paymentMethod?: string;
  amount?: number;
  total?: number;
  status?: string;
  date?: string;
  createdAt?: string;
}

export default function ShopPayments() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: sales, loading, error, refetch } = useModulesList<SaleItem>(
    'shop',
    'sales',
    academicYear?.id,
  );

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, method: 'cash', customerId: '' });
  const [walletAmount, setWalletAmount] = useState(0);

  const handleRecordPayment = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('shop/sales', paymentForm, buildModulesApiOptions(academicYear?.id));
      setPaymentModalOpen(false);
      setPaymentForm({ amount: 0, method: 'cash', customerId: '' });
      await refetch();
      toast({ title: 'Paiement enregistré', description: 'La transaction a été ajoutée à l\'historique.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement du paiement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletRecharge = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('shop/wallet/recharge', { amount: walletAmount }, buildModulesApiOptions(academicYear?.id));
      setWalletModalOpen(false);
      setWalletAmount(0);
      await refetch();
      toast({ title: 'Recharge effectuée', description: 'Le portefeuille a été rechargé avec succès.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la recharge',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeSales = sales ?? [];

  // Calcul du solde global consolidé (somme des montants crédités)
  const totalBalance = safeSales.reduce((acc: number, s: any) => {
    const type = (s?.type ?? s?.direction ?? '').toString().toUpperCase();
    const amount = s?.amount ?? s?.total ?? 0;
    return type.includes('CRÉDIT') || type.includes('CREDIT') || type === 'IN'
      ? acc + (amount as number)
      : acc;
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des transactions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les transactions. {error}
        </div>
      )}

      {/* Wallet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 p-6 bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md border-0 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Total Portefeuille</h3>
                  <p className="text-indigo-100 text-xs">Fonds sécurisés Academia Pay</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-semibold">{formatCurrency(totalBalance)}</p>
                <p className="text-xs text-indigo-100 mt-1">Solde global consolidé</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <QuickAction label="Recharger" icon={Plus} onClick={() => setWalletModalOpen(true)} />
              <QuickAction label="Historique" icon={History} />
              <QuickAction label="Réglages" icon={Smartphone} />
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-navy-900">Méthodes Favorites</h3>
            <div className="space-y-3">
              <PaymentMethodItem icon={Banknote} label="Espèces" percent={65} color="emerald" />
              <PaymentMethodItem icon={Smartphone} label="Academia Pay (Wallet)" percent={25} color="indigo" />
              <PaymentMethodItem icon={CreditCard} label="Carte Bancaire" percent={10} color="amber" />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setPaymentModalOpen(true)}
            className="w-full mt-4"
          >
            Enregistrer un Paiement
          </Button>
        </Card>
      </div>

      {/* Transaction History */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-navy-900">Historique des Transactions</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="N° Transac..."
                className="pl-9 h-9 w-48"
              />
            </div>
            <Button variant="outline" size="icon" className="h-9 w-9">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Type</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead>Client / Élève</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">
                    Aucune transaction disponible pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                safeSales.map((sale: any, i: number) => {
                  const type = (sale?.type ?? sale?.direction ?? 'DÉBIT').toString().toUpperCase();
                  const isCredit = type.includes('CRÉDIT') || type.includes('CREDIT') || type === 'IN';
                  return (
                    <TxRow
                      key={sale?.id ?? `tx-${i}`}
                      type={isCredit ? 'CRÉDIT' : 'DÉBIT'}
                      refNo={sale?.refNo ?? sale?.reference ?? sale?.id ?? `TXN-${i}`}
                      name={sale?.customerName ?? sale?.clientName ?? sale?.studentName ?? 'Client'}
                      method={sale?.method ?? sale?.paymentMethod ?? '—'}
                      amount={sale?.amount ?? sale?.total ?? 0}
                      status={sale?.status ?? 'Succès'}
                      date={sale?.date ?? (sale?.createdAt ? new Date(sale.createdAt).toLocaleDateString('fr-FR') : '—')}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un Paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Montant (FCFA)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Méthode</Label>
              <select
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="cash">Espèces</option>
                <option value="wallet">Wallet</option>
                <option value="card">Carte</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">ID Client</Label>
              <Input
                type="text"
                value={paymentForm.customerId}
                onChange={(e) => setPaymentForm({ ...paymentForm, customerId: e.target.value })}
                placeholder="Optionnel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>Annuler</Button>
            <Button onClick={handleRecordPayment} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Recharge Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recharger le Portefeuille</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Montant (FCFA)</Label>
              <Input
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletModalOpen(false)}>Annuler</Button>
            <Button onClick={handleWalletRecharge} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Recharger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickAction({ label, icon: Icon, onClick }: any) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white h-auto"
    >
      <div className="p-2 bg-white/10 rounded-md">
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}

function PaymentMethodItem({ icon: Icon, label, percent, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-600',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-navy-900">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <span className="text-xs text-gray-400">{percent}%</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}

function TxRow({ type, refNo, name, method, amount, status, date }: any) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${type === 'CRÉDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {type === 'CRÉDIT' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
          </div>
          <span className="text-xs font-medium">{type}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs font-medium text-navy-900">{refNo}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-3 h-3 text-gray-400" />
          </div>
          <span className="text-xs text-gray-600">{name}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-gray-500">{method}</TableCell>
      <TableCell className="text-right">
        <span className={`text-sm font-semibold ${type === 'CRÉDIT' ? 'text-emerald-600' : 'text-navy-900'}`}>
          {type === 'CRÉDIT' ? '+' : '-'}{formatCurrency(amount)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${
          status === 'Succès' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-gray-500">{date}</TableCell>
    </TableRow>
  );
}
