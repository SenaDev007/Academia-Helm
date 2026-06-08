'use client';

import React from 'react';
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
  Loader2
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useCommunicationDashboard } from '@/hooks/useCommunicationDashboard';

export default function CommunicationDashboardPage() {
  const { stats, isLoading, error, refresh } = useCommunicationDashboard();

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
            <button onClick={refresh} className="mt-2 text-sm font-bold text-rose-800 underline">Réessayer</button>
          </div>
        </div>
      </ModuleContentArea>
    );
  }

  const kpis = stats?.overview || [];
  const channelHealth = stats?.channelHealth || [];
  const criticalAlerts = stats?.criticalAlerts || [];
  const recentActivity = stats?.recentActivity || [];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'send': return Send;
      case 'today': return Clock;
      case 'error': return AlertTriangle;
      case 'visibility': return Users;
      default: return MessageSquare;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return Mail;
      case 'SMS': return Smartphone;
      case 'WHATSAPP': return MessageSquare;
      case 'PUSH': return Zap;
      case 'PORTAL': return Users;
      default: return Send;
    }
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpis.map((stat: any, i: number) => {
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
          {/* Main Chart Section */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
              <BarChart3 size={200} />
            </div>
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Analyse de Performance</h3>
                <p className="text-slate-500 text-sm font-medium">Volume de communication multicanal</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">7J</button>
                <button className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200">30J</button>
              </div>
            </div>
            
            <div className="h-[350px] w-full flex items-end space-x-4 px-4">
              {/* Mock Chart Bars - Still using bars but could be real data if available */}
              {[45, 60, 40, 75, 55, 90, 65, 80, 50, 70, 85, 95].map((h, i) => (
                <div key={i} className="flex-1 group relative">
                  <div 
                    className="w-full bg-slate-100 rounded-t-lg group-hover:bg-blue-500 transition-all duration-300 relative cursor-pointer" 
                    style={{ height: `${h}%` }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {Math.round(h * 12.5)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
              <span>Jan</span><span>Fév</span><span>Mar</span><span>Avr</span><span>Mai</span><span>Juin</span>
              <span>Juil</span><span>Août</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Déc</span>
            </div>
          </div>

          {/* Channel Health Section */}
          <div className="bg-slate-900 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
            <div className="absolute bottom-0 right-0 p-8 opacity-10 pointer-events-none">
              <Zap size={150} className="text-yellow-400" />
            </div>
            <h3 className="text-2xl font-black mb-8 relative z-10 tracking-tight">État des Canaux</h3>
            <div className="space-y-8 relative z-10">
              {channelHealth.map((channel: any, i: number) => {
                const Icon = getChannelIcon(channel.channel);
                const colorClass = channel.status === 'HEALTHY' ? 'emerald' : channel.status === 'WARNING' ? 'amber' : 'rose';
                
                return (
                  <div key={i} className="group cursor-default">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-2xl bg-white/10 text-white group-hover:bg-white group-hover:text-slate-900 transition-all`}>
                          <Icon size={20} />
                        </div>
                        <div>
                          <p className="font-bold tracking-tight">{channel.channel}</p>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{channel.total} envois</p>
                        </div>
                      </div>
                      <span className={`text-sm font-black text-${colorClass}-400 bg-${colorClass}-400/10 px-3 py-1 rounded-full`}>
                        {channel.successRate}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-${colorClass}-400 rounded-full transition-all duration-1000`} 
                        style={{ width: channel.successRate }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ORION / Critical Alerts - Premium Dark Mode Style */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 animate-pulse">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Centre de Vigilance — SARA x ORION</h3>
                <p className="text-slate-500 text-sm font-medium">Détection proactive d'anomalies de communication</p>
              </div>
            </div>
            <button className="text-blue-600 font-bold text-sm flex items-center hover:translate-x-1 transition-transform">
              Tout voir <ChevronRight size={16} className="ml-1" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {criticalAlerts.length > 0 ? criticalAlerts.map((alert: any, i: number) => (
              <div key={i} className={`p-6 rounded-2xl border bg-slate-50 border-slate-100 hover:border-${alert.severity === 'CRITICAL' ? 'rose' : 'amber'}-200 hover:bg-${alert.severity === 'CRITICAL' ? 'rose' : 'amber'}-50/30 transition-all cursor-pointer`}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase bg-${alert.severity === 'CRITICAL' ? 'rose' : 'amber'}-100 text-${alert.severity === 'CRITICAL' ? 'rose' : '700'}`}>
                    {alert.severity}
                  </span>
                  <span className="text-xs font-bold text-slate-400 flex items-center">
                    <Clock size={12} className="mr-1" /> {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="font-black text-slate-900 text-lg mb-2 tracking-tight">{alert.title}</p>
                <p className="text-sm text-slate-600 leading-relaxed font-medium mb-6">{alert.message}</p>
                <div className="flex space-x-3">
                  <button className={`px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors`}>Agir maintenant</button>
                  <button className="px-4 py-2 bg-white text-slate-600 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-50">Ignorer</button>
                </div>
              </div>
            )) : (
              <div className="col-span-2 py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4 opacity-20" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Aucune anomalie détectée par ORION</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tight">Activités Récentes</h3>
          <div className="space-y-6">
            {recentActivity.map((activity: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{activity.title}</p>
                    <p className="text-xs text-slate-500 font-medium">Par {activity.sender} • {activity.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{new Date(activity.timestamp).toLocaleDateString()}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activity.status === 'SENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ModuleContentArea>
  );
}
