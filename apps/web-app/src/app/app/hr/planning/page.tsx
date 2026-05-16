/**
 * ============================================================================
 * HR MODULE - PLANNING & POINTAGE PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  LogIn,
  LogOut,
  Timer,
  User
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PlanningPage() {
  const { tenant, academicYear } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayDate] = useState(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));

  useEffect(() => {
    async function fetchAttendance() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        // We fetch staff and their today's attendance
        const staffList = await apiFetch<any[]>(`/hr/staff?tenantId=${tenant.id}`);
        setStaff(staffList);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAttendance();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Planning & Pointage"
        description="Suivi en temps réel des présences, des retards et des heures supplémentaires."
        icon="rh"
        kpis={[
          { label: 'Présents ce jour', value: '0', unit: 'pers.' },
          { label: 'Retards', value: '0', unit: '' },
          { label: 'Heures Sup. (Mois)', value: '12', unit: 'hrs' },
        ]}
      />

      <div className="px-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Daily Checklist */}
          <div className="lg:w-2/3 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={20} className="text-blue-600" />
                Pointage du {todayDate}
              </h3>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filtrer par nom..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-50 overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Collaborateur</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Arrivée</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Départ</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {staff.map((s) => (
                      <tr key={s.id} className="hover:bg-blue-50/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                              {s.firstName[0]}{s.lastName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{s.firstName} {s.lastName}</p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">{s.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-400">--:--</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-400">--:--</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors">
                              <LogIn size={14} /> Arrivée
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-xs font-bold cursor-not-allowed">
                              <LogOut size={14} /> Départ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Side Panels */}
          <div className="lg:w-1/3 space-y-6">
            <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
              <CardTitle className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                <Timer size={20} className="text-blue-600" />
                Heures Supplémentaires
              </CardTitle>
              <div className="space-y-4">
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase mb-1">Total ce mois</p>
                  <h3 className="text-2xl font-black text-blue-900">12.5 hrs</h3>
                  <p className="text-xs text-blue-400 mt-1">Estimé : 45,000 XOF</p>
                </div>
                
                <button className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> Déclarer des heures
                </button>
              </div>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
              <CardTitle className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                <AlertCircle size={20} className="text-amber-500" />
                Alertes Retards
              </CardTitle>
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">Koffi A. (Retard 15min)</p>
                      <p className="text-[10px] text-amber-600 font-medium">Aujourd'hui à 08:15</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
