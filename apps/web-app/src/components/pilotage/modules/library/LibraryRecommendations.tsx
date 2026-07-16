/**
 * ============================================================================
 * LIBRARY RECOMMENDATIONS — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)  : GET  /modules-complementaires/library/recommendations
 * Endpoint (création): POST /modules-complementaires/library/recommendations
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Sparkles, GraduationCap, Plus, Send, Loader2 } from 'lucide-react';
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

interface RecommendationItem {
  id: string;
  target?: string;
  targetName?: string;
  audience?: string;
  type?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  reason?: string;
  description?: string;
  teacher?: string;
  author?: string;
  createdBy?: string;
  [key: string]: any;
}

interface NewRecommendationFormData {
  bookId: string;
  comment: string;
}

const emptyRecForm: NewRecommendationFormData = { bookId: '', comment: '' };

export default function LibraryRecommendations() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewRecommendationFormData>(emptyRecForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: recommendations, loading, error, refetch } = useModulesList<RecommendationItem>(
    'library',
    'recommendations',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/recommendations',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyRecForm);
      await refetch();
      toast({ title: 'Recommandation créée', description: 'La recommandation pédagogique a été enregistrée.' });
    } catch (e: any) {
      console.error('Erreur création recommandation :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de la recommandation', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des recommandations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les recommandations. {error}
        </div>
      )}

      {/* AI Recommendation Spotlight */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-700 rounded-xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm text-amber-400">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Sarah AI Suggestion</h3>
              <p className="text-white/60 text-sm">Basé sur les performances de la classe 3ème B</p>
            </div>
          </div>
          <p className="text-base font-medium max-w-2xl text-white/90 leading-relaxed">
            « Le livre <span className="font-semibold text-amber-400">Physique-Chimie 3ème</span> est recommandé pour cette période afin d'accompagner le chapitre sur la pesanteur. 85% des élèves l'ont trouvé utile l'an dernier. »
          </p>
          <div className="flex gap-3">
            <Button className="bg-amber-500 text-slate-900 hover:bg-amber-600">
              Partager avec la classe
            </Button>
            <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white">
              Ignorer
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
          <GraduationCap className="w-5 h-5 mr-2 text-emerald-600" />
          Recommandations Pédagogiques
        </h3>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Créer une recommandation
        </Button>
      </div>

      {recommendations.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucune recommandation pédagogique pour cette année scolaire.
        </Card>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recommendations.map((rec) => {
          const target = rec.target ?? rec.targetName ?? rec.audience ?? '—';
          const type = (rec.type ?? 'CLASSE').toString().toUpperCase();
          const bookTitle = rec.book ?? rec.bookTitle ?? rec.title ?? '—';
          const reason = rec.reason ?? rec.description ?? '';
          const teacher = rec.teacher ?? rec.author ?? rec.createdBy ?? '—';
          return (
          <Card key={rec.id} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start gap-6">
              <div className="w-20 h-28 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 font-semibold text-xs group-hover:bg-blue-50 transition-colors shrink-0">
                LIVRE
              </div>
              <div className="space-y-3 flex-1">
                <div className="flex justify-between">
                  <Badge variant="outline" className={
                    type === 'CLASSE' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  }>
                    {type}: {target}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 leading-tight">{bookTitle}</h4>
                  {reason && <p className="text-sm text-slate-500 mt-2 italic">« {reason} »</p>}
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                    <p className="text-xs text-slate-400">Recommandé par {teacher}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          );
        })}
      </div>
      )}

      {/* Modal Créer une recommandation */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer une recommandation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rec-book">Livre (ID)</Label>
              <Input
                id="rec-book"
                type="text"
                placeholder="ex : book-456"
                value={formData.bookId}
                onChange={(e) => setFormData({ ...formData, bookId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-comment">Commentaire</Label>
              <textarea
                id="rec-comment"
                rows={4}
                placeholder="Raison pédagogique..."
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Recommander'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
