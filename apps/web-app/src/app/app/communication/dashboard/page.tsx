'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Users,
  Clock,
  Smartphone,
  Mail,
  Zap,
  BarChart3,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Eye,
  Reply,
  XCircle,
  MousePointer,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useEmailLogStats } from '@/hooks/useEmailLogs';

export default function CommunicationDashboardPage() {
  const { data: stats, isLoading, error, refetch } = useEmailLogStats();

  if (isLoading) {
    return (
      <ModuleContentArea>
        <div className="flex flex-col items-center justify-center h-[600px] space-y-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Analyse des flux de communication en cours...</p>
        </div>
      </ModuleContentArea>
    );
  }

  if (error) {
    return (
      <ModuleContentArea>
        <div className="p-8 bg-rose-50 border border-rose-100 rounded-3xl flex items-center space-x-4">
          <AlertTriangle className="text-rose-600 w-8 h-8" />
          <div>
            <h3 className="font-bold text-rose-900">Erreur de chargement</h3>
            <p className="text-rose-700">{error}</p>
            <button onClick={refetch} className="mt-2 text-sm font-bold text-rose-800 underline">Réessayer</button>
          </div>
        </div>
      </ModuleContentArea>
    );
  }

  // Construire les KPIs depuis les stats réelles
  const total = stats?.total || 0;
  const openRate = stats?.openRate || 0;
  const replyRate = stats?.replyRate || 0;
  const bounceRate = stats?.bounceRate || 0;
  const byStatus = stats?.byStatus || {};
  const byCategory = stats?.byCategory || {};

  const kpis = [
    {
      icon: 'send',
      title: 'Emails envoyés',
      value: total.toLocaleString('fr-FR'),
      subtitle: 'Total cumulé',
    },
    {
      icon: 'visibility',
      title: "Taux d'ouverture",
      value: `${openRate.toFixed(1)}%`,
      subtitle: `${byStatus.OPENED || 0} + ${byStatus.CLICKED || 0} emails ouverts`,
    },
    {
      icon: 'reply',
      title: 'Taux de réponse',
      value: `${replyRate.toFixed(1)}%`,
      subtitle: `${stats?.byStatus?.OPENED || 0} réponses reçues`,
    },
    {
      icon: 'error',
      title: 'Taux de rejet',
      value: `${bounceRate.toFixed(1)}%`,
      subtitle: `${byStatus.BOUNCED || 0} emails rejetés`,
    },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'send': return Send;
      case 'today': return Clock;
      case 'error': return AlertTriangle;
      case 'visibility': return Eye;
      case 'reply': return Reply;
      default: return MessageSquare;
    }
  };

  // Catégories avec labels français
  const CATEGORY_LABELS: Record<string, string> = {
    RECRUTEMENT: 'Recrutement',
    PEDAGOGIE: 'Pédagogie',
    FINANCE: 'Finance',
    ADMINISTRATIF: 'Administratif',
    COMMUNICATION: 'Communication',
    SYSTEM: 'Système',
  };

  const CATEGORY_COLORS: Record<string, string> = {
    RECRUTEMENT: 'bg-blue-500',
    PEDAGOGIE: 'bg-purple-500',
    FINANCE: 'bg-emerald-500',
    ADMINISTRATIF: 'bg-amber-500',
    COMMUNICATION: 'bg-pink-500',
    SYSTEM: 'bg-slate-500',
  };

  const categoryData = Object.entries(byCategory)
    .filter(([key]) => key !== 'NULL' && key !== 'null')
    .map(([key, value]) => ({
      key,
      label: CATEGORY_LABELS[key] || key,
      count: value as number,
      color: CATEGORY_COLORS[key] || 'bg-slate-400',
      percentage: total > 0 ? ((value as number) / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...categoryData.map((c) => c.count), 1);

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((stat, i) => {
            const Icon = getIcon(stat.icon);
            return (
              <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
                <div className="flex items-start justify-between relative z-10">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{stat.title}</p>
                    <h3 className="text-4xl font-black text-slate-900 mt-1 tracking-tight">{stat.value}</h3>
                    <p className="text-xs text-slate-400 mt-2 font-medium">{stat.subtitle}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300 shadow-inner`}>
                    <Icon size={28} />
                  </div>
                </div>
                <div className="absolute -bottom-2 -left-2 w-24 h-24 bg-slate-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-500" />
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Section — Répartition par catégorie (vraies données) */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <BarChart3 size={200} />
            </div>
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Répartition par catégorie</h3>
                <p className="text-slate-500 text-sm font-medium">Volume d'emails envoyés par type</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-slate-900">{total}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</div>
              </div>
            </div>

            {categoryData.length === 0 ? (
              <div className="h-[350px] flex flex-col items-center justify-center text-slate-400">
                <Mail size={48} className="mb-3 opacity-30" />
                <p className="font-bold">Aucun email envoyé pour le moment</p>
                <p className="text-xs mt-1">Les emails catégorisés apparaîtront ici automatiquement.</p>
              </div>
            ) : (
              <div className="h-[350px] w-full flex items-end space-x-4 px-4">
                {categoryData.map((cat, i) => {
                  const heightPercent = (cat.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex-1 group relative flex flex-col items-center">
                      <div className="text-xs font-black text-slate-700 mb-2">{cat.count}</div>
                      <div
                        className={`w-full ${cat.color} rounded-t-lg group-hover:opacity-80 transition-all duration-300 relative cursor-pointer min-h-[20px]`}
                        style={{ height: `${Math.max(heightPercent, 5)}%` }}
                      >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {cat.label} — {cat.percentage.toFixed(1)}%
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 mt-2 text-center truncate w-full">
                        {cat.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Statuts des emails — vraies données */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 p-8 opacity-10 pointer-events-none">
              <Zap size={150} className="text-yellow-400" />
            </div>
            <h3 className="text-2xl font-black mb-8 relative z-10 tracking-tight">Statuts des emails</h3>
            <div className="space-y-6 relative z-10">
              {[
                { key: 'SENT', label: 'Envoyés', icon: Send, color: 'emerald' },
                { key: 'DELIVERED', label: 'Livrés', icon: CheckCircle2, color: 'blue' },
                { key: 'OPENED', label: 'Ouverts', icon: Eye, color: 'indigo' },
                { key: 'CLICKED', label: 'Cliqués', icon: MousePointer, color: 'purple' },
                { key: 'BOUNCED', label: 'Rejetés', icon: XCircle, color: 'rose' },
                { key: 'FAILED', label: 'Échecs', icon: AlertTriangle, color: 'amber' },
              ].map((status) => {
                const count = byStatus[status.key] || 0;
                const percentage = total > 0 ? (count / total) * 100 : 0;
                const Icon = status.icon;
                return (
                  <div key={status.key} className="group cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-white/10 text-white group-hover:bg-white group-hover:text-slate-900 transition-all">
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="font-bold tracking-tight text-sm">{status.label}</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                            {count} email{count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-black text-white bg-white/10 px-3 py-1 rounded-full">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-${status.color}-400 rounded-full transition-all duration-1000`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lien rapide vers Historique + Inbox */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="/app/communication/history"
            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                <BarChart3 className="w-7 h-7 text-blue-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">Historique complet</h3>
                <p className="text-sm text-slate-500">Voir tous les emails envoyés avec filtres et détails</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
          </a>

          <a
            href="/app/communication/inbox"
            className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                <Reply className="w-7 h-7 text-emerald-500 group-hover:text-white transition-colors" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">Boîte de réception</h3>
                <p className="text-sm text-slate-500">Voir les réponses reçues des candidats et parents</p>
              </div>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-700 group-hover:translate-x-1 transition-all" />
          </a>
        </div>
      </div>
    </ModuleContentArea>
  );
}
