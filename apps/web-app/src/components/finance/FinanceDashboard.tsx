/**
 * ============================================================================
 * ACADEMIA HELM - FINANCE MODULE
 * Dashboard pilotage stratégique (Spec Premium)
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  AlertCircle,
  TrendingDown,
  Wallet,
  BarChart3,
  DollarSign,
  Brain,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModuleContext } from '@/hooks/useModuleContext';
import { SubModuleNavigation } from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { financeService } from '@/services/finance.service';
import { orionService } from '@/services/orion.service';

const formatXOF = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Composant Mini-Chart (SVG) pour l'esthétique
 */
function Sparkline({ data, color = '#10b981' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const points = data
    .map((val, i) => `${(i / (data.length - 1)) * 100},${100 - (val / max) * 100}`)
    .join(' ');

  return (
    <svg className="w-16 h-8 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function FinanceDashboardArrears({
  academicYearId,
  schoolLevelId,
}: {
  academicYearId?: string;
  schoolLevelId?: string;
}) {
  const [arrears, setArrears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!academicYearId) return;
    setLoading(true);
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);
    financeService.getArrears(Object.fromEntries(params.entries()))
      .then((data) => setArrears(Array.isArray(data) ? data : []))
      .catch(() => setArrears([]))
      .finally(() => setLoading(false));
  }, [academicYearId, schoolLevelId]);

  const topByStudent = arrears.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Alertes de Recouvrement
        </h3>
        <Link
          href="/app/finance/collection"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 uppercase tracking-wider flex items-center gap-1"
        >
          Tout voir <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : topByStudent.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-50 text-green-500 mb-3">
              <RefreshCw className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500">Aucun impayé critique détecté.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {topByStudent.map((a, idx) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * idx }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                    {a.student?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {a.student?.firstName} {a.student?.lastName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.student?.studentEnrollments?.[0]?.class?.name ?? 'Classe N/A'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600 text-sm">{formatXOF(Number(a.balanceDue))}</p>
                  <Badge variant="outline" className="text-[10px] uppercase font-black border-red-200 text-red-700 bg-red-50">
                    {a.arrearsLevel ?? 'CRITIQUE'}
                  </Badge>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

