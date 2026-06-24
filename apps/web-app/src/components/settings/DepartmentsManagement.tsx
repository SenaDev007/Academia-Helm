'use client';

/**
 * ============================================================================
 * DEPARTMENTS MANAGEMENT — CRUD UI for school departments
 * ============================================================================
 *
 * Used in Settings → Départements tab.
 * Allows the admin to create, edit, and delete departments for their school.
 * Departments are used in:
 *   - Job offers (dept selector in the recruitment modal)
 *   - Organigram (organizational chart)
 *   - Staff assignments
 *
 * Includes a suggested departments list for a well-structured school.
 *
 * Endpoints:
 *   GET    /api/departments              — list
 *   POST   /api/departments              — create
 *   PATCH  /api/departments/:id          — update
 *   DELETE /api/departments/:id          — delete
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, Trash2, Loader2, Save, X, Lightbulb, Check } from 'lucide-react';

const PRIMARY = '#1A2BA6';

/**
 * Liste de départements suggérés pour une école bien structurée.
 * Couvre les départements administratifs, pédagogiques et de support.
 */
const SUGGESTED_DEPARTMENTS = [
  // Direction & Administration
  { name: 'Direction Générale', description: 'Direction générale de l\'établissement — Promoteur/Directeur' },
  { name: 'Administration', description: 'Secrétariat, comptabilité et gestion administrative' },
  { name: 'Comptabilité et Finances', description: 'Gestion financière, paie et budget' },
  { name: 'Ressources Humaines', description: 'Gestion du personnel et recrutement' },

  // Pédagogique — Maternelle
  { name: 'Département Maternelle', description: 'Coordination pédagogique de la section maternelle' },

  // Pédagogique — Primaire
  { name: 'Département Primaire', description: 'Coordination pédagogique du cycle primaire (CI au CM2)' },

  // Pédagogique — Secondaire
  { name: 'Département Sciences', description: 'Mathématiques, Physique, SVT, Informatique' },
  { name: 'Département Lettres et Langues', description: 'Français, Anglais, Espagnol, Philosophie' },
  { name: 'Département Sciences Humaines', description: 'Histoire-Géographie, EMC, SES' },
  { name: 'Département EPS', description: 'Éducation Physique et Sportive' },
  { name: 'Département Arts', description: 'Arts plastiques, Musique, Théâtre' },

  // Vie Scolaire
  { name: 'Vie Scolaire', description: 'Surveillance, discipline et suivi des élèves' },
  { name: 'Orientation', description: 'Conseil d\'orientation et accompagnement' },

  // Support
  { name: 'Documentation (CDI)', description: 'Centre de documentation et d\'information' },
  { name: 'Maintenance', description: 'Entretien et maintenance des locaux' },
  { name: 'Sécurité', description: 'Sécurité et accueil des visiteurs' },
];

interface Department {
  id: string;
  name: string;
  description?: string | null;
  managerId?: string | null;
  createdAt?: string;
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  position?: string | null;
  roleType?: string | null;
}

