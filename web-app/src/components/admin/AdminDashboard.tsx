/**
 * Admin Dashboard Component
 * 
 * Vue d'ensemble pour le Super Admin
 * Statistiques globales, activité récente, santé du système
 */

'use client';

import { useEffect, useState } from 'react';
import type { AdminDashboardData, AdminTenantView, AdminAuditLog } from '@/types';
import { getAdminDashboard } from '@/services/admin.service';
import {
  Building,
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Loader,
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const dashboardData = await getAdminDashboard();
        setData(dashboardData);
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement du dashboard');
      } finally {
        setIsLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">{error || 'Erreur lors du chargement'}</p>
      </div>
    );
  }

  const { stats, recentTenants, recentActivity, pendingTestimonials, systemHealth } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Dashboard Super Admin</h1>
        <p className="text-slate-600">Vue d'ensemble de la plateforme Academia Helm</p>
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`bg-white rounded-lg border-2 p-4 ${
          systemHealth.apiStatus === 'healthy' ? 'border-green-200' : 'border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">API</p>
              <p className={`text-lg font-semibold ${
                systemHealth.apiStatus === 'healthy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {systemHealth.apiStatus === 'healthy' ? 'Opérationnelle' : 'Problème'}
              </p>
            </div>
            {systemHealth.apiStatus === 'healthy' ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>

        <div className={`bg-white rounded-lg border-2 p-4 ${
          systemHealth.databaseStatus === 'healthy' ? 'border-green-200' : 'border-red-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Base de données</p>
              <p className={`text-lg font-semibold ${
                systemHealth.databaseStatus === 'healthy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {systemHealth.databaseStatus === 'healthy' ? 'Opérationnelle' : 'Problème'}
              </p>
            </div>
            {systemHealth.databaseStatus === 'healthy' ? (
              <CheckCircle className="w-8 h-8 text-green-600" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-red-600" />
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Témoignages en attente</p>
              <p className="text-2xl font-bold text-navy-900">{pendingTestimonials}</p>
            </div>
            <Link
              href="/admin/testimonials"
              className="text-soft-gold hover:text-gold-600 transition-colors"
            >
              Voir →
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total établissements</p>
            <Building className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-navy-900">{stats.totalTenants}</p>
          <p className="text-xs text-slate-500 mt-1">
            +{stats.newTenantsLast30Days} ce mois
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Abonnements actifs</p>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.activeSubscriptions}</p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.trialTenants} en période d'essai
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Revenus mensuels</p>
            <DollarSign className="w-5 h-5 text-soft-gold" />
          </div>
          <p className="text-3xl font-bold text-navy-900">
            {stats.monthlyRevenue.toLocaleString()} FCFA
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Total: {stats.totalRevenue.toLocaleString()} FCFA
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600">Total utilisateurs</p>
            <Users className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-3xl font-bold text-navy-900">
            {stats.totalStudents + stats.totalTeachers}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.totalStudents} élèves, {stats.totalTeachers} enseignants
          </p>
        </div>
      </div>

      {/* Recent Tenants */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Établissements récents</h2>
            <Link
              href="/admin/tenants"
              className="text-sm text-soft-gold hover:text-gold-600 transition-colors"
            >
              Voir tous →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Établissement</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Élèves</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Revenus</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-navy-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500">{tenant.subdomain}.academiahub.com</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tenant.subscriptionStatus === 'ACTIVE_SUBSCRIBED'
                        ? 'bg-green-100 text-green-800'
                        : tenant.subscriptionStatus === 'ACTIVE_TRIAL'
                        ? 'bg-yellow-100 text-yellow-800'
                        : tenant.subscriptionStatus === 'SUSPENDED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {tenant.subscriptionStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{tenant.studentCount}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {tenant.monthlyRevenue.toLocaleString()} FCFA
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="text-sm text-soft-gold hover:text-gold-600 transition-colors"
                    >
                      Voir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Activité récente</h2>
            <Link
              href="/admin/audit"
              className="text-sm text-soft-gold hover:text-gold-600 transition-colors"
            >
              Voir tout →
            </Link>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {recentActivity.map((log) => (
            <div key={log.id} className="flex items-start space-x-4 pb-4 border-b border-gray-100 last:border-0">
              <div className="w-10 h-10 bg-navy-900 rounded-full flex items-center justify-center flex-shrink-0">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy-900">{log.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {log.adminEmail} • {new Date(log.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

