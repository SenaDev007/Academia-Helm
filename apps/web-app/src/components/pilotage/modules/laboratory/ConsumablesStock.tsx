/**
 * ============================================================================
 * CONSUMABLES STOCK
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 2 alert() → 2 toast() (création consommable + mouvement stock)
 * - 2 modals fixed inset-0 → <Dialog> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Droplets, Search, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Calendar, MoreHorizontal, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ConsumableItem {
  id?: string;
  name?: string;
  category?: string;
  cat?: string;
  quantity?: number;
  qty?: number;
  unit?: string;
  status?: string;
  expiry?: string;
  expiryDate?: string;
  expiresAt?: string;
}

export default function ConsumablesStock() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: consumables, loading, error, refetch } = useModulesList<ConsumableItem>(
    'labs',
    'consumables',
    academicYear?.id,
  );

  const [consumableModalOpen, setConsumableModalOpen] = useState(false);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [moveConsumableId, setMoveConsumableId] = useState<string | null>(null);
  const [consumableForm, setConsumableForm] = useState({ labId: '', name: '', unit: 'unité(s)', quantity: 0 });
  const [moveForm, setMoveForm] = useState({ quantity: 0, type: 'IN' });

  const handleCreateConsumable = async () => {
    if (!consumableForm.name?.trim() || !consumableForm.labId?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir un nom et un ID laboratoire.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `labs/${consumableForm.labId}/consumables`,
        consumableForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setConsumableModalOpen(false);
      setConsumableForm({ labId: '', name: '', unit: 'unité(s)', quantity: 0 });
      await refetch();
      toast({ title: 'Consommable créé', description: consumableForm.name });
    } catch (e: any) {
      toast({
        title: 'Erreur de création',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du consommable',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openMoveModal = (consumableId: string, type: 'IN' | 'OUT') => {
    setMoveConsumableId(consumableId);
    setMoveForm({ quantity: 0, type });
    setMoveModalOpen(true);
  };

  const handleStockMove = async () => {
    if (!moveConsumableId) return;
    try {
      setSubmitting(true);
      await modulesApi.post(
        `labs/consumables/${moveConsumableId}/move`,
        moveForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setMoveModalOpen(false);
      setMoveForm({ quantity: 0, type: 'IN' });
      setMoveConsumableId(null);
      await refetch();
      toast({
        title: 'Mouvement enregistré',
        description: `${moveForm.type === 'IN' ? 'Entrée' : 'Sortie'} de ${moveForm.quantity} unité(s).`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de mouvement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors du mouvement de stock',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeConsumables = consumables ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des consommables...</span>
      </div>
    );
  }

  const normalizeStatus = (raw?: string) => {
    const s = (raw ?? '').toString().toUpperCase();
    if (s.includes('CRITICAL') || s.includes('RUPTURE')) return 'CRITICAL';
    if (s.includes('LOW') || s.includes('FAIBLE')) return 'LOW_STOCK';
    return 'IN_STOCK';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les consommables. {error}
        </div>
      )}

      {/* Quick Actions & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input type="text" placeholder="Rechercher un produit..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setConsumableModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un Consommable
          </Button>
          <Button
            variant="outline"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            disabled={!consumables?.[0]?.id}
            onClick={() => consumables?.[0]?.id && openMoveModal(consumables[0].id!, 'IN')}
          >
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Réapprovisionner
          </Button>
          <Button
            variant="outline"
            disabled={!consumables?.[0]?.id}
            onClick={() => consumables?.[0]?.id && openMoveModal(consumables[0].id!, 'OUT')}
          >
            <ArrowUpCircle className="w-4 h-4 mr-2" />
            Sortie Stock
          </Button>
        </div>
      </div>

      {safeConsumables.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun consommable enregistré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeConsumables.map((item: any, i: number) => {
            const name = item?.name ?? `Consommable #${i + 1}`;
            const cat = item?.category ?? item?.cat ?? 'Consommable';
            const qty = item?.quantity ?? item?.qty ?? 0;
            const unit = item?.unit ?? 'unité(s)';
            const status = normalizeStatus(item?.status);
            const expiry = item?.expiry ?? item?.expiryDate ?? (item?.expiresAt ? new Date(item.expiresAt).toLocaleDateString('fr-FR') : 'N/A');
            return (
              <Card key={item?.id ?? `cons-${i}`} className="p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-xl ${
                    status === 'CRITICAL' ? 'bg-rose-50 text-rose-600' :
                    status === 'LOW_STOCK' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    <Droplets className="w-6 h-6" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-5 h-5 text-slate-300" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-1">{cat}</p>
                    <h4 className="text-lg font-semibold text-slate-900">{name}</h4>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-semibold text-slate-900">{qty}</p>
                      <p className="text-xs text-slate-500">{unit}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-xs text-slate-400 mb-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        EXP : {expiry}
                      </div>
                      {status === 'CRITICAL' && (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Rupture proche
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        status === 'IN_STOCK' ? 'bg-emerald-500' :
                        status === 'LOW_STOCK' ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: status === 'IN_STOCK' ? '80%' : status === 'LOW_STOCK' ? '30%' : '10%' }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Consumable Modal */}
      <Dialog open={consumableModalOpen} onOpenChange={setConsumableModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un Consommable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cons-labId">ID Laboratoire</Label>
              <Input
                id="cons-labId"
                value={consumableForm.labId}
                onChange={(e) => setConsumableForm({ ...consumableForm, labId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cons-name">Nom</Label>
              <Input
                id="cons-name"
                value={consumableForm.name}
                onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cons-unit">Unité</Label>
                <Input
                  id="cons-unit"
                  value={consumableForm.unit}
                  onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cons-qty">Quantité</Label>
                <Input
                  id="cons-qty"
                  type="number"
                  value={consumableForm.quantity}
                  onChange={(e) => setConsumableForm({ ...consumableForm, quantity: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsumableModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateConsumable} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Move Modal */}
      <Dialog open={moveModalOpen} onOpenChange={setMoveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mouvement de Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="move-type">Type</Label>
              <select
                id="move-type"
                value={moveForm.type}
                onChange={(e) => setMoveForm({ ...moveForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="IN">Entrée</option>
                <option value="OUT">Sortie</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="move-qty">Quantité</Label>
              <Input
                id="move-qty"
                type="number"
                value={moveForm.quantity}
                onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveModalOpen(false)}>Annuler</Button>
            <Button onClick={handleStockMove} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Valider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
