/**
 * ============================================================================
 * EDUCAST MODERATION
 * ============================================================================
 */

'use client';

import { ShieldCheck, Eye, CheckCircle2, XCircle, AlertTriangle, Clock, Filter, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ModerationItem {
  id: string | number;
  title?: string;
  name?: string;
  author?: string;
  submittedBy?: string;
  uploader?: string;
  type?: string;
  contentType?: string;
  date?: string;
  createdAt?: string;
  submittedAt?: string;
  status?: string;
  reason?: string;
  flagReason?: string;
  moderationReason?: string;
}

export default function EduCastModeration() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: queue, loading, error } = useModulesList<ModerationItem>('educast', 'contents', academicYear?.id, { status: 'pending' });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de la file de modération...</span>
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
            <ShieldCheck className="w-5 h-5 mr-2 text-emerald-600" />
            File de Modération
          </h3>
          <p className="text-slate-500 text-sm">Contrôlez et validez les contenus avant publication.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button
            variant="default"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => toast({ title: 'Bientôt disponible', description: 'Cette action sera bientôt activée.' })}
          >
            Tout Valider
          </Button>
        </div>
      </div>

      {queue.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucun contenu en attente de modération pour cette année scolaire.
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-6">Contenu & Auteur</TableHead>
                  <TableHead className="px-6">Type</TableHead>
                  <TableHead className="px-6">Raison Modération</TableHead>
                  <TableHead className="px-6">Date</TableHead>
                  <TableHead className="px-6 text-right">Décision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item, i) => {
                  const title = item.title || item.name || 'Contenu';
                  const author = item.author || item.submittedBy || item.uploader || '—';
                  const type = item.type || item.contentType || 'Contenu';
                  const date = item.date || (item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('fr-FR') : item.createdAt ? new Date(item.createdAt).toLocaleDateString('fr-FR') : '—');
                  const status = item.status || 'PENDING';
                  const reason = item.reason || item.flagReason || item.moderationReason || 'Nouveau contenu';
                  const flagged = status === 'FLAGGED';
                  return (
                    <TableRow key={item.id ?? i} className="hover:bg-slate-50">
                      <TableCell className="px-6">
                        <div>
                          <p className="font-semibold text-slate-900">{title}</p>
                          <p className="text-xs text-slate-500">Par {author}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">{type}</Badge>
                      </TableCell>
                      <TableCell className="px-6">
                        <div className={`flex items-center text-xs ${flagged ? 'text-rose-600' : 'text-amber-600'}`}>
                          {flagged ? <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> : <Clock className="w-3.5 h-3.5 mr-1.5" />}
                          {reason}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 text-xs text-slate-500">{date}</TableCell>
                      <TableCell className="px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600">
                            <XCircle className="w-4 h-4" />
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
