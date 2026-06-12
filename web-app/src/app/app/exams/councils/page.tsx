/**
 * ============================================================================
 * MODULE 3 : CONSEILS DE CLASSE
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  CheckSquare, 
  FileText, 
  ChevronRight,
  Gavel,
  MoreVertical,
  Plus,
  Clock,
  MapPin
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useModuleContext } from '@/hooks/useModuleContext';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function CouncilsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [councils, setCouncils] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock period
  const currentPeriodId = "T1";

  useEffect(() => {
    async function loadData() {
      if (!academicYear?.id) return;
      try {
        setLoading(true);
        const res = await institutionalExamsService.getCouncils(currentPeriodId);
        setCouncils(res);
      } catch (error) {
        console.error('Error loading councils', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [academicYear]);

  return (
    <ModuleContainer
      header={{
        title: 'Conseils de Classe',
        description: 'Tenue des sessions de délibération et décisions pédagogiques.',
        icon: 'gavel',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'councils'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
               <h2 className="text-lg font-bold text-gray-900">Sessions de délibération</h2>
               <Button className="bg-blue-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Programmer un Conseil
               </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {councils.map((council) => (
                <div key={council.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-3 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                         <Users className="w-6 h-6" />
                      </div>
                      <Badge className={council.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                         {council.status === 'COMPLETED' ? 'Terminé' : 'Programmé'}
                      </Badge>
                   </div>
                   
                   <h3 className="font-bold text-gray-900 mb-1">{council.title}</h3>
                   <p className="text-xs text-gray-500 mb-4 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {format(new Date(council.scheduledAt), 'eeee d MMMM yyyy', { locale: fr })}
                   </p>

                   <div className="space-y-2 mb-6">
                      <div className="flex items-center text-sm text-gray-600">
                         <Clock className="w-4 h-4 mr-2 text-gray-400" />
                         14:30 - Salle des Actes
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                         <CheckSquare className="w-4 h-4 mr-2 text-gray-400" />
                         Délibération des moyennes
                      </div>
                   </div>

                   <Button variant="outline" className="w-full text-blue-600 border-blue-100 hover:bg-blue-50 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600">
                      Ouvrir la session
                      <ChevronRight className="w-4 h-4 ml-2" />
                   </Button>
                </div>
              ))}
              
              {councils.length === 0 && !loading && (
                <div className="col-span-full py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                   <Gavel className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                   <h3 className="text-gray-500 font-medium">Aucun conseil de classe programmé</h3>
                   <p className="text-sm text-gray-400 max-w-xs mx-auto mt-1">Les délibérations se tiennent généralement à la fin de chaque période scolaire.</p>
                   <Button variant="link" className="text-blue-600 mt-4 font-bold">Consulter le calendrier académique</Button>
                </div>
              )}
            </div>
          </div>
        )
      }}
    />
  );
}
