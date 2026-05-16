/**
 * ============================================================================
 * MODULE 3 : AUDIT ACADÉMIQUE
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  History, 
  User, 
  Activity, 
  FileSearch,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Filter
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

export default function AuditPage() {
  const { academicYear } = useModuleContext();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      if (!academicYear?.id) return;
      try {
        setLoading(true);
        const res = await institutionalExamsService.getAuditLogs({ academicYearId: academicYear.id });
        setLogs(res);
      } catch (error) {
        console.error('Error loading logs', error);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [academicYear]);

  const getActionIcon = (action: string) => {
    if (action.includes('LOCKED')) return <Lock className="w-4 h-4 text-amber-600" />;
    if (action.includes('UNLOCKED')) return <Unlock className="w-4 h-4 text-blue-600" />;
    if (action.includes('VALIDATED')) return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    return <Activity className="w-4 h-4 text-gray-500" />;
  };

  return (
    <ModuleContainer
      header={{
        title: 'Audit Académique',
        description: 'Journal des événements critiques et traçabilité des modifications de notes.',
        icon: 'shieldAlert',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'audit'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
               <div className="flex items-center space-x-2 text-sm text-gray-500 font-medium">
                  <Filter className="w-4 h-4" />
                  <span>Filtrer par entité :</span>
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 cursor-pointer">TOUTES</Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">GRADES</Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">EVALUATIONS</Badge>
                  <Badge variant="outline" className="cursor-pointer hover:bg-gray-50">LOCKS</Badge>
               </div>
               <Button variant="ghost" size="sm" className="text-gray-400">Exporter en PDF</Button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Détails</TableHead>
                    <TableHead className="text-right">Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-sm font-medium text-gray-500">
                        {format(new Date(log.createdAt), 'dd/MM HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                           {getActionIcon(log.action)}
                           <span className="font-bold text-xs uppercase tracking-wider">{log.action}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center text-sm">
                            <User className="w-3 h-3 mr-1 text-gray-400" />
                            {log.performedById}
                         </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">{log.entityType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs max-w-[200px] truncate text-gray-500">
                           {JSON.stringify(log.newValue)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right italic text-sm text-gray-400">
                        {log.reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-gray-400">
                        <History className="w-12 h-12 mx-auto mb-2 opacity-20" />
                        Aucun log d'audit pour le moment.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      }}
    />
  );
}