interface Props {
  tenantId?: string | null;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export default function DepartmentsManagement({ tenantId, showToast }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', managerId: '' });

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const res = await fetch(`/api/departments${qs}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : data?.data ?? []);
      }
    } catch (err) {
      showToast('error', 'Erreur lors du chargement des départements');
    } finally {
      setLoading(false);
    }
  }, [tenantId, showToast]);

  const loadStaff = useCallback(async () => {
    try {
      // includePromoter=true : le promoteur DOIT apparaître dans la liste des responsables
      // (il peut être responsable de la "Direction Générale")
      const params = new URLSearchParams();
      if (tenantId) params.set('tenantId', tenantId);
      params.set('includePromoter', 'true');
      const qs = `?${params.toString()}`;
      const res = await fetch(`/api/hr/staff${qs}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setStaffList(list.map((s: any) => ({
          id: s.id,
          firstName: s.firstName || '',
          lastName: s.lastName || '',
          position: s.position || null,
          roleType: s.roleType || null,
        })));
      }
    } catch {
      // Non-critical — manager is optional
    }
  }, [tenantId]);

  useEffect(() => {
    loadDepartments();
    loadStaff();
  }, [loadDepartments, loadStaff]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showToast('error', 'Le nom du département est requis');
      return;
    }
    setSaving(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const body: any = { name: form.name.trim() };
      if (form.description.trim()) body.description = form.description.trim();
      if (form.managerId) body.managerId = form.managerId;

      const res = await fetch(`/api/departments${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast('success', 'Département créé avec succès');
        setForm({ name: '', description: '', managerId: '' });
        setShowForm(false);
        loadDepartments();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message || 'Erreur lors de la création');
      }
    } catch (err) {
      showToast('error', 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSuggested = async (suggested: { name: string; description: string }) => {
    setSaving(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const res = await fetch(`/api/departments${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: suggested.name, description: suggested.description }),
      });
      if (res.ok) {
        showToast('success', `Département "${suggested.name}" créé`);
        loadDepartments();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message || 'Erreur lors de la création');
      }
    } catch (err) {
      showToast('error', 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !form.name.trim()) {
      showToast('error', 'Le nom du département est requis');
      return;
    }
    setSaving(true);
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const body: any = { name: form.name.trim() };
      if (form.description !== undefined) body.description = form.description.trim();
      if (form.managerId !== undefined) body.managerId = form.managerId || null;

      const res = await fetch(`/api/departments/${editingId}${qs}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast('success', 'Département modifié avec succès');
        setForm({ name: '', description: '', managerId: '' });
        setEditingId(null);
        setShowForm(false);
        loadDepartments();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message || 'Erreur lors de la modification');
      }
    } catch (err) {
      showToast('error', 'Erreur réseau');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer le département "${name}" ?`)) return;
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const res = await fetch(`/api/departments/${id}${qs}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        showToast('success', 'Département supprimé');
        loadDepartments();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast('error', data?.message || 'Erreur lors de la suppression');
      }
    } catch (err) {
      showToast('error', 'Erreur réseau');
    }
  };

  const startEdit = (dept: Department) => {
    setEditingId(dept.id);
    setForm({
      name: dept.name,
      description: dept.description || '',
      managerId: dept.managerId || '',
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setForm({ name: '', description: '', managerId: '' });
    setEditingId(null);
    setShowForm(false);
  };

  // Filter out already-created departments from suggestions
  const existingNames = departments.map((d) => d.name.toLowerCase());
  const availableSuggestions = SUGGESTED_DEPARTMENTS.filter(
    (s) => !existingNames.includes(s.name.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des départements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Départements de l'établissement
          </h3>
          {!showForm && (
            <button
              onClick={() => { setForm({ name: '', description: '', managerId: '' }); setEditingId(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Créer un département
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          Les départements sont utilisés dans les offres d'emploi (sélecteur), l'organigramme et les affectations du personnel.
          Configurez ici la liste des départements de votre établissement.
        </p>
      </div>

      {/* Suggested departments */}
      {availableSuggestions.length > 0 && !showForm && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-blue-600" />
            <h4 className="text-sm font-bold text-blue-900">Départements suggérés</h4>
            <span className="text-xs text-blue-600 ml-auto">Cliquez pour ajouter rapidement</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSuggestions.map((s) => (
              <button
                key={s.name}
                onClick={() => handleCreateSuggested(s)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                title={s.description}
              >
                <Plus className="w-3 h-3" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form (create/edit) */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm border border-blue-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            {editingId ? 'Modifier le département' : 'Nouveau département'}
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du département *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Département des Sciences, Administration, Primaire..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brève description du département et de ses responsabilités"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Responsable (optionnel)</label>
              <select
                value={form.managerId}
                onChange={(e) => setForm({ ...form, managerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">— Aucun responsable désigné —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.position ? ` (${s.position})` : ''}{s.roleType === 'PROMOTEUR' ? ' — Promoteur' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Le promoteur de l'école peut être désigné comme responsable (ex: Direction Générale).
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={saving || !form.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
              <button
                onClick={cancelForm}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                <X className="w-4 h-4" /> Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {departments.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium mb-1">Aucun département configuré</p>
            <p className="text-xs text-gray-400">Créez votre premier département ou utilisez les suggestions ci-dessus.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Responsable</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => {
                const manager = staffList.find((s) => s.id === dept.managerId);
                return (
                  <tr key={dept.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{dept.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{dept.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {manager ? (
                        <span>
                          {manager.firstName} {manager.lastName}
                          {manager.roleType === 'PROMOTEUR' && (
                            <span className="ml-1 text-xs text-blue-600 font-bold">(Promoteur)</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => startEdit(dept)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Supprimer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
