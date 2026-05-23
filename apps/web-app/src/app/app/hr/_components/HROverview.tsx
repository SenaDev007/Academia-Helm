/**
 * ============================================================================
 * HR OVERVIEW COMPONENT - MODULE 5
 * ============================================================================
 */

'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OrionPanel } from '@/components/ui/orion/OrionPanel';
import { OrionAlertItem } from '@/components/ui/orion/OrionAlertItem';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface HROverviewProps {
  data: any;
  loading: boolean;
}

export function HROverview({ data, loading }: HROverviewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl" />
        ))}
      </div>
    );
  }

  const snapshot = data?.snapshot || {
    totalStaff: 0,
    totalTeachers: 0,
    totalAdmin: 0,
    monthlyPayroll: 0,
    cnssCharges: 0,
    leaveCount: 0
  };

  const payrollHistory = data?.payrollHistory || [];
  const orionAlerts = data?.orionAlerts || [];

  const kpis = [
    { 
      label: 'Effectif Total', 
      value: snapshot.totalStaff, 
      subValue: `${snapshot.totalTeachers} ens. / ${snapshot.totalAdmin} admin`,
      icon: Users,
      color: 'blue'
    },
    { 
      label: 'Masse Salariale', 
      value: `${Number(snapshot.monthlyPayroll).toLocaleString()} XOF`, 
      subValue: 'Dernier mois validé',
      icon: DollarSign,
      color: 'emerald'
    },
    { 
      label: 'Charges Sociales', 
      value: `${Number(snapshot.cnssCharges).toLocaleString()} XOF`, 
      subValue: 'Cotisations CNSS estimées',
      icon: ShieldCheck,
      color: 'blue'
    },
    { 
      label: 'Congés Actifs', 
      value: snapshot.leaveCount, 
      subValue: 'Personnes absentes ce jour',
      icon: Calendar,
      color: 'amber'
    }
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                    <h3 className="text-2xl font-bold mt-1">{kpi.value}</h3>
                    <p className="text-xs text-gray-400 mt-1">{kpi.subValue}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                    <Icon size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payroll History Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp size={20} className="text-emerald-500" />
              Évolution de la Masse Salariale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="periodName" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="totalNet" name="Net à payer" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalGross" name="Brut Total" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ORION Insights */}
        <div className="space-y-6">
          <OrionPanel 
            title="Cockpit de Surveillance ORION"
          >
            <div className="space-y-3 mt-4">
              {orionAlerts.length > 0 ? (
                orionAlerts.map((alert: any, idx: number) => (
                  <OrionAlertItem 
                    key={idx}
                    id={`alert-${idx}`}
                    severity={alert.severity}
                    title={alert.title}
                    message={alert.description}
                  />
                ))
              ) : (
                <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-3">
                  <UserCheck size={20} />
                  <p className="text-sm font-medium">Tout est en ordre. Aucune anomalie détectée.</p>
                </div>
              )}
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Conseil ORION</h4>
              <p className="text-sm text-gray-600 italic">
                "Pensez à préparer les déclarations CNSS avant le 15 du mois pour éviter les pénalités de retard."
              </p>
            </div>
          </OrionPanel>
        </div>
      </div>

      {/* Quick Access Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Générer la paie', icon: DollarSign, color: 'emerald' },
          { label: 'Déclaration CNSS', icon: Briefcase, color: 'blue' },
          { label: 'Planifier congés', icon: Calendar, color: 'amber' },
        ].map((action, idx) => (
          <button 
            key={idx}
            className={`flex items-center justify-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-${action.color}-200 hover:bg-${action.color}-50 transition-all group shadow-sm`}
          >
            <div className={`p-2 rounded-lg bg-${action.color}-50 text-${action.color}-600 group-hover:bg-white`}>
              <action.icon size={20} />
            </div>
            <span className="font-semibold text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

