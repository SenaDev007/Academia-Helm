'use client';

import { Lock, Shield, ShieldCheck, Plus, Search, ArrowRight } from 'lucide-react';

const GLOBAL_ROLES = [
  { name: 'PLATFORM_OWNER', users: 2, permissions: 'All' },
  { name: 'PLATFORM_SUPER_ADMIN', users: 5, permissions: 'Most' },
  { name: 'SUPPORT_AGENT', users: 12, permissions: 'Tickets, Tenants (View)' },
  { name: 'BILLING_MANAGER', users: 3, permissions: 'Invoices, Payments' },
];

export default function PlatformRBACWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rôles & Permissions Globales</h1>
          <p className="text-slate-500">Définir le modèle RBAC pour l'administration plateforme</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <ShieldPlus className="w-4 h-4" />
          Nouveau Rôle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {GLOBAL_ROLES.map((role) => (
          <div key={role.name} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">{role.name}</h3>
            <p className="text-xs text-slate-500 mb-4">{role.users} utilisateurs affectés</p>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Permissions: {role.permissions}</div>
            <button className="w-full py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              Configurer
            </button>
          </div>
        ))}
      </div>

      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-slate-900">Permissions Granulaires</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" placeholder="Filtrer les permissions..." className="pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg text-xs" />
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          {['TENANT_CREATE', 'TENANT_SUSPEND', 'BILLING_GENERATE', 'INCIDENT_RESOLVE', 'AUDIT_VIEW'].map((perm) => (
            <div key={perm} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-sm font-mono font-medium text-slate-700">{perm}</span>
              </div>
              <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                Détails <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShieldPlus({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Plus className="w-4 h-4" />
    </div>
  );
}
