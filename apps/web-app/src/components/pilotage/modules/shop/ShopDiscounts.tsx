/**
 * ============================================================================
 * SHOP DISCOUNTS & PROMOTIONS - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Percent, Plus, Search, Trash2, Edit, CheckCircle2, Ticket } from 'lucide-react';
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

interface DiscountItem {
  id?: string;
  name?: string;
  code?: string;
  couponCode?: string;
  value?: number;
  amount?: number;
  type?: string;
  discountType?: string;
  usageCount?: number;
  maxUsage?: number;
  usageLimit?: number;
  validUntil?: string;
  endDate?: string;
  validFrom?: string;
  status?: string;
  active?: boolean;
}

export default function ShopDiscounts() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: discounts, loading, error, refetch } = useModulesList<DiscountItem>(
    'shop',
    'discounts',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discountForm, setDiscountForm] = useState({ code: '', percentage: 0, validUntil: '' });

  const handleCreateDiscount = async () => {
    try {
      setSubmitting(true);
      // ⭐ FIX: Backend expects { name, type, value, code, startDate?, endDate? }
      //    — not { code, percentage, validUntil }
      await modulesApi.post('shop/discounts', {
        name: discountForm.code || `Remise ${discountForm.percentage}%`,
        type: 'PERCENTAGE',
        value: discountForm.percentage,
        code: discountForm.code,
        endDate: discountForm.validUntil || undefined,
      }, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setDiscountForm({ code: '', percentage: 0, validUntil: '' });
      await refetch();
      toast({ title: 'Promotion créée', description: 'La nouvelle remise a été enregistrée.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la remise',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeDiscounts = discounts ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des promotions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les promotions. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Remises & Promotions</h3>
          <p className="text-sm text-gray-500">Gérez les codes promos, soldes et remises automatiques</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Promotion
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-base font-semibold text-navy-900">Promotions Actives</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="text" placeholder="Rechercher..." className="pl-9 h-9 w-48" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Nom / Code</TableHead>
                    <TableHead className="text-right">Valeur</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Validité</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeDiscounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-12">
                        Aucune promotion active pour cette année scolaire.
                      </TableCell>
                    </TableRow>
                  ) : (
                    safeDiscounts.map((d: any, i: number) => {
                      const value = d?.value ?? d?.amount ?? 0;
                      const maxUsage = d?.maxUsage ?? d?.usageLimit;
                      const usage = d?.usageCount ?? 0;
                      const usageDisplay = maxUsage ? `${usage}/${maxUsage}` : `${usage}/∞`;
                      const valid = d?.validUntil ?? d?.endDate ?? 'Permanent';
                      return (
                        <DiscountRow
                          key={d?.id ?? `disc-${i}`}
                          name={d?.name ?? `Promotion #${i + 1}`}
                          code={d?.code ?? d?.couponCode ?? '—'}
                          value={`-${value}%`}
                          type={(d?.type ?? d?.discountType ?? 'CODE PROMO').toString().toUpperCase()}
                          usage={usageDisplay}
                          valid={valid}
                          status={d?.active === false ? 'Inactif' : 'Actif'}
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
          <Card className="p-6 bg-slate-900 text-white shadow-md border-0 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 bg-white/10 rounded-md">
                  <Percent className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold">Analyse ORION</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Les analyses prédictives de performance des promotions seront disponibles après quelques semaines d'utilisation.
              </p>
              <div className="flex flex-col space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Conversion</span>
                  <span className="text-emerald-300">—</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-0"></div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-navy-900 mb-4">Coupons à usage unique</h3>
            <div className="space-y-3">
              <CouponItem code="—" used={false} />
            </div>
            <Button variant="outline" className="w-full mt-4">
              Générer des coupons
            </Button>
          </Card>
        </div>
      </div>

      {/* Discount Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Remise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Code</Label>
              <Input type="text" value={discountForm.code} onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Pourcentage (%)</Label>
              <Input type="number" value={discountForm.percentage} onChange={(e) => setDiscountForm({ ...discountForm, percentage: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Valide jusqu'à</Label>
              <Input type="date" value={discountForm.validUntil} onChange={(e) => setDiscountForm({ ...discountForm, validUntil: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateDiscount} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Création...' : 'Créer la remise'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiscountRow({ name, code, value, type, usage, valid, status }: any) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <p className="text-sm font-medium text-navy-900">{name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Ticket className="w-3 h-3 text-gray-300" />
          <span className="text-xs text-gray-400">{code}</span>
        </div>
      </TableCell>
      <TableCell className="text-right text-sm font-semibold text-emerald-600">{value}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">{type}</Badge>
      </TableCell>
      <TableCell className="text-xs text-gray-600">{usage}</TableCell>
      <TableCell className="text-xs text-gray-500">{valid}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Modifier">
            <Edit className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-600" title="Supprimer">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CouponItem({ code, used }: any) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${used ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
      <span className={`text-xs font-mono ${used ? 'line-through text-gray-400' : 'text-navy-900'}`}>{code}</span>
      {used ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-amber-500"></div>}
    </div>
  );
}
