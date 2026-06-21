'use client';

import { useState, useMemo } from 'react';
import {
  Shield,
  Plus,
  Search,
  ArrowRight,
  Lock,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface RoleRow {
  id: string;
  name: string;
  label?: string | null;
  description: string | null;
  isSystem: boolean;
  isSystemRole?: boolean;
  level?: number | null;
  scope?: string | null;
  isActive?: boolean;
  usersCount: number;
  permissionsCount: number;
  canAccessOrion: boolean;
  canAccessAtlas: boolean;
}

interface RbacData {
  roles: RoleRow[];
}

interface PermissionsData {
  permissions: Array<{
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string | null;
    rolesCount: number;
  }>;
}

const ROLE_SCOPES = [
  { value: 'PLATFORM', label: 'Plateforme' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'GLOBAL', label: 'Global' },
];

type RoleFormState = {
  name: string;
  label: string;
  description: string;
  level: string;
  scope: string;
  isActive: boolean;
};

const EMPTY_ROLE: RoleFormState = {
  name: '',
  label: '',
  description: '',
  level: '50',
  scope: 'PLATFORM',
  isActive: true,
};

export default function PlatformRBACWorkspace() {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: rolesData, loading: rolesLoading, error: rolesError, refetch: rolesRefetch } = usePlatformData<RbacData>('/roles');
  const { data: permsData, loading: permsLoading, error: permsError, refetch: permsRefetch } = usePlatformData<PermissionsData>('/permissions');

  const filteredPermissions = useMemo(() => {
    if (!permsData?.permissions) return [];
    if (!searchTerm.trim()) return permsData.permissions;
    const q = searchTerm.toLowerCase();
    return permsData.permissions.filter((p) =>
      p.name.toLowerCase().includes(q) || p.resource.toLowerCase().includes(q)
    );
  }, [permsData, searchTerm]);

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>(EMPTY_ROLE);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_ROLE);
    setFormError(null);
    setFormSuccess(null);
    setEditingId(null);
    setModalMode('create');
  };

  const openEdit = (r: RoleRow) => {
    setForm({
      name: r.name,
      label: r.label ?? '',
      description: r.description ?? '',
      level: r.level != null ? String(r.level) : '50',
      scope: r.scope ?? 'PLATFORM',
      isActive: r.isActive !== false,
    });
    setFormError(null);
    setFormSuccess(null);
    setEditingId(r.id);
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

    if (!form.name.trim() || !form.label.trim()) {
      setFormError('Nom et libellé sont requis.');
      return;
    }

    setSubmitting(true);
    try {
      const isEdit = modalMode === 'edit' && editingId;
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        label: form.label.trim(),
        description: form.description.trim() || null,
        level: Number(form.level) || 0,
        scope: form.scope,
      };
      if (isEdit) body.isActive = form.isActive;

      const url = isEdit ? `/api/platform/roles/${editingId}` : '/api/platform/roles';
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

      setFormSuccess(isEdit ? 'Rôle mis à jour.' : 'Rôle créé.');
      setTimeout(() => {
        setSubmitting(false);
        setModalMode(null);
        setEditingId(null);
        setFormError(null);
        setFormSuccess(null);
        rolesRefetch();
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
      const res = await fetch(`/api/platform/roles/${deleteTarget.id}`, {
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
      rolesRefetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setDeleteError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Rôles & Permissions Globales</h1>
          <p className="text-slate-500">Modèle RBAC de l'administration plateforme</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-white shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          Créer un rôle
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Rôles plateforme</h3>
        {rolesLoading ? <PlatformLoading label="Chargement des rôles…" /> :
         rolesError ? <PlatformError message={rolesError} onRetry={rolesRefetch} /> :
         !rolesData || rolesData.roles.length === 0 ? (
           <PlatformEmpty title="Aucun rôle" description="Aucun rôle plateforme n'a été défini." />
         ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {rolesData.roles.map((role) => {
              const isSystem = role.isSystem || role.isSystemRole === true;
              return (
                <div key={role.id} className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-amber-200 transition-all group relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    {isSystem && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold uppercase">Système</span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{role.label || role.name}</h3>
                  <p className="text-xs text-slate-500 mb-4">{role.description || '—'}</p>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                    {role.usersCount} utilisateur(s) · {role.permissionsCount} permission(s)
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {role.canAccessOrion && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded text-[9px] font-bold uppercase">ORION</span>}
                    {role.canAccessAtlas && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px] font-bold uppercase">Atlas</span>}
                  </div>
                  {!isSystem && (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => openEdit(role)}
                        title="Modifier"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-900 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      <button
                        onClick={() => { setDeleteTarget(role); setDeleteError(null); }}
                        title="Supprimer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-red-50 hover:text-red-600 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-bold text-blue-900">Permissions Granulaires</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer les permissions..."
              className="pl-9 pr-3 py-1.5 bg-slate-50 border-none rounded-lg text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {permsLoading ? <PlatformLoading label="Chargement des permissions…" /> :
         permsError ? <PlatformError message={permsError} onRetry={permsRefetch} /> :
         filteredPermissions.length === 0 ? (
           <PlatformEmpty title="Aucune permission" description="Aucune permission ne correspond à votre recherche." />
         ) : (
          <div className="space-y-2">
            {filteredPermissions.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-3">
                  <Lock className="w-3 h-3 text-indigo-400" />
                  <div>
                    <span className="text-sm font-mono font-medium text-slate-700">{p.name}</span>
                    <div className="text-[10px] text-slate-400">{p.resource} · {p.action} · {p.rolesCount} rôle(s)</div>
                  </div>
                </div>
                <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  Détails <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Role Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-blue-900">
                  {modalMode === 'create' ? 'Créer un rôle' : 'Modifier le rôle'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalMode === 'create' ? 'Nouveau rôle plateforme' : `ID: ${editingId}`}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom technique *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="PLATFORM_TENANT_MANAGER"
                    disabled={modalMode === 'edit'}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Clé technique, non modifiable après création.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Libellé *</label>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="Gestionnaire de tenants"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                  placeholder="Rôle responsable de la gestion des tenants et de leur configuration."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Niveau</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Périmètre (scope)</label>
                  <select
                    value={form.scope}
                    onChange={(e) => setForm({ ...form, scope: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  >
                    {ROLE_SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {modalMode === 'edit' && (
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500/20"
                  />
                  <span className="text-xs font-semibold text-slate-700">Rôle actif</span>
                </label>
              )}

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
                <h2 className="text-lg font-bold text-blue-900">Supprimer le rôle</h2>
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
                Confirmez-vous la suppression du rôle{' '}
                <span className="font-bold text-slate-900">{deleteTarget.label || deleteTarget.name}</span> ? Cette action est irréversible.
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
