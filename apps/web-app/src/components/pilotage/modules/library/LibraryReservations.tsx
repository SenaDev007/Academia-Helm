/**
 * ============================================================================
 * LIBRARY RESERVATIONS — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/library/reservations
 * Endpoint (création)  : POST /modules-complementaires/library/reservations
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Calendar, Clock, Book, XCircle, Timer, MoreVertical, Loader2, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ReservationItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  reservedAt?: string;
  expires?: string;
  expiresAt?: string;
  expiryDate?: string;
  status?: string;
  priority?: string;
  [key: string]: any;
}

interface NewReservationFormData {
  bookId: string;
  readerId: string;
  date: string;
}

const emptyReservationForm: NewReservationFormData = { bookId: '', readerId: '', date: '' };

export default function LibraryReservations() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewReservationFormData>(emptyReservationForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: reservations, loading, error, refetch } = useModulesList<ReservationItem>(
    'library',
    'reservations',
    academicYear?.id,
  );

  const handleCreateReservation = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/reservations',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyReservationForm);
      await refetch();
      toast({ title: 'Réservation créée', description: 'La nouvelle réservation a été enregistrée.' });
    } catch (e: any) {
      console.error('Erreur création réservation :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de la réservation', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

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
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Timer className="w-5 h-5 mr-2 text-blue-600" />
            File d'Attente des Réservations
          </h3>
          <p className="text-slate-500 text-sm">Gérez les priorités et les délais de retrait.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nouvelle Réservation
        </Button>
      </div>

      {reservations.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucune réservation pour cette année scolaire.
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reservations.map((res) => {
          const reader = res.reader ?? res.readerName ?? res.student ?? res.user ?? '—';
          const bookTitle = res.book ?? res.bookTitle ?? res.title ?? '—';
          const date = res.date ?? res.reservedAt ?? '—';
          const expires = res.expires ?? res.expiresAt ?? res.expiryDate ?? '—';
          const status = (res.status ?? 'WAITING').toString().toUpperCase();
          const priority = (res.priority ?? 'NORMALE').toString().toUpperCase();
          return (
          <Card key={res.id} className={`p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden ${
            status === 'AVAILABLE' ? 'border-emerald-200' : ''
          }`}>
            {status === 'AVAILABLE' && (
              <div className="absolute top-0 right-0 p-4">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <Badge variant={priority === 'HAUTE' ? 'destructive' : 'outline'} className={priority === 'HAUTE' ? '' : 'bg-slate-50 text-slate-500'}>
                    Priorité {priority}
                  </Badge>
                  <h4 className="text-lg font-semibold text-slate-900 mt-2 leading-tight">{reader}</h4>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-5 h-5 text-slate-300" />
                </Button>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl flex items-center gap-4">
                <div className="p-2.5 bg-white rounded-lg shadow-sm text-slate-400">
                  <Book className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{bookTitle}</p>
                  <p className="text-xs text-slate-400">ID: {res.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Réservé le</p>
                  <p className="text-sm font-semibold text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {date}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Expire le</p>
                  <p className={`text-sm font-semibold flex items-center ${status === 'EXPIRED' ? 'text-rose-600' : 'text-slate-700'}`}>
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {expires}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                {status === 'AVAILABLE' ? (
                  <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    Prêt pour retrait
                  </Button>
                ) : status === 'WAITING' ? (
                  <div className="flex-1 py-2.5 bg-blue-50 text-blue-600 text-center rounded-lg text-sm font-medium">
                    En attente de retour
                  </div>
                ) : (
                  <div className="flex-1 py-2.5 bg-slate-100 text-slate-400 text-center rounded-lg text-sm font-medium">
                    Réservation expirée
                  </div>
                )}
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-600">
                  <XCircle className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </Card>
          );
        })}
      </div>
      )}

      {/* Modal Nouvelle Réservation */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Réservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="res-book">Livre (ID)</Label>
              <Input
                id="res-book"
                type="text"
                placeholder="ex : book-456"
                value={formData.bookId}
                onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-reader">Lecteur (ID)</Label>
              <Input
                id="res-reader"
                type="text"
                placeholder="ex : student-123"
                value={formData.readerId}
                onChange={(e) => setFormData({ ...formData, readerId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-date">Date souhaitée</Label>
              <Input
                id="res-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreateReservation} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
