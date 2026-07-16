/**
 * ============================================================================
 * EDUCAST MEDIA LIBRARY
 * ============================================================================
 */

'use client';

import { Search, Filter, MoreVertical, Play, Headphones, Zap, Download, Eye, FileText, Plus, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface MediaItem {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  mediaType?: string;
  category?: string;
  subject?: string;
  author?: string;
  uploadedBy?: string;
  teacherName?: string;
  date?: string;
  createdAt?: string;
  views?: number;
  viewCount?: number;
  duration?: string;
  length?: string;
}

export default function EduCastLibrary() {
  const { academicYear } = useModuleContext();
  const { data: media, loading, error } = useModulesList<MediaItem>('educast', 'contents', academicYear?.id, { scope: 'library' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de la médiathèque...</span>
      </div>
    );
  }

  const getTypeIcon = (type: string) => {
    switch ((type || '').toUpperCase()) {
      case 'VIDEO': return <Play className="w-5 h-5" />;
      case 'AUDIO':
      case 'PODCAST': return <Headphones className="w-5 h-5" />;
      case 'CAPSULE': return <Zap className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input type="text" placeholder="Rechercher dans la médiathèque..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Importer
          </Button>
        </div>
      </div>

      {media.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucun média dans votre bibliothèque pour cette année scolaire.
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-6">Titre & Type</TableHead>
                  <TableHead className="px-6">Auteur</TableHead>
                  <TableHead className="px-6">Catégorie</TableHead>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead className="px-6">Durée</TableHead>
                  <TableHead className="px-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {media.map((item, i) => {
                  const title = item.title || item.name || 'Média';
                  const type = (item.type || item.mediaType || 'FILE').toUpperCase();
                  const category = item.category || item.subject || '—';
                  const author = item.author || item.teacherName || item.uploadedBy || '—';
                  const date = item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—');
                  const duration = item.duration || item.length || '—';
                  return (
                    <TableRow key={item.id ?? i} className="hover:bg-slate-50 group">
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                            {getTypeIcon(type)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">{title}</p>
                            <p className="text-xs text-slate-500">{type}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-sm text-slate-600">{author}</TableCell>
                      <TableCell className="px-6">
                        <Badge variant="outline">{category}</Badge>
                      </TableCell>
                      <TableCell className="px-6 text-xs text-slate-500">{date}</TableCell>
                      <TableCell className="px-6 text-sm font-semibold text-slate-900">{duration}</TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
