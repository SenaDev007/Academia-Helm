/**
 * ============================================================================
 * LIBRARY DIGITAL RESOURCES — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/library/digital-resources
 * Endpoint (création)  : POST /modules-complementaires/library/digital-resources
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Globe, FileText, Video, Headphones, Link as LinkIcon, Search, Eye, Download, Plus, Filter, MoreVertical, Loader2 } from 'lucide-react';
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

interface DigitalResourceItem {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  category?: string;
  author?: string;
  creator?: string;
  views?: number;
  viewCount?: number;
  status?: string;
  [key: string]: any;
}

interface NewDigitalResourceFormData {
  title: string;
  url: string;
  type: string;
}

const emptyDigitalForm: NewDigitalResourceFormData = { title: '', url: '', type: 'PDF' };

export default function LibraryDigitalResources() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewDigitalResourceFormData>(emptyDigitalForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: resources, loading, error, refetch } = useModulesList<DigitalResourceItem>(
    'library',
    'digital-resources',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'library/digital-resources',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyDigitalForm);
      await refetch();
      toast({ title: 'Ressource publiée', description: 'La ressource numérique a été ajoutée.' });
    } catch (e: any) {
      console.error('Erreur création ressource numérique :', e?.message || e);
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création de la ressource numérique', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch ((type ?? '').toUpperCase()) {
      case 'PDF': return <FileText className="w-6 h-6 text-rose-500" />;
      case 'VIDEO': return <Video className="w-6 h-6 text-blue-500" />;
      case 'AUDIO': return <Headphones className="w-6 h-6 text-emerald-500" />;
      case 'LINK': return <LinkIcon className="w-6 h-6 text-blue-500" />;
      default: return <Globe className="w-6 h-6 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des ressources numériques...</span>
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

      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher une ressource numérique..."
            className="w-full pl-12 h-11"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Publier une ressource
          </Button>
        </div>
      </div>

      {/* Resources Grid */}
      {resources.length === 0 ? (
        <Card className="text-center py-16 text-gray-500 shadow-sm">
          Aucune ressource numérique disponible pour cette année scolaire.
        </Card>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {resources.map((res) => {
          const title = res.title ?? res.name ?? '—';
          const type = (res.type ?? '').toUpperCase();
          const author = res.author ?? res.creator ?? '—';
          const views = res.views ?? res.viewCount ?? 0;
          return (
          <Card key={res.id} className="p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                {getTypeIcon(type)}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-5 h-5 text-slate-300" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <Badge variant="outline" className="mb-2">{res.category ?? '—'}</Badge>
                <h4 className="text-sm font-semibold text-slate-900 leading-tight line-clamp-2 min-h-[40px] group-hover:text-blue-600 transition-colors">{title}</h4>
                <p className="text-xs text-slate-400 mt-1">Par {author}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{views}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" title="Ouvrir">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Télécharger">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
          );
        })}
      </div>
      )}

      {/* Modal Publier une ressource numérique */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publier une ressource numérique</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dr-title">Titre</Label>
              <Input
                id="dr-title"
                type="text"
                placeholder="Titre de la ressource"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-url">URL</Label>
              <Input
                id="dr-url"
                type="url"
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dr-type">Type</Label>
              <select
                id="dr-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="PDF">PDF</option>
                <option value="VIDEO">Vidéo</option>
                <option value="AUDIO">Audio</option>
                <option value="LINK">Lien</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Publier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
