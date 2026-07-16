/**
 * ============================================================================
 * STOCKS & APPROVISIONNEMENT
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 2 alert() → 2 toast() (création demande + changement statut) + toasts destructifs pour les erreurs
 * - 1 modal fixed inset-0 → <Dialog> shadcn
 * - <table>/<thead>/<tbody>/<tr>/<td>/<th> → <Table> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Bouton "Créer une Demande" bg-navy-900 → <Button> shadcn
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Package, ShoppingCart, TrendingDown, Truck, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  quantity?: number;
  qty?: number;
  unit?: string;
  status?: string;
  cost?: number;
  unitPrice?: number;
  price?: number;
  estimatedCost?: string;
  requestStatus?: string;
  date?: string;
  requestedAt?: string;
  createdAt?: string;
}

export default function StocksApprovisionnement() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: consumables, loading, error, refetch } = useModulesList<ConsumableItem>(
    'labs',
    'consumables',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requestForm, setRequestForm] = useState({ consumableId: '', quantity: 0, supplierId: '' });

  const handleCreateRequest = async () => {
    if (!requestForm.consumableId?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir l\'ID consommable.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('labs/purchase-requests', requestForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setRequestForm({ consumableId: '', quantity: 0, supplierId: '' });
      await refetch();
      toast({
        title: 'Demande créée',
        description: `${requestForm.quantity} unité(s) demandées.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de création',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la demande',
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
        `labs/purchase-requests/${id}/status`,
        { status: newStatus },
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Statut mis à jour', description: newStatus });
    } catch (e: any) {
      toast({
        title: 'Erreur de mise à jour',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors du changement de statut',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const safeItems = consumables ?? [];

  const inStockCount = safeItems.length;
  const alertCount = safeItems.filter((c: any) => {
    const s = (c?.status ?? '').toString().toUpperCase();
    return s.includes('LOW') || s.includes('CRITICAL') || s.includes('FAIBLE');
  }).length;
  const pendingOrdersCount = safeItems.filter((c: any) => {
    const s = (c?.requestStatus ?? c?.status ?? '').toString().toUpperCase();
    return s.includes('PENDING') || s.includes('ORDERED') || s.includes('ATTENTE');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des approvisionnements...</span>
      </div>
    );
  }

  const statusBadgeClass = (s: string) => {
    const v = (s ?? '').toString().toUpperCase();
    if (v === 'APPROVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (v === 'PENDING') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (v === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données d&apos;approvisionnement. {error}
        </div>
      )}

      {/* Stock Health & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm flex items-center gap-4 hover:border-emerald-200 transition-all">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{inStockCount}</p>
            <p className="text-xs text-slate-400">Articles en Stock</p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm flex items-center gap-4 hover:border-rose-200 transition-all">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">
            <TrendingDown className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{alertCount}</p>
            <p className="text-xs text-slate-400">Articles en Alerte</p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-semibold text-slate-900">{pendingOrdersCount}</p>
            <p className="text-xs text-slate-400">Commandes en Cours</p>
          </div>
        </Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Demandes d&apos;Approvisionnement</h3>
        <Button onClick={() => setModalOpen(true)}>
          <ShoppingCart className="w-4 h-4 mr-2" />
          Créer une Demande
        </Button>
      </div>

      {/* Requests Table */}
      <Card className="p-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Article & Quantité</TableHead>
              <TableHead>Coût Estimé</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date Demande</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                  Aucune demande d&apos;approvisionnement pour cette année scolaire.
                </TableCell>
              </TableRow>
            ) : (
              safeItems.map((req: any, i: number) => {
                const name = req?.name ?? `Article #${i + 1}`;
                const qty = req?.quantity ?? req?.qty ?? 0;
                const id = req?.id ?? `REQ-${i}`;
                const costValue = req?.cost ?? req?.unitPrice ?? req?.price ?? 0;
                const cost = req?.estimatedCost ?? (costValue > 0 ? `${costValue.toLocaleString('fr-FR')} F CFA` : '—');
                const status = (req?.requestStatus ?? req?.status ?? 'PENDING').toString().toUpperCase();
                const statusValue = ['PENDING', 'APPROVED', 'REJECTED', 'ORDERED'].includes(status) ? status : 'PENDING';
                const date = req?.date ?? (req?.requestedAt ?? req?.createdAt ? new Date(req.requestedAt ?? req.createdAt).toLocaleDateString('fr-FR') : '—');
                return (
                  <TableRow key={id} className="hover:bg-slate-50">
                    <TableCell>
                      <div>
                        <p className="font-semibold text-slate-900">{name}</p>
                        <p className="text-xs text-slate-400">QTÉ : {qty} • {id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-900">{cost}</TableCell>
                    <TableCell>
                      {id && !id.startsWith('REQ-') ? (
                        <select
                          value={statusValue}
                          onChange={(e) => handleStatusChange(id, e.target.value)}
                          disabled={actionLoading === id}
                          className={`inline-flex items-center px-3 py-1.5 rounded-md border text-xs font-medium outline-none disabled:opacity-50 ${statusBadgeClass(statusValue)}`}
                        >
                          <option value="PENDING">En attente</option>
                          <option value="APPROVED">Approuvée</option>
                          <option value="REJECTED">Rejetée</option>
                          <option value="ORDERED">Commandée</option>
                        </select>
                      ) : (
                        <Badge variant="outline" className={statusBadgeClass(status)}>
                          {status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                          {status === 'PENDING' && <Clock className="w-3.5 h-3.5 mr-1" />}
                          {status === 'ORDERED' && <Truck className="w-3.5 h-3.5 mr-1" />}
                          {status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{date}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" className="text-blue-600" size="sm">
                        Détails
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Request Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Demande d&apos;Achat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="req-consId">ID Consommable</Label>
              <Input
                id="req-consId"
                value={requestForm.consumableId}
                onChange={(e) => setRequestForm({ ...requestForm, consumableId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-qty">Quantité</Label>
              <Input
                id="req-qty"
                type="number"
                value={requestForm.quantity}
                onChange={(e) => setRequestForm({ ...requestForm, quantity: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-supId">ID Fournisseur</Label>
              <Input
                id="req-supId"
                value={requestForm.supplierId}
                onChange={(e) => setRequestForm({ ...requestForm, supplierId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateRequest} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
