/**
 * ============================================================================
 * EDUCAST CAPSULES DE RÉVISION
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Zap, Play, BookOpen, Clock, Star, Loader2 } from 'lucide-react';
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
  difficulty?: string;
  level?: string;
  duration?: string;
  length?: string;
  rating?: number;
  averageRating?: number;
  score?: number;
}

const EMPTY_FORM = { title: '', description: '', type: 'capsule', url: '' };

export default function EduCastRevisionCapsules() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: capsules, loading, error, refetch } = useModulesList<MediaItem>('educast', 'media', academicYear?.id, { type: 'capsule' });

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
      await modulesApi.post('educast/media', { ...formData, type: 'capsule' }, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Capsule créée', description: 'La capsule de révision a été ajoutée avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des capsules...</span>
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
            <Zap className="w-5 h-5 mr-2 text-amber-500" />
            Capsules de Révision
          </h3>
          <p className="text-slate-500 text-sm">Contenus courts (2-5 min) pour mémoriser les points essentiels.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Créer une Capsule
        </Button>
      </div>

      {capsules.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune capsule de révision pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {capsules.map((capsule, i) => {
            const title = capsule.title || capsule.name || 'Capsule';
            const subject = capsule.subject || capsule.category || '—';
            const difficulty = capsule.difficulty || capsule.level || 'Moyen';
            const duration = capsule.duration || capsule.length || '—';
            const rating = capsule.rating ?? capsule.averageRating ?? capsule.score ?? 0;
            return (
              <Card key={capsule.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                  <div className="flex items-center gap-1.5 text-amber-500 font-semibold text-xs">
                    <Star className="w-4 h-4 fill-current" />
                    {rating}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Badge variant="outline" className={`mb-2 ${
                      subject === 'Maths' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                      subject === 'Français' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                      subject === 'SVT' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}>
                      {subject}
                    </Badge>
                    <h4 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{title}</h4>
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-300" />
                      <span className="text-xs text-slate-500">{duration}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-300" />
                      <span className={`text-xs ${
                        difficulty === 'Facile' || difficulty === 'EASY' ? 'text-emerald-600' :
                        difficulty === 'Moyen' || difficulty === 'MEDIUM' ? 'text-amber-600' : 'text-rose-600'
                      }`}>{difficulty}</span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                  <Zap className="w-20 h-20 rotate-12" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Créer une capsule */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une capsule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Les identités remarquables"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                placeholder="Décrivez la capsule..."
              />
            </div>
            <div className="space-y-2">
              <Label>URL du média</Label>
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
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
