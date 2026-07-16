'use client';

import { useState } from 'react';
import { Users, Plus, Search, MapPin, Bus, Loader2 } from 'lucide-react';
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

interface AssignmentItem {
  id: string;
  student?: string;
  studentName?: string;
  studentId?: string;
  class?: string;
  className?: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  stop?: string;
  stopName?: string;
  stopId?: string;
  payment?: string;
  paymentStatus?: string;
  status?: string;
  assignmentStatus?: string;
  [key: string]: any;
}

const EMPTY_FORM = { studentId: '', routeId: '', stopId: '' };

export default function TransportStudents() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<AssignmentItem>('transport', 'assignments', academicYear?.id);
  const { toast } = useToast();

  const students = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ studentId: string; routeId: string; stopId: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/assignments', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Affectation créée', description: 'L\'élève a été affecté à l\'itinéraire.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'affectation',
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
            placeholder="Rechercher un élève..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Affecter un Élève
        </Button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-4 py-3">Élève</TableHead>
                  <TableHead className="px-4 py-3">Itinéraire / Arrêt</TableHead>
                  <TableHead className="px-4 py-3">Abonnement</TableHead>
                  <TableHead className="px-4 py-3">Paiement</TableHead>
                  <TableHead className="px-4 py-3">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const name = student.student || student.studentName || `Élève ${student.id}`;
                  const className = student.class || student.className || '';
                  const route = student.route || student.routeName || '—';
                  const stop = student.stop || student.stopName || '—';
                  const payment = student.payment || student.paymentStatus || 'PENDING';
                  const status = student.status || student.assignmentStatus || 'ACTIVE';
                  return (
                    <TableRow key={student.id} className="hover:bg-slate-50">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700 font-semibold text-xs">
                            {name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{name}</p>
                            <p className="text-xs text-gray-500">{className}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Bus className="w-3 h-3 text-gray-400" /> {route}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-gray-300" /> {stop}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-600">Annuel (A/R)</span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            payment === 'PAID'
                              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                              : 'border-rose-200 text-rose-700 bg-rose-50'
                          }
                        >
                          {payment}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline">{status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Affecter un élève</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="as-student">Student ID</Label>
              <Input
                id="as-student"
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                placeholder="student-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-route">Route ID</Label>
              <Input
                id="as-route"
                type="text"
                value={formData.routeId}
                onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                placeholder="route-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-stop">Stop ID</Label>
              <Input
                id="as-stop"
                type="text"
                value={formData.stopId}
                onChange={(e) => setFormData({ ...formData, stopId: e.target.value })}
                placeholder="stop-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Affecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
