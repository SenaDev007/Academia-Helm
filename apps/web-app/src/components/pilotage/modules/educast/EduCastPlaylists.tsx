/**
 * ============================================================================
 * EDUCAST PLAYLISTS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ListMusic, Play, Clock, MoreVertical, BookOpen, Loader2 } from 'lucide-react';
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

interface PlaylistItem {
  id: string | number;
  title?: string;
  name?: string;
  contents?: number;
  contentCount?: number;
  itemCount?: number;
  duration?: string;
  totalDuration?: string;
  target?: string;
  targetLevel?: string;
  audience?: string;
  author?: string;
  createdBy?: string;
  teacherName?: string;
}

const EMPTY_FORM = { name: '', description: '' };

export default function EduCastPlaylists() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: playlists, loading, error, refetch } = useModulesList<PlaylistItem>('educast', 'playlists', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.name) {
      toast({ title: 'Champ manquant', description: 'Le nom est requis.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/playlists', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Playlist créée', description: 'La playlist a été ajoutée avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de la playlist', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des playlists...</span>
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
            <ListMusic className="w-5 h-5 mr-2 text-rose-600" />
            Playlists EduCast
          </h3>
          <p className="text-slate-500 text-sm">Parcours d&apos;apprentissage structurés.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Nouvelle Playlist
        </Button>
      </div>

      {playlists.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune playlist pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist, i) => {
            const title = playlist.title || playlist.name || 'Playlist';
            const contents = playlist.contents ?? playlist.contentCount ?? playlist.itemCount ?? 0;
            const duration = playlist.duration || playlist.totalDuration || '—';
            const target = playlist.target || playlist.targetLevel || playlist.audience || '—';
            const author = playlist.author || playlist.createdBy || playlist.teacherName || '—';
            return (
              <div key={playlist.id ?? i} className="group">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-sm group-hover:shadow-md transition-all mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-600/40 to-slate-900/60 mix-blend-overlay group-hover:opacity-60 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/10 backdrop-blur rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
                      <Play className="w-7 h-7 text-white fill-current" />
                    </div>
                  </div>
                  <Badge variant="outline" className="absolute bottom-3 right-3 bg-black/40 text-white border-white/20 backdrop-blur">
                    <ListMusic className="w-3 h-3 mr-1" />
                    {contents} Vidéos
                  </Badge>
                </div>

                <div className="space-y-3 px-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 mb-2">{target}</Badge>
                      <h4 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-rose-600 transition-colors">{title}</h4>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs">{duration}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs">Par {author}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Nouvelle playlist */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle playlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Révisions Bac 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none"
                placeholder="Décrivez la playlist..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
