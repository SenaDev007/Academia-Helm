'use client';

import { useState } from 'react';
import { Plus, ShieldAlert, MessageSquare, Loader2 } from 'lucide-react';
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

interface IncidentItem {
  id: string;
  type?: string;
  incidentType?: string;
  title?: string;
  vehicle?: string;
  vehicleName?: string;
  vehicleId?: string;
  date?: string;
  incidentDate?: string;
  severity?: string;
  status?: string;
  desc?: string;
  description?: string;
  [key: string]: any;
}

const EMPTY_FORM = { type: '', description: '', vehicleId: '', severity: 'MEDIUM' };

export default function TransportIncidents() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<IncidentItem>('transport', 'incidents', academicYear?.id);
  const { toast } = useToast();

  const incidents = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ type: string; description: string; vehicleId: string; severity: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/incidents', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Incident signalé', description: `${formData.type || 'Incident'} enregistré.` });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création de l\'incident',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ⭐ Task 7-e : la route POST transport/incidents/:id/resolve existe maintenant côté backend
  // (controller ligne 439). Elle attend un body { resolution: string } (et non { status }).
  const handleResolve = async (id: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(
        `transport/incidents/${id}/resolve`,
        { resolution: 'Résolu' },
        buildModulesApiOptions(academicYear?.id),
      );
      toast({ title: 'Incident résolu', description: 'L\'incident a été marqué comme résolu.' });
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la résolution',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
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
          <ShieldAlert className="w-6 h-6 text-rose-600" /> Gestion des incidents
        </h3>
        <Button variant="destructive" onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Signaler un incident
        </Button>
      </div>

      {incidents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {incidents.map((incident) => {
            const type = incident.type || incident.incidentType || incident.title || `Incident ${incident.id}`;
            const vehicle = incident.vehicle || incident.vehicleName || '—';
            const date = incident.date || incident.incidentDate;
            const severity = incident.severity || 'MEDIUM';
            const status = incident.status || 'OPEN';
            const desc = incident.desc || incident.description || '';
            const isResolved = (status || '').toUpperCase() === 'RESOLVED';
            return (
              <Card key={incident.id} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col lg:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <Badge
                        variant="outline"
                        className={
                          severity === 'HIGH'
                            ? 'border-rose-200 text-rose-700 bg-rose-50'
                            : 'border-amber-200 text-amber-700 bg-amber-50'
                        }
                      >
                        {severity} SEVERITY
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          isResolved
                            ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                            : 'border-blue-200 text-blue-700 bg-blue-50'
                        }
                      >
                        {status}
                      </Badge>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">{type}</h4>
                    <p className="text-gray-600 font-medium text-sm leading-relaxed mb-4">{desc}</p>
                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-500">Véhicule:</p>
                        <p className="text-sm font-semibold text-gray-900">{vehicle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-gray-500">Date:</p>
                        <p className="text-sm font-semibold text-gray-900">{date ? new Date(date).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col justify-end gap-3 shrink-0">
                    <Button variant="outline">
                      <MessageSquare className="w-4 h-4" /> Contacter
                    </Button>
                    <Button
                      onClick={() => handleResolve(incident.id)}
                      disabled={actionLoading === incident.id || isResolved}
                    >
                      {actionLoading === incident.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {isResolved ? 'Résolu' : 'Résoudre'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler un incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="in-type">Type d'incident</Label>
              <Input
                id="in-type"
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                placeholder="Panne moteur"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-severity">Gravité</Label>
              <select
                id="in-severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
              >
                <option value="LOW">Faible</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-vehicle">Véhicule (ID)</Label>
              <Input
                id="in-vehicle"
                type="text"
                value={formData.vehicleId}
                onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                placeholder="vehicle-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="in-desc">Description</Label>
              <textarea
                id="in-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={3}
                placeholder="Détails de l'incident"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Signaler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
