'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, DollarSign, GraduationCap, TrendingUp, AlertTriangle,
  BookOpen, Wallet, FileText, Settings, MessageSquare,
  ArrowRight, Loader2, UserCog, Calendar, BarChart3,
} from 'lucide-react';
import { useSchoolLevelContext } from '@/contexts/SchoolLevelContext';
import KPICards from '@/components/pilotage/KPICards';
import QuickAnalytics from '@/components/pilotage/QuickAnalytics';
import OrionAlertsCard from '@/components/pilotage/OrionAlertsCard';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { formatCurrency } from '@/lib/utils';

interface PromoterKpis {
  totalStudents?: number;
  totalRevenue?: number;
  unpaidAmount?: number;
  attendanceRate?: number;
  activeClasses?: number;
  totalStaff?: number;
  pendingPayments?: number;
  averageGrade?: number;
}

export default function PromoterDashboard({ tenantId }: { tenantId: string }) {
  const { currentYear, currentLevel } = useSchoolLevelContext();
  const [kpis, setKpis] = useState<PromoterKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayRevenue, setTodayRevenue] = useState<number | null>(null);

  const levelLabel =
    currentLevel?.code === 'MATERNELLE' ? 'Maternelle' :
    currentLevel?.code === 'PRIMAIRE' ? 'Primaire' :
    currentLevel?.code === 'SECONDAIRE' ? 'Secondaire' :
    currentLevel?.code === 'ALL' ? 'Tous les niveaux' : currentLevel?.code || 'Tous les niveaux';

  useEffect(() => {
    if (!currentYear?.id) return;
    setLoading(true);
    const authHeaders = getClientAuthorizationHeader();

    // Fetch KPIs
    Promise.allSettled([
      fetch(`/api/general/consolidated-report?academicYearId=${currentYear.id}${currentLevel?.id && currentLevel.id !== 'ALL' ? `&schoolLevelId=${currentLevel.id}` : ''}`, {
        headers: { ...authHeaders },
        credentials: 'include',
        cache: 'no-store',
      }).then((r) => r.json()),
      fetch('/api/finance/payments/today', {
        headers: { ...authHeaders },
        credentials: 'include',
        cache: 'no-store',
      }).then((r) => r.json()),
    ]).then((results) => {
      if (results[0].status === 'fulfilled') {
        const data = results[0].value;
        setKpis({
          totalStudents: data?.enrollment?.total || 0,
          totalRevenue: data?.revenue?.total || 0,
          attendanceRate: data?.attendance?.rate || 0,
          averageGrade: data?.weightedAverage?.value || 0,
        });
      }
      if (results[1].status === 'fulfilled') {
        setTodayRevenue(results[1].value?.total || results[1].value?.amount || 0);
      }
      setLoading(false);
    });
  }, [currentYear?.id, currentLevel?.id]);

  const quickActions = [
    { label: 'Élèves & Inscriptions', icon: Users, href: '/app/students', color: 'blue' },
    { label: 'Finance & Économat', icon: Wallet, href: '/app/finance', color: 'green' },
    { label: 'Pédagogie', icon: BookOpen, href: '/app/pedagogy', color: 'purple' },
    { label: 'RH & Paie', icon: UserCog, href: '/app/hr', color: 'amber' },
    { label: 'Communication', icon: MessageSquare, href: '/app/communication', color: 'cyan' },
    { label: 'Rapports', icon: BarChart3, href: '/app/finance/reports', color: 'rose' },
    { label: 'Paramètres', icon: Settings, href: '/app/settings', color: 'slate' },
    { label: 'Emploi du temps', icon: Calendar, href: '/app/pedagogy/timetable', color: 'indigo' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-50 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-navy-900 mb-1">
          Tableau de bord
        </h1>
        <p className="text-sm text-gray-600">
          {currentYear?.name} • {levelLabel}
        </p>
      </div>

      {/* KPI Cards — Effectifs, Assiduité, Recettes, Alertes */}
      {currentYear?.id && (
        <KPICards academicYearId={currentYear.id} schoolLevelId={currentLevel?.id === 'ALL' ? undefined : currentLevel?.id} />
      )}

      {/* Recette du jour + Moyenne générale */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Aujourd'hui</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Recette du jour</p>
          <p className="text-xl font-bold text-navy-900">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : formatCurrency(todayRevenue || 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <GraduationCap className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Année</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Moyenne générale</p>
          <p className="text-xl font-bold text-navy-900">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `${(kpis?.averageGrade || 0).toFixed(2)}/20`}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Effectif</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Élèves inscrits</p>
          <p className="text-xl font-bold text-navy-900">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : kpis?.totalStudents || 0}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Taux</span>
          </div>
          <p className="text-xs text-gray-500 mb-1">Assiduité</p>
          <p className="text-xl font-bold text-navy-900">
            {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `${(kpis?.attendanceRate || 0).toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Quick Analytics + Orion Alerts */}
      {currentYear?.id && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <QuickAnalytics academicYearId={currentYear.id} schoolLevelId={currentLevel?.id === 'ALL' ? undefined : currentLevel?.id} />
          </div>
          <div>
            <OrionAlertsCard academicYearId={currentYear.id} schoolLevelId={currentLevel?.id === 'ALL' ? undefined : currentLevel?.id} />
          </div>
        </div>
      )}

      {/* Actions rapides — Accès aux modules */}
      <div>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Accès rapide aux modules</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
              >
                <div className={`p-2.5 rounded-lg mb-3 ${colorClasses[action.color]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-navy-900 mb-1">{action.label}</p>
                <div className="flex items-center text-xs text-gray-400 group-hover:text-blue-600 transition-colors">
                  Accéder <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
