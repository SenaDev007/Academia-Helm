/**
 * ============================================================================
 * SOUS-MODULE D — RÃ‰GIMES & SITUATION FINANCIÃˆRE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { DollarSign, CreditCard, ShieldAlert, BadgeCheck, Receipt, Wallet, ArrowRight } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';

interface FinanceRecord {
  id: string;
  student: {
    firstName: string;
    lastName: string;
    matricule?: string;
  };
  feeProfile?: {
    feeRegime: { label: string; code: string };
    totalExpected: number;
    totalPaid: number;
    balance: number;
  };
}

export default function StudentRegimeFinanceContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [data, setData] = useState<FinanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) loadFinanceData();
  }, [academicYear, schoolLevel]);

  const loadFinanceData = async () => {
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeFinance: 'true',
      };
      const data = await studentsService.getAll(params);
      setData(data);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger la situation financière', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Synchronisation financière..." />;

  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-5 text-white shadow-lg shadow-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-white/20 rounded-lg"><Wallet className="w-5 h-5" /></div>
            <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded">GLOBAL</span>
          </div>
          <div className="text-2xl font-black">Recouvrement</div>
          <div className="text-xs opacity-80 mt-1">Niveau de collecte en temps rÃ©el</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 rounded-lg"><ShieldAlert className="w-5 h-5 text-blue-600" /></div>
            <span className="text-[10px] font-bold text-blue-600 uppercase">Alertes</span>
          </div>
          <div className="text-2xl font-black text-gray-900">12 ImpayÃ©s</div>
          <div className="text-xs text-gray-500 mt-1">DÃ©passement de dÃ©lai dÃ©tectÃ©</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 rounded-lg"><BadgeCheck className="w-5 h-5 text-purple-600" /></div>
            <span className="text-[10px] font-bold text-purple-600 uppercase">RÃ©gimes</span>
          </div>
          <div className="text-2xl font-black text-gray-900">8 SpÃ©ciaux</div>
          <div className="text-xs text-gray-500 mt-1">Enfants personnel & bourses</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50/50 border-b border-gray-200 flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-700">Situation des Ã‰lÃ¨ves</h4>
          <div className="flex items-center gap-2">
             <button className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
               Exporter le grand livre
             </button>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">Ã‰lÃ¨ve & RÃ©gime</th>
              <th className="px-6 py-4 text-right">ScolaritÃ©</th>
              <th className="px-6 py-4 text-right">VersÃ©</th>
              <th className="px-6 py-4 text-right">Reste Ã  payer</th>
              <th className="px-6 py-4 text-center">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-gray-900 text-sm">{item.student.lastName} {item.student.firstName}</div>
                  <div className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter mt-0.5">
                    {item.feeProfile?.feeRegime.label || 'SANS RÃ‰GIME'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm font-bold text-gray-600">
                  {item.feeProfile?.totalExpected?.toLocaleString() || '0'} FCFA
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm font-bold text-green-600">
                  {item.feeProfile?.totalPaid?.toLocaleString() || '0'} FCFA
                </td>
                <td className="px-6 py-4 text-right font-mono text-sm font-bold text-red-600">
                  {item.feeProfile?.balance?.toLocaleString() || '0'} FCFA
                </td>
                <td className="px-6 py-4 text-center">
                  {(item.feeProfile?.balance || 0) <= 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase">
                      <BadgeCheck className="w-3 h-3" /> SoldÃ©
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase">
                      <Receipt className="w-3 h-3" /> En cours
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
