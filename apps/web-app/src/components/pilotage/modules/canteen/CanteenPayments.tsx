/**
 * ============================================================================
 * CANTEEN PAYMENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/payments
 * Endpoint (création)  : POST /modules-complementaires/canteen/payments
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - fixed inset-0 modal → <Dialog> shadcn
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - <table> HTML → <Table> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Search, Filter, Download,
  CreditCard, Wallet, Smartphone,
  CheckCircle2, AlertCircle, Clock,
  ArrowUpRight, Plus,
  DollarSign, TrendingUp, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface PaymentItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  period?: string;
  periodLabel?: string;
  plan?: string;
  subscriptionPlan?: string;
  amount?: number;
  amountPaid?: number;
  paid?: number;
  mode?: string;
  paymentMethod?: string;
  status?: string;
  [key: string]: any;
}

interface NewPaymentFormData {
  studentId: string;
  amount: number;
  method: string;
}

const emptyPaymentForm: NewPaymentFormData = { studentId: '', amount: 0, method: 'ESPECES' };

export default function CanteenPayments() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewPaymentFormData>(emptyPaymentForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: payments, loading, error, refetch } = useModulesList<PaymentItem>(
    'canteen',
    'payments',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/payments',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyPaymentForm);
      await refetch();
      toast({ title: 'Paiement enregistré', description: 'Le paiement a été enregistré avec succès.' });
    } catch (e: any) {
      console.error('Erreur enregistrement paiement :', e?.message || e);
      toast({
        title: 'Erreur enregistrement',
        description: e?.message || 'Erreur lors de l’enregistrement du paiement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalRevenue = payments
    ?? [].filter((p) => {
      const s = (p.status ?? '').toLowerCase();
      return s.includes('payé') || s.includes('paid');
    })
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const pendingCount = (payments ?? [])?? [].filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending');
  }).length;
  const pendingAmount = payments
    ?? [].filter((p) => {
      const s = (p.status ?? '').toLowerCase();
      return s.includes('attente') || s.includes('pending') || s.includes('retard') || s.includes('late');
    })
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const paidCount = (payments ?? [])?? [].filter((p) => {
    const s = (p.status ?? '').toLowerCase();
    return s.includes('payé') || s.includes('paid');
  }).length;
  const recoveryRate = (payments ?? []).length > 0 ? Math.round((paidCount / payments.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des paiements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceCard
          title="Recettes (Payées)"
          value={`${totalRevenue.toLocaleString('fr-FR')} F`}
          change={`${paidCount} paiement${paidCount > 1 ? 's' : ''}`}
          trend="up"
          icon={TrendingUp}
          color="emerald"
        />
        <FinanceCard
          title="Paiements en attente"
          value={`${pendingAmount.toLocaleString('fr-FR')} F`}
          change={`${pendingCount} élève${pendingCount > 1 ? 's' : ''}`}
          trend="neutral"
          icon={Clock}
          color="amber"
        />
        <FinanceCard
          title="Taux de recouvrement"
          value={`${recoveryRate}%`}
          change={`sur ${payments.length} paiement${payments.length > 1 ? 's' : ''}`}
          trend="up"
          icon={CheckCircle2}
          color="blue"
        />
        <FinanceCard
          title="Total Paiements"
          value={String(payments.length)}
          change="Toutes statuts confondus"
          trend="down"
          icon={AlertCircle}
          color="red"
        />
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy-900 text-lg">Suivi des Paiements</h3>
            <p className="text-gray-500 text-sm mt-1">Gestion financière de la restauration scolaire</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Élève, parent, reçu..."
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="w-4 h-4" />
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Paiement
            </Button>
          </div>
        </div>

        {(payments ?? []).length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun paiement enregistré pour cette année scolaire.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Élève & Période</TableHead>
                <TableHead>Abonnement</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(payments ?? []).map((payment) => {
                const amount = payment.amount ?? 0;
                const paid = payment.paid ?? payment.amountPaid;
                return (
                  <PaymentRow
                    key={payment.id}
                    student={payment.student ?? payment.studentName ?? '—'}
                    class={payment.class ?? payment.className ?? '—'}
                    period={payment.period ?? payment.periodLabel ?? '—'}
                    plan={payment.plan ?? payment.subscriptionPlan ?? '—'}
                    amount={amount > 0 ? `${amount.toLocaleString('fr-FR')} F` : '—'}
                    mode={payment.mode ?? payment.paymentMethod ?? 'Espèces'}
                    status={payment.status ?? 'En attente'}
                    paid={paid != null && paid > 0 ? `${paid.toLocaleString('fr-FR')} F` : undefined}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal Nouveau Paiement */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer un Paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-student">Élève (ID)</Label>
              <Input
                id="pay-student"
                type="text"
                placeholder="ex : student-123"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Montant (F CFA)</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Mode de paiement</Label>
              <select
                id="pay-method"
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="ESPECES">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CARTE_BANCAIRE">Carte bancaire</option>
                <option value="VIREMENT">Virement</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinanceCard({ title, value, change, trend, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <Card className="p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <Badge variant="outline" className={
          trend === 'up' ? 'bg-emerald-50 text-emerald-600' :
          trend === 'down' ? 'bg-red-50 text-red-600' :
          'bg-gray-50 text-gray-500'
        }>
          {change}
        </Badge>
      </div>
      <p className="text-gray-500 text-xs font-medium">{title}</p>
      <p className="text-2xl font-semibold text-navy-900 mt-1">{value}</p>
    </Card>
  );
}

function PaymentRow({ student, class: className, period, plan, amount, mode, status, paid }: any) {
  const statusStyles: any = {
    'Payé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Partiel': 'bg-blue-50 text-blue-600 border-blue-100',
    'Retard': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En attente'];

  const modeIcon = (m: string) => {
    const lower = (m ?? '').toLowerCase();
    if (lower.includes('mobile')) return <Smartphone className="w-3.5 h-3.5" />;
    if (lower.includes('espèce') || lower.includes('cash')) return <Wallet className="w-3.5 h-3.5" />;
    if (lower.includes('carte') || lower.includes('virement') || lower.includes('card')) return <CreditCard className="w-3.5 h-3.5" />;
    return <DollarSign className="w-3.5 h-3.5" />;
  };

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs text-blue-500">{className}</span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400">{period}</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{plan}</Badge>
      </TableCell>
      <TableCell>
        <p className="text-sm font-semibold text-navy-900">{amount}</p>
        {paid && <p className="text-xs text-blue-600 italic mt-0.5">Payé: {paid}</p>}
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2 text-gray-500">
          {modeIcon(mode)}
          <p className="text-xs font-medium">{mode}</p>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyle}>
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-1">
          <Button variant="ghost" size="icon">
            <ArrowUpRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
