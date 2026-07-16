/**
 * ============================================================================
 * EDUCAST WEBINAIRES & DIRECTS
 * ============================================================================
 *
 * Refonte juillet 2026 : le bouton "Nouvelle Session" était précédemment
 * câblé sur alert('Bientôt disponible'). Désormais la route POST /educast/webinars
 * existe côté backend — on ouvre un Dialog avec un formulaire (title, description,
 * scheduledAt, duration, streamUrl) et on appelle modulesApi.post('educast/webinars', data).
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Globe, Calendar, Clock, Users, MonitorPlay, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface WebinarItem {
  id: string | number;
  title?: string;
  name?: string;
  presenter?: string;
  host?: string;
  presenterName?: string;
  description?: string;
  date?: string;
  scheduledAt?: string;
  time?: string;
  duration?: number;
  durationMinutes?: number;
  audience?: string;
  targetAudience?: string;
  status?: string;
  streamUrl?: string;
}

interface WebinarForm {
  title: string;
  description: string;
  scheduledAt: string;
  duration: number;
  streamUrl: string;
}

const EMPTY_FORM: WebinarForm = {
  title: '',
  description: '',
  scheduledAt: '',
  duration: 60,
  streamUrl: '',
};

export default function EduCastWebinars() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: webinars, loading, error, refetch } = useModulesList<WebinarItem>('educast', 'webinars', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<WebinarForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.scheduledAt) {
      toast({ title: 'Champ manquant', description: 'Le titre et la date/heure sont requis.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        'educast/webinars',
        {
          title: formData.title,
          description: formData.description,
          scheduledAt: formData.scheduledAt,
          duration: Number(formData.duration) || 60,
          streamUrl: formData.streamUrl,
        },
        buildModulesApiOptions(academicYear?.id),
      );
      toast({ title: 'Session planifiée', description: 'Le webinaire a été créé avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création du webinaire', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des webinaires...</span>
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
          <h3 className="text-lg font-semibold text-navy-900 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-emerald-600" />
            Webinaires & Directs
          </h3>
          <p className="text-slate-500 text-sm">Planifiez et diffusez vos événements en temps réel.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Nouvelle Session
        </Button>
      </div>

      {webinars.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucun webinaire planifié pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {webinars.map((webinar, i) => {
            const title = webinar.title || webinar.name || 'Webinaire';
            const presenter = webinar.presenter || webinar.host || webinar.presenterName || '—';
            const dateStr = webinar.date || (webinar.scheduledAt ? new Date(webinar.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const time = webinar.time || (webinar.scheduledAt ? new Date(webinar.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—');
            const duration = webinar.duration ?? webinar.durationMinutes ?? 0;
            const audience = webinar.audience || webinar.targetAudience || '—';
            const status = webinar.status || 'PLANNED';
            return (
              <Card key={webinar.id ?? i} className="p-6 flex flex-col lg:flex-row items-center justify-between gap-6 hover:shadow-md transition-all group shadow-sm">
                <div className="flex items-center gap-6 flex-1">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <MonitorPlay className="w-8 h-8" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={status === 'LIVE' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                        {status === 'LIVE' ? 'EN DIRECT' : 'PROCHAINEMENT'}
                      </Badge>
                      <h4 className="text-xl font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{title}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Users className="w-4 h-4" />
                        <span className="text-xs">{audience}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">{time} ({duration} min)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <div className="w-5 h-5 rounded-full bg-slate-100" />
                        <span className="text-xs">{presenter}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 min-w-[200px]">
                  <Button className="w-full">S&apos;inscrire</Button>
                  <Button variant="outline" className="w-full">Détails</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Nouvelle Session (POST /educast/webinars) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle Session Webinaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Révisions Bac - Mathématiques"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                placeholder="Décrivez le contenu du webinaire..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date & Heure</Label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (minutes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL du stream</Label>
              <Input
                type="text"
                value={formData.streamUrl}
                onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })}
                placeholder="https://meet.google.com/... ou RTMP"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Planifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
