'use client';

import { useState } from 'react';
import { Users, CheckCircle2, XCircle, Clock, Calendar, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
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

// TODO: endpoint GET non disponible — le backend expose uniquement POST transport/attendances.
// Les présences déjà enregistrées restent en données statiques en attendant un endpoint de lecture.
// Toute nouvelle présence est envoyée au backend via modulesApi.post('transport/attendances').

const EMPTY_FORM = { studentId: '', tripId: '', status: 'PRESENT' };

export default function TransportAttendance() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ studentId: string; tripId: string; status: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ name: string; status: string; time: string } | null>(null);

  // ⚠ Données locales uniquement (pas d'endpoint GET /transport/attendances).
  // Ces lignes sont conservées uniquement pour la démonstration de l'UI ; elles ne
  // prétendent pas être des données réelles et seront remplacées quand le backend
  // exposera un endpoint de lecture.
  const attendance = [
    { id: '1', name: 'Fatou Sow', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:15' },
    { id: '2', name: 'Abdoulaye Diallo', route: 'Circuit Est', stop: 'Pharmacie du Marché', status: 'ABSENT', time: '—' },
    { id: '3', name: 'Mariama Ba', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:12' },
  ];

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/attendances', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Présence enregistrée', description: `Élève ${formData.studentId} — ${formData.status}.` });
      setLastSubmission({
        name: `Élève ${formData.studentId}`,
        status: formData.status,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de la présence',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <Card className="p-4 shadow-sm flex items-center gap-3">
          <Calendar className="w-5 h-5 text-indigo-700" />
          <p className="font-semibold text-gray-900 text-sm">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </Card>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Users className="w-4 h-4" /> Marquer Présence
        </Button>
      </div>

      {lastSubmission && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          ✓ Présence enregistrée : <strong>{lastSubmission.name}</strong> — {lastSubmission.status} à {lastSubmission.time}
        </div>
      )}

      <Card className="shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-4 py-3">Élève</TableHead>
                <TableHead className="px-4 py-3">Itinéraire / Arrêt</TableHead>
                <TableHead className="px-4 py-3">Heure de montée</TableHead>
                <TableHead className="px-4 py-3">Statut</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendance.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
                        {entry.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm">{entry.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-700">{entry.route}</p>
                    <p className="text-xs text-gray-500">{entry.stop}</p>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-gray-300" />
                      <span className="text-sm font-semibold text-gray-900">{entry.time}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        entry.status === 'PRESENT'
                          ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                          : 'border-rose-200 text-rose-700 bg-rose-50'
                      }
                    >
                      {entry.status === 'PRESENT' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button variant="link" size="sm">Détails</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marquer une présence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="at-student">Student ID</Label>
              <Input
                id="at-student"
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                placeholder="student-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-trip">Trip ID</Label>
              <Input
                id="at-trip"
                type="text"
                value={formData.tripId}
                onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                placeholder="trip-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-status">Statut</Label>
              <select
                id="at-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full h-9 px-3 border border-gray-200 rounded-md text-sm bg-transparent"
              >
                <option value="PRESENT">Présent</option>
                <option value="ABSENT">Absent</option>
                <option value="LATE">En retard</option>
                <option value="EXCUSED">Excusé</option>
              </select>
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
