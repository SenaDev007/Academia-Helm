/**
 * ============================================================================
 * EDUCAST ANNOUNCEMENTS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Megaphone, Eye, MoreHorizontal, Bell, MessageSquare, Loader2 } from 'lucide-react';
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

interface AnnouncementItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  createdBy?: string;
  authorName?: string;
  target?: string;
  targetAudience?: string;
  audience?: string;
  date?: string;
  publishedAt?: string;
  createdAt?: string;
  views?: number;
  viewCount?: number;
  important?: boolean;
  isImportant?: boolean;
  priority?: string;
}

const EMPTY_FORM = { title: '', content: '', targetAudience: 'TOUS' };

export default function EduCastAnnouncements() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: announcements, loading, error, refetch } = useModulesList<AnnouncementItem>('educast', 'announcements', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title || !formData.content) {
      toast({ title: 'Champ manquant', description: 'Le titre et le contenu sont requis.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('educast/announcements', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Annonce publiée', description: 'L\'annonce a été créée avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de l\'annonce', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des annonces...</span>
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
            <Megaphone className="w-5 h-5 mr-2 text-amber-600" />
            Publications & Annonces
          </h3>
          <p className="text-slate-500 text-sm">Communiquez officiellement via des formats audio/vidéo.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Créer une Annonce
        </Button>
      </div>

      {announcements.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune annonce pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {announcements.map((ann, i) => {
            const title = ann.title || ann.name || 'Annonce';
            const author = ann.author || ann.createdBy || ann.authorName || '—';
            const target = ann.target || ann.targetAudience || ann.audience || '—';
            const date = ann.date || (ann.publishedAt ? new Date(ann.publishedAt).toLocaleDateString('fr-FR') : ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('fr-FR') : '—');
            const views = ann.views ?? ann.viewCount ?? 0;
            const important = ann.important || ann.isImportant || ann.priority === 'HIGH' || ann.priority === 'URGENT';
            return (
              <Card
                key={ann.id ?? i}
                className={`p-6 shadow-sm hover:shadow-md transition-all group ${important ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500'}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-4 rounded-xl ${important ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Bell className="w-7 h-7" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{date}</Badge>
                        {important && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">IMPORTANT</Badge>}
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">{title}</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <span className="text-xs">Cible: {target}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span className="text-xs">Par {author}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-base font-semibold text-slate-900">{views}</p>
                      <p className="text-xs text-slate-400">Vues</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Créer une annonce */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une annonce</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Rentrée scolaire 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Contenu</Label>
              <textarea
                rows={4}
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
                placeholder="Contenu de l'annonce..."
              />
            </div>
            <div className="space-y-2">
              <Label>Audience cible</Label>
              <select
                value={formData.targetAudience}
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
              >
                <option value="TOUS">Tous</option>
                <option value="ELEVES">Élèves</option>
                <option value="PARENTS">Parents</option>
                <option value="ENSEIGNANTS">Enseignants</option>
                <option value="PERSONNEL">Personnel</option>
              </select>
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
