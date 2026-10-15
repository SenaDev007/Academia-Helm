/**
 * ============================================================================
 * CANTEEN STOCKS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/stocks
 * Endpoint (mouvement) : POST /modules-complementaires/canteen/stocks
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
  Package, Search,
  ArrowDownCircle, ArrowUpCircle, History,
  AlertTriangle, CheckCircle2, MoreHorizontal,
  BarChart3, RefreshCcw, Loader2,
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

interface StockItem {
  id: string;
  name?: string;
  productName?: string;
  category?: string;
  qty?: number;
  quantity?: number;
  unit?: string;
  threshold?: string;
  alertThreshold?: number;
  minThreshold?: number;
  status?: string;
  lastEntry?: string;
  lastRestockDate?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface StockMovementFormData {
  itemId: string;
  quantity: number;
  type: 'IN' | 'OUT';
}

const emptyMovementForm: StockMovementFormData = { itemId: '', quantity: 1, type: 'IN' };

export default function CanteenStocks() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<StockMovementFormData>(emptyMovementForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: stocks, loading, error, refetch } = useModulesList<StockItem>(
    'canteen',
    'stocks',
    academicYear?.id,
  );

  const openMovement = (type: 'IN' | 'OUT') => {
    setFormData({ ...emptyMovementForm, type });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/stocks',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyMovementForm);
      await refetch();
      toast({ title: 'Mouvement enregistré', description: 'Le stock a été mis à jour.' });
    } catch (e: any) {
      console.error('Erreur mouvement de stock :', e?.message || e);
      toast({
        title: 'Erreur enregistrement',
        description: e?.message || 'Erreur lors de l’enregistrement du mouvement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalValue = (stocks ?? []).reduce((acc, s) => acc + (s.qty ?? s.quantity ?? 0), 0);
  const criticalCount = (stocks ?? []).filter((s) => {
    const st = (s.status ?? '').toLowerCase();
    return st.includes('critique') || st.includes('critical');
  }).length;
  const freshCount = (stocks ?? []).filter((s) => {
    const cat = (s.category ?? '').toLowerCase();
    return cat.includes('frais') || cat.includes('fresh');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des stocks...</span>
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

      {/* Stock KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StockCard
          title="Articles en Stock"
          value={String(stocks.length)}
          desc="Toutes catégories"
          icon={BarChart3}
          color="navy"
        />
        <StockCard
          title="Articles Critiques"
          value={String(criticalCount).padStart(2, '0')}
          desc="Seuil d’alerte atteint"
          icon={AlertTriangle}
          color="red"
        />
        <StockCard
          title="Quantité Totale"
          value={totalValue.toLocaleString('fr-FR')}
          desc="Unités cumulées"
          icon={RefreshCcw}
          color="blue"
        />
        <StockCard
          title="Produits Frais"
          value={String(freshCount).padStart(2, '0')}
          desc="Catégorie frais"
          icon={CheckCircle2}
          color="emerald"
        />
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-gray-50 to-white">
          <div>
            <h3 className="font-semibold text-navy-900 text-lg">Inventaire & Stocks</h3>
            <p className="text-gray-500 text-sm mt-1">Gestion des denrées et consommables</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un produit..."
                className="pl-10 w-64"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openMovement('IN')}
              className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              Entrée
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openMovement('OUT')}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Sortie
            </Button>
          </div>
        </div>

        {(stocks ?? []).length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucun article en stock pour cette année scolaire.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Produit & Catégorie</TableHead>
                <TableHead>Quantité Actuelle</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-center">Seuil Alerte</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Dernière Entrée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stocks ?? []).map((stock) => {
                const qty = stock.qty ?? stock.quantity ?? 0;
                const threshold = stock.threshold ?? stock.alertThreshold ?? stock.minThreshold ?? '—';
                const name = stock.name ?? stock.productName ?? '—';
                const lastEntry = stock.lastEntry ?? stock.lastRestockDate ?? stock.updatedAt ?? '—';
                return (
                  <StockRow
                    key={stock.id}
                    name={name}
                    category={stock.category ?? '—'}
                    qty={String(qty)}
                    unit={stock.unit ?? 'U'}
                    threshold={String(threshold)}
                    status={stock.status ?? 'OK'}
                    lastEntry={lastEntry}
                  />
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal Mouvement de stock */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formData.type === 'IN' ? 'Entrée de stock' : 'Sortie de stock'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="stock-item">Article (ID)</Label>
              <Input
                id="stock-item"
                type="text"
                placeholder="ex : stock-123"
                value={formData.itemId}
                onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-qty">Quantité</Label>
              <Input
                id="stock-qty"
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stock-type">Type de mouvement</Label>
              <select
                id="stock-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'IN' | 'OUT' })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="IN">Entrée (+)</option>
                <option value="OUT">Sortie (−)</option>
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

function StockCard({ title, value, desc, icon: Icon, color }: any) {
  const colors: any = {
    navy: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };
  return (
    <Card className="p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-gray-500 text-xs font-medium">{title}</p>
      <p className="text-2xl font-semibold text-navy-900 mt-1">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{desc}</p>
    </Card>
  );
}

function StockRow({ name, category, qty, unit, threshold, status, lastEntry }: any) {
  const statusStyles: any = {
    'OK': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Faible': 'bg-amber-50 text-amber-600 border-amber-100',
    'Critique': 'bg-red-50 text-red-600 border-red-100',
    'Critical': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['OK'];

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-50 rounded-lg border border-gray-100">
            <Package className="w-4 h-4 text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{name}</p>
            <p className="text-xs text-gray-500">{category}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-lg font-semibold text-navy-900">{qty}</p>
      </TableCell>
      <TableCell>
        <p className="text-xs text-gray-500">{unit}</p>
      </TableCell>
      <TableCell className="text-center">
        <p className="text-xs text-gray-500 italic">{threshold} {unit}</p>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyle}>
          {status === 'OK' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end">
          <p className="text-xs font-medium text-navy-900">{lastEntry}</p>
          <Button variant="link" size="sm" className="p-0 h-auto mt-1">
            <History className="w-3 h-3 mr-1" />
            Historique
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
