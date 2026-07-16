/**
 * ============================================================================
 * EDUCAST CONTENT PACKS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Package, Clock, MoreVertical, BookOpen, Loader2 } from 'lucide-react';
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

interface PackItem {
  id: string | number;
  title?: string;
  name?: string;
  contents?: number;
  contentCount?: number;
  itemCount?: number;
  duration?: string;
  totalDuration?: string;
  price?: string | number;
  amount?: string | number;
  author?: string;
  createdBy?: string;
  teacherName?: string;
  sales?: number;
  salesCount?: number;
}

const EMPTY_FORM = { name: '', description: '', price: 0, mediaIds: '' };

export default function EduCastPacks() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: packs, loading, error, refetch } = useModulesList<PackItem>('educast', 'packs', academicYear?.id);

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
      const mediaIds = formData.mediaIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await modulesApi.post(
        'educast/packs',
        { ...formData, price: Number(formData.price), mediaIds },
        buildModulesApiOptions(academicYear?.id),
      );
      toast({ title: 'Pack créé', description: 'Le pack a été ajouté avec succès.' });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création du pack', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des packs...</span>
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
            <Package className="w-5 h-5 mr-2 text-rose-600" />
            Packs de Contenus Premium
          </h3>
          <p className="text-slate-500 text-sm">Groupement de vidéos, documents et quiz pour un apprentissage complet.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          Créer un Pack
        </Button>
      </div>

      {packs.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucun pack de contenu pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packs.map((pack, i) => {
            const title = pack.title || pack.name || 'Pack';
            const contents = pack.contents ?? pack.contentCount ?? pack.itemCount ?? 0;
            const duration = pack.duration || pack.totalDuration || '—';
            const price = pack.price ?? pack.amount ?? '—';
            const author = pack.author || pack.createdBy || pack.teacherName || '—';
            const sales = pack.sales ?? pack.salesCount ?? 0;
            return (
              <div key={pack.id ?? i} className="group">
                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-sm group-hover:shadow-md transition-all mb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-600 to-slate-900 opacity-60 mix-blend-overlay group-hover:opacity-80 transition-opacity" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                    <Package className="w-10 h-10 mb-2 text-amber-400" />
                    <p className="text-2xl font-semibold">{price} <span className="text-xs">F CFA</span></p>
                  </div>
                  <Badge variant="outline" className="absolute top-3 right-3 bg-white/10 text-white border-white/20 backdrop-blur">
                    {sales} Ventes
                  </Badge>
                </div>

                <div className="space-y-3 px-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-slate-900 leading-tight group-hover:text-rose-600 transition-colors line-clamp-1">{title}</h4>
                      <p className="text-xs text-slate-500 mt-1">Par {author}</p>
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
                      <span className="text-xs">{contents} Contenus</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Créer un pack */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un pack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pack Terminale S - Maths"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none"
                placeholder="Décrivez le pack..."
              />
            </div>
            <div className="space-y-2">
              <Label>Prix (F CFA)</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>IDs des médias (séparés par virgule)</Label>
              <Input
                type="text"
                value={formData.mediaIds}
                onChange={(e) => setFormData({ ...formData, mediaIds: e.target.value })}
                placeholder="Ex: 1, 5, 12"
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
