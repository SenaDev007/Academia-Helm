/**
 * ============================================================================
 * HR MODULE - LEAVES PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  Search,
  Filter,
  User,
  Coffee
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function LeavesPage() {
  const { tenant, academicYear } = useModuleContext();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('PENDING');

  useEffect(() => {
    async function fetchLeaves() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        let url = `/hr/leaves/requests?tenantId=${tenant.id}`;
        if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
        
        const result = await apiFetch<any[]>(url);
        setRequests(result);
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaves();
  }, [tenant?.id, filterStatus]);

  const kpis = [
    { label: 'Demandes en attente', value: requests.filter(r => r.status === 'PENDING').length.toString(), color: 'amber' },
    { label: 'Approuvées ce mois', value: requests.filter(r => r.status === 'APPROVED').length.toString(), color: 'emerald' },
    { label: 'Absences ce jour', value: '3', color: 'blue' }, // Mocked or fetched separately
  ];

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Congés & Absences"
        description="Gestion des demandes de congés, suivi des absences et calcul automatisé des soldes."
        icon="rh"
        kpis={kpis.map(k => ({ label: k.label, value: k.value, unit: '' }))}
      />

      <div className="px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
              {['PENDING', 'APPROVED', 'ALL'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    filterStatus === status 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {status === 'PENDING' ? 'En attente' : status === 'APPROVED' ? 'Approuvés' : 'Tous'}
                </button>
              ))}
            </div>
          </div>

          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-all font-semibold">
            <Plus size={20} />
            Nouvelle demande
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <Coffee className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-800">Aucune demande trouvée</h3>
            <p className="text-gray-500 mt-2">Le personnel est actuellement au complet ou aucune demande n'a été faite.</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-50">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Collaborateur</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Type / Motif</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Période</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Durée</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-blue-50/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {request.staff?.firstName[0]}{request.staff?.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{request.staff?.firstName} {request.staff?.lastName}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{request.staff?.staffCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700">{request.type}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[200px] italic">"{request.reason || 'Pas de motif'}"</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                        <Calendar size={14} className="text-gray-400" />
                        {new Date(request.startDate).toLocaleDateString()}
                        <span className="text-gray-300">→</span>
                        {new Date(request.endDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-none font-bold">
                        {calculateDays(request.startDate, request.endDate)} jrs
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {request.status === 'PENDING' && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          request.status === 'APPROVED' ? 'text-emerald-600' :
                          request.status === 'REJECTED' ? 'text-rose-600' :
                          'text-amber-600'
                        }`}>
                          {request.status === 'PENDING' ? 'En attente' : request.status === 'APPROVED' ? 'Approuvé' : 'Refusé'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {request.status === 'PENDING' ? (
                        <div className="flex justify-end gap-2">
                          <button 
                            className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                            title="Approuver"
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <button 
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors"
                            title="Rejeter"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      ) : (
                        <button className="text-gray-400 hover:text-blue-600 transition-colors">
                          <FileText size={20} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateDays(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
