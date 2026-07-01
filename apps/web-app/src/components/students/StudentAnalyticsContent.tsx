'use client';

import { useState, useEffect, useMemo } from 'react';
import { Activity, ShieldAlert, BarChart3, TrendingUp, AlertCircle, CheckCircle2, Search, Info, BrainCircuit, Users, UserCheck, FileWarning } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export default function StudentAnalyticsContent() {
  const { academicYear } = useModuleContext();
  const [kpis, setKpis] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (academicYear) loadOrionData();
  }, [academicYear]);

  const loadOrionData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [kpisData, alertsData] = await Promise.all([
        studentsService.getOrionKpis(academicYear.id),
        studentsService.getOrionAlerts(academicYear.id)
      ]);
      
      setKpis(kpisData);
      setAlerts(alertsData);
    } catch (e: any) {
      console.error('Failed to load ORION data:', e);
      toast({ title: 'Erreur ORION', description: e.message || 'Impossible de charger les données analytiques', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingState message="Le moteur ORION analyse les données..." />;

  const stats = [
    { 
      label: 'Conformité Matricule', 
      value: kpis?.identificationRate !== undefined ? `${Math.round(kpis.identificationRate)}%` : '...', 
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, 
      color: 'bg-emerald-50',
      description: 'Élèves avec matricule valide'
    },
    { 
      label: 'Couverture Cartes', 
      value: kpis?.idCardCoverage !== undefined ? `${Math.round(kpis.idCardCoverage)}%` : '...', 
      icon: <ShieldAlert className="w-5 h-5 text-amber-600" />, 
      color: 'bg-amber-50',
      description: 'Cartes scolaires générées'
    },
    { 
      label: 'Alertes Critiques', 
      value: alerts.filter(a => a.severity === 'CRITICAL').length, 
      icon: <Activity className="w-5 h-5 text-rose-600" />, 
      color: 'bg-rose-50',
      description: 'Anomalies à résoudre d\'urgence'
    },
    { 
      label: 'Tendance Admission', 
      value: '+12%', 
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />, 
      color: 'bg-blue-50',
      description: 'Vs année précédente'
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white overflow-hidden relative border border-slate-800 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Moteur d'Analyse ORION</span>
            </div>
            <h2 className="text-2xl font-bold">Intelligence Analytique Élèves</h2>
            <p className="text-slate-400 text-sm max-w-md">Surveillance en temps réel des flux d'admission, de la conformité identitaire et des risques opérationnels.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={loadOrionData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-all border border-slate-700"
            >
              Re-calculer l'index
            </button>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all">
              Exporter le rapport
            </button>
          </div>
        </div>
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/10 blur-[80px] pointer-events-none" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 rounded-xl ${stat.color} group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
              <BarChart3 className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] text-slate-400 font-medium">{stat.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Visualisations CSS (barres horizontales + donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Barres horizontales — Répartition par sévérité */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Répartition des alertes par sévérité
          </h3>
          {(() => {
            const critical = alerts.filter(a => a.severity === 'CRITICAL').length;
            const warning = alerts.filter(a => a.severity === 'WARNING').length;
            const info = alerts.filter(a => a.severity === 'INFO' || (!a.severity)).length;
            const total = alerts.length || 1;
            const bars = [
              { label: 'Critique', count: critical, pct: (critical / total) * 100, color: 'bg-rose-500' },
              { label: 'Avertissement', count: warning, pct: (warning / total) * 100, color: 'bg-amber-500' },
              { label: 'Info', count: info, pct: (info / total) * 100, color: 'bg-blue-500' },
            ];
            return (
              <div className="space-y-3">
                {bars.map(bar => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600">{bar.label}</span>
                      <span className="font-bold text-slate-900">{bar.count}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={cn('h-full rounded-full', bar.color)}
                      />
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && <p className="text-xs text-slate-400 italic text-center py-4">Aucune alerte — tout va bien !</p>}
              </div>
            );
          })()}
        </div>

        {/* Donut CSS — Taux de conformité */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Taux de conformité
          </h3>
          {(() => {
            const idRate = kpis?.identificationRate ?? 0;
            const cardRate = kpis?.idCardCoverage ?? 0;
            const items = [
              { label: 'Matricules assignés', pct: idRate, color: 'text-emerald-600', bg: 'bg-emerald-500', icon: UserCheck },
              { label: 'Cartes scolaires', pct: cardRate, color: 'text-blue-600', bg: 'bg-blue-500', icon: Activity },
              { label: 'Dossiers NPI', pct: kpis?.npiCoverage ?? 0, color: 'text-amber-600', bg: 'bg-amber-500', icon: FileWarning },
            ];
            return (
              <div className="space-y-4">
                {items.map(item => {
                  const Icon = item.icon;
                  const remaining = 100 - item.pct;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="relative w-14 h-14 shrink-0">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                          <motion.circle
                            cx="18" cy="18" r="16" fill="none" strokeWidth="3" strokeLinecap="round"
                            stroke={item.pct > 75 ? '#10b981' : item.pct > 50 ? '#f59e0b' : '#ef4444'}
                            strokeDasharray={`${item.pct} ${remaining}`}
                            initial={{ strokeDasharray: '0 100' }}
                            animate={{ strokeDasharray: `${item.pct} ${remaining}` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-700">{Math.round(item.pct)}%</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <Icon className={cn('w-3.5 h-3.5', item.color)} /> {item.label}
                        </p>
                        <p className="text-xs text-slate-400">{Math.round(item.pct)}% conforme</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts Center */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Journal des Alertes de Conformité
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {alerts.length} Alertes détectées
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              {alerts.map((alert, i) => (
                <div key={i} className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : 
                    alert.severity === 'WARNING' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {alert.severity === 'CRITICAL' ? <AlertCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">{alert.title || alert.type}</p>
                      <span className="text-[10px] font-medium text-slate-400">Il y a 2h</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                    {alert.studentId && (
                      <div className="pt-2">
                        <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4">
                          Voir le dossier concerné
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="p-12 text-center text-slate-400">
                   <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                   <p className="text-sm">Aucune anomalie critique détectée par ORION.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200/50">
            <h4 className="font-bold mb-2">Optimisation Recommandée</h4>
            <p className="text-xs text-blue-100 mb-4 leading-relaxed">
              Le taux de cartes scolaires pour les classes de 6ème est inférieur à 40%. La génération automatique pourrait réduire les délais.
            </p>
            <button className="w-full py-2.5 bg-white text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all">
              Lancer la génération en lot
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Missions de l'Analyste</h4>
            <div className="space-y-4">
              {[
                { task: 'Vérifier NPI doublons', done: true },
                { task: 'Auditer dossiers sans photo', done: false },
                { task: 'Réconcilier les transferts', done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                  }`}>
                    {item.done && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <span className={`text-xs ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.task}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
