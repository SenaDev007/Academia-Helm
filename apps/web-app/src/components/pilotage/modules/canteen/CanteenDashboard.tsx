'use client';

import React from 'react';
import {
  Users, UtensilsCrossed, Package, CheckCircle2,
  BarChart3, Activity, TrendingUp, TrendingDown,
  Clock, AlertTriangle, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CanteenStats {
  enrolledStudents?: number;
  mealsToday?: number;
  stockAlerts?: number;
  hygieneScore?: string;
  todayMenu?: Array<{ label: string; value: string; icon?: string }>;
  recentActivity?: Array<{ id?: string; student: string; time: string; status: string; color?: string }>;
  alerts?: Array<{ id?: string; type: string; title: string; desc: string; time: string }>;
}

const DEFAULT_STATS: CanteenStats = {
  enrolledStudents: 0,
  mealsToday: 0,
  stockAlerts: 0,
  hygieneScore: '—',
  todayMenu: [],
  recentActivity: [],
  alerts: [],
};

export default function CanteenDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<CanteenStats>('canteen', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Élèves Inscrits"
          value={String(stats.enrolledStudents ?? 0)}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Repas Prévus (Midi)"
          value={String(stats.mealsToday ?? 0)}
          icon={UtensilsCrossed}
          color="green"
        />
        <StatCard
          title="Alertes Stock"
          value={String(stats.stockAlerts ?? 0).padStart(2, '0')}
          icon={Package}
          color="amber"
        />
        <StatCard
          title="Score Hygiène"
          value={stats.hygieneScore ?? '—'}
          icon={CheckCircle2}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Menu Card */}
        <Card className="lg:col-span-2 p-0 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-navy-900 text-lg">Menu du Jour</h3>
              <p className="text-gray-500 text-xs font-medium mt-1">Service du jour</p>
            </div>
            <Badge className="bg-slate-900 text-white">Matin & Midi</Badge>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {(stats.todayMenu?.length ? stats.todayMenu : []).map((item, i) => (
              <MenuSection
                key={i}
                label={item.label}
                value={item.value}
                icon={item.icon ?? '🍽️'}
              />
            ))}
            {(!stats.todayMenu || stats.todayMenu.length === 0) && (
              <div className="md:col-span-2 text-center py-8 text-sm text-slate-400">
                Aucun menu disponible pour aujourd’hui.
              </div>
            )}
          </div>
          <div className="px-6 py-4 bg-amber-50/40 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-medium text-gray-600">Allergènes : Arachides, Lactose</span>
            </div>
            <Button variant="link" size="sm">Modifier le menu</Button>
          </div>
        </Card>

      </div>

      {/* Recent Activity & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm">
          <h3 className="font-semibold text-navy-900 mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-500" />
            <span>Service en Temps Réel</span>
          </h3>
          <div className="space-y-3">
            {(stats.recentActivity?.length ? stats.recentActivity : []).map((row, i) => (
              <LiveRow
                key={row.id ?? i}
                student={row.student}
                time={row.time}
                status={row.status}
                color={row.color ?? 'green'}
              />
            ))}
            {(!stats.recentActivity || stats.recentActivity.length === 0) && (
              <div className="text-center py-8 text-sm text-slate-400">
                Aucune activité récente.
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-sm">
          <h3 className="font-semibold text-navy-900 mb-4 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <span>Alertes & Rappels</span>
          </h3>
          <div className="space-y-3">
            {(stats.alerts?.length ? stats.alerts : []).map((alert, i) => (
              <AlertItem
                key={alert.id ?? i}
                type={alert.type}
                title={alert.title}
                desc={alert.desc}
                time={alert.time}
              />
            ))}
            {(!stats.alerts || stats.alerts.length === 0) && (
              <div className="text-center py-8 text-sm text-slate-400">
                Aucune alerte.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Helpers ---

function StatCard({ title, value, icon: Icon, color }: any) {
  const bgColors: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-blue-50 text-blue-600',
  };

  return (
    <Card className="p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-xl ${bgColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-gray-500 text-xs font-medium">{title}</p>
      <p className="text-3xl font-semibold text-navy-900 mt-1">{value}</p>
    </Card>
  );
}

function MenuSection({ label, value, icon }: any) {
  return (
    <div className="flex items-start space-x-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-semibold text-navy-900 leading-tight">{value}</p>
      </div>
    </div>
  );
}

// 🗑️ 2026-10-15 — InsightItem supprimé (ORION masqué, plus utilisé)

function LiveRow({ student, time, status, color = 'green' }: any) {
  const badgeClass: any = {
    green: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
  };
  return (
    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs">
          {student.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-900">{student}</p>
          <p className="text-xs text-gray-500">{time}</p>
        </div>
      </div>
      <Badge variant="outline" className={badgeClass[color]}>
        {status}
      </Badge>
    </div>
  );
}

function AlertItem({ type, title, desc, time }: any) {
  return (
    <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-50">
      <div className={`p-2 rounded-lg ${type === 'stock' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
        {type === 'stock' ? <Package className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className="text-sm font-semibold text-navy-900">{title}</p>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{desc}</p>
      </div>
    </div>
  );
}
