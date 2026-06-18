/**
 * ============================================================================
 * MODULE 3 : EVALUATIONS - GESTION DES EXAMENS
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  FileText, 
  Send,
  Eye,
  Trash2,
  Calendar
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function EvaluationsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      try {
        setLoading(true);
        const params: any = {
          schoolLevelId: schoolLevel.id,
          academicYearId: academicYear.id,
        };
        if (isBilingual) params.language = currentTrack;
        const res = await institutionalExamsService.getEvaluations(params);
        setEvaluations(res);
      } catch (error) {
        console.error('Error loading evaluations', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [schoolLevel, academicYear, isBilingual, currentTrack]);


  return (
    <ModuleContainer
      header={{
        title: 'Évaluations',
        description: 'Planification et suivi des examens institutionnels.',
        icon: 'fileText',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'evaluations'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Bilingual track selector */}
            {isBilingual && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setCurrentTrack('FR')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'FR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTrack('EN')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${currentTrack === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                  English
                </button>
              </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 w-96">
                <Search className="w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher une évaluation..." 
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtres
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle Évaluation
                </Button>
              </div>
            </div>

            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Titre</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((ev) => (
                    <TableRow key={ev.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium">{ev.title}</TableCell>
                      <TableCell>{ev.class.name}</TableCell>
                      <TableCell>{ev.subject.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-3 h-3 mr-1" />
                          {format(new Date(ev.evaluationDate), 'dd/MM/yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ev.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {ev._count.grades} notes
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600">
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {evaluations.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                        Aucune évaluation planifiée.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )
      }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: any = {
    PLANNED: { label: 'Planifié', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    OPEN_FOR_GRADING: { label: 'En Saisie', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    SUBMITTED: { label: 'Soumis', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    VALIDATED: { label: 'Validé', className: 'bg-green-100 text-green-700 border-green-200' },
  };

  const config = configs[status] || { label: status, className: 'bg-gray-100' };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function Card({ children, className }: any) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
