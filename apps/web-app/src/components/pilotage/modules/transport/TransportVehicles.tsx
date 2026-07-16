'use client';

import { useState } from 'react';
import { Bus, Plus, Search, Filter, Users, Gauge, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  plate?: string;
  registrationPlate?: string;
  type?: string;
  capacity?: number;
  status?: string;
  driver?: string;
  driverName?: string;
  [key: string]: any;
}

const EMPTY_FORM = { name: '', plate: '', model: '', capacity: '', type: 'Bus Scolaire' };

export default function TransportVehicles() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<VehicleItem>('transport', 'vehicles', academicYear?.id);
  const { toast } = useToast();

  const vehicles = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{ name: string; plate: string; model: string; capacity: string; type: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (v: VehicleItem) => {
    setFormData({
      name: v.name || '',
      plate: v.plate || v.registrationPlate || '',
      model: v.model || v.type || '',
      capacity: String(v.capacity ?? ''),
      type: v.type || 'Bus Scolaire',
    });
    setEditId(v.id);
    setModalOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        plate: formData.plate,
        registrationPlate: formData.plate,
        model: formData.model,
        type: formData.type,
        capacity: Number(formData.capacity) || 0,
      };
      if (editId) {
        await modulesApi.put(`transport/vehicles/${editId}`, payload, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Véhicule mis à jour', description: `${payload.name || 'Véhicule'} enregistré.` });
      } else {
        await modulesApi.post('transport/vehicles', payload, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Véhicule créé', description: `${payload.name || 'Véhicule'} ajouté au parc.` });
      }
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditId(null);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement',
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
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un véhicule..."
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Filter className="w-4 h-4" /> Filtrer
          </Button>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Nouveau Véhicule
          </Button>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {vehicles.map((vehicle) => {
            const name = vehicle.name || vehicle.id;
            const plate = vehicle.plate || vehicle.registrationPlate || '—';
            const capacity = vehicle.capacity ?? 0;
            const status = vehicle.status || 'AVAILABLE';
            const driver = vehicle.driver || vehicle.driverName || 'Non assigné';
            return (
              <Card key={vehicle.id} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${
                      status === 'ACTIVE' ? 'bg-emerald-50' :
                      status === 'MAINTENANCE' ? 'bg-rose-50' : 'bg-gray-50'
                    }`}>
                      <Bus className={`w-6 h-6 ${
                        status === 'ACTIVE' ? 'text-emerald-600' :
                        status === 'MAINTENANCE' ? 'text-rose-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{name}</h4>
                      <p className="text-xs font-medium text-gray-500">{plate}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                      <Users className="w-3 h-3" />
                      <span className="text-xs font-medium">Capacité</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{capacity} places</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1 text-gray-400">
                      <Gauge className="w-3 h-3" />
                      <span className="text-xs font-medium">Statut</span>
                    </div>
                    <p className={`text-sm font-semibold ${
                      status === 'ACTIVE' ? 'text-emerald-600' :
                      status === 'MAINTENANCE' ? 'text-rose-600' : 'text-gray-900'
                    }`}>{status}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                      {driver.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-0.5">Chauffeur</p>
                      <p className="text-xs font-semibold text-gray-900">{driver}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(vehicle)}>
                    Modifier
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Modifier le véhicule' : 'Nouveau véhicule'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="veh-name">Nom</Label>
              <Input
                id="veh-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Bus scolaire A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="veh-plate">Plaque d'immatriculation</Label>
              <Input
                id="veh-plate"
                type="text"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
                placeholder="AB-123-CD"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="veh-model">Modèle</Label>
              <Input
                id="veh-model"
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="Mercedes Sprinter"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="veh-capacity">Capacité</Label>
                <Input
                  id="veh-capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="veh-type">Type</Label>
                <select
                  id="veh-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
                >
                  <option>Bus Scolaire</option>
                  <option>Mini-bus</option>
                  <option>Van</option>
                  <option>4x4</option>
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateOrUpdate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
