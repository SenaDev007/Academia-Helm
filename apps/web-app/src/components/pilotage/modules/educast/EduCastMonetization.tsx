/**
 * ============================================================================
 * EDUCAST MONETIZATION & EARNINGS
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, ShoppingCart, ArrowUpRight, ArrowDownRight, Wallet, Download, Clock, Loader2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EarningsData {
  kpis?: Array<{
    label: string;
    value: string | number;
    unit?: string;
    trend?: string;
    positive?: boolean | null;
    icon?: string;
    color?: string;
    bg?: string;
  }>;
  transactions?: Array<{
    id: string | number;
    content?: string;
    title?: string;
    buyer?: string;
    customer?: string;
    date?: string;
    createdAt?: string;
    amount?: string | number;
    net?: string | number;
    netAmount?: string | number;
    status?: string;
  }>;
  payouts?: Array<{
    id: string | number;
    date?: string;
    amount?: string | number;
    status?: string;
  }>;
}

const ICONS: Record<string, any> = {
  DollarSign,
  TrendingUp,
  Wallet,
  ShoppingCart,
};

export default function EduCastMonetization() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payoutModal, setPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!academicYear?.id) return;
    try {
      const result = await modulesApi.get<EarningsData>('educast/teacher-earnings', buildModulesApiOptions(academicYear.id));
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  }, [academicYear?.id]);

  const handlePayoutRequest = async () => {
    if (!payoutAmount || payoutAmount <= 0) {
      toast({ title: 'Montant invalide', description: 'Le montant doit être supérieur à 0.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/payout-requests', { amount: Number(payoutAmount) }, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Demande envoyée', description: 'Votre demande de paiement a bien été transmise.' });
      setPayoutModal(false);
      setPayoutAmount(0);
      await refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la demande de paiement', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await modulesApi.get<EarningsData>('educast/teacher-earnings', buildModulesApiOptions(academicYear.id));
        if (!cancelled) setData(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des revenus...</span>
      </div>
    );
  }

  const kpis = data?.kpis ?? [];
  const transactions = data?.transactions ?? [];
  // payouts : on prend uniquement ceux réellement renvoyés par l'API (pas de mocks)
  const payouts = data?.payouts ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.length === 0 ? (
          <Card className="col-span-full p-12 text-center text-slate-500 shadow-sm">
            Aucune donnée de revenu disponible pour cette année scolaire.
          </Card>
        ) : (
          kpis.map((kpi, i) => {
            const Icon = kpi.icon ? ICONS[kpi.icon] : DollarSign;
            return (
              <Card key={i} className="p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${kpi.bg || 'bg-blue-50'} ${kpi.color || 'text-blue-600'}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {kpi.positive !== null && kpi.positive !== undefined && (
                    <div className={`flex items-center gap-1 text-xs ${kpi.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {kpi.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {kpi.trend}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-slate-500">{kpi.label}</h4>
                  <p className="text-2xl font-semibold text-slate-900">
                    {kpi.value} <span className="text-xs text-slate-400 ml-1">{kpi.unit}</span>
                  </p>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy-900">Dernières Ventes</h3>
            <Button variant="link" size="sm" className="text-blue-600">
              <Download className="w-4 h-4 mr-1" />
              Exporter (CSV)
            </Button>
          </div>
          {transactions.length === 0 ? (
            <Card className="p-12 text-center text-slate-500 shadow-sm">
              Aucune transaction pour cette année scolaire.
            </Card>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="px-6">Contenu / Client</TableHead>
                      <TableHead className="px-6">Date</TableHead>
                      <TableHead className="px-6">Montant Brut</TableHead>
                      <TableHead className="px-6">Part Enseignant</TableHead>
                      <TableHead className="px-6 text-right">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t, i) => {
                      const content = t.content || t.title || 'Contenu';
                      const buyer = t.buyer || t.customer || '—';
                      const date = t.date || (t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : '—');
                      const amount = t.amount ?? '—';
                      const net = t.net ?? t.netAmount ?? '—';
                      const status = t.status || 'PAID';
                      return (
                        <TableRow key={t.id ?? i} className="hover:bg-slate-50 group cursor-pointer">
                          <TableCell className="px-6">
                            <div>
                              <p className="font-semibold text-slate-900 leading-tight">{content}</p>
                              <p className="text-xs text-slate-500">{buyer}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 text-xs text-slate-500">{date}</TableCell>
                          <TableCell className="px-6 text-sm font-semibold text-slate-900">{amount}</TableCell>
                          <TableCell className="px-6 text-sm font-semibold text-emerald-600">{net}</TableCell>
                          <TableCell className="px-6 text-right">
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">{status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Payout History */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-navy-900">Historique de Paiement</h3>
          <Card className="p-6 shadow-sm space-y-4">
            {payouts.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-6">Aucun paiement effectué.</p>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {payouts.map((p, i) => (
                  <div key={p.id ?? i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{p.amount} <span className="text-xs text-slate-400">F CFA</span></p>
                        <p className="text-xs text-slate-500">{p.date}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={() => setPayoutModal(true)}>
              Demander un Paiement
            </Button>
            <Button variant="outline" className="w-full">Voir tout l&apos;historique</Button>
          </Card>
        </div>
      </div>

      {/* Modal: Demander un paiement */}
      <Dialog open={payoutModal} onOpenChange={setPayoutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demander un paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Montant (F CFA)</Label>
              <Input
                type="number"
                min={0}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(Number(e.target.value))}
                placeholder="Ex: 50000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutModal(false)}>Annuler</Button>
            <Button onClick={handlePayoutRequest} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Demander
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
