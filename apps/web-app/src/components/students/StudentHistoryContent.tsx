/**
 * ============================================================================
 * SOUS-MODULE C — HISTORIQUE & MULTI-ANNÃ‰E
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { History, Milestone, TrendingUp, AlertTriangle, Lock, Unlock, FileText } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { LoadingState } from '@/components/ui/feedback/LoadingState';

interface HistoryRecord {
  id: string;
  student: {
    firstName: string;
    lastName: string;
    matricule?: string;
  };
  academicRecords: Array<{
    id: string;
    academicYear: { label: string };
    class?: { name: string };
    averageScore?: number;
    decision?: string;
    isLocked: boolean;
  }>;
}

export default function StudentHistoryContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) loadHistory();
  }, [academicYear, schoolLevel]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeHistory: 'true',
      });
      const res = await fetch(`/api/students?${params}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Reconstitution des parcours..." />;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 border-l-4 border-l-purple-600">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl">
            <History className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">MÃ©moire Institutionnelle</h3>
            <p className="text-sm text-gray-500">TrabilitÃ© des promotions, redoublements et dÃ©cisions de conseils</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Ã‰lÃ¨ve</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Parcours (3 derniÃ¨res annÃ©es)</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-all">
                      {item.student.lastName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{item.student.lastName} {item.student.firstName}</div>
                      <div className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">{item.student.matricule || 'Sans matricule'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {item.academicRecords.slice(0, 3).map((record, idx) => (
                      <div key={record.id} className="relative flex items-center">
                        <div className={`flex flex-col p-2 rounded-lg border min-w-[120px] ${
                          record.isLocked ? 'bg-gray-50 border-gray-200 shadow-inner' : 'bg-white border-blue-100 shadow-sm'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">{record.academicYear.label}</span>
                            {record.isLocked ? <Lock className="w-2.5 h-2.5 text-gray-400" /> : <Unlock className="w-2.5 h-2.5 text-green-500" />}
                          </div>
                          <div className="text-xs font-bold text-gray-800 truncate">{record.class?.name || 'Inconnu'}</div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              record.decision === 'PROMOTED' ? 'bg-green-100 text-green-700' : 
                              record.decision === 'REPEATED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {record.decision || 'EN COURS'}
                            </span>
                            {record.averageScore && (
                              <span className="text-[10px] font-mono font-bold text-blue-600">{record.averageScore}/20</span>
                            )}
                          </div>
                        </div>
                        {idx < Math.min(item.academicRecords.length, 3) - 1 && (
                          <Milestone className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
                        )}
                      </div>
                    ))}
                    {item.academicRecords.length === 0 && (
                      <span className="text-xs text-gray-400 italic">Aucun historique numÃ©risÃ©</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-black transition-colors shadow-sm">
                    <FileText className="w-3.5 h-3.5" />
                    Dossier Complet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="py-20 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Aucune donnÃ©e historique trouvÃ©e pour ce contexte.</p>
          </div>
        )}
      </div>
    </div>
  );
}
