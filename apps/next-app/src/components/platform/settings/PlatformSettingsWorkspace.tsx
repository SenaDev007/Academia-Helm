'use client';

import { History, Search, Filter, Shield, Clock, ArrowRight, Settings, Globe, Database, Key } from 'lucide-react';

export default function PlatformSettingsWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paramètres Plateforme</h1>
          <p className="text-slate-500">Configuration globale d'Academia Helm</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-3">
          {[
            { id: 'general', name: 'Configuration Générale', icon: Globe },
            { id: 'auth', name: 'Authentification & SSO', icon: Key },
            { id: 'infra', name: 'Infrastructure & DB', icon: Database },
            { id: 'security', name: 'Sécurité & Audit', icon: Shield },
          ].map((tab) => (
            <button key={tab.id} className="w-full flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 transition-all text-left">
              <div className="p-2 bg-slate-50 text-slate-500 rounded-lg">
                <tab.icon className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-900 text-sm">{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="md:col-span-2 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-8">
          <section>
            <h3 className="font-bold text-slate-900 mb-6">Informations Plateforme</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nom de la solution</label>
                  <input type="text" defaultValue="Academia Helm" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">Version de production</label>
                  <input type="text" defaultValue="v1.4.2-stable" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">URL de Base</label>
                <input type="text" defaultValue="https://academia-hub.pro" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900" />
              </div>
            </div>
          </section>

          <section className="pt-8 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 mb-6">Maintenance & Urgence</h3>
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="font-bold text-red-900 text-sm">Mode Maintenance Global</h4>
                <p className="text-xs text-red-700 mt-1">Désactive l'accès à tous les tenants immédiatement.</p>
              </div>
              <div className="w-12 h-6 bg-slate-200 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4">
            <button className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">Annuler</button>
            <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100">Enregistrer les modifications</button>
          </div>
        </div>
      </div>
    </div>
  );
}
