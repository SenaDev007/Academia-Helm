/**
 * ============================================================================
 * PRACTICAL SESSIONS (SÉANCES PRATIQUES)
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 1 alert() → 1 toast() (création séance) + 1 toast destructif pour l'erreur
 * - 1 modal fixed inset-0 → <Dialog> shadcn
 * - <table>/<thead>/<tbody>/<tr>/<td>/<th> → <Table> shadcn
 * - <input>/<label>/<button> → <Input>/<Label>/<Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - Bouton bg-[#C9A84C] → <Button> shadcn (indigo)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, GraduationCap, Search, FileText, Users, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface SessionItem {
  id?: string;
  theme?: string;
  title?: string;
  subject?: string;
  teacher?: string;
  teacherName?: string;
  date?: string;
  sessionDate?: string;
  scheduledAt?: string;
  students?: number;
  studentCount?: number;
  attendees?: number;
  status?: string;
}

export default function PracticalSessions() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: sessions, loading, error, refetch } = useModulesList<SessionItem>(
    'labs',
    'sessions',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionForm, setSessionForm] = useState({ labId: '', subject: '', date: '', duration: 0, studentCount: 0 });

  const handleCreateSession = async () => {
    if (!sessionForm.subject?.trim() || !sessionForm.labId?.trim()) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez saisir l\'ID laboratoire et la matière.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('labs/sessions', sessionForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setSessionForm({ labId: '', subject: '', date: '', duration: 0, studentCount: 0 });
      await refetch();
      toast({ title: 'Séance créée', description: sessionForm.subject });
    } catch (e: any) {
      toast({
        title: 'Erreur de création',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la séance',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const safeSessions = sessions ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des séances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les séances. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Historique des Travaux Pratiques</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="text" placeholder="Rechercher..." className="pl-10 w-64" />
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Enregistrer Séance
          </Button>
        </div>
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Séance</TableHead>
              <TableHead>Enseignant</TableHead>
              <TableHead>Élèves</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Rapport</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {safeSessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                  Aucune séance enregistrée pour cette année scolaire.
                </TableCell>
              </TableRow>
            ) : (
              safeSessions.map((ses: any, i: number) => {
                const theme = ses?.theme ?? ses?.title ?? `Séance #${i + 1}`;
                const subject = ses?.subject ?? '—';
                const teacher = ses?.teacher ?? ses?.teacherName ?? '—';
                const date = ses?.date ?? ses?.sessionDate ?? (ses?.scheduledAt ? new Date(ses.scheduledAt).toLocaleDateString('fr-FR') : '—');
                const students = ses?.students ?? ses?.studentCount ?? ses?.attendees ?? 0;
                const id = ses?.id ?? `SES-${i}`;
                return (
                  <TableRow key={id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-100 rounded-lg">
                          <GraduationCap className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{theme}</p>
                          <p className="text-xs text-slate-400">{subject} • {id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{teacher}</TableCell>
                    <TableCell>
                      <div className="flex items-center text-sm text-slate-600">
                        <Users className="w-4 h-4 mr-2 text-slate-300" />
                        {students} Présents
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{date}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Voir Rapport
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Session Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle Séance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ses-labId">ID Laboratoire</Label>
              <Input
                id="ses-labId"
                value={sessionForm.labId}
                onChange={(e) => setSessionForm({ ...sessionForm, labId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ses-subject">Matière</Label>
              <Input
                id="ses-subject"
                value={sessionForm.subject}
                onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ses-date">Date</Label>
              <Input
                id="ses-date"
                type="date"
                value={sessionForm.date}
                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ses-duration">Durée (min)</Label>
                <Input
                  id="ses-duration"
                  type="number"
                  value={sessionForm.duration}
                  onChange={(e) => setSessionForm({ ...sessionForm, duration: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ses-students">Élèves</Label>
                <Input
                  id="ses-students"
                  type="number"
                  value={sessionForm.studentCount}
                  onChange={(e) => setSessionForm({ ...sessionForm, studentCount: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateSession} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
