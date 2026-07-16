/**
 * ============================================================================
 * EMERGENCIES & INCIDENTS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Table> shadcn, <Dialog> shadcn, Cards rounded-xl, alert() → toast(),
 * plus de font-black uppercase tracking-widest, plus de text-[10px] / text-[9px].
 * Logique useModulesList + modulesApi conservée.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  AlertCircle,
  PhoneCall,
  MapPin,
  ShieldAlert,
  ArrowRight,
  Plus,
  History,
  LifeBuoy,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
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

interface EmergencyItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  type?: string;
  emergencyType?: string;
  incidentType?: string;
  location?: string;
  incidentLocation?: string;
  severity?: string;
  status?: string;
  emergencyStatus?: string;
  duration?: string;
  elapsed?: string;
  services?: string;
  emergencyServices?: string;
  [key: string]: any;
}

const SEVERITY_BADGE: Record<string, string> = {
  CRITIQUE: 'bg-rose-100 text-rose-700 border-rose-200',
  HAUTE: 'text-orange-600 bg-orange-50 border-orange-100',
  MOYENNE: 'text-amber-600 bg-amber-50 border-amber-100',
  FAIBLE: 'text-blue-600 bg-blue-50 border-blue-100',
};

export default function Emergencies() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<EmergencyItem>('infirmary', 'emergencies', academicYear?.id);
  const { toast } = useToast();

  const emergencies = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', severity: 'HAUTE', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/emergencies', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', severity: 'HAUTE', description: '' });
      await refetch();
      toast({
        title: 'Urgence déclarée',
        description: 'L\'incident a été enregistré et les intervenants notifiés.',
        variant: 'destructive',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur lors de la création',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création de l\'urgence',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`infirmary/emergencies/${id}`, { status }, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({
        title: 'Statut mis à jour',
        description: `L'urgence est désormais : ${status}.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de mise à jour',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la mise à jour',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Sépare les urgences actives (CRITIQUE / OPEN) de l'historique
  const active = emergencies.filter((e) => {
    const sev = (e.severity || '').toUpperCase();
    const status = (e.status || e.emergencyStatus || 'OPEN').toUpperCase();
    return sev === 'CRITIQUE' || status === 'OPEN' || status === 'IN_PROGRESS';
  });
  const history = emergencies.filter((e) => !active.includes(e));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
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

      {/* Active Emergencies Section */}
      <Card className="bg-rose-50 border-rose-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-rose-900 flex items-center">
              <AlertCircle className="w-6 h-6 mr-3 animate-pulse" />
              Urgences Actives
            </h2>
            <p className="text-rose-700 font-medium text-sm">Interventions critiques nécessitant un suivi immédiat.</p>
          </div>
          <Button
            variant="destructive"
            onClick={() => { setFormData({ studentId: '', severity: 'HAUTE', description: '' }); setModalOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Déclarer urgence
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {active.length === 0 ? (
            <div className="md:col-span-2 bg-white/50 border-2 border-dashed border-rose-200 rounded-xl flex items-center justify-center p-12">
              <p className="text-rose-400 font-semibold text-center">Aucune urgence active.<br />La situation est sous contrôle.</p>
            </div>
          ) : (
            active.map((e) => {
              const student = e.student || e.studentName || `Élève ${e.id}`;
              const className = e.class || e.className || '';
              const type = e.type || e.emergencyType || e.incidentType || 'Urgence';
              const location = e.location || e.incidentLocation || '—';
              const services = e.services || e.emergencyServices || '';
              const duration = e.duration || e.elapsed || '';
              return (
                <motion.div
                  key={e.id}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-xl border-2 border-rose-200 p-6 shadow-md"
                >
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="destructive" className="bg-rose-600">
                      Critique
                    </Badge>
                    {duration && (
                      <span className="text-slate-400 text-xs font-semibold flex items-center">
                        <History className="w-3 h-3 mr-1" />
                        Depuis {duration}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-1">{student}</h3>
                  <p className="text-sm font-semibold text-slate-500 mb-4">{className} • {type}</p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-sm text-slate-600">
                      <MapPin className="w-4 h-4 mr-2 text-rose-500" />
                      {location}
                    </div>
                    {services && (
                      <div className="flex items-center text-sm text-slate-600">
                        <LifeBuoy className="w-4 h-4 mr-2 text-rose-500" />
                        {services}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-100">
                      <PhoneCall className="w-4 h-4 mr-2" />
                      Appeler Parent
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateStatus(e.id, 'IN_PROGRESS')}
                      disabled={actionLoading === e.id}
                      className="flex-1 border-amber-200 bg-amber-500 text-white hover:bg-amber-600"
                    >
                      {actionLoading === e.id ? 'Envoi...' : 'Prendre en charge'}
                    </Button>
                    <Button
                      onClick={() => handleUpdateStatus(e.id, 'RESOLVED')}
                      disabled={actionLoading === e.id}
                      className="flex-1 bg-slate-900 hover:bg-slate-800"
                    >
                      Résoudre
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Incident History / Recent Logs */}
      <div>
        <h3 className="text-lg font-semibold text-navy-900 mb-4 flex items-center">
          <ShieldAlert className="w-5 h-5 mr-2 text-slate-400" />
          Historique des Incidents (7 derniers jours)
        </h3>
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date / Heure</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Incident</TableHead>
                <TableHead>Lieu</TableHead>
                <TableHead>Gravité</TableHead>
                <TableHead className="text-right">Rapport</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                    Aucun incident dans l'historique.
                  </TableCell>
                </TableRow>
              ) : history.map((incident) => {
                const sev = (incident.severity || 'FAIBLE').toUpperCase();
                const color = SEVERITY_BADGE[sev] ?? SEVERITY_BADGE.FAIBLE;
                const date = incident.date || '';
                const time = incident.time || '';
                const student = incident.student || incident.studentName || `Élève ${incident.id}`;
                const type = incident.type || incident.emergencyType || incident.incidentType || 'Incident';
                const location = incident.location || incident.incidentLocation || '—';
                return (
                  <TableRow key={incident.id} className="hover:bg-slate-50">
                    <TableCell className="text-sm font-semibold text-navy-900">
                      {date || '—'} {time && <span className="text-slate-400 text-xs font-medium ml-1">{time}</span>}
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-slate-700">{student}</TableCell>
                    <TableCell className="text-sm text-slate-600">{type}</TableCell>
                    <TableCell className="text-sm text-slate-600">{location}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={color}>
                        {sev}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="link" size="sm" className="text-blue-600">Consulter</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle urgence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                placeholder="student-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Gravité</Label>
              <select
                id="severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="CRITIQUE">Critique</option>
                <option value="HAUTE">Haute</option>
                <option value="MOYENNE">Moyenne</option>
                <option value="FAIBLE">Faible</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Description de l'urgence"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Déclarer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
