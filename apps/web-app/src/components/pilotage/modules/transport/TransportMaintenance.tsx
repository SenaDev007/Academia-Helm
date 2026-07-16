'use client';

import { useState } from 'react';
import { Plus, Wrench, AlertCircle, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface VehicleItem {
  id: string;
  name?: string;
  vehicleName?: string;
  maintenance?: any;
  maintenances?: Array<{
    id?: string;
    type?: string;
    maintenanceType?: string;
    date?: string;
    maintenanceDate?: string;
    cost?: string;
    maintenanceCost?: string;
    status?: string;
    maintenanceStatus?: string;
  }>;
  [key: string]: any;
}

interface MaintenanceRow {
  id: string;
  vehicleId: string;
  vehicle: string;
  type: string;
  date: string;
  cost: string;
  status: string;
}

const EMPTY_FORM = { vehicleId: '', type: 'PREVENTIVE', cost: '', date: new Date().toISOString().slice(0, 10) };

export default function TransportMaintenance() {
  const { academicYear } = useModuleContext();
  // Récupère les véhicules avec un filtre "maintenance" pour cibler les entretiens
  const { data, loading, error, refetch } = useModulesList<VehicleItem>('transport', 'vehicles', academicYear?.id, { maintenance: true });
  const { toast } = useToast();

  const vehicles = data ?? [];

  // Aplatit les maintenances imbriquées dans chaque véhicule
  const maintenances: MaintenanceRow[] = vehicles.flatMap((v) => {
    const vehicleName = v.name || v.vehicleName || `Véhicule ${v.id}`;
    const list = Array.isArray(v.maintenance) ? v.maintenance : (v.maintenances ?? []);
    if (list.length === 0) {
      return [{
        id: v.id,
        vehicleId: v.id,
        vehicle: vehicleName,
        type: '—',
        date: '',
        cost: '—',
        status: 'NONE',
      }];
    }
    return list.map((m, idx) => ({
      id: m.id ?? `${v.id}-${idx}`,
      vehicleId: v.id,
      vehicle: vehicleName,
      type: m.type || m.maintenanceType || '—',
      date: m.date || m.maintenanceDate || '',
      cost: m.cost || m.maintenanceCost || '—',
      status: m.status || m.maintenanceStatus || 'PLANNED',
    }));
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ vehicleId: string; type: string; cost: string; date: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.vehicleId) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir l\'ID du véhicule.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        type: formData.type,
        cost: Number(formData.cost) || 0,
        date: formData.date,
      };
      await modulesApi.post(`transport/vehicles/${formData.vehicleId}/maintenance`, payload, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Maintenance enregistrée', description: `Entretien ${formData.type} ajouté au véhicule.` });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de la maintenance',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-indigo-700" /> Maintenance Préventive
        </h3>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouvelle Maintenance
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-4 py-3">Véhicule</TableHead>
                    <TableHead className="px-4 py-3">Type d'entretien</TableHead>
                    <TableHead className="px-4 py-3">Date</TableHead>
                    <TableHead className="px-4 py-3">Statut</TableHead>
                    <TableHead className="px-4 py-3 text-right">Coût</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-10 text-center text-gray-500 text-sm">
                        Aucune donnée disponible pour cette année scolaire.
                      </TableCell>
                    </TableRow>
                  ) : maintenances.map((m) => (
                    <TableRow key={m.id} className="hover:bg-slate-50">
                      <TableCell className="px-4 py-3 font-semibold text-gray-900 text-sm">{m.vehicle}</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium text-gray-700">{m.type}</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium text-gray-700">{m.date ? new Date(m.date).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            m.status === 'COMPLETED'
                              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              : 'border-blue-200 text-blue-700 bg-blue-50'
                          }
                        >
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">{m.cost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-6 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-900 mb-4">Alertes Maintenance</h4>
            <div className="space-y-3">
              <div className="flex gap-3 p-4 rounded-xl bg-rose-50 border border-rose-100">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-rose-900 mb-1">Visite technique</p>
                  <p className="text-xs font-medium text-rose-700">Bus #02 expiré le 12/05</p>
                </div>
              </div>
              <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-900 mb-1">Pneumatiques</p>
                  <p className="text-xs font-medium text-amber-700">Bus #01 à vérifier (15,000km)</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mn-vehicle">Vehicle ID</Label>
              <Input
                id="mn-vehicle"
                type="text"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                placeholder="vehicle-001"
              />
              {vehicles.length > 0 && (
                <p className="text-xs text-gray-500">
                  IDs disponibles : {vehicles.slice(0, 5).map((v) => v.id).join(', ')}
                  {vehicles.length > 5 ? '…' : ''}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mn-type">Type d'entretien</Label>
              <select
                id="mn-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
              >
                <option value="PREVENTIVE">Préventive</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="TECHNICAL_INSPECTION">Visite technique</option>
                <option value="TIRES">Pneumatiques</option>
                <option value="OIL_CHANGE">Vidange</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mn-cost">Coût (FCFA)</Label>
              <Input
                id="mn-cost"
                type="number"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                placeholder="50000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mn-date">Date</Label>
              <Input
                id="mn-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
