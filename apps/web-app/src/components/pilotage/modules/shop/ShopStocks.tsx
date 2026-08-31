/**
 * ============================================================================
 * SHOP STOCKS & INVENTORY - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-3xl / rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Package, Search, AlertTriangle, History, TrendingDown, BarChart3, MapPin, MoreVertical, Edit, RefreshCw } from 'lucide-react';
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

interface StockItem {
  id?: string;
  name?: string;
  productName?: string;
  location?: string;
  zone?: string;
  qty?: number;
  quantity?: number;
  stock?: number;
  threshold?: number;
  minThreshold?: number;
  lastMvt?: string;
  lastMovementAt?: string;
  lastMovement?: string;
  updatedAt?: string;
  status?: string;
  unitPrice?: number;
  price?: number;
}

export default function ShopStocks() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: stocks, loading, error, refetch } = useModulesList<StockItem>(
    'shop',
    'stocks',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockForm, setStockForm] = useState({ productId: '', quantity: 0 });

  const handleUpdateStock = async () => {
    try {
      setSubmitting(true);
      await modulesApi.put('shop/stocks', stockForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setStockForm({ productId: '', quantity: 0 });
      await refetch();
      toast({ title: 'Stock mis à jour', description: 'L\'inventaire a été actualisé.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la mise à jour du stock',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openStockModal = (productId?: string) => {
    setStockForm({ productId: productId ?? '', quantity: 0 });
    setModalOpen(true);
  };

  const safeStocks = stocks ?? [];

  const totalArticles = safeStocks.length;
  const alertCount = safeStocks.filter((s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    const threshold = s?.threshold ?? s?.minThreshold ?? 0;
    return qty > 0 && qty <= threshold;
  }).length;
  const ruptureCount = safeStocks.filter((s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    return qty <= 0;
  }).length;
  const totalValue = safeStocks.reduce((acc: number, s: any) => {
    const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
    const price = s?.unitPrice ?? s?.price ?? 0;
    return acc + (qty * price);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des stocks...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les stocks. {error}
        </div>
      )}

      {/* Stock KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StockStatCard label="Valeur Stock" value={formatCurrency(totalValue)} icon={BarChart3} color="indigo" />
        <StockStatCard label="Articles Totaux" value={String(totalArticles)} icon={Package} color="blue" />
        <StockStatCard label="Alertes Seuil" value={String(alertCount)} icon={AlertTriangle} color="amber" />
        <StockStatCard label="Ruptures" value={String(ruptureCount)} icon={TrendingDown} color="rose" />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher un produit dans l'inventaire..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button variant="outline" size="sm">
                  <MapPin className="w-4 h-4 mr-1.5" />
                  Localisation
                </Button>
                <Button size="sm" onClick={() => openStockModal()}>
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Mettre à jour
                </Button>
              </div>
            </div>
          </Card>

          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Produit</TableHead>
                    <TableHead>Zone / Emplacement</TableHead>
                    <TableHead className="text-right">En Stock</TableHead>
                    <TableHead className="text-right">Seuil</TableHead>
                    <TableHead>Dernier Mvt</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeStocks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-12">
                        Aucun stock disponible pour cette année scolaire.
                      </TableCell>
                    </TableRow>
                  ) : (
                    safeStocks.map((s: any, i: number) => {
                      const name = s?.product?.name ?? s?.name ?? s?.productName ?? `Article #${i + 1}`;
                      const location = s?.location ?? s?.zone ?? '—';
                      const qty = s?.qty ?? s?.quantity ?? s?.stock ?? 0;
                      const threshold = s?.threshold ?? s?.minThreshold ?? 0;
                      const lastMvt = s?.lastMvt
                        ?? s?.lastMovement
                        ?? (s?.lastMovementAt ? new Date(s.lastMovementAt).toLocaleDateString('fr-FR') : null)
                        ?? (s?.updatedAt ? new Date(s.updatedAt).toLocaleDateString('fr-FR') : '—');
                      const status = qty <= 0 ? 'Rupture' : qty <= threshold ? 'Alerte' : 'Normal';
                      return (
                        <StockRow
                          key={s?.id ?? `stock-${i}`}
                          name={name}
                          location={location}
                          qty={qty}
                          threshold={threshold}
                          lastMvt={lastMvt}
                          status={status}
                          onEdit={() => openStockModal(s?.productId ?? s?.id)}
                        />
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 text-white shadow-md border-0">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-indigo-300" />
              <h3 className="text-sm font-semibold">Mouvements Récents</h3>
            </div>
            <div className="space-y-4">
              {safeStocks.slice(0, 4).map((s: any, i: number) => (
                <MovementItem
                  key={`mv-${i}`}
                  type={i % 2 === 0 ? 'IN' : 'OUT'}
                  label={`Mouvement - ${s?.product?.name ?? s?.name ?? s?.productName ?? 'Article'}`}
                  qty={s?.qty ?? s?.quantity ?? s?.stock ?? 0}
                  date={s?.lastMvt ?? s?.lastMovement ?? '—'}
                />
              ))}
              {safeStocks.length === 0 && (
                <p className="text-xs text-slate-300 text-center py-4">Aucun mouvement récent</p>
              )}
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4 bg-white/10 border-white/20 text-white hover:bg-white/20">
              Voir tout l'historique
            </Button>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Zones de Stockage</h3>
            <div className="space-y-3">
              <StorageZone label="Rayon Principal" count={safeStocks.length} color="emerald" />
              <StorageZone label="Réserve Centrale" count={0} color="indigo" />
              <StorageZone label="Point de Vente" count={0} color="amber" />
            </div>
          </Card>
        </div>
      </div>

      {/* Stock Update Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mettre à jour le Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Produit</Label>
              <select
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/30 bg-white"
                value={stockForm.productId}
                onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}
              >
                <option value="">— Sélectionner un produit —</option>
                {safeStocks.map((s: any) => (
                  <option key={s?.productId ?? s?.id} value={s?.productId ?? s?.id}>
                    {s?.product?.name ?? s?.name ?? 'Produit inconnu'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Nouvelle Quantité</Label>
              <Input
                type="number"
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateStock} disabled={submitting || !stockForm.productId}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StockStatCard({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card className="p-5 shadow-sm">
      <div className={`p-2.5 rounded-lg ${colorMap[color]} mb-3 w-fit`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <h4 className="text-xl font-semibold text-navy-900">{value}</h4>
    </Card>
  );
}

function StockRow({ name, location, qty, threshold, lastMvt, status, onEdit }: any) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-navy-900">{name}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-600">{location}</span>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className={`text-sm font-medium ${status === 'Rupture' ? 'text-red-600' : status === 'Alerte' ? 'text-amber-600' : 'text-navy-900'}`}>
          {qty} <span className="text-xs text-gray-400">unités</span>
        </span>
      </TableCell>
      <TableCell className="text-right text-xs text-gray-500">{threshold}</TableCell>
      <TableCell className="text-xs text-gray-500">{lastMvt}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Modifier">
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Plus d'actions">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function MovementItem({ type, label, qty, date }: any) {
  const TrendingUp = History;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${type === 'IN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
          {type === 'IN' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        </div>
        <div>
          <p className="text-xs font-medium text-white line-clamp-1">{label}</p>
          <p className="text-xs text-slate-400">{date}</p>
        </div>
      </div>
      <span className={`text-xs font-medium ${type === 'IN' ? 'text-emerald-300' : 'text-rose-300'}`}>
        {type === 'IN' ? '+' : ''}{qty}
      </span>
    </div>
  );
}

function StorageZone({ label, count, color }: any) {
  const colors: any = {
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-600',
    amber: 'bg-amber-500',
  };
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[color]}`}></div>
        <span className="text-sm font-medium text-navy-900">{label}</span>
      </div>
      <span className="text-xs text-gray-500">{count} articles</span>
    </div>
  );
}
