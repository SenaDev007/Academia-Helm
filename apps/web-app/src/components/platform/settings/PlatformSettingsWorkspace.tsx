'use client';

import { Settings, Shield, Globe, Database, Key, AlertCircle } from 'lucide-react';

export default function PlatformSettingsWorkspace() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres Plateforme</h1>
        <p className="text-slate-500">Configuration globale d'Academia Helm</p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Les paramètres plateforme (domaines, secrets, intégrations) sont gérés via les variables
          d'environnement et le PricingAdminController. Aucune donnée mock n'est affichée ici.
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <a
          href="/platform/rbac"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Shield className="w-6 h-6 text-indigo-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Rôles & Permissions</h3>
          <p className="text-xs text-slate-500 mt-1">Gérer le RBAC plateforme</p>
        </a>
        <a
          href="/platform/settings"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Globe className="w-6 h-6 text-blue-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Domaines & Sous-domaines</h3>
          <p className="text-xs text-slate-500 mt-1">Configuration DNS et domaines</p>
        </a>
        <a
          href="/platform/audit"
          className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all"
        >
          <Database className="w-6 h-6 text-emerald-600 mb-3" />
          <h3 className="font-bold text-slate-900 text-sm">Audit & Logs</h3>
          <p className="text-xs text-slate-500 mt-1">Journal d'audit plateforme</p>
        </a>
      </div>
    </div>
  );
}
