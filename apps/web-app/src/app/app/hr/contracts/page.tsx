'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, FileText, Calendar, DollarSign, Clock, AlertCircle, FileCheck, User } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function ContractsPage() {
  const { tenant, academicYear } = useModuleContext();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  useEffect(() => {
    async function fetchContracts() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        let url = `/hr/contracts?tenantId=${tenant.id}`;
        if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
        
        const result = await apiFetch<any[]>(url);
        setContracts(result);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [tenant?.id, filterStatus]);

  const filteredContracts = contracts.filter(c => 
    `${c.staff?.firstName} ${c.staff?.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.staff?.staffCode && c.staff?.staffCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Gestion des Contrats"
        description="Moteur de versioning, avenants et suivi des échéances contractuelles."
        icon="rh"
        kpis={[
          { label: 'Contrats actifs', value: contracts.filter(c => c.status === 'ACTIVE').length.toString(), unit: '' },
          { label: 'CDI en cours', value: contracts.filter(c => c.type === 'CDI' && c.status === 'ACTIVE').length.toString(), unit: '' },
          { label: 'Échéances J-30', value: contracts.filter(c => {
            if (!c.endDate || c.status !== 'ACTIVE') return false;
            const diff = (new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
            return diff > 0 && diff <= 30;
          }).length.toString(), unit: '' },
        ]}
      />

      <div className="px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Rechercher par nom ou matricule..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select 
              className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ACTIVE">Contrats Actifs</option>
              <option value="ALL">Historique Complet</option>
              <option value="EXPIRED">Expirés</option>
              <option value="TERMINATED">Terminés</option>
            </select>
          </div>

          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transition-all font-semibold">
            <Plus size={20} />
            Nouveau contrat / Avenant
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <FileText className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-800">Aucun contrat trouvé</h3>
            <p className="text-gray-500 mt-2">Commencez par générer un contrat pour un membre du personnel.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredContracts.map((contract) => (
              <ContractRow key={contract.id} contract={contract} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractRow({ contract }: { contract: any }) {
  const isExpiringSoon = () => {
    if (!contract.endDate || contract.status !== 'ACTIVE') return false;
    const diff = (new Date(contract.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    return diff > 0 && diff <= 30;
  };

  return (
    <Card className={`border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white ${isExpiringSoon() ? 'ring-1 ring-amber-200 bg-amber-50/10' : ''}`}>
      <CardContent className="p-0">
        <div className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${
              contract.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
            }`}>
              {contract.type[0]}
            </div>
            <div>
              <h4 className="font-bold text-gray-900">
                {contract.staff?.firstName} {contract.staff?.lastName}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] uppercase font-bold py-0">
                  {contract.type}
                </Badge>
                <span className="text-xs text-gray-400 font-medium">#{contract.staff?.staffCode}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 flex-grow max-w-2xl px-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Période</p>
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Calendar size={14} className="text-gray-400" />
                {new Date(contract.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                {' → '}
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : 'Indéfini'}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Salaire de base</p>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                <DollarSign size={14} />
                {Number(contract.baseSalary).toLocaleString()} XOF
              </div>
            </div>

            <div className="hidden md:block space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Statut / Alerte</p>
              <div className="flex items-center gap-2">
                {isExpiringSoon() ? (
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 animate-pulse">
                    <AlertCircle size={14} /> Expiration proche
                  </div>
                ) : (
                  <Badge className={contract.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                    {contract.status === 'ACTIVE' ? 'En vigueur' : contract.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto border-t md:border-none pt-4 md:pt-0">
            <button className="flex-grow md:flex-grow-0 px-4 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              Gérer l'avenant
            </button>
            <Link 
              href={`/app/hr/contracts/${contract.id}`}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <FileCheck size={20} />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


