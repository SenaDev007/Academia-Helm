/**
 * ============================================================================
 * EQUIPMENTS INVENTORY
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - alert() + confirm() → useToast() + useConfirmDialog().danger()
 * - 2 modals fixed inset-0 → <Dialog> shadcn
 * - <table>/<thead>/<tbody>/<tr>/<td>/<th> → <Table>/<TableHeader>/<TableBody>/<TableRow>/<TableHead>/<TableCell> shadcn
 * - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Microscope, Search, Filter, Download, Plus, Edit, Trash2, Wrench } from 'lucide-react';
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
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface EquipmentItem {
  id?: string;
  name?: string;
  category?: string;
  equipmentCategory?: string;
  labName?: string;
  lab?: string;
  laboratory?: string;
  status?: string;
  condition?: string;
  lastMaintenance?: string;
  lastMaintenanceDate?: string;
  maintenanceAt?: string;
}

export default function EquipmentsInventory() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const { data: equipments, loading, error, refetch } = useModulesList<EquipmentItem>(
    'labs',
    'equipment',
    academicYear?.id,
  );

  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [maintenanceEquipId, setMaintenanceEquipId] = useState<string | null>(null);
  const [equipForm, setEquipForm] = useState({ labId: '', name: '', type: '', status: 'GOOD' });
  const [maintenanceForm, setMaintenanceForm] = useState({ type: 'PREVENTIVE', cost: 0, date: '' });

  const openCreateModal = () => {
    setEditingId(null);
    setEquipForm({ labId: '', name: '', type: '', status: 'GOOD' });
    setEquipModalOpen(true);
  };

  const openEditModal = (eq: any) => {
    setEditingId(eq?.id ?? null);
    setEquipForm({
      labId: eq?.labId ?? '',
      name: eq?.name ?? '',
      type: eq?.category ?? eq?.equipmentCategory ?? '',
      status: eq?.status ?? eq?.condition ?? 'GOOD',
    });
    setEquipModalOpen(true);
  };

  const openMaintenanceModal = (equipId: string) => {
    setMaintenanceEquipId(equipId);
    setMaintenanceForm({ type: 'PREVENTIVE', cost: 0, date: '' });
    setMaintenanceModalOpen(true);
  };

  const handleSubmitEquipment = async () => {
    if (!equipForm.name?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir un nom d\'équipement.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      if (editingId) {
        await modulesApi.put(`labs/equipment/${editingId}`, equipForm, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Équipement mis à jour', description: equipForm.name });
      } else {
        await modulesApi.post(`labs/${equipForm.labId}/equipment`, equipForm, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Équipement créé', description: equipForm.name });
      }
      setEquipModalOpen(false);
      setEquipForm({ labId: '', name: '', type: '', status: 'GOOD' });
      setEditingId(null);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur d\'enregistrement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement de l\'équipement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    const ok = await confirmDialog.danger(
      'Voulez-vous vraiment supprimer cet équipement ? Cette action est irréversible.',
      'Supprimer l\'équipement',
    );
    if (!ok) return;
    try {
      setActionLoading(id);
      await modulesApi.delete(`labs/equipment/${id}`, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({ title: 'Équipement supprimé' });
    } catch (e: any) {
      toast({
        title: 'Erreur de suppression',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateMaintenance = async () => {
    if (!maintenanceEquipId) return;
    try {
      setSubmitting(true);
      await modulesApi.post(
        `labs/equipment/${maintenanceEquipId}/maintenance`,
        maintenanceForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setMaintenanceModalOpen(false);
      setMaintenanceForm({ type: 'PREVENTIVE', cost: 0, date: '' });
      setMaintenanceEquipId(null);
      await refetch();
      toast({ title: 'Maintenance enregistrée', description: `Type : ${maintenanceForm.type}` });
    } catch (e: any) {
      toast({
        title: 'Erreur d\'enregistrement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement de la maintenance',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeEquipments = equipments ?? [];

  const renderStatusBadge = (status?: string) => {
    const s = (status ?? '').toString().toUpperCase();
    switch (s) {
      case 'NEW':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Neuf</Badge>;
      case 'GOOD':
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Bon État</Badge>;
      case 'AVERAGE':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Moyen</Badge>;
      case 'OUT_OF_ORDER':
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">HS</Badge>;
      default:
        return <Badge variant="outline">{status || '—'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des équipements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les équipements. {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher un équipement (nom, code, catégorie)..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" title="Filtrer">
            <Filter className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="icon" title="Exporter">
            <Download className="w-5 h-5" />
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      <Card className="p-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Équipement</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Laboratoire</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Dernière Maintenance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeEquipments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                  Aucun équipement disponible pour cette année scolaire.
                </TableCell>
              </TableRow>
            ) : (
              safeEquipments.map((eq: any, i: number) => (
                <TableRow key={eq?.id ?? `eq-${i}`} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Microscope className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{eq?.name ?? `Équipement #${i + 1}`}</p>
                        <p className="text-xs text-slate-400">{eq?.id ?? `EQ-${i}`}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {eq?.category ?? eq?.equipmentCategory ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {eq?.labName ?? eq?.lab ?? eq?.laboratory ?? '—'}
                  </TableCell>
                  <TableCell>{renderStatusBadge(eq?.status ?? eq?.condition ?? 'GOOD')}</TableCell>
                  <TableCell>
                    <div className="flex items-center text-xs text-slate-500">
                      <Wrench className="w-3.5 h-3.5 mr-2 text-slate-300" />
                      {eq?.lastMaintenance ?? eq?.lastMaintenanceDate ?? (eq?.maintenanceAt ? new Date(eq.maintenanceAt).toLocaleDateString('fr-FR') : 'N/A')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(eq)} title="Modifier">
                        <Edit className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-amber-50" onClick={() => eq?.id && openMaintenanceModal(eq.id)} title="Maintenance">
                        <Wrench className="w-4 h-4 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-rose-50"
                        onClick={() => eq?.id && handleDeleteEquipment(eq.id)}
                        disabled={actionLoading === eq?.id}
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Equipment Modal */}
      <Dialog open={equipModalOpen} onOpenChange={setEquipModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'Équipement' : 'Ajouter un Équipement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="eq-labId">ID Laboratoire</Label>
              <Input
                id="eq-labId"
                value={equipForm.labId}
                onChange={(e) => setEquipForm({ ...equipForm, labId: e.target.value })}
                disabled={!!editingId}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-name">Nom</Label>
              <Input
                id="eq-name"
                value={equipForm.name}
                onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-type">Type</Label>
              <Input
                id="eq-type"
                value={equipForm.type}
                onChange={(e) => setEquipForm({ ...equipForm, type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eq-status">État</Label>
              <select
                id="eq-status"
                value={equipForm.status}
                onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="NEW">Neuf</option>
                <option value="GOOD">Bon État</option>
                <option value="AVERAGE">Moyen</option>
                <option value="OUT_OF_ORDER">HS</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmitEquipment} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : editingId ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Modal */}
      <Dialog open={maintenanceModalOpen} onOpenChange={setMaintenanceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enregistrer une Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mnt-type">Type</Label>
              <select
                id="mnt-type"
                value={maintenanceForm.type}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="PREVENTIVE">Préventive</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="CALIBRATION">Étalonnage</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mnt-cost">Coût</Label>
              <Input
                id="mnt-cost"
                type="number"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mnt-date">Date</Label>
              <Input
                id="mnt-date"
                type="date"
                value={maintenanceForm.date}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateMaintenance} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog.dialog}
    </div>
  );
}
