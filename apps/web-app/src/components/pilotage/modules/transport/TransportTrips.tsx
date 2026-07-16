'use client';

import { useState } from 'react';
import { Bus, Clock, Activity, Play, CheckCircle2, Loader2 } from 'lucide-react';
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
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface AssignmentItem {
  id: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  vehicle?: string;
  vehicleName?: string;
  vehicleId?: string;
  driver?: string;
  driverName?: string;
  driverId?: string;
  status?: string;
  start?: string;
  startTime?: string;
  expected?: string;
  expectedEnd?: string;
  end?: string;
  endTime?: string;
  expectedStart?: string;
  delay?: number;
  delayMinutes?: number;
  [key: string]: any;
}

const EMPTY_FORM = { vehicleId: '', routeId: '', driverId: '' };

export default function TransportTrips() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<AssignmentItem>('transport', 'assignments', academicYear?.id);
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  const trips = data ?? [];

  const [startModalOpen, setStartModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ vehicleId: string; routeId: string; driverId: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Event modal
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTripId, setEventTripId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState({ type: 'BOARDING', description: '' });
  const [eventSubmitting, setEventSubmitting] = useState(false);

  const handleStartTrip = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/trips/start', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Trajet démarré', description: 'Le trajet est maintenant en cours.' });
      setStartModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors du démarrage du trajet',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTrip = async (tripId: string) => {
    const ok = await confirmDialog.danger(
      'Terminer ce trajet ? Son statut passera à COMPLETED et il sera archivé.',
      'Terminer le trajet',
    );
    if (!ok) return;
    try {
      setActionLoading(tripId);
      await modulesApi.post(`transport/trips/${tripId}/complete`, {}, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Trajet terminé', description: 'Le trajet a été clôturé avec succès.' });
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la finalisation du trajet',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddEvent = async () => {
    if (!eventTripId) return;
    try {
      setEventSubmitting(true);
      await modulesApi.post(`transport/trips/${eventTripId}/events`, eventForm, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Événement enregistré', description: 'L\'événement a été ajouté au journal du trajet.' });
      setEventModalOpen(false);
      setEventForm({ type: 'BOARDING', description: '' });
      setEventTripId(null);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de l\'événement',
        variant: 'destructive',
      });
    } finally {
      setEventSubmitting(false);
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

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Suivi des trajets (Temps réel)</h3>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
            <Activity className="w-3 h-3 mr-1" /> System Live
          </Badge>
          <Button onClick={() => { setFormData(EMPTY_FORM); setStartModalOpen(true); }}>
            <Play className="w-4 h-4" /> Démarrer un Trajet
          </Button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const route = trip.route || trip.routeName || `Trajet ${trip.id}`;
            const vehicle = trip.vehicle || trip.vehicleName || '—';
            const driver = trip.driver || trip.driverName || '—';
            const status = (trip.status || 'PLANNED').toUpperCase();
            const start = trip.start || trip.startTime || '';
            const end = trip.end || trip.endTime || '';
            const expected = trip.expected || trip.expectedEnd || '';
            const expectedStart = trip.expectedStart || '';
            const delay = trip.delay ?? trip.delayMinutes ?? 0;
            const isActive = status === 'IN_PROGRESS' || status === 'ACTIVE';
            return (
              <Card key={trip.id} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${
                      isActive ? 'bg-emerald-50 text-emerald-600' :
                      status === 'COMPLETED' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {isActive ? <Play className="w-6 h-6 animate-pulse" /> :
                       status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">{route}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-500">{vehicle}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs font-medium text-gray-500">{driver}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-500 mb-1">Départ</p>
                      <p className="text-base font-semibold text-gray-900">{start || expectedStart || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        {status === 'COMPLETED' ? 'Arrivée' : 'Estimation'}
                      </p>
                      <p className="text-base font-semibold text-gray-900">{end || expected || '—'}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-500 mb-1">Retard</p>
                      <p className={`text-base font-semibold ${delay > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {delay ? `+${delay} min` : '0 min'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        isActive ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                        status === 'COMPLETED' ? 'border-gray-200 text-gray-700 bg-gray-50' :
                        'border-gray-200 text-gray-500 bg-gray-50'
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-6 pt-6 border-t border-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-gray-500">Progression de l'itinéraire</p>
                      <p className="text-xs font-semibold text-indigo-700">65% complété</p>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEventTripId(trip.id); setEventForm({ type: 'BOARDING', description: '' }); setEventModalOpen(true); }}
                        disabled={actionLoading === trip.id}
                      >
                        Événement
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleCompleteTrip(trip.id)}
                        disabled={actionLoading === trip.id}
                      >
                        {actionLoading === trip.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Terminer
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={startModalOpen} onOpenChange={setStartModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Démarrer un trajet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tr-vehicle">Vehicle ID</Label>
              <Input
                id="tr-vehicle"
                type="text"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                placeholder="vehicle-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-route">Route ID</Label>
              <Input
                id="tr-route"
                type="text"
                value={formData.routeId}
                onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                placeholder="route-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tr-driver">Driver ID</Label>
              <Input
                id="tr-driver"
                type="text"
                value={formData.driverId}
                onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                placeholder="driver-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartModalOpen(false)}>Annuler</Button>
            <Button onClick={handleStartTrip} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Démarrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={eventModalOpen} onOpenChange={setEventModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Événement de trajet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ev-type">Type d'événement</Label>
              <select
                id="ev-type"
                value={eventForm.type}
                onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
              >
                <option value="BOARDING">Embarquement</option>
                <option value="DISEMBARKING">Débarquement</option>
                <option value="DELAY">Retard</option>
                <option value="INCIDENT">Incident</option>
                <option value="ARRIVAL">Arrivée</option>
                <option value="DEPARTURE">Départ</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">Description</Label>
              <textarea
                id="ev-desc"
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={3}
                placeholder="Détails de l'événement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEventModalOpen(false)}>Annuler</Button>
            <Button onClick={handleAddEvent} disabled={eventSubmitting}>
              {eventSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog.dialog}
    </div>
  );
}
