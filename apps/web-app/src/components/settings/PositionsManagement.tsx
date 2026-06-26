'use client';

/**
 * ============================================================================
 * PositionsManagement — Gestion des postes occupés (CRUD)
 * ============================================================================
 *
 * Pattern identique à DepartmentsManagement.
 * Endpoint: /api/positions
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Loader2, Briefcase } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

interface Position {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

interface Props {
  tenantId?: string;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  TEACHER: 'Corps Enseignant',
  ADMIN: 'Administration',
  SUPPORT: 'Personnel d\'appui',
  DIRECTOR: 'Direction',
};

const CATEGORY_COLORS: Record<string, string> = {
  TEACHER: 'bg-emerald-100 text-emerald-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  SUPPORT: 'bg-amber-100 text-amber-700',
  DIRECTOR: 'bg-violet-100 text-violet-700',
};

export default function PositionsManagement({ tenantId, showToast }: Props) {
  const confirmDialog = useConfirmDialog();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: '' });

  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/positions', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPositions(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast('error', 'Erreur lors du chargement des postes');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('error', 'Le nom du poste est requis'); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/positions/${editingId}` : '/api/positions';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Erreur');
      showToast('success', editingId ? 'Poste modifié' : 'Poste créé');
      setForm({ name: '', description: '', category: '' });
      setEditingId(null);
      setShowForm(false);
      loadPositions();
    } catch {
      showToast('error', 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (pos: Position) => {
    setForm({ name: pos.name, description: pos.description || '', category: pos.category || '' });
    setEditingId(pos.id);
    setShowForm(true);
  };

  const handleDelete = async (pos: Position) => {
    const confirmed = await confirmDialog({
      title: 'Supprimer le poste',
      description: `Confirmez-vous la suppression du poste "${pos.name}" ?`,
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/positions/${pos.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Erreur');
      showToast('success', 'Poste supprimé');
      loadPositions();
    } catch {
      showToast('error', 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-slate-500" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Postes occupés</h3>
            <p className="text-xs text-slate-400">{positions.length} poste{positions.length > 1 ? 's' : ''} configuré{positions.length > 1 ? 's' : ''}</p>
          </div>
        </div>
        {!showForm && (
          <button onClick={() => { setForm({ name: '', description: '', category: '' }); setEditingId(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
            <Plus className="w-3.5 h-3.5" /> Ajouter un poste
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Nom du poste *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                placeholder="Ex: Professeur de Mathématiques" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Catégorie</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white">
                <option value="">— Aucune —</option>
                <option value="TEACHER">Corps Enseignant</option>
                <option value="ADMIN">Administration</option>
                <option value="SUPPORT">Personnel d'appui</option>
                <option value="DIRECTOR">Direction</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optionnelle)</label>
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              placeholder="Description du poste…" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold disabled:opacity-50 hover:bg-blue-700 transition">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {editingId ? 'Modifier' : 'Créer'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {positions.length === 0 && !showForm ? (
        <div className="text-center py-8 text-sm text-slate-400">Aucun poste configuré.</div>
      ) : (
        <div className="space-y-2">
          {positions.map((pos) => (
            <div key={pos.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{pos.name}</p>
                {pos.description && <p className="text-xs text-slate-400">{pos.description}</p>}
              </div>
              {pos.category && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${CATEGORY_COLORS[pos.category] || 'bg-slate-100 text-slate-600'}`}>
                  {CATEGORY_LABELS[pos.category] || pos.category}
                </span>
              )}
              <button onClick={() => handleEdit(pos)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(pos)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
