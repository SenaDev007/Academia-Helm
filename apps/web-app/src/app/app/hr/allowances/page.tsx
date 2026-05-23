/**
 * ============================================================================
 * HR MODULE - ALLOWANCES & PRIMES PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  DollarSign, 
  Settings, 
  UserPlus, 
  Trash2, 
  Edit3,
  Search,
  Filter,
  CheckCircle2,
  Info,
  UserCheck,
  FileText,
  Clock,
  Shield,
  Users
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePathname } from 'next/navigation';

export default function AllowancesPage() {
  const { tenant, academicYear } = useModuleContext();
  const pathname = usePathname();
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const subModuleTabs = [
    { id: 'overview', label: "Vue d'ensemble", path: '/app/hr', icon: UserCheck, exact: true },
    { id: 'staff', label: 'Personnel', path: '/app/hr/staff', icon: Users },
    { id: 'contracts', label: 'Contrats', path: '/app/hr/contracts', icon: FileText },
    { id: 'leaves', label: 'Congés & Absences', path: '/app/hr/leaves', icon: Clock },
    { id: 'planning', label: 'Planning', path: '/app/hr/planning', icon: Clock },
    { id: 'allowances', label: 'Indemnités', path: '/app/hr/allowances', icon: DollarSign },
    { id: 'payroll', label: 'Paie', path: '/app/hr/payroll', icon: DollarSign },
    { id: 'cnss', label: 'CNSS', path: '/app/hr/cnss', icon: Shield },
    { id: 'reporting', label: 'Rapports', path: '/app/hr/reporting', icon: FileText },
    { id: 'settings', label: 'Paramètres', path: '/app/hr/settings', icon: Shield },
  ];

  useEffect(() => {
    async function fetchAllowanceTypes() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const result = await apiFetch<any[]>(`/hr/allowances/types?tenantId=${tenant.id}`);
        setAllowanceTypes(result);
      } catch (error) {
        console.error('Error fetching allowance types:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllowanceTypes();
  }, [tenant?.id]);

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Indemnités & Primes"
        description="Configuration des variables de paie : primes fixes, indemnités de transport, logement et gratifications."
        icon="rh"
        kpis={[
          { label: 'Types définis', value: allowanceTypes.length.toString(), unit: '' },
          { label: 'Primes imposables', value: allowanceTypes.filter(t => t.isTaxable).length.toString(), unit: '' },
          { label: 'Total distribué (est.)', value: '1.2M', unit: 'XOF' },
        ]}
      />

      <div className="px-6">
        <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
        
        <Tabs defaultValue="types" className="w-full mt-6">
          <TabsList className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 mb-8">
            <TabsTrigger value="types" className="px-6 py-2.5 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              Configuration des Types
            </TabsTrigger>
            <TabsTrigger value="assignments" className="px-6 py-2.5 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              Attributions par Personnel
            </TabsTrigger>
          </TabsList>

          <TabsContent value="types">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Settings size={20} className="text-blue-600" />
                Catalogue des Indemnités
              </h3>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-all font-semibold">
                <Plus size={18} /> Nouveau Type
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                [1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />)
              ) : allowanceTypes.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100">
                  <DollarSign className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500">Aucun type d'indemnité configuré.</p>
                </div>
              ) : (
                allowanceTypes.map((type) => (
                  <Card key={type.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-white p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                        <DollarSign size={24} />
                      </div>
                      <div className="flex gap-2">
                        <Badge className={type.isTaxable ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}>
                          {type.isTaxable ? 'Imposable' : 'Exonéré'}
                        </Badge>
                      </div>
                    </div>
                    <h4 className="font-bold text-gray-900 text-lg mb-1">{type.name}</h4>
                    <p className="text-xs text-gray-400 font-bold mb-4 uppercase">{type.code}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                      <span className="text-xl font-black text-gray-900">
                        {type.amount ? `${Number(type.amount).toLocaleString()} XOF` : 'Variable'}
                      </span>
                      <div className="flex gap-1">
                        <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors"><Edit3 size={18} /></button>
                        <button className="p-2 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={18} /></button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="assignments">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="font-bold text-gray-800">Attributions Actives</h3>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Rechercher un employé..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-bold">
                    <UserPlus size={18} /> Attribuer
                  </button>
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Employé</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Indemnité</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Montant</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Périodicité</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-blue-50/10">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold">KA</div>
                          <span className="text-sm font-bold text-gray-800">Koffi Antoine</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase">Logement</Badge>
                      </td>
                      <td className="px-6 py-4 font-bold text-sm">45,000 XOF</td>
                      <td className="px-6 py-4 text-xs text-gray-500">Mensuel</td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-gray-400 hover:text-red-600"><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
