'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  MoreVertical,
  FileText,
  DollarSign,
  Download,
  Filter,
  ShieldAlert,
  History,
  Users,
  HelpCircle,
  CreditCard,
  PieChart,
  Building,
  LayoutDashboard,
  Briefcase,
  Zap,
  BarChart3,
  Lock,
  Settings,
  Loader2,
  AlertCircle,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface UsersData {
  users: Array<{
    id: string; name: string; email: string; role: string;
    status: 'ACTIVE' | 'INACTIVE'; lastLogin: string | null; createdAt: string;
  }>;
}

export default function PlatformUsersWorkspace() {
  const [roleFilter, setRoleFilter] = useState('ALL');
  const { data, loading, error, refetch } = usePlatformData<UsersData>(`/users?role=${roleFilter}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utilisateurs Plateforme</h1>
          <p className="text-slate-500">Comptes avec accès au back-office global</p>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="ALL">Tous rôles</option>
          <option value="PLATFORM_OWNER">Platform Owner</option>
          <option value="PLATFORM_SUPER_ADMIN">Super Admin</option>
          <option value="PLATFORM_ADMIN">Admin</option>
          <option value="SUPER_ADMIN">Super Admin (système)</option>
        </select>
      </div>

      {loading ? <PlatformLoading label="Chargement des utilisateurs…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data || data.users.length === 0 ? <PlatformEmpty title="Aucun utilisateur" /> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Nom</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Rôle</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Dernière connexion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase">{u.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      {u.status === 'ACTIVE' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Actif</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase">Inactif</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleString('fr-FR') : 'Jamais'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
