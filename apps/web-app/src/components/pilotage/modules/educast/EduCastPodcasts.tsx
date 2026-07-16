/**
 * ============================================================================
 * EDUCAST PODCASTS & AUDIOS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Headphones, Clock, Play, MoreVertical, Music, Loader2 } from 'lucide-react';
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

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  teacherName?: string;
  uploadedBy?: string;
  category?: string;
  duration?: string;
  length?: string;
  date?: string;
  createdAt?: string;
  listens?: number;
  viewCount?: number;
  views?: number;
}

const EMPTY_FORM = { title: '', description: '', type: 'podcast', url: '' };

export default function EduCastPodcasts() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: podcasts, loading, error, refetch } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'podcast' });

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.url) {
      toast({ title: 'Champ manquant', description: 'Le titre et l\'URL sont requis.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/media', { ...formData, type: 'podcast' }, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Podcast publié', description: 'Le podcast a été ajouté avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la publication', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des podcasts...</span>
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
            <Headphones className="w-5 h-5 mr-2 text-blue-600" />
            Podcasts & Audios
          </h3>
          <p className="text-slate-500 text-sm">Contenus audio pour apprendre partout, tout le temps.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Publier Podcast
        </Button>
      </div>

      {podcasts.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucun podcast pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {podcasts.map((podcast, i) => {
            const title = podcast.title || podcast.name || 'Podcast';
            const author = podcast.author || podcast.teacherName || podcast.uploadedBy || '—';
            const category = podcast.category || 'Audio';
            const date = podcast.date || (podcast.createdAt ? new Date(podcast.createdAt).toLocaleDateString('fr-FR') : '—');
            const duration = podcast.duration || podcast.length || '—';
            const listens = podcast.listens ?? podcast.viewCount ?? podcast.views ?? 0;
            return (
              <Card key={podcast.id ?? i} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-md transition-all group shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <Music className="w-7 h-7" />
                    </div>
                    <Button size="icon" className="absolute -bottom-2 -right-2 h-7 w-7 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{category}</Badge>
                      <span className="text-xs text-slate-500">{date}</span>
                    </div>
                    <h4 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{title}</h4>
                    <p className="text-xs text-slate-500 mt-1">Par {author}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden md:block">
                    <p className="text-xs font-semibold text-slate-900 flex items-center justify-end">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-300" />
                      {duration}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">Durée</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900">{listens.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Écoutes</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Publier un podcast */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publier un podcast</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Analyse de texte - Méthodologie"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                placeholder="Décrivez le contenu..."
              />
            </div>
            <div className="space-y-2">
              <Label>URL de l&apos;audio</Label>
              <Input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://...mp3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
