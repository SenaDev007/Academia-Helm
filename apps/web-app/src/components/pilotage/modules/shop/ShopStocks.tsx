/**
 * ============================================================================
 * SHOP STOCKS & INVENTORY - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte sept 2026 :
 *  - Suppression de la colonne "Zone / Emplacement" (non utilisée)
 *  - Suppression du bouton "Localisation"
 *  - Suppression de la carte "Zones de Stockage" (données mock)
 *  - Tous les libellés de colonnes sur une ligne (whitespace-nowrap)
 *  - Statistiques corrigées : Valeur Stock, Alertes Seuil, Ruptures
 *    utilisent les vrais champs du backend (product.unitPrice, product.minStock)
 *  - Seuil d'alerte : utilise defaultLowStockThreshold des paramètres
 *    comme fallback quand product.minStock = 0
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Package, Search, AlertTriangle, TrendingDown, BarChart3, Edit, RefreshCw, FileText } from 'lucide-react';
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
  productId?: string;
  quantity?: number;
  location?: string;
  updatedAt?: string;
  product?: {
    id?: string;
    name?: string;
    code?: string;
    unitPrice?: number;
    minStock?: number;
    category?: { name?: string };
  };
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
  // ⭐ Seuil d'alerte par défaut chargé depuis les paramètres
  const [defaultThreshold, setDefaultThreshold] = useState(10);

  // ⭐ Charger les paramètres pour récupérer le seuil d'alerte par défaut
  useEffect(() => {
    if (!academicYear?.id) return;
    modulesApi.get<any>('shop/settings', buildModulesApiOptions(academicYear.id))
      .then((data: any) => {
        const settings = data?.data ?? data ?? {};
        if (settings.defaultLowStockThreshold) {
          setDefaultThreshold(settings.defaultLowStockThreshold);
        }
      })
      .catch(() => {/* settings may not exist yet — use default 10 */});
  }, [academicYear?.id]);

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

  // ⭐ Calculs des statistiques — utilise les vrais champs du backend :
  //    quantity (sur ShopStock), product.unitPrice, product.minStock
  const totalArticles = safeStocks.length;
  const alertCount = safeStocks.filter((s: any) => {
    const qty = Number(s?.quantity ?? 0);
    const threshold = Number(s?.product?.minStock ?? defaultThreshold);
    return qty > 0 && qty <= threshold;
  }).length;
  const ruptureCount = safeStocks.filter((s: any) => {
    return Number(s?.quantity ?? 0) <= 0;
  }).length;
  const totalValue = safeStocks.reduce((acc: number, s: any) => {
    const qty = Number(s?.quantity ?? 0);
    const price = Number(s?.product?.unitPrice ?? 0);
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

      {/* ⭐ Cartes statistiques — Valeur Stock, Articles, Alertes, Ruptures */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StockStatCard label="Valeur Stock" value={formatCurrency(totalValue)} icon={BarChart3} color="indigo" />
        <StockStatCard label="Articles Totaux" value={String(totalArticles)} icon={Package} color="blue" />
        <StockStatCard label="Alertes Seuil" value={String(alertCount)} icon={AlertTriangle} color="amber" />
        <StockStatCard label="Ruptures" value={String(ruptureCount)} icon={TrendingDown} color="rose" />
      </div>

      {/* Table des stocks — pleine largeur (suppression du split 2/3 + 1/3) */}
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
            {/* ⭐ Bouton "Localisation" supprimé (non utilisé) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!academicYear?.id) return;
                window.open(
                  `/api/modules-complementaires/shop/stocks/pdf?academicYearId=${academicYear.id}`,
                  '_blank',
                );
              }}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Générer PDF
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
                {/* ⭐ Tous les libellés sur une ligne (whitespace-nowrap) */}
                {/* ⭐ Colonne "Zone / Emplacement" supprimée */}
                <TableHead className="whitespace-nowrap">Produit</TableHead>
                <TableHead className="whitespace-nowrap">Code</TableHead>
                <TableHead className="text-right whitespace-nowrap">En Stock</TableHead>
                <TableHead className="text-right whitespace-nowrap">Seuil</TableHead>
                <TableHead className="whitespace-nowrap">Dernière Mise à Jour</TableHead>
                <TableHead className="text-center whitespace-nowrap">Actions</TableHead>
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
                  const name = s?.product?.name ?? `Article #${i + 1}`;
                  const code = s?.product?.code ?? '—';
                  const qty = Number(s?.quantity ?? 0);
                  // ⭐ Seuil : utilise product.minStock, ou defaultThreshold
                  //    des paramètres si minStock est 0
                  const threshold = Number(s?.product?.minStock ?? 0) || defaultThreshold;
                  const lastUpdate = s?.updatedAt
                    ? new Date(s.updatedAt).toLocaleDateString('fr-FR')
                    : '—';
                  const status = qty <= 0 ? 'Rupture' : qty <= threshold ? 'Alerte' : 'Normal';

                  return (
                    <TableRow key={s?.id ?? `stock-${i}`} className="hover:bg-slate-50">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm font-medium text-navy-900">{name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-gray-500 whitespace-nowrap">{code}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          status === 'Rupture' ? 'text-red-600' : status === 'Alerte' ? 'text-amber-600' : 'text-navy-900'
                        }`}>
                          {qty}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-gray-500 whitespace-nowrap">{threshold}</TableCell>
                      <TableCell className="text-xs text-gray-500 whitespace-nowrap">{lastUpdate}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openStockModal(s?.productId ?? s?.id)} title="Modifier">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

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
                    {s?.product?.name ?? 'Produit inconnu'}
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
      <p className="text-xs text-gray-500 mb-1 whitespace-nowrap">{label}</p>
      <h4 className="text-xl font-semibold text-navy-900">{value}</h4>
    </Card>
  );
}
