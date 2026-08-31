/**
 * ============================================================================
 * SHOP SUPPLIERS & PROCUREMENT - ACADEMIA HELM
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
import { Loader2, Truck, FileText, Plus, Phone, Mail, MoreVertical, ChevronRight } from 'lucide-react';
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

interface SupplierItem {
  id?: string;
  name?: string;
  category?: string;
  type?: string;
  phone?: string;
  email?: string;
  ordersCount?: number;
  totalAmount?: number;
  total?: number;
}

interface PurchaseOrderItem {
  id?: string;
  refNo?: string;
  reference?: string;
  number?: string;
  supplierName?: string;
  supplier?: string;
  amount?: number;
  total?: number;
  status?: string;
  deliveryDate?: string;
  expectedDate?: string;
  date?: string;
}

export default function ShopSuppliers() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: suppliers, loading: supLoading, error: supError, refetch: refetchSuppliers } = useModulesList<SupplierItem>(
    'shop',
    'suppliers',
    academicYear?.id,
  );
  const { data: purchaseOrders, loading: poLoading, error: poError, refetch: refetchPOs } = useModulesList<PurchaseOrderItem>(
    'shop',
    'purchase-orders',
    academicYear?.id,
  );
  // ⭐ Fetch products for the PO multi-select
  const { data: products } = useModulesList<any>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ⭐ PO form: supplier dropdown + product checkboxes
  const [poSelectedSupplierId, setPoSelectedSupplierId] = useState('');
  const [poSelectedProductIds, setPoSelectedProductIds] = useState<string[]>([]);
  const [supplierForm, setSupplierForm] = useState({ name: '', category: '', phone: '', email: '' });
  const [poForm, setPoForm] = useState({ supplierId: '', items: '' });

  const handleCreateSupplier = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('shop/suppliers', supplierForm, buildModulesApiOptions(academicYear?.id));
      setSupplierModalOpen(false);
      setSupplierForm({ name: '', category: '', phone: '', email: '' });
      await refetchSuppliers();
      toast({ title: 'Fournisseur créé', description: 'Le nouveau fournisseur a été ajouté.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du fournisseur',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePO = async () => {
    try {
      setSubmitting(true);
      // ⭐ FIX: Build PO items from selected products (checkbox multi-select)
      const items = poSelectedProductIds.map((productId: string) => {
        const product = (products ?? []).find((p: any) => p.id === productId);
        return {
          productId,
          quantity: 1,
          unitPrice: Number(product?.unitPrice ?? 0),
          totalPrice: Number(product?.unitPrice ?? 0),
        };
      });
      await modulesApi.post('shop/purchase-orders', {
        supplierId: poSelectedSupplierId,
        items,
      }, buildModulesApiOptions(academicYear?.id));
      setPoModalOpen(false);
      setPoSelectedSupplierId('');
      setPoSelectedProductIds([]);
      setPoForm({ supplierId: '', items: '' });
      await refetchPOs();
      toast({ title: 'Bon de commande créé', description: 'Le PO a été enregistré.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du bon de commande',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (supLoading || poLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des fournisseurs...</span>
      </div>
    );
  }

  const errorMsg = supError || poError;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {errorMsg && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données d'approvisionnement. {errorMsg}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Fournisseurs & Approvisionnement</h3>
          <p className="text-sm text-gray-500">Gérez votre réseau de partenaires et vos bons de commande (PO)</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setPoModalOpen(true)}>
            <FileText className="w-4 h-4 mr-2" />
            Nouveau Bon de Commande
          </Button>
          <Button onClick={() => setSupplierModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Fournisseur
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Suppliers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(suppliers ?? []).length === 0 ? (
              <div className="md:col-span-2 text-center py-12 text-gray-500">
                Aucun fournisseur enregistré pour cette année scolaire.
              </div>
            ) : (
              (suppliers ?? []).map((supplier: any, i: number) => (
                <SupplierCard
                  key={supplier?.id ?? `sup-${i}`}
                  name={supplier?.name ?? `Fournisseur #${i + 1}`}
                  category={supplier?.category ?? supplier?.type ?? 'Général'}
                  phone={supplier?.phone ?? '—'}
                  email={supplier?.email ?? '—'}
                  stats={{
                    orders: supplier?.ordersCount ?? 0,
                    total: supplier?.totalAmount ?? supplier?.total ?? 0,
                  }}
                />
              ))
            )}
          </div>

          {/* Active Purchase Orders */}
          <Card className="shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-navy-900">Bons de Commande Récents</h3>
              <Button variant="link" size="sm" className="text-xs">Voir tout le registre</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>N° PO</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date Livraison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(purchaseOrders ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-gray-400 py-12">
                        Aucun bon de commande enregistré.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (purchaseOrders ?? []).map((po: any, i: number) => (
                      <PORow
                        key={po?.id ?? `po-${i}`}
                        id={po?.refNo ?? po?.reference ?? po?.number ?? po?.id ?? `ACH-${i}`}
                        supplier={po?.supplierName ?? po?.supplier ?? '—'}
                        amount={po?.amount ?? po?.total ?? 0}
                        status={po?.status ?? 'En Attente'}
                        date={po?.deliveryDate ?? po?.expectedDate ?? po?.date ?? '—'}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        {/* Procurement Analytics */}
        <div className="space-y-6">
          <Card className="p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-6">Répartition des Achats</h3>
            <div className="space-y-4">
              <ProcurementCategory label="Textile / Uniformes" amount={0} percent={45} color="indigo" />
              <ProcurementCategory label="Papeterie" amount={0} percent={30} color="emerald" />
              <ProcurementCategory label="Livres" amount={0} percent={15} color="blue" />
              <ProcurementCategory label="Autres" amount={0} percent={10} color="amber" />
            </div>
            {(suppliers ?? []).length === 0 && (
              <p className="mt-6 text-xs text-gray-400 text-center">Données d'analyse non disponibles.</p>
            )}
          </Card>

          <Card className="p-6 bg-slate-900 text-white shadow-md border-0 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-5 h-5 text-indigo-300" />
                <h3 className="text-sm font-semibold">Optimisation ORION</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                L'analyse des performances fournisseurs sera disponible une fois vos données d'achat renseignées.
              </p>
              <Button variant="outline" size="sm" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                Analyser les performances
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Supplier Modal */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Nom</Label>
              <Input type="text" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Type de fournisseur</Label>
              <Input type="text" value={supplierForm.category} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })} placeholder="ex: Textile & Uniforme, Fournitures..." />
            </div>
            <div>
              <Label className="text-xs">Téléphone</Label>
              <Input type="text" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateSupplier} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer le fournisseur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Order Modal */}
      <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Bon de Commande</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Fournisseur</Label>
              <select
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/30 bg-white"
                value={poSelectedSupplierId}
                onChange={(e) => setPoSelectedSupplierId(e.target.value)}
              >
                <option value="">— Sélectionner un fournisseur —</option>
                {(suppliers ?? []).filter((s: any) => s.isActive !== false).map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.category ? ` (${s.category})` : ''}
                  </option>
                ))}
              </select>
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
                        checked={poSelectedProductIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPoSelectedProductIds([...poSelectedProductIds, p.id]);
                          } else {
                            setPoSelectedProductIds(poSelectedProductIds.filter(id => id !== p.id));
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
              {poSelectedProductIds.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">{poSelectedProductIds.length} article(s) sélectionné(s)</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreatePO} disabled={submitting || !poSelectedSupplierId || poSelectedProductIds.length === 0}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer le bon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierCard({ name, category, phone, email, stats }: any) {
  return (
    <Card className="p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
          <Truck className="w-5 h-5" />
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      <h4 className="text-base font-semibold text-navy-900 mb-1">{name}</h4>
      <Badge variant="outline" className="text-xs mb-4">{category}</Badge>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-gray-500">
          <Phone className="w-3.5 h-3.5" />
          <span className="text-xs">{phone}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500">
          <Mail className="w-3.5 h-3.5" />
          <span className="text-xs truncate">{email}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">Commandes</p>
          <p className="text-sm font-semibold text-navy-900">{stats.orders}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Total Volume</p>
          <p className="text-sm font-semibold text-emerald-600">{formatCurrency(stats.total)}</p>
        </div>
      </div>
    </Card>
  );
}

function PORow({ id, supplier, amount, status, date }: any) {
  const statusStyles: any = {
    'Reçu': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'En Transit': 'bg-blue-50 text-blue-700 border-blue-200',
    'En Attente': 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="text-xs font-medium text-navy-900">{id}</TableCell>
      <TableCell className="text-xs text-gray-600">{supplier}</TableCell>
      <TableCell className="text-right text-sm font-semibold text-navy-900">{formatCurrency(amount)}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${statusStyles[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-gray-500">{date}</TableCell>
    </TableRow>
  );
}

function ProcurementCategory({ label, amount, percent, color }: any) {
  const colors: any = {
    indigo: 'bg-indigo-600',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs">
        <span className="text-navy-900 font-medium">{label}</span>
        <span className="text-gray-400">{formatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} transition-all duration-1000`} style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  );
}
