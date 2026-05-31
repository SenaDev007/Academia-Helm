'use client';

import { useState, useEffect } from 'react';
import {
  Plus, DollarSign, Calendar, ChevronRight,
  Calculator, CreditCard, ShieldCheck, Clock, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ComponentType<any> }> = {
  OPEN:       { label: 'Ouvert',   className: 'bg-blue-50 text-[#1A2BA6] border border-blue-200',    icon: Clock },
  CALCULATED: { label: 'Calculé',  className: 'bg-amber-50 text-amber-600 border border-amber-200',  icon: Calculator },
  VALIDATED:  { label: 'Validé',   className: 'bg-emerald-50 text-emerald-600 border border-emerald-200', icon: ShieldCheck },
  PAID:       { label: 'Payé',     className: 'bg-emerald-600 text-white border border-emerald-600',  icon: CreditCard },
};

export default function PayrollPage() {
  const { tenant, academicYear } = useModuleContext();
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        const [payrollData, statsData] = await Promise.all([
          apiFetch<any[]>(`/hr/payroll/periods?tenantId=${tenant.id}`),
          apiFetch<any>(`/hr/payroll/statistics?tenantId=${tenant.id}&academicYearId=${academicYear?.id}`),
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

  const lastPayroll = payrolls[0];

  return (
    <div className="pb-20">
      <div className="px-6 pt-6 space-y-6">

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            {
              label: 'Masse annuelle',
              value: stats?.totalAmount ? `${Math.round(stats.totalAmount / 1000000)}M XOF` : '—',
            },
            {
              label: 'Effectif moyen',
              value: stats?.totalStaff ? `${stats.totalStaff} pers.` : '—',
            },
            {
              label: 'Dernière paie',
              value: lastPayroll?.startDate
                ? new Date(lastPayroll.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                : '—',
            },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{k.label}</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5" style={{ color: PRIMARY }} />
            Historique des Paies
          </h3>
          <button
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle Période
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : payrolls.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
              <CreditCard className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Aucune paie enregistrée</h3>
            <p className="text-sm text-slate-500 mt-2">
              Commencez par initialiser une période de paie pour l'exercice en cours.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payrolls.map((payroll, idx) => (
              <PayrollRow key={payroll.id} payroll={payroll} index={idx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PayrollRow({ payroll, index }: { payroll: any; index: number }) {
  const config = STATUS_CONFIG[payroll.status] || STATUS_CONFIG.OPEN;
  const StatusIcon = config.icon;
  const monthLabel = new Date(payroll.startDate).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link href={`/app/hr/payroll/${payroll.id}`}>
        <div className="group rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
          <div className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Month badge + title */}
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}
              >
                {monthLabel.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm capitalize">{monthLabel}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    config.className
                  )}>
                    <StatusIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {payroll._count?.payrolls || 0} bulletins
                  </span>
                </div>
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-8 flex-grow max-w-md">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Net à Payer</p>
                <p className="text-lg font-black text-slate-900">
                  {Number(payroll.totalAmount).toLocaleString()}
                  <span className="text-xs font-bold ml-1 text-slate-400">XOF</span>
                </p>
              </div>
              <div className="hidden md:block">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Période</p>
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {new Date(payroll.startDate).toLocaleDateString('fr-FR')}
                  <span className="text-slate-300">→</span>
                  {new Date(payroll.endDate).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-300 group-hover:border-[#1A2BA6] group-hover:text-[#1A2BA6] transition-all shrink-0">
              <ChevronRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
