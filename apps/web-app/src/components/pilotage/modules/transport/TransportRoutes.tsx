'use client';

import { useState } from 'react';
import { Route, Plus, Search, MapPin, Clock, Users, ArrowRight, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface RouteItem {
  id: string;
  name?: string;
  code?: string;
  zoneId?: string;
  zone?: string;
  stops?: number;
  stopCount?: number;
  students?: number;
  studentCount?: number;
  morning?: string;
  morningTime?: string;
  evening?: string;
  eveningTime?: string;
  vehicle?: string;
  vehicleName?: string;
  [key: string]: any;
}

const EMPTY_FORM = { name: '', zoneId: '', stops: '' };
const EMPTY_STOP_FORM = { name: '', time: '', lat: '', lng: '' };

export default function TransportRoutes() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<RouteItem>('transport', 'routes', academicYear?.id);
  const { toast } = useToast();

  const routes = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ name: string; zoneId: string; stops: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Stop add modal
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [stopRouteId, setStopRouteId] = useState<string | null>(null);
  const [stopForm, setStopForm] = useState(EMPTY_STOP_FORM);
  const [stopSubmitting, setStopSubmitting] = useState(false);

  const handleCreateRoute = async () => {
    try {
      setSubmitting(true);
      const payload: any = {
        name: formData.name,
        zoneId: formData.zoneId || undefined,
      };
      if (formData.stops.trim()) {
        payload.stops = formData.stops.split(',').map((s) => s.trim()).filter(Boolean).map((name, idx) => ({
          name,
          order: idx + 1,
        }));
      }
      await modulesApi.post('transport/routes', payload, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Itinéraire créé', description: `${formData.name || 'Itinéraire'} ajouté.` });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création de la route',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStop = async () => {
    if (!stopRouteId) return;
    try {
      setStopSubmitting(true);
      const payload: any = {
        name: stopForm.name,
        time: stopForm.time || undefined,
      };
      if (stopForm.lat) payload.lat = Number(stopForm.lat);
      if (stopForm.lng) payload.lng = Number(stopForm.lng);
      await modulesApi.post(`transport/routes/${stopRouteId}/stops`, payload, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Arrêt ajouté', description: `${stopForm.name || 'Arrêt'} ajouté à l'itinéraire.` });
      setStopModalOpen(false);
      setStopForm(EMPTY_STOP_FORM);
      setStopRouteId(null);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'ajout de l\'arrêt',
        variant: 'destructive',
      });
    } finally {
      setStopSubmitting(false);
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
            placeholder="Rechercher un itinéraire..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouvel Itinéraire
        </Button>
      </div>

      {routes.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {routes.map((route) => {
            const name = route.name || `Itinéraire ${route.id}`;
            const code = route.code || '—';
            const stops = route.stops ?? route.stopCount ?? 0;
            const students = route.students ?? route.studentCount ?? 0;
            const morning = route.morning || route.morningTime || '—';
            const evening = route.evening || route.eveningTime || '—';
            const vehicle = route.vehicle || route.vehicleName || '—';
            return (
              <Card key={route.id} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 rounded-xl text-indigo-700">
                      <Route className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{name}</h4>
                      <p className="text-xs font-medium text-gray-500">{code}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Véhicule</p>
                    <p className="text-xs font-semibold text-gray-900">{vehicle}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs font-medium">Arrêts</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{stops}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-400">
                      <Users className="w-3 h-3" />
                      <span className="text-xs font-medium">Élèves</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">{students}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs font-medium">Horaires</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900">{morning}</span>
                      <ArrowRight className="w-3 h-3 text-gray-300" />
                      <span className="text-xs font-semibold text-gray-900">{evening}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setStopRouteId(route.id);
                    setStopForm(EMPTY_STOP_FORM);
                    setStopModalOpen(true);
                  }}
                >
                  Gérer les arrêts et l'itinéraire
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel itinéraire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rt-name">Nom de l'itinéraire</Label>
              <Input
                id="rt-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Circuit Nord"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-zone">Zone (ID)</Label>
              <Input
                id="rt-zone"
                type="text"
                value={formData.zoneId}
                onChange={(e) => setFormData({ ...formData, zoneId: e.target.value })}
                placeholder="zone-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-stops">Arrêts (séparés par une virgule)</Label>
              <Input
                id="rt-stops"
                type="text"
                value={formData.stops}
                onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
                placeholder="Rond-point Central, Marché, École"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateRoute} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={stopModalOpen} onOpenChange={setStopModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un arrêt</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="st-name">Nom de l'arrêt</Label>
              <Input
                id="st-name"
                type="text"
                value={stopForm.name}
                onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })}
                placeholder="Rond-point Central"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-time">Heure (optionnel)</Label>
              <Input
                id="st-time"
                type="text"
                value={stopForm.time}
                onChange={(e) => setStopForm({ ...stopForm, time: e.target.value })}
                placeholder="07:15"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="st-lat">Latitude (optionnel)</Label>
                <Input
                  id="st-lat"
                  type="text"
                  value={stopForm.lat}
                  onChange={(e) => setStopForm({ ...stopForm, lat: e.target.value })}
                  placeholder="6.365"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="st-lng">Longitude (optionnel)</Label>
                <Input
                  id="st-lng"
                  type="text"
                  value={stopForm.lng}
                  onChange={(e) => setStopForm({ ...stopForm, lng: e.target.value })}
                  placeholder="2.418"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopModalOpen(false)}>Annuler</Button>
            <Button onClick={handleAddStop} disabled={stopSubmitting}>
              {stopSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
