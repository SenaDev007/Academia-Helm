/**
 * ============================================================================
 * SAFETY & INCIDENTS (SÉCURITÉ & INCIDENTS)
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - MOCKS hardcoded supprimés → useModulesList('labs', 'incidents', academicYear?.id)
 *   (backend GET /labs/incidents désormais exposé)
 * - 2 alert() → 2 toast() (signalement succès + erreur)
 * - 1 modal fixed inset-0 → <Dialog> shadcn
 * - <table>/<thead>/<tbody>/<tr>/<td>/<th> → <Table> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Bandeau rose rounded-3xl → rounded-xl ; bandeau navy-900 → slate-900
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  Loader2,
  ShieldAlert,
  Search,
  Plus,
  Eye,
  CheckCircle2,
  Activity,
} from 'lucide-react';
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

interface IncidentItem {
  id?: string;
  type?: string;
  description?: string;
  item?: string;
  equipmentName?: string;
  severity?: string;
  date?: string;
  incidentDate?: string;
  createdAt?: string;
  status?: string;
  resolved?: boolean;
}

const severityBadgeClass = (severity?: string) => {
  const s = (severity ?? '').toString().toUpperCase();
  if (s === 'CRITICAL') return 'bg-rose-100 text-rose-700 border-rose-200';
  if (s === 'HIGH') return 'bg-orange-100 text-orange-700 border-orange-200';
  if (s === 'MEDIUM') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-blue-100 text-blue-700 border-blue-200';
};

export default function SafetyIncidents() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: incidents, loading, error, refetch } = useModulesList<IncidentItem>(
    'labs',
    'incidents',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ description: '', severity: 'LOW', labId: '' });

  const handleCreateIncident = async () => {
    if (!incidentForm.description?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez décrire l\'incident.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('labs/incidents', incidentForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setIncidentForm({ description: '', severity: 'LOW', labId: '' });
      await refetch();
      toast({
        title: 'Incident signalé',
        description: 'Votre signalement a été enregistré avec succès.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de signalement',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors du signalement de l\'incident',
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
        <span className="ml-2 text-gray-600">Chargement des incidents...</span>
      </div>
    );
  }

  const safeIncidents = incidents ?? [];
  const criticalOpen = safeIncidents.filter((inc: any) => {
    const s = (inc?.severity ?? '').toString().toUpperCase();
    const st = (inc?.status ?? '').toString().toUpperCase();
    return s === 'CRITICAL' && st !== 'RESOLVED' && !inc?.resolved;
  }).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les incidents. {error}
        </div>
      )}

      {/* Risk Alert Header */}
      <Card className="p-6 shadow-sm bg-rose-50 border-rose-100">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="p-4 bg-white rounded-xl shadow-sm text-rose-600">
            <ShieldAlert className="w-10 h-10" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-rose-900 mb-1">Vigilance Sécurité Active</h3>
            <p className="text-rose-700/80 text-sm">
              {criticalOpen > 0
                ? `${criticalOpen} incident(s) critique(s) non résolu(s). Vérifiez les accès aux espaces concernés.`
                : 'Aucun incident critique ouvert. La surveillance reste active.'}
            </p>
          </div>
          <Button variant="destructive" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Déclarer un Incident
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-base font-semibold text-slate-900">Registre des Incidents</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input type="text" placeholder="Filtrer..." className="pl-10 w-64" />
            </div>
          </div>

          <Card className="p-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Type & Objet</TableHead>
                  <TableHead>Gravité</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeIncidents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-12">
                      Aucun incident enregistré pour cette année scolaire.
                    </TableCell>
                  </TableRow>
                ) : (
                  safeIncidents.map((inc: any, i: number) => {
                    const id = inc?.id ?? `INC-${i}`;
                    const type = inc?.type ?? 'INCIDENT';
                    const item = inc?.item ?? inc?.equipmentName ?? inc?.description ?? '—';
                    const date = inc?.date ?? inc?.incidentDate ?? (inc?.createdAt ? new Date(inc.createdAt).toLocaleDateString('fr-FR') : '—');
                    const severity = inc?.severity ?? 'LOW';
                    const status = (inc?.status ?? (inc?.resolved ? 'RESOLVED' : 'OPEN')).toString().toUpperCase();
                    return (
                      <TableRow key={id} className="hover:bg-slate-50">
                        <TableCell>
                          <div>
                            <p className="font-semibold text-slate-900">{type}</p>
                            <p className="text-xs text-slate-400">{item} • {id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityBadgeClass(severity)}>
                            {severity}
                          </Badge>
                          {status === 'RESOLVED' && (
                            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                              Résolu
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{date}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir détails">
                            <Eye className="w-4 h-4 text-slate-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* Safety Rules Summary */}
        <div className="space-y-6">
          <Card className="p-6 shadow-sm bg-slate-900 text-white">
            <h4 className="text-base font-semibold mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-amber-400" />
              Consignes de Sécurité
            </h4>
            <div className="space-y-4">
              {[
                { title: 'Port de la blouse obligatoire', desc: 'SVT, Physique & Chimie' },
                { title: 'Lunettes de protection', desc: 'Manipulations d\'acides' },
                { title: 'Gants nitrile', desc: 'Solvants & bases fortes' },
                { title: 'Extincteur à proximité', desc: 'Lab Physique paillasse 1-8' },
              ].map((rule, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="p-1 bg-white/10 rounded-full mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{rule.title}</p>
                    <p className="text-xs text-slate-400">{rule.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="secondary" className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white">
              Toutes les Règles
            </Button>
          </Card>
        </div>
      </div>

      {/* Incident Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signaler un Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="inc-description">Description</Label>
              <textarea
                id="inc-description"
                value={incidentForm.description}
                onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20 h-20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc-severity">Gravité</Label>
              <select
                id="inc-severity"
                value={incidentForm.severity}
                onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="LOW">Faible</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Élevée</option>
                <option value="CRITICAL">Critique</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inc-labId">ID Laboratoire</Label>
              <Input
                id="inc-labId"
                value={incidentForm.labId}
                onChange={(e) => setIncidentForm({ ...incidentForm, labId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCreateIncident} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Signaler'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
