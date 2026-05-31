/**
 * ============================================================================
 * HR MODULE - MAIN PAGE
 * ============================================================================
 */

'use client';

import { useModuleContext } from '@/hooks/useModuleContext';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { HROverview } from './_components/HROverview';
import { apiFetch } from '@/lib/api/client';
import { HR_SUBMODULE_TABS } from './hr-tabs';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

export default function HRPage() {
  const { tenant, academicYear } = useModuleContext();
  const pathname = usePathname();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  const currentTab = useMemo(() =>
    HR_SUBMODULE_TABS.find(tab =>
      ('exact' in tab && tab.exact) ? pathname === tab.path : pathname.startsWith(tab.path)
    )?.id || 'overview',
    [pathname]
  );

  async function fetchData() {
    if (!tenant?.id || !academicYear?.id) return;
    try {
      setIsFetching(true);
      const result = await apiFetch<any>(
        `/hr/overview/dashboard?tenantId=${tenant.id}&academicYearId=${academicYear.id}`
      );
      setData(result);
    } catch (error) {
      console.error('Error fetching HR overview data:', error);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (currentTab === 'overview') {
      fetchData();
    }
  }, [tenant?.id, academicYear?.id, currentTab]);

  return (
    <div className="space-y-0 pb-10">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
        <div className="flex items-end justify-between mb-6">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-2xl font-bold text-slate-900 tracking-tight"
            >
              Personnel, RH & Paie
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 }}
              className="text-sm text-slate-500 mt-0.5"
            >
              Gestion complète du personnel, des contrats, des présences, de la paie et des déclarations sociales.
            </motion.p>
          </div>
          {currentTab === 'overview' && (
            <button
              onClick={fetchData}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw
                className={cn('h-4 w-4 transition-transform duration-500', isFetching && 'animate-spin')}
                style={{ color: PRIMARY }}
              />
              {isFetching ? 'Actualisation...' : 'Actualiser'}
            </button>
          )}
        </div>

        {/* KPI Summary Bar */}
        {currentTab === 'overview' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Effectif total', value: data?.snapshot?.totalStaff ?? '—', unit: 'pers.' },
              { label: 'Masse salariale', value: data?.snapshot?.monthlyPayroll ? `${Math.round(data.snapshot.monthlyPayroll / 1000000)}M` : '—', unit: 'XOF' },
              { label: 'Congés actifs', value: data?.snapshot?.leaveCount ?? '—', unit: '' },
              { label: 'Alertes ORION', value: data?.orionAlerts?.length ?? '0', unit: '' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{kpi.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">
                  {loading ? <span className="inline-block h-5 w-12 rounded bg-slate-200 animate-pulse" /> : kpi.value}
                  {!loading && kpi.unit && <span className="ml-1 text-xs font-medium text-slate-400">{kpi.unit}</span>}
                </p>
              </motion.div>
            ))}
          </div>
        )}

        {/* Sub-module Navigation Tabs */}
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {HR_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = ('exact' in tab && tab.exact)
              ? pathname === tab.path
              : pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-t-xl px-4 py-2.5 text-sm font-semibold border-b-2 transition-all',
                  isActive
                    ? 'border-b-[#1A2BA6] text-[#1A2BA6] bg-blue-50/50'
                    : 'border-b-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Content ── */}
      <div className="px-6 pt-6">
        {currentTab === 'overview' ? (
          <HROverview data={data} loading={loading} />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-16 text-center"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
              <AlertCircle className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {HR_SUBMODULE_TABS.find(t => t.id === currentTab)?.label}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mt-2">
              Ce sous-module est en cours de déploiement. Utilisez la navigation pour consulter les autres sections disponibles.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
