/**
 * ============================================================================
 * EDUCAST VIDEOS PÉDAGOGIQUES
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Play, Search, Plus, Eye, GraduationCap, Loader2 } from 'lucide-react';
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
  subject?: string;
  category?: string;
  level?: string;
  targetLevel?: string;
  author?: string;
  uploadedBy?: string;
  teacherName?: string;
  duration?: string;
  length?: string;
  views?: number;
  viewCount?: number;
  thumbnail?: string;
  thumbnailUrl?: string;
}

const EMPTY_FORM = { title: '', description: '', type: 'video', url: '' };

export default function EduCastVideos() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: videos, loading, error, refetch } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'video' });

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
      await modulesApi.post('educast/media', { ...formData, type: 'video' }, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Vidéo publiée', description: 'La vidéo a été ajoutée avec succès.' });
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
        <span className="ml-2 text-slate-600">Chargement des vidéos...</span>
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
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-navy-900 flex items-center">
            <GraduationCap className="w-5 h-5 mr-2 text-blue-600" />
            Vidéos Pédagogiques
          </h3>
          <p className="text-slate-500 text-sm">Contenus éducatifs structurés par niveau et matière.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input type="text" placeholder="Rechercher un cours..." className="pl-10 w-64" />
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter Vidéo
          </Button>
        </div>
      </div>

      {videos.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune vidéo pédagogique pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {videos.map((video, i) => {
            const title = video.title || video.name || 'Vidéo';
            const subject = video.subject || video.category || '—';
            const level = video.level || video.targetLevel || '—';
            const author = video.author || video.teacherName || video.uploadedBy || '—';
            const duration = video.duration || video.length || '—';
            const views = video.views ?? video.viewCount ?? 0;
            const thumbnail = video.thumbnail || video.thumbnailUrl;
            return (
              <Card key={video.id ?? i} className="overflow-hidden shadow-sm hover:shadow-md transition-all group p-0">
                <div className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                    <div className="p-3 bg-amber-500 rounded-full scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-6 h-6 text-white fill-current" />
                    </div>
                  </div>
                  <Badge className="absolute bottom-2 right-2 bg-black/60 text-white backdrop-blur z-10">{duration}</Badge>
                  <Badge className="absolute top-2 left-2 bg-blue-600 text-white z-10">{subject}</Badge>
                  {thumbnail ? (
                    <img src={thumbnail} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                  )}
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{level}</p>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[40px]">{title}</h4>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">{author}</p>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Eye className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{views}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Ajouter une vidéo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une vidéo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Les fonctions dérivées - Chapitre 3"
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
              <Label>URL de la vidéo</Label>
              <Input
                type="text"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://..."
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
