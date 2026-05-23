'use client';

import { useState, useEffect } from 'react';
import { Plus, DollarSign, Calendar, FileText, CheckCircle2, Clock, ChevronRight, Calculator, CreditCard, ShieldCheck, UserCheck, Shield, Users } from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PayrollPage() {
  const { tenant, academicYear } = useModuleContext();
  const pathname = usePathname();
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

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
    async function fetchData() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const [payrollData, statsData] = await Promise.all([
          apiFetch<any[]>(`/hr/payroll/periods?tenantId=${tenant.id}`),
          apiFetch<any>(`/hr/payroll/statistics?tenantId=${tenant.id}&academicYearId=${academicYear?.id}`)
        ]);
        setPayrolls(payrollData);
        setStats(statsData);
      } catch (error) {
        console.error('Error fetching payroll data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tenant?.id, academicYear?.id]);

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Gestion de la Paie"
        description="Moteur de calcul des salaires, retenues fiscales (IRPP) et sociales (CNSS)."
        icon="rh"
        kpis={[
          { label: 'Masse annuelle', value: stats?.totalAmount ? `${Math.round(stats.totalAmount / 1000000)}M` : '0', unit: 'XOF' },
          { label: 'Effectif moyen', value: stats?.totalStaff?.toString() || '0', unit: 'pers.' },
          { label: 'Dernière paie', value: payrolls[0]?.startDate ? new Date(payrolls[0].startDate).toLocaleDateString('fr-FR', { month: 'short' }) : 'N/A', unit: '' },
        ]}
      />

      <div className="px-6">
        <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
        
        <div className="flex justify-between items-center mb-8 mt-6">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign size={24} className="text-blue-600" />
            Historique des Paies
          </h3>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md transition-all font-semibold">
            <Plus size={20} />
            Nouvelle Période
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
          </div>
        ) : payrolls.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <CreditCard className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-800">Aucune paie enregistrée</h3>
            <p className="text-gray-500 mt-2">Commencez par initialiser une période de paie pour l'exercice en cours.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {payrolls.map((payroll) => (
              <PayrollRow key={payroll.id} payroll={payroll} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayrollRow({ payroll }: { payroll: any }) {
  const statusConfig: any = {
    OPEN: { label: 'Ouvert', color: 'bg-blue-50 text-blue-600', icon: Clock },
    CALCULATED: { label: 'Calculé', color: 'bg-amber-50 text-amber-600', icon: Calculator },
    VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-600', icon: ShieldCheck },
    PAID: { label: 'Payé', color: 'bg-emerald-500 text-white', icon: CreditCard },
  };

  const config = statusConfig[payroll.status] || statusConfig.OPEN;
  const Icon = config.icon || Clock;

  const monthLabel = new Date(payroll.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <Link href={`/app/hr/payroll/${payroll.id}`}>
      <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden bg-white group">
        <CardContent className="p-0">
          <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${
                payroll.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {monthLabel.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg capitalize">{monthLabel}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 border-none ${config.color}`}>
                    <Icon size={12} className="mr-1" /> {config.label}
                  </Badge>
                  <span className="text-xs text-gray-400 font-medium">
                    {payroll._count?.payrolls || 0} bulletins
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-12 flex-grow max-w-xl px-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right md:text-left">Net à Payer</p>
                <div className="text-lg font-black text-gray-900 text-right md:text-left">
                  {Number(payroll.totalAmount).toLocaleString()} <span className="text-xs font-bold">XOF</span>
                </div>
              </div>
              
              <div className="hidden md:block space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Période</p>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar size={14} className="text-gray-400" />
                  {new Date(payroll.startDate).toLocaleDateString()} → {new Date(payroll.endDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
              <ChevronRight size={24} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}


