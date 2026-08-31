/**
 * ============================================================================
 * SHOP ORDERS - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table>/<TableHeader>/... shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl border-gray-200 (au lieu de rounded-3xl)
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Search, Plus, Clock, CheckCircle2, Truck, Archive, MoreVertical, Eye, Download, Calendar, Filter, ShoppingBag, User } from 'lucide-react';
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

interface OrderItem {
  id?: string;
  refNo?: string;
  reference?: string;
  number?: string;
  customerName?: string;
  parentName?: string;
  clientName?: string;
  studentName?: string;
  student?: string;
  date?: string;
  createdAt?: string;
  itemCount?: number;
  itemsCount?: number;
  total?: number;
  amount?: number;
  status?: string;
}

export default function ShopOrders() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: orders, loading, error, refetch } = useModulesList<OrderItem>(
    'shop',
    'orders',
    academicYear?.id,
  );
  // ⭐ Fetch products for the dropdown selector
  const { data: products } = useModulesList<any>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({ customer: '', items: '' });

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      // ⭐ FIX: Build order items from selected products (dropdown multi-select)
      //    instead of asking the user to type comma-separated IDs.
      const orderItems = selectedProductIds.map((productId: string) => {
        const product = (products ?? []).find((p: any) => p.id === productId);
        return {
          productId,
          quantity: 1,
          unitPrice: Number(product?.unitPrice ?? 0),
        };
      });
      const totalAmount = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      await modulesApi.post('shop/orders', {
        totalAmount,
        items: orderItems,
      }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setSelectedProductIds([]);
      setFormData({ customer: '', items: '' });
      await refetch();
      toast({ title: 'Commande créée', description: 'La nouvelle commande a été enregistrée.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la commande',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionLoading(id);
      await modulesApi.put(
        `shop/orders/${id}/status`,
        { status: newStatus },
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Statut mis à jour', description: `Commande passée en "${newStatus}".` });
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

  const safeOrders = orders ?? [];

  // Calcul des compteurs par statut
  const pendingCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending') || s.includes('à prép');
  }).length;
  const confirmedCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('confirm') || s.includes('payé') || s.includes('paid');
  }).length;
  const toPrepareCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('prépar') || s.includes('prepare') || s.includes('ready');
  }).length;
  const deliveredCount = safeOrders.filter((o: any) => {
    const s = (o?.status ?? '').toLowerCase();
    return s.includes('livr') || s.includes('deliver') || s.includes('prêt');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des commandes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les commandes. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Gestion des Commandes</h3>
          <p className="text-sm text-gray-500">Suivez les pré-commandes parents et le processus de préparation</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Créer une Commande
        </Button>
      </div>

      {/* Stats Mini Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <OrderStatCard label="En attente" count={pendingCount} color="amber" icon={Clock} />
        <OrderStatCard label="Confirmées" count={confirmedCount} color="blue" icon={CheckCircle2} />
        <OrderStatCard label="À préparer" count={toPrepareCount} color="rose" icon={Archive} />
        <OrderStatCard label="Prêtes / Livrées" count={deliveredCount} color="emerald" icon={Truck} />
      </div>

      {/* Filter Bar */}
      <Card className="p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher par N° commande, Parent ou Élève..."
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-1.5" />
              Filtres
            </Button>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-1.5" />
              Période
            </Button>
          </div>
        </div>
      </Card>

      {/* Orders Table — pattern Finance */}
      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>N° Commande</TableHead>
                <TableHead>Client / Élève</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">
                    Aucune commande disponible pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                safeOrders.map((order: any, i: number) => (
                  <OrderRow
                    key={order?.id ?? `order-${i}`}
                    id={order?.refNo ?? order?.reference ?? order?.number ?? order?.id ?? `CMD-${i}`}
                    orderId={order?.id ?? ''}
                    name={order?.customerName ?? order?.parentName ?? order?.clientName ?? 'Client'}
                    student={order?.studentName ?? order?.student ?? ''}
                    date={order?.date ?? (order?.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : '—')}
                    itemCount={order?.itemCount ?? order?.itemsCount ?? 0}
                    total={order?.total ?? order?.amount ?? 0}
                    status={order?.status ?? 'pending'}
                    actionLoading={actionLoading}
                    onStatusChange={handleStatusChange}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal Nouvelle Commande */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Commande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Client</Label>
              <Input
                type="text"
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Articles</Label>
              <div className="mt-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                {(products ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Aucun produit disponible. Créez des produits dans le Catalogue d'abord.</p>
                ) : (
                  (products ?? []).map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds([...selectedProductIds, p.id]);
                          } else {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                          }
                        }}
                        className="w-4 h-4 rounded accent-amber-600"
                      />
                      <span className="text-sm flex-1">{p.name}</span>
                      <span className="text-xs text-slate-500">{Number(p.unitPrice).toLocaleString('fr-FR')} FCFA</span>
                    </label>
                  ))
                )}
              </div>
              {selectedProductIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{selectedProductIds.length} article(s) sélectionné(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting || selectedProductIds.length === 0}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer la commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderStatCard({ label, count, color, icon: Icon }: any) {
  const colorMap: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg border ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{label}</p>
          <p className="text-xl font-semibold text-navy-900">{count}</p>
        </div>
      </div>
    </Card>
  );
}

function OrderRow({ id, orderId, name, student, date, itemCount, total, status, actionLoading, onStatusChange }: any) {
  const statusColors: any = {
    'À préparer': 'bg-rose-50 text-rose-600 border-rose-100',
    'Payé': 'bg-blue-50 text-blue-600 border-blue-100',
    'Confirmé': 'bg-amber-50 text-amber-600 border-amber-100',
    'Prêt': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    pending: 'bg-amber-50 text-amber-600 border-amber-100',
    confirmed: 'bg-blue-50 text-blue-600 border-blue-100',
    shipped: 'bg-rose-50 text-rose-600 border-rose-100',
    delivered: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    cancelled: 'bg-gray-50 text-gray-600 border-gray-100',
  };
  const statusLabel: any = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    shipped: 'Expédiée',
    delivered: 'Livrée',
    cancelled: 'Annulée',
  };
  const displayStatus = statusLabel[status] ?? status;
  const statusValue = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status) ? status : 'pending';

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <span className="text-xs font-medium text-navy-900">{id}</span>
      </TableCell>
      <TableCell>
        <div>
          <p className="text-sm font-medium text-navy-900">{name}</p>
          {student && (
            <div className="flex items-center gap-1 mt-0.5 text-gray-400">
              <User className="w-3 h-3" />
              <span className="text-xs">{student}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-gray-500">{date}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-600">{itemCount} article{itemCount > 1 ? 's' : ''}</span>
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold text-navy-900 text-sm">{formatCurrency(total)}</TableCell>
      <TableCell>
        {orderId ? (
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(orderId, e.target.value)}
            disabled={actionLoading === orderId}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${statusColors[statusValue] ?? 'bg-gray-50 text-gray-500 border-gray-100'} outline-none disabled:opacity-50`}
          >
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmée</option>
            <option value="shipped">Expédiée</option>
            <option value="delivered">Livrée</option>
            <option value="cancelled">Annulée</option>
          </select>
        ) : (
          <Badge variant="outline" className={`text-xs ${statusColors[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
            {displayStatus}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualiser">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger">
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Plus d'actions">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
