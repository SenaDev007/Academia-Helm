'use client';

import { useState } from 'react';
import {
  Users,
  Shield,
  Lock,
  Plus,
  Search,
  MoreVertical,
  Mail,
  ShieldCheck,
  Ban,
  UserPlus,
} from 'lucide-react';

const MOCK_PLATFORM_USERS = [
  { id: '1', name: 'Admin Principal', email: 'admin@academiahelm.com', role: 'PLATFORM_OWNER', status: 'ACTIVE', lastLogin: 'Il y a 10 min' },
  { id: '2', name: 'Agent Support 1', email: 'support1@academiahelm.com', role: 'SUPPORT_AGENT', status: 'ACTIVE', lastLogin: 'Aujourd\'hui' },
  { id: '3', name: 'Comptable SaaS', email: 'billing@academiahelm.com', role: 'BILLING_MANAGER', status: 'INACTIVE', lastLogin: 'Il y a 2 jours' },
];

export default function PlatformUsersWorkspace() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilisateurs Plateforme</h1>
          <p className="text-slate-500">Gérer l'équipe d'administration centrale</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <UserPlus className="w-4 h-4" />
          Ajouter un Utilisateur
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un membre de l'équipe..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-6 py-4">Utilisateur</th>
              <th className="px-6 py-4">Rôle</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Dernière connexion</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {MOCK_PLATFORM_USERS.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{user.role}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="text-xs font-bold text-slate-600">{user.status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{user.lastLogin}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
