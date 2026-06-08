/**
 * ============================================================================
 * HR OVERVIEW COMPONENT
 * Design harmonisé avec le pattern pédagogie (SubjectsWorkspace)
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  DollarSign,
  Calendar,
  Briefcase,
  ShieldCheck,
  ArrowRight,
  BarChart3,
  Target,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

function KpiCard({
  label,
  value,
  subValue,
  icon: Icon,
  index = 0,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      <div className="absolute -right-4 -top-4 opacity-[0.04]">
        <Icon className="h-24 w-24" />
      </div>
      <div className="flex items-start justify-between">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <Icon className="h-5 w-5" style={{ color: PRIMARY }} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
        {subValue && <p className="text-xs text-slate-400 mt-0.5">{subValue}</p>}
      </div>
    </motion.div>
  );
}

export function HROverview() {
  const { tenant, academicYear } = useModuleContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  async function fetchData() {
    if (!tenant?.id || !academicYear?.id) { setLoading(false); return; }
    try {
      setIsFetching(true);
      const result = await hrFetch<any>(hrUrl('overview/dashboard', { tenantId: tenant.id, academicYearId: academicYear.id }));
      setData(result);
    } catch (error) {
      console.error('Error fetching HR overview:', error);
      toast({ variant: 'error', title: 'Erreur: chargement du tableau de bord RH' });
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }

  useEffect(() => { fetchData(); }, [tenant?.id, academicYear?.id]);

  // Refresh dashboard data when the tab becomes visible (fixes stale data after actions in other tabs)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') fetchData();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [tenant?.id, academicYear?.id]);

  const snapshot = data?.snapshot || { totalStaff: 0, totalTeachers: 0, totalAdmin: 0, monthlyPayroll: 0, cnssCharges: 0, leaveCount: 0 };
  const evolution = data?.evolution || [];
  const orionAlerts = data?.orionAlerts || [];

  const kpis = [
    { label: 'Effectif Total', value: snapshot.totalStaff, subValue: `${snapshot.totalTeachers} ens. · ${snapshot.totalAdmin} admin`, icon: Users },
    { label: 'Masse Salariale', value: formatCurrency(snapshot.monthlyPayroll), subValue: 'Dernier mois validé', icon: DollarSign },
    { label: 'Charges Sociales', value: formatCurrency(snapshot.cnssCharges), subValue: 'Cotisations CNSS estimées', icon: ShieldCheck },
    { label: 'Congés Actifs', value: snapshot.leaveCount, subValue: 'Personnes absentes ce jour', icon: Calendar },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-72 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
          <div className="h-72 rounded-xl bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <KpiCard key={kpi.label} {...kpi} index={idx} />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Payroll Chart */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Évolution de la Masse Salariale</h2>
              <p className="text-sm text-slate-500">Historique des 6 derniers mois</p>
            </div>
            <Link
              href="/app/hr/payroll"
              className="flex items-center gap-1 text-sm font-semibold hover:underline"
              style={{ color: PRIMARY }}
            >
              Détails <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {evolution.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={evolution.map((e: any) => ({ periodName: e.month, totalNet: e.total }))} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="periodName"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="totalNet" name="Net à payer" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[260px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30">
              <div className="text-center space-y-2">
                <BarChart3 className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-400 font-semibold">Aucun historique disponible</p>
              </div>
            </div>
          )}
        </motion.section>

        {/* ORION Cockpit */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl bg-slate-900 p-6 shadow-sm text-white relative overflow-hidden"
        >
          <div className="absolute -right-12 -bottom-12 opacity-10">
            <Target className="h-48 w-48" />
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <h2 className="text-lg font-bold">Cockpit ORION & IA Alerts</h2>
          </div>

          <div className="space-y-3">
            {orionAlerts.length > 0 ? (
              orionAlerts.map((alert: any, idx: number) => (
                <div key={idx} className="rounded-lg bg-white/5 border border-white/10 p-3 flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-white/90 leading-snug">{alert.title || alert.type}</p>
                    <p className="text-[10px] text-white/50">{alert.description || alert.message}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center space-y-2">
                <UserCheck className="h-8 w-8 text-white/20 mx-auto" />
                <p className="text-xs text-white/40 font-semibold">Aucune anomalie détectée.</p>
                <p className="text-[10px] text-white/30">Tout est en ordre dans le module RH.</p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-[10px] text-white/30 italic leading-relaxed">
              "Pensez à générer les déclarations CNSS du mois en cours avant l'échéance légale."
            </p>
          </div>

          <Link
            href="/app/hr/reporting"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition hover:opacity-90 bg-[#1A2BA6] shadow-md"
          >
            Consulter les rapports
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.section>
      </div>

      {/* Quick Actions */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h2 className="text-base font-bold text-slate-900 mb-4">Actions Rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { label: 'Générer la paie', icon: DollarSign, href: '/app/hr/payroll' },
            { label: 'Déclaration CNSS', icon: ShieldCheck, href: '/app/hr/cnss' },
            { label: 'Nouveau Recrutement', icon: Briefcase, href: '/app/hr/recruitment' },
            { label: 'Analyse IA Document', icon: Target, href: '/app/hr/ia' },
          ].map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link
                key={idx}
                href={action.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 group-hover:bg-blue-50 transition-colors">
                  <Icon className="h-5 w-5 text-slate-400 group-hover:text-[#1A2BA6] transition-colors" />
                </div>
                <span className="font-semibold text-slate-700 group-hover:text-slate-900 text-sm">{action.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 ml-auto transition-colors" />
              </Link>
            );
          })}
        </div>
      </motion.section>
    </div>
  );
}

