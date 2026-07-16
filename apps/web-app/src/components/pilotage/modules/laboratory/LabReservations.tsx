/**
 * ============================================================================
 * LABORATORY RESERVATIONS
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 1 alert() → 1 toast() (création réservation) + 1 toast destructif pour l'erreur
 * - 1 modal fixed inset-0 → <Dialog> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Boutons "Valider/Rejeter" custom → <Button variant="ghost">
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Calendar, Clock, Beaker, CheckCircle2, XCircle, Clock4, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ReservationItem {
  id?: string;
  teacher?: string;
  teacherName?: string;
  class?: string;
  className?: string;
  subject?: string;
  lab?: string;
  labName?: string;
  date?: string;
  reservationDate?: string;
  scheduledAt?: string;
  time?: string;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export default function LabReservations() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: reservations, loading, error, refetch } = useModulesList<ReservationItem>(
    'labs',
    'sessions',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reservationForm, setReservationForm] = useState({ labId: '', date: '', startTime: '', endTime: '', purpose: '' });

  const handleCreateReservation = async () => {
    if (!reservationForm.labId?.trim() || !reservationForm.date) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez saisir l\'ID laboratoire et la date.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `labs/${reservationForm.labId}/reservations`,
        reservationForm,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setReservationForm({ labId: '', date: '', startTime: '', endTime: '', purpose: '' });
      await refetch();
      toast({ title: 'Réservation créée', description: `Le ${reservationForm.date}` });
    } catch (e: any) {
      toast({
        title: 'Erreur de réservation',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la réservation',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeReservations = reservations ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des réservations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les réservations. {error}
        </div>
      )}

      {/* Header & New Reservation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Planning des Réservations
          </h3>
          <p className="text-slate-500 text-sm">Gérez l&apos;occupation des espaces spécialisés.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Réservation
        </Button>
      </div>

      {safeReservations.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune réservation de laboratoire pour cette année scolaire.
        </div>
      ) : (
        <div className="space-y-4">
          {safeReservations.map((res: any, i: number) => {
            const id = res?.id ?? `RES-${i}`;
            const teacher = res?.teacher ?? res?.teacherName ?? '—';
            const cls = res?.class ?? res?.className ?? '—';
            const subject = res?.subject ?? '—';
            const lab = res?.lab ?? res?.labName ?? '—';
            const date = res?.date ?? res?.reservationDate ?? (res?.scheduledAt ? new Date(res.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const time = res?.time ?? res?.timeSlot ?? (res?.startTime && res?.endTime ? `${res.startTime} - ${res.endTime}` : '—');
            const status = (res?.status ?? 'PENDING').toString().toUpperCase();
            return (
              <Card key={id} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6 flex-1 w-full">
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-400">
                      <Beaker className="w-7 h-7" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 w-full">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Enseignant & Classe</p>
                        <p className="font-semibold text-slate-900">{teacher}</p>
                        <p className="text-xs text-blue-600">{cls}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Matière & Lab</p>
                        <p className="font-medium text-slate-700">{subject}</p>
                        <p className="text-xs text-slate-500">{lab}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date & Horaire</p>
                        <p className="font-medium text-slate-700 flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {date}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                          {time}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {status === 'VALIDATED' ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Validé
                          </Badge>
                        ) : status === 'PENDING' ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Clock4 className="w-3.5 h-3.5 mr-1" />
                            En Attente
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            <Clock4 className="w-3.5 h-3.5 mr-1" />
                            Soumis
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="hover:bg-emerald-50 hover:text-emerald-600" title="Valider">
                      <CheckCircle2 className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-rose-50 hover:text-rose-600" title="Rejeter">
                      <XCircle className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reservation Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Réservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="res-labId">ID Laboratoire</Label>
              <Input
                id="res-labId"
                value={reservationForm.labId}
                onChange={(e) => setReservationForm({ ...reservationForm, labId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-date">Date</Label>
              <Input
                id="res-date"
                type="date"
                value={reservationForm.date}
                onChange={(e) => setReservationForm({ ...reservationForm, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="res-start">Heure début</Label>
                <Input
                  id="res-start"
                  type="time"
                  value={reservationForm.startTime}
                  onChange={(e) => setReservationForm({ ...reservationForm, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="res-end">Heure fin</Label>
                <Input
                  id="res-end"
                  type="time"
                  value={reservationForm.endTime}
                  onChange={(e) => setReservationForm({ ...reservationForm, endTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-purpose">Objet</Label>
              <textarea
                id="res-purpose"
                value={reservationForm.purpose}
                onChange={(e) => setReservationForm({ ...reservationForm, purpose: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20 h-20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateReservation} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Réserver'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
