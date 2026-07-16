/**
 * ============================================================================
 * PHARMACY & STOCKS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Dialog> shadcn, Cards rounded-xl, alert() → toast(),
 * plus de font-black uppercase tracking-widest, plus de rounded-3xl,
 * plus de text-[10px]. Logique useModulesList + modulesApi conservée.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  Pill,
  Plus,
  ArrowDownCircle,
  Search,
  AlertTriangle,
  Package,
  Calendar,
  MoreHorizontal,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface StockItem {
  id: string;
  name?: string;
  itemName?: string;
  type?: string;
  itemType?: string;
  qty?: number;
  quantity?: number;
  unit?: string;
  status?: string;
  stockStatus?: string;
  expiry?: string;
  expirationDate?: string;
  [key: string]: any;
}

const STATUS_COLORS: Record<string, string> = {
  OK: 'bg-emerald-500',
  LOW: 'bg-amber-500',
  CRITICAL: 'bg-rose-500',
};

export default function PharmacyStock() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<StockItem>('infirmary', 'stock', academicYear?.id);
  const { toast } = useToast();

  const items = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ medicationId: '', quantity: '', type: 'IN' });
  const [submitting, setSubmitting] = useState(false);

  const handleMove = async () => {
    if (!formData.medicationId) {
      toast({
        title: 'Champ manquant',
        description: 'Veuillez saisir l\'ID du médicament.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        quantity: Number(formData.quantity) || 0,
        type: formData.type,
      };
      await modulesApi.post(`infirmary/stock/${formData.medicationId}/move`, payload, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ medicationId: '', quantity: '', type: 'IN' });
      await refetch();
      toast({
        title: 'Mouvement enregistré',
        description: `Mouvement ${payload.type} de ${payload.quantity} unité(s) effectué.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur lors du mouvement',
        description: e?.response?.data?.message || e?.message || 'Erreur lors du mouvement de stock',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Statistiques calculées depuis le stock réel
  const total = items.length;
  const lowStock = items.filter((i) => {
    const s = (i.status || i.stockStatus || '').toUpperCase();
    return s === 'LOW' || s === 'CRITICAL';
  }).length;
  const expiringSoon = items.filter((i) => {
    const exp = i.expiry || i.expirationDate;
    if (!exp) return false;
    const d = new Date(exp);
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">Total Articles</p>
            <p className="text-3xl font-bold text-navy-900">{total}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl text-blue-600">
            <Package className="w-6 h-6" />
          </div>
        </Card>
        <Card className="p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">Stock Faible</p>
            <p className="text-3xl font-bold text-amber-600">{lowStock}</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-xl text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Card>
        <Card className="p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-medium mb-1">Péremption &lt; 30j</p>
            <p className="text-3xl font-bold text-rose-600">{expiringSoon}</p>
          </div>
          <div className="p-4 bg-rose-50 rounded-xl text-rose-600">
            <Calendar className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Inventory Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher un médicament..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => { setFormData({ medicationId: '', quantity: '', type: 'IN' }); setModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Mouvement de Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => { setFormData({ medicationId: '', quantity: '', type: 'OUT' }); setModalOpen(true); }}
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Sortie Stock
          </Button>
        </div>
      </div>

      {/* Inventory List */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-semibold text-navy-900 flex items-center">
            <Pill className="w-5 h-5 mr-2 text-blue-600" />
            Inventaire Actif
          </h3>
          <div className="flex space-x-2">
            {['Tous', 'Médicaments', 'Consommables', 'Urgences'].map((cat, i) => (
              <Button
                key={i}
                variant={i === 0 ? 'default' : 'outline'}
                size="sm"
                className={i === 0 ? 'bg-slate-900 hover:bg-slate-800' : ''}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-slate-100 border-b border-slate-100">
          {items.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-4 p-12 text-center text-slate-500">
              Aucune donnée disponible pour cette année scolaire.
            </div>
          ) : items.map((item, i) => {
            const name = item.name || item.itemName || `Article ${item.id}`;
            const type = item.type || item.itemType || 'Médicament';
            const qty = item.qty ?? item.quantity ?? 0;
            const unit = item.unit || 'unités';
            const status = (item.status || item.stockStatus || 'OK').toUpperCase();
            const color = STATUS_COLORS[status] ?? STATUS_COLORS.OK;
            const expiry = item.expiry || item.expirationDate;
            const expiryLabel = expiry ? new Date(expiry).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'N/A';
            return (
              <motion.div
                key={item.id ?? i}
                whileHover={{ backgroundColor: '#F8FAFC' }}
                className="p-6 transition-colors group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-7 w-7">
                    <MoreHorizontal className="w-4 h-4 text-slate-500" />
                  </Button>
                </div>
                <p className="text-xs font-medium text-slate-400 mb-1">{type}</p>
                <h4 className="font-semibold text-navy-900 mb-4">{name}</h4>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-bold text-navy-900">{qty}</p>
                    <p className="text-xs font-medium text-slate-500">{unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-slate-400">Expire</p>
                    <p className="text-sm font-semibold text-slate-600">{expiryLabel}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mouvement de stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="medicationId">Médicament (ID)</Label>
              <Input
                id="medicationId"
                type="text"
                value={formData.medicationId}
                onChange={(e) => setFormData({ ...formData, medicationId: e.target.value })}
                placeholder="med-001"
              />
              {items.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  IDs disponibles : {items.slice(0, 5).map((i) => i.id).join(', ')}
                  {items.length > 5 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="moveType">Type de mouvement</Label>
              <select
                id="moveType"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="IN">Entrée (approvisionnement)</option>
                <option value="OUT">Sortie (distribution)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleMove} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Valider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
