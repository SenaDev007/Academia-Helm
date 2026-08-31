/**
 * ============================================================================
 * SHOP KITS (SCHOOL PACKS) - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Package, Layers, Plus, Edit, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface KitItem {
  id?: string;
  name?: string;
  level?: string;
  grade?: string;
  className?: string;
  itemsCount?: number;
  items?: number;
  itemCount?: number;
  price?: number;
  total?: number;
  popularity?: string;
  promoted?: boolean;
  isPromoted?: boolean;
}

const COLOR_BY_INDEX = ['emerald', 'indigo', 'blue', 'amber', 'emerald', 'indigo'];

export default function ShopKits() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: kits, loading, error, refetch } = useModulesList<KitItem>(
    'shop',
    'kits',
    academicYear?.id,
  );
  // ⭐ Fetch products for the multi-select dropdown
  const { data: products } = useModulesList<any>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kitForm, setKitForm] = useState({ name: '', description: '', price: 0 });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const handleCreateKit = async () => {
    try {
      setSubmitting(true);
      // ⭐ FIX: Build items from selected products (checkbox multi-select)
      const items = selectedProductIds.map((productId: string) => ({ productId, quantity: 1 }));
      await modulesApi.post('shop/kits', {
        name: kitForm.name,
        description: kitForm.description,
        price: kitForm.price,
        items,
      }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setKitForm({ name: '', description: '', price: 0 });
      setSelectedProductIds([]);
      await refetch();
      toast({ title: 'Kit créé', description: 'Le nouveau kit scolaire a été enregistré.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du kit',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeKits = kits ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des kits...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les kits. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Kits Scolaires Par Niveau</h3>
          <p className="text-sm text-gray-500">Composez des packs d'articles obligatoires par classe</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Kit
        </Button>
      </div>

      {/* Kits Grid */}
      {safeKits.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun kit scolaire configuré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {safeKits.map((kit: any, i: number) => (
            <KitCard
              key={kit?.id ?? `kit-${i}`}
              level={kit?.level ?? kit?.grade ?? kit?.className ?? 'Niveau'}
              name={kit?.name ?? `Kit #${i + 1}`}
              items={kit?.itemsCount ?? kit?.items ?? kit?.itemCount ?? 0}
              price={kit?.price ?? kit?.total ?? 0}
              popularity={kit?.popularity ?? 'Stable'}
              color={COLOR_BY_INDEX[i % COLOR_BY_INDEX.length]}
              isPromoted={kit?.isPromoted ?? kit?.promoted ?? false}
            />
          ))}
        </div>
      )}

      {/* Composition Preview (Bottom Section) */}
      <Card className="p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-semibold text-navy-900">Détails de Composition</h3>
            <p className="text-sm text-gray-500">Sélectionnez un kit pour voir et éditer ses articles</p>
          </div>
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
            <Button variant="ghost" size="sm" className="bg-white shadow-sm text-navy-900">Articles</Button>
            <Button variant="ghost" size="sm" className="text-gray-400">Stocks Liés</Button>
          </div>
        </div>

        <div className="space-y-3">
          {safeKits.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">
              Aucun article à afficher. Créez un kit pour commencer.
            </p>
          ) : (
            <KitItemRow name={`Articles du kit : ${safeKits[0]?.name ?? 'Kit sélectionné'}`} qty={safeKits[0]?.itemsCount ?? safeKits[0]?.items ?? 0} price={safeKits[0]?.price ?? safeKits[0]?.total ?? 0} />
          )}
        </div>
      </Card>

      {/* Kit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Kit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nom</Label>
              <Input type="text" value={kitForm.name} onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={kitForm.description}
                onChange={(e) => setKitForm({ ...kitForm, description: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">Prix (FCFA)</Label>
              <Input type="number" value={kitForm.price} onChange={(e) => setKitForm({ ...kitForm, price: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Produits du kit</Label>
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
                <p className="text-xs text-slate-500 mt-1">{selectedProductIds.length} produit(s) sélectionné(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateKit} disabled={submitting || selectedProductIds.length === 0 || !kitForm.name}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer le kit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KitCard({ level, name, items, price, popularity, color, isPromoted }: any) {
  const colors: any = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <Card className={`p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${isPromoted ? 'border-indigo-300' : ''}`}>
      {isPromoted && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-bl-lg shadow-sm">
          Best-Seller
        </div>
      )}

      <div className={`p-3 rounded-lg w-fit mb-4 border ${colors[color]}`}>
        <Package className="w-6 h-6" />
      </div>

      <p className="text-xs text-gray-400 mb-1">{level}</p>
      <h4 className="text-lg font-semibold text-navy-900 mb-4">{name}</h4>

      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-400" />
            <span>{items} Articles inclus</span>
          </span>
          <Badge variant="outline" className="text-xs">{popularity}</Badge>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${isPromoted ? 'bg-indigo-600' : 'bg-slate-200'} transition-all duration-1000`} style={{ width: '75%' }}></div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Prix Pack</p>
          <p className="text-xl font-semibold text-navy-900">{formatCurrency(price)}</p>
        </div>
        <Button size="icon" variant="outline" className="h-10 w-10">
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </Card>
  );
}

function KitItemRow({ name, qty, price, isOptional }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white rounded-md flex items-center justify-center border border-slate-100 shadow-sm">
          <Package className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-navy-900">{name}</p>
            {isOptional && (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Optionnel</Badge>
            )}
          </div>
          <p className="text-xs text-gray-400">Quantité: {qty}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs text-gray-400 mb-0.5">Prix Unitaire</p>
          <p className="text-sm font-semibold text-navy-900">{formatCurrency(price)}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-600">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
