'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, Mail, Phone, MapPin, Briefcase, User, GraduationCap, Building2 } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { AddStaffModal } from '../_components/modals/AddStaffModal';

export default function StaffPage() {
  const { tenant, academicYear } = useModuleContext();
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, [tenant?.id, filterCategory, filterStatus]);

  async function fetchStaff() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      let url = `/hr/staff?tenantId=${tenant.id}`;
      if (filterCategory !== 'ALL') url += `&category=${filterCategory}`;
      if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
      
      const result = await apiFetch<any[]>(url);
      setStaff(result);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = staff.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.staffCode && s.staffCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20">
      <AddStaffModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={fetchStaff}
        tenantId={tenant?.id || ''}
      />
      <ModuleHeader
        title="Gestion du Personnel"
        description="Fiche normalisée, documents et suivi de carrière de l'ensemble des collaborateurs."
        icon="rh"
        kpis={[
          { label: 'Effectif total', value: staff.length.toString(), unit: 'pers.' },
          { label: 'Enseignants', value: staff.filter(s => s.category === 'PEDAGOGICAL').length.toString(), unit: '' },
          { label: 'Administratifs', value: staff.filter(s => s.category === 'ADMIN').length.toString(), unit: '' },
          { label: 'Non déclarés CNSS', value: staff.filter(s => s.cnssStatus === 'NOT_DECLARED').length.toString(), unit: '' },
        ]}
      />

      <div className="px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0 md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Nom, prénom ou matricule..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <select 
                className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="ALL">Toutes les catégories</option>
                <option value="PEDAGOGICAL">Corps Enseignant</option>
                <option value="ADMIN">Administration</option>
                <option value="SUPPORT">Personnel d'appui</option>
              </select>

              <select 
                className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="SUSPENDED">Suspendu</option>
              </select>
            </div>
          </div>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md hover:shadow-lg transition-all font-semibold whitespace-nowrap"
          >
            <Plus size={20} />
            Nouveau collaborateur
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 bg-gray-100 rounded-2xl" />
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <div className="p-4 bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <User className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">Aucun collaborateur trouvé</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              Ajustez vos filtres ou commencez par ajouter un nouveau membre à votre effectif.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStaff.map((member) => (
              <StaffCard key={member.id} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffCard({ member }: { member: any }) {
  const statusColors: any = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    INACTIVE: 'bg-gray-50 text-gray-600 border-gray-100',
    SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <Card className="group border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-2xl overflow-hidden bg-white">
      <CardContent className="p-0">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl shadow-inner">
                {member.firstName[0]}{member.lastName[0]}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
                  {member.firstName} {member.lastName}
                </h4>
                <p className="text-xs font-bold text-blue-500 tracking-wider uppercase">
                  {member.staffCode || 'MAT-PENDING'}
                </p>
              </div>
            </div>
            <Badge className={`px-3 py-1 rounded-full border ${statusColors[member.status] || statusColors.INACTIVE}`}>
              {member.status === 'ACTIVE' ? 'En poste' : member.status}
            </Badge>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                <Briefcase size={16} />
              </div>
              <span>{member.position || 'Poste non défini'}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                <GraduationCap size={16} />
              </div>
              <span>{member.category === 'PEDAGOGICAL' ? 'Corps Enseignant' : 'Personnel Admin'}</span>
            </div>
            {member.phone && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400">
                  <Phone size={16} />
                </div>
                <span>{member.phone}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
            <div className="flex -space-x-2">
              {/* Documents indicators */}
              {['CNI', 'DIP', 'CNSS'].map((doc, i) => (
                <div key={i} className="w-7 h-7 rounded-full bg-white border border-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 shadow-sm" title={doc}>
                  {doc}
                </div>
              ))}
            </div>
            <Link 
              href={`/app/hr/staff/${member.id}`}
              className="px-4 py-2 text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Gérer la fiche →
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