export default function FinanceDashboard() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [kpis, setKpis] = useState<any>(null);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [orionAlerts, setOrionAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!academicYear?.id) return;
      setLoading(true);
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevel?.id) params.set('schoolLevelId', schoolLevel.id);

      try {
        const [kpi, monthly, alerts] = await Promise.all([
          financeService.getKpiReports(Object.fromEntries(params.entries())).catch(() => ({})),
          financeService.getMonthlyEncaissements(Object.fromEntries(params.entries())).catch(() => []),
          orionService.getAlerts({ academicYearId: academicYear.id }).catch(() => []),
        ]);

        setKpis(kpi);
        setMonthlyData(Array.isArray(monthly) ? monthly : []);
        setOrionAlerts(Array.isArray(alerts) ? alerts : []);
      } catch (e) {
        console.error('Finance dashboard load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [academicYear?.id, schoolLevel?.id]);

  const tabsForNav = useMemo(() => 
    FINANCE_SUBMODULE_TABS.map((t) => ({
      id: t.id,
      label: t.label,
      path: t.path,
      icon: <t.icon className="w-4 h-4" />,
    })), []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 }
  };

  return (
    <div className="space-y-8 pb-12">
      <SubModuleNavigation tabs={tabsForNav} currentPath="/app/finance" />

      {/* KPI Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <KPICard
          title="Total Encaissé"
          value={kpis?.totalEncaissement ?? 0}
          icon={<TrendingUp className="w-6 h-6" />}
          trend="+12.5%"
          color="emerald"
          loading={loading}
          sparklineData={[10, 25, 45, 30, 55, 70, 85]}
        />
        <KPICard
          title="Prévisionnel Dû"
          value={kpis?.totalDue ?? 0}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
          loading={loading}
          sparklineData={[80, 80, 80, 80, 80, 80, 80]}
        />
        <KPICard
          title="Taux Recouvrement"
          value={`${kpis?.tauxRecouvrement ?? 0}%`}
          isCurrency={false}
          icon={<BarChart3 className="w-6 h-6" />}
          trend="-2.4%"
          color="amber"
          loading={loading}
          sparklineData={[40, 45, 50, 48, 52, 55, 60]}
        />
        <KPICard
          title="Dépenses Total"
          value={kpis?.totalDepenses ?? 0}
          icon={<TrendingDown className="w-6 h-6" />}
          color="rose"
          loading={loading}
          sparklineData={[5, 15, 10, 25, 20, 35, 30]}
        />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Main Analytics Area */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="xl:col-span-2 space-y-8"
        >
          {/* Monthly Trend Chart Placeholder */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Évolution des Recettes</h3>
                <p className="text-sm text-slate-500">Performance financière mensuelle</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full">Mensuel</Button>
                <Button variant="ghost" size="sm" className="rounded-full">Trimestriel</Button>
              </div>
            </div>
            
            <div className="flex-1 flex items-end gap-2 pb-4">
              {loading ? (
                <div className="w-full h-full bg-slate-50 animate-pulse rounded-2xl" />
              ) : monthlyData.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-3xl">
                  <BarChart3 className="w-12 h-12 opacity-20" />
                  <p>Données historiques insuffisantes</p>
                </div>
              ) : (
                <div className="w-full h-64 flex items-end justify-between px-4 gap-4">
                  {monthlyData.map((d, i) => {
                    const height = (d.total / Math.max(...monthlyData.map(x => x.total), 1)) * 100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: 0.5 + i * 0.05, type: 'spring' }}
                          className="w-full bg-blue-500/10 group-hover:bg-blue-500/20 rounded-t-lg relative overflow-hidden transition-colors"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                          {d.month.split('-')[1]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <FinanceDashboardArrears academicYearId={academicYear?.id} schoolLevelId={schoolLevel?.id} />
        </motion.div>

        {/* Sidebar Analytics */}
        <div className="space-y-8">
          {/* ORION Intelligence */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-lg tracking-tight">ORION Intelligence</h3>
              </div>

              {loading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-white/10 animate-pulse rounded w-3/4" />
                  <div className="h-20 bg-white/5 animate-pulse rounded" />
                </div>
              ) : orionAlerts.length === 0 ? (
                <div className="py-6">
                  <p className="text-blue-200 text-sm leading-relaxed">
                    Aucune anomalie détectée. La santé financière de l'établissement est optimale.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {orionAlerts.map((a, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className={`p-4 rounded-2xl border ${
                        a.level === 'CRITICAL' 
                          ? 'bg-red-500/10 border-red-500/20 text-red-100' 
                          : 'bg-blue-500/10 border-blue-500/20 text-blue-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {a.level === 'CRITICAL' ? <ArrowUpRight className="w-4 h-4 text-red-400" /> : <Clock className="w-4 h-4 text-blue-400" />}
                        <span className="text-xs font-black uppercase tracking-widest">{a.title}</span>
                      </div>
                      <p className="text-xs opacity-80">{a.message}</p>
                    </motion.div>
                  ))}
                </div>
              )}
              
              <Button variant="ghost" className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white border-0 rounded-2xl">
                Analyser maintenant
              </Button>
            </div>
          </motion.div>

          {/* Rapid Access Grid */}
          <div className="grid grid-cols-2 gap-4">
            {FINANCE_SUBMODULE_TABS.filter(t => t.id !== 'dashboard').slice(0, 4).map((tab, i) => (
              <motion.div
                key={tab.id}
                whileHover={{ y: -5 }}
                className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center text-center gap-3"
              >
                <Link href={tab.path} className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <tab.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 leading-tight">{tab.label}</span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ 
  title, 
  value, 
  icon, 
  trend, 
  color, 
  loading, 
  isCurrency = true,
  sparklineData
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  trend?: string; 
  color: 'emerald' | 'blue' | 'amber' | 'rose';
  loading: boolean;
  isCurrency?: boolean;
  sparklineData: number[];
}) {
  const colorMap = {
    emerald: 'bg-emerald-500 text-emerald-600 ring-emerald-100',
    blue: 'bg-blue-500 text-blue-600 ring-blue-100',
    amber: 'bg-amber-500 text-amber-600 ring-amber-100',
    rose: 'bg-rose-500 text-rose-600 ring-rose-100'
  };

  const sparkColor = {
    emerald: '#10b981',
    blue: '#3b82f6',
    amber: '#f59e0b',
    rose: '#f43f5e'
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-opacity-10 ${colorMap[color].split(' ')[0]} ${colorMap[color].split(' ')[1]}`}>
            {icon}
          </div>
          {trend && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend.startsWith('+') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {trend}
            </span>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-500 tracking-wide uppercase">{title}</p>
          <div className="flex items-end justify-between">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">
              {loading ? '—' : (typeof value === 'number' && isCurrency ? formatXOF(value) : value)}
            </h4>
            {!loading && <Sparkline data={sparklineData} color={sparkColor[color]} />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
