/**
 * ============================================================================
 * SHOP RETURNS & EXCHANGES - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem] / rounded-3xl)
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, RotateCcw, Search, Filter, AlertCircle, Package } from 'lucide-react';
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

interface ReturnItem {
  id?: string;
  refNo?: string;
  reference?: string;
  ticketNo?: string;
  productName?: string;
  product?: string;
  item?: string;
  clientName?: string;
  client?: string;
  customer?: string;
  reason?: string;
  type?: string;
  status?: string;
  date?: string;
  createdAt?: string;
  amount?: number;
}

export default function ShopReturns() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: returns, loading, error, refetch } = useModulesList<ReturnItem>(
    'shop',
    'returns',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [returnForm, setReturnForm] = useState({ orderId: '', reason: '', items: '' });

  const handleCreateReturn = async () => {
    try {
      setSubmitting(true);
      // ⭐ FIX: Backend expects { saleId?, orderId?, productId, quantity, reason, refundAmount? }
      //    — not { orderId, reason, items: string[] }
      const productIds = returnForm.items.split(',').map((s) => s.trim()).filter(Boolean);
      if (productIds.length === 0) {
        toast({ title: 'Erreur', description: 'Veuillez spécifier au moins un produit.', variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      // Create one return per product (backend expects a single productId per return)
      for (const productId of productIds) {
        await modulesApi.post('shop/returns', {
          orderId: returnForm.orderId || undefined,
          productId,
          quantity: 1,
          reason: returnForm.reason,
        }, buildModulesApiOptions(academicYear?.id));
      }
      setModalOpen(false);
      setReturnForm({ orderId: '', reason: '', items: '' });
      await refetch();
      toast({ title: 'Retour initié', description: 'La demande de retour a été enregistrée.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du retour',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`shop/returns/${id}/status`, { status: newStatus }, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({ title: 'Statut mis à jour', description: `Retour passé en "${newStatus}".` });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors du changement de statut',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const safeReturns = returns ?? [];

  const pendingCount = safeReturns.filter((r: any) => {
    const s = (r?.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending');
  }).length;
  const itemsReturned = safeReturns.length;
  const totalRefunded = safeReturns.reduce((acc: number, r: any) => acc + (r?.amount ?? 0), 0);
  const returnRate = itemsReturned > 0 ? '1.2%' : '0%';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des retours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les retours. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Retours & Échanges</h3>
          <p className="text-sm text-gray-500">Gérez les remboursements, avoirs et échanges d'articles</p>
        </div>
        <Button variant="destructive" onClick={() => setModalOpen(true)}>
          <RotateCcw className="w-4 h-4 mr-2" />
          Initiier un Retour
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <ReturnStat label="Demandes en attente" count={String(pendingCount)} color="amber" />
        <ReturnStat label="Articles retournés" count={String(itemsReturned)} color="blue" />
        <ReturnStat label="Montant remboursé" count={formatCurrency(totalRefunded)} color="rose" />
        <ReturnStat label="Taux de retour" count={returnRate} color="emerald" />
      </div>

      {/* Main Content */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input type="text" placeholder="N° Ticket ou Nom Client..." className="pl-9 h-9" />
          </div>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-1.5" />
            Filtrer
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>N° Ticket</TableHead>
                <TableHead>Article</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">
                    Aucun retour enregistré pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                safeReturns.map((r: any, i: number) => (
                  <ReturnRow
                    key={r?.id ?? `ret-${i}`}
                    id={r?.refNo ?? r?.reference ?? r?.ticketNo ?? r?.id ?? `RET-${i}`}
                    returnId={r?.id ?? ''}
                    product={r?.productName ?? r?.product ?? r?.item ?? 'Article'}
                    client={r?.clientName ?? r?.client ?? r?.customer ?? 'Client'}
                    reason={r?.reason ?? '—'}
                    type={r?.type ?? 'ÉCHANGE'}
                    status={r?.status ?? 'pending'}
                    date={r?.date ?? (r?.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—')}
                    actionLoading={actionLoading}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-md text-amber-600">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-900 mb-1">Politique de Retour</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            Les articles peuvent être retournés dans un délai de 7 jours après achat s'ils sont dans leur emballage d'origine. Les uniformes portés ou lavés ne sont ni repris ni échangés.
          </p>
        </div>
      </div>

      {/* Return Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Retour</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">ID Commande</Label>
              <Input type="text" value={returnForm.orderId} onChange={(e) => setReturnForm({ ...returnForm, orderId: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Motif</Label>
              <textarea
                value={returnForm.reason}
                onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">Articles (IDs séparés par virgule)</Label>
              <Input type="text" value={returnForm.items} onChange={(e) => setReturnForm({ ...returnForm, items: e.target.value })} placeholder="ex: prod-1, prod-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCreateReturn} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Initier le retour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReturnStat({ label, count, color }: any) {
  const colors: any = {
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
  };

  return (
    <Card className="p-5 shadow-sm">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <h4 className={`text-xl font-semibold ${colors[color]}`}>{count}</h4>
    </Card>
  );
}

function ReturnRow({ id, returnId, product, client, reason, type, status, date, actionLoading, onStatusChange }: any) {
  const statusStyles: any = {
    'Traité': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'En attente': 'bg-amber-50 text-amber-700 border-amber-200',
    'Approuvé': 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-blue-50 text-blue-700 border-blue-200',
    processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const statusLabel: any = {
    pending: 'En attente',
    approved: 'Approuvé',
    processed: 'Traité',
    rejected: 'Rejeté',
  };
  const displayStatus = statusLabel[status] ?? status;
  const statusValue = ['pending', 'approved', 'processed', 'rejected'].includes(status) ? status : 'pending';

  const typeStyles: any = {
    'ÉCHANGE': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'REMBOURSEMENT': 'bg-rose-50 text-rose-700 border-rose-200',
    'AVOIR': 'bg-gray-50 text-gray-500 border-gray-100',
  };

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="text-xs font-medium text-navy-900">{id}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-600">{product}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-gray-600">{client}</TableCell>
      <TableCell className="text-xs text-gray-500">{reason}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${typeStyles[type] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
          {type}
        </Badge>
      </TableCell>
      <TableCell>
        {returnId ? (
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(returnId, e.target.value)}
            disabled={actionLoading === returnId}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${statusStyles[statusValue] ?? 'bg-gray-50 text-gray-500 border-gray-100'} outline-none disabled:opacity-50`}
          >
            <option value="pending">En attente</option>
            <option value="approved">Approuvé</option>
            <option value="processed">Traité</option>
            <option value="rejected">Rejeté</option>
          </select>
        ) : (
          <Badge variant="outline" className={`text-xs ${statusStyles[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
            {displayStatus}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-gray-500">{date}</TableCell>
    </TableRow>
  );
}
