/**
 * ============================================================================
 * EDUCAST ASSOCIATED RESOURCES
 * ============================================================================
 */

'use client';

import { Paperclip, FileText, Download, Link as LinkIcon, ExternalLink, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ResourceItem {
  id: string | number;
  title?: string;
  name?: string;
  associatedWith?: string;
  parentTitle?: string;
  linkedContent?: string;
  type?: string;
  fileType?: string;
  mimeType?: string;
  size?: string;
  fileSize?: string;
  url?: string;
  link?: string;
}

export default function EduCastResources() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: resources, loading, error } = useModulesList<ResourceItem>('educast', 'contents', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des ressources...</span>
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
            <Paperclip className="w-5 h-5 mr-2 text-blue-600" />
            Documents & Ressources
          </h3>
          <p className="text-slate-500 text-sm">Gérez les fichiers attachés à vos contenus multimédias.</p>
        </div>
        <Button onClick={() => toast({ title: 'Bientôt disponible', description: 'Cette fonctionnalité sera bientôt activée.' })}>
          Attacher une Ressource
        </Button>
      </div>

      {resources.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune ressource attachée pour cette année scolaire.
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-6">Ressource & Type</TableHead>
                  <TableHead className="px-6">Contenu Associé</TableHead>
                  <TableHead className="px-6">Taille / Lien</TableHead>
                  <TableHead className="px-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((res, i) => {
                  const title = res.title || res.name || 'Ressource';
                  const type = (res.type || res.fileType || (res.mimeType && res.mimeType.split('/')[1]?.toUpperCase()) || 'FILE').toUpperCase();
                  const isLink = type === 'LINK' || type === 'URL' || !!res.url || !!res.link;
                  const associatedWith = res.associatedWith || res.parentTitle || res.linkedContent || '—';
                  const size = res.size || res.fileSize || (isLink ? '-' : '—');
                  return (
                    <TableRow key={res.id ?? i} className="hover:bg-slate-50 group">
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-blue-50 transition-colors">
                            {isLink ? <LinkIcon className="w-5 h-5 text-blue-600" /> : <FileText className="w-5 h-5 text-rose-600" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 leading-tight">{title}</p>
                            <Badge variant="outline" className="mt-0.5">{type}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-xs text-slate-500 italic">&ldquo;{associatedWith}&rdquo;</TableCell>
                      <TableCell className="px-6 text-sm font-semibold text-slate-900">{size}</TableCell>
                      <TableCell className="px-6 text-right">
                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100">
                          {isLink ? <ExternalLink className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                        </Button>
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
