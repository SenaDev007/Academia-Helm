'use client';

import { useState } from 'react';
import { Calendar, Plus, Clock, ChevronRight, Loader2 } from 'lucide-react';
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

interface ScheduleItem {
  id: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  vehicle?: string;
  vehicleName?: string;
  startTime?: string;
  start?: string;
  endTime?: string;
  end?: string;
  dayOfWeek?: string;
  day?: string;
  [key: string]: any;
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
const EMPTY_FORM = { routeId: '', dayOfWeek: 'Lundi', departureTime: '07:00' };

export default function TransportSchedules() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<ScheduleItem>('transport', 'assignments', academicYear?.id);
  const { toast } = useToast();

  const assignments = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ routeId: string; dayOfWeek: string; departureTime: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Groupe les assignments par jour de la semaine (fallback: Lundi)
  const byDay: Record<string, ScheduleItem[]> = {};
  for (const d of DAYS) byDay[d] = [];
  for (const a of assignments) {
    const day = a.dayOfWeek || a.day || 'Lundi';
    const key = DAYS.includes(day) ? day : 'Lundi';
    byDay[key].push(a);
  }

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/schedules', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Planning créé', description: `Planning ${formData.dayOfWeek} ajouté.` });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création du planning',
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
        <h3 className="text-lg font-semibold text-gray-900">Planning hebdomadaire</h3>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouveau Planning
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {DAYS.map((day) => (
          <div key={day} className="space-y-4">
            <Card className="p-4 shadow-sm text-center">
              <p className="text-xs font-medium text-gray-500">{day}</p>
            </Card>
            <div className="space-y-3">
              {byDay[day].length === 0 ? (
                <div className="bg-white p-4 rounded-xl border border-dashed border-gray-200 text-center text-xs font-medium text-gray-400">
                  Aucun trajet
                </div>
              ) : (
                byDay[day].map((s) => {
                  const routeName = s.route || s.routeName || `Itinéraire ${s.id}`;
                  const start = s.startTime || s.start || '07:00';
                  const end = s.endTime || s.end || '08:30';
                  const vehicle = s.vehicle || s.vehicleName || '—';
                  return (
                    <Card key={s.id} className="p-4 shadow-sm hover:border-indigo-300 transition-all cursor-pointer">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-3 h-3 text-indigo-600" />
                        <span className="text-xs font-semibold text-gray-900">{start} - {end}</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-900 mb-1">{routeName}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{vehicle}</span>
                        <ChevronRight className="w-3 h-3 text-gray-300" />
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {assignments.length === 0 && !error && (
        <div className="text-center py-10 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau planning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sc-route">Route ID</Label>
              <Input
                id="sc-route"
                type="text"
                value={formData.routeId}
                onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                placeholder="route-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-day">Jour de la semaine</Label>
              <select
                id="sc-day"
                value={formData.dayOfWeek}
                onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sc-time">Heure de départ</Label>
              <Input
                id="sc-time"
                type="time"
                value={formData.departureTime}
                onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
