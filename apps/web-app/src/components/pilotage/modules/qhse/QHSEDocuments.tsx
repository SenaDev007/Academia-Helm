/**
 * ============================================================================
 * QHSE PROCEDURES & DOCUMENTS (Standardisé)
 * ============================================================================
 */

'use client';

import { FileText, Download, Eye, Loader2, Tag, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface DocumentItem {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  version?: string;
  size?: string;
  fileSize?: string;
  date?: string;
  uploadedAt?: string;
  category?: string;
}

export default function QHSEDocuments() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: documents, loading, error } = useModulesList<DocumentItem>('qhse', 'documents', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des documents...</span>
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
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-slate-400" /> Bibliothèque Documentaire QHSE
          </h3>
          <p className="text-slate-500 text-sm">Accédez aux procédures, consignes et rapports officiels.</p>
        </div>
        <Button onClick={() => toast({ title: 'Information', description: 'Ajout de document — fonctionnalité à venir.' })}>
          Ajouter un Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun document QHSE disponible pour cette année scolaire.
        </Card>
      ) : (
        /* Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc, i) => {
            const title = doc.title || doc.name || 'Document';
            const type = doc.type || 'DOCUMENT';
            const version = doc.version || 'v1.0';
            const size = doc.size || doc.fileSize || '—';
            const date = doc.date || (doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('fr-FR') : '—');
            const category = doc.category || 'QHSE';
            return (
              <Card key={doc.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-4 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-colors">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">{version}</Badge>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 leading-tight">{title}</h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {category}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1 border-l border-slate-100 pl-3">
                        <Calendar className="w-3 h-3" /> {date}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-400">{size} • {type}</p>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="w-5 h-5 text-slate-300" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white">
                        <Download className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
