'use client';

import { useState } from 'react';
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
  Pencil,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastLogin: string | null;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
}

interface UsersData {
  users: UserRow[];
  roles?: Array<{ name: string; label?: string }>;
}

const PLATFORM_ROLES = [
  { value: 'PLATFORM_OWNER', label: 'Platform Owner' },
  { value: 'PLATFORM_SUPER_ADMIN', label: 'Super Admin' },
  { value: 'PLATFORM_ADMIN', label: 'Admin' },
  { value: 'SUPER_ADMIN', label: 'Super Admin (système)' },
];

type FormState = {
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  status: 'ACTIVE' | 'INACTIVE';
};

const EMPTY_FORM: FormState = {
  email: '',
  role: 'PLATFORM_ADMIN',
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
  status: 'ACTIVE',
};

export default function PlatformUsersWorkspace() {
  const [roleFilter, setRoleFilter] = useState('ALL');
  const { data, loading, error, refetch } = usePlatformData<UsersData>(`/users?role=${roleFilter}`);

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setEditingId(null);
    setModalMode('create');
  };

  const openEdit = (u: UserRow) => {
    setForm({
      email: u.email,
      role: u.role,
      firstName: u.firstName ?? '',
      lastName: u.lastName ?? '',
      phone: u.phone ?? '',
      password: '',
      status: u.status,
    });
    setFormError(null);
    setFormSuccess(null);
    setEditingId(u.id);
    setModalMode('edit');
  };

  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setEditingId(null);
    setFormError(null);
    setFormSuccess(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!form.email.trim() || !form.firstName.trim() || !form.lastName.trim()) {
      setFormError('Email, prénom et nom sont requis.');
      return;
    }
    if (modalMode === 'create' && !form.password.trim()) {
      setFormError('Un mot de passe est requis pour la création.');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const body: Record<string, unknown> = {
        email: form.email.trim(),
        role: form.role,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
      };
      if (modalMode === 'create') {
        body.password = form.password;
      } else {
        body.status = form.status;
        if (form.password.trim()) body.password = form.password.trim();
      }

      const url = isEdit ? `/api/platform/users/${editingId}` : '/api/platform/users';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }

      setFormSuccess(isEdit ? 'Utilisateur mis à jour.' : 'Utilisateur créé.');
      setTimeout(() => {
        setSubmitting(false);
        setModalMode(null);
        setEditingId(null);
        setFormError(null);
        setFormSuccess(null);
        refetch();
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mutation';
      setFormError(msg);
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/platform/users/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || j?.message || `Erreur ${res.status}`);
      }
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteError(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setDeleteError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Utilisateurs Plateforme</h1>
          <p className="text-slate-500">Comptes avec accès au back-office global</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">Tous rôles</option>
            <option value="PLATFORM_OWNER">Platform Owner</option>
            <option value="PLATFORM_SUPER_ADMIN">Super Admin</option>
            <option value="PLATFORM_ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin (système)</option>
          </select>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer un utilisateur
          </button>
        </div>
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
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          title="Modifier"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-900 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteTarget(u); setDeleteError(null); }}
                          title="Supprimer"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-blue-900">
                  {modalMode === 'create' ? 'Créer un utilisateur' : 'Modifier l\'utilisateur'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalMode === 'create' ? 'Nouvel accès au back-office plateforme' : `ID: ${editingId}`}
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={submitting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitForm} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  placeholder="jean.dupont@academia-helm.fr"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Rôle *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {PLATFORM_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Mot de passe {modalMode === 'create' ? '*' : '(laisser vide pour ne pas changer)'}
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
                {modalMode === 'edit' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    >
                      <option value="ACTIVE">Actif</option>
                      <option value="INACTIVE">Inactif</option>
                    </select>
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-blue-900">Supprimer l'utilisateur</h2>
              </div>
              <button
                onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
                disabled={deleting}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Confirmez-vous la suppression de l'utilisateur{' '}
                <span className="font-bold text-slate-900">{deleteTarget.name}</span>{' '}
                (<span className="font-mono text-xs">{deleteTarget.email}</span>) ? Cette action est irréversible.
              </p>
              {deleteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(null); } }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
