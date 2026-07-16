/**
 * ============================================================================
 * LABORATORY MAINTENANCE
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 1 alert() → 1 toast() (création maintenance) + 1 toast destructif pour l'erreur
 * - 1 modal fixed inset-0 → <Dialog> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Bouton "Planifier Intervention" bg-navy-900 → <Button> shadcn
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Wrench, Calendar, Shield, ChevronRight, Plus } from 'lucide-react';
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

interface MaintenanceItem {
  id?: string;
  item?: string;
  equipmentName?: string;
  equipment?: string;
  type?: string;
  maintenanceType?: string;
  date?: string;
  scheduledAt?: string;
  maintenanceDate?: string;
  provider?: string;
  serviceProvider?: string;
  technician?: string;
  status?: string;
}

export default function LabMaintenance() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: maintenances, loading, error, refetch } = useModulesList<MaintenanceItem>(
    'labs',
    'maintenance',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({ equipmentId: '', type: 'PREVENTIVE', cost: 0, date: '' });

  const handleCreateMaintenance = async () => {
    if (!maintenanceForm.equipmentId?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir l\'ID équipement.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `labs/equipment/${maintenanceForm.equipmentId}/maintenance`,
        maintenanceForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setMaintenanceForm({ equipmentId: '', type: 'PREVENTIVE', cost: 0, date: '' });
      await refetch();
      toast({ title: 'Maintenance planifiée', description: maintenanceForm.type });
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

  const safeMaintenances = maintenances ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des maintenances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les maintenances. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Wrench className="w-5 h-5 mr-2 text-amber-500" />
            Maintenance & Étalonnage
          </h3>
          <p className="text-slate-500 text-sm">Assurez la précision et la longévité de vos outils.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Planifier Intervention
        </Button>
      </div>

      {safeMaintenances.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune intervention de maintenance planifiée pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {safeMaintenances.map((mnt: any, i: number) => {
            const id = mnt?.id ?? `MNT-${i}`;
            const item = mnt?.item ?? mnt?.equipmentName ?? mnt?.equipment ?? 'Équipement';
            const type = mnt?.type ?? mnt?.maintenanceType ?? 'PRÉVENTIVE';
            const date = mnt?.date ?? mnt?.maintenanceDate ?? (mnt?.scheduledAt ? new Date(mnt.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const provider = mnt?.provider ?? mnt?.serviceProvider ?? mnt?.technician ?? '—';
            const status = (mnt?.status ?? 'PLANNED').toString().toUpperCase();
            return (
              <Card
                key={id}
                className="p-6 shadow-sm hover:shadow-md transition-all border-l-4"
                style={{ borderLeftColor: status === 'PLANNED' ? '#3B82F6' : status === 'IN_PROGRESS' ? '#F59E0B' : '#10B981' }}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">{type}</p>
                    <h4 className="text-lg font-semibold text-slate-900">{item}</h4>
                    <p className="text-xs text-slate-500">{id}</p>
                  </div>
                  <Badge variant="outline" className={
                    status === 'PLANNED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }>
                    {status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center text-sm text-slate-600">
                    <Calendar className="w-4 h-4 mr-2 text-slate-300" />
                    {date}
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <Shield className="w-4 h-4 mr-2 text-slate-300" />
                    {provider}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Button variant="ghost" className="text-slate-500" size="sm">
                    Modifier
                  </Button>
                  <Button variant="link" className="text-blue-600" size="sm">
                    Rapport Technique
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Maintenance Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="m-equipmentId">ID Équipement</Label>
              <Input
                id="m-equipmentId"
                value={maintenanceForm.equipmentId}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, equipmentId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-type">Type</Label>
              <select
                id="m-type"
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
              <Label htmlFor="m-cost">Coût</Label>
              <Input
                id="m-cost"
                type="number"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-date">Date</Label>
              <Input
                id="m-date"
                type="date"
                value={maintenanceForm.date}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateMaintenance} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Planifier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
