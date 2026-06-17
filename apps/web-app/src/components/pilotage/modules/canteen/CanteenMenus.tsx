/**
 * ============================================================================
 * CANTEEN MENUS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/menus?academicYearId=...
 * Endpoint : POST /modules-complementaires/canteen/menus
 * ============================================================================
 */

import React, { useState } from 'react';
import {
  Plus, Calendar, Search, Filter, Download,
  ChevronLeft, ChevronRight,
  Clock, ChefHat, Eye, Edit, Trash2,
  Sparkles, CheckCircle2, Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface MenuItem {
  id: string;
  date?: string;
  menuDate?: string;
  period?: string;
  mealType?: string;
  main?: string;
  mainCourse?: string;
  dish?: string;
  level?: string;
  schoolLevel?: string;
  targetLevel?: string;
  cost?: number;
  estimatedCost?: number;
  status?: string;
  [key: string]: any;
}

interface MenuFormData {
  date: string;
  mealType: string;
  dishes: string;
}

const emptyMenuForm: MenuFormData = { date: '', mealType: 'DEJEUNER', dishes: '' };

export default function CanteenMenus() {
  const { academicYear } = useModuleContext();
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MenuFormData>(emptyMenuForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { data: menus, loading, error, refetch } = useModulesList<MenuItem>(
    'canteen',
    'menus',
    academicYear?.id,
  );

  const openCreate = () => {
    setFormData(emptyMenuForm);
    setEditingId(null);
    setCreateOpen(true);
  };

  const openEdit = (menu: MenuItem) => {
    setEditingId(menu.id);
    setFormData({
      date: menu.date ?? menu.menuDate ?? '',
      mealType: menu.mealType ?? menu.period ?? 'DEJEUNER',
      dishes: menu.main ?? menu.mainCourse ?? menu.dish ?? '',
    });
    setEditOpen(true);
  };

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/menus',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setCreateOpen(false);
      setFormData(emptyMenuForm);
      await refetch();
    } catch (e: any) {
      console.error('Erreur création menu :', e?.message || e);
      alert(e?.message || 'Erreur lors de la création du menu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      setSubmitting(true);
      await modulesApi.put(
        `canteen/menus/${editingId}`,
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setEditOpen(false);
      setEditingId(null);
      setFormData(emptyMenuForm);
      await refetch();
    } catch (e: any) {
      console.error('Erreur mise à jour menu :', e?.message || e);
      alert(e?.message || 'Erreur lors de la mise à jour du menu');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (menuId: string) => {
    if (!window.confirm('Supprimer ce menu ?')) return;
    try {
      setActionLoading(menuId);
      await modulesApi.delete(
        `canteen/menus/${menuId}`,
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
    } catch (e: any) {
      console.error('Erreur suppression menu :', e?.message || e);
      alert(e?.message || 'Erreur lors de la suppression du menu');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des menus...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setViewMode('list')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-400 hover:text-navy-600'}`}
          >
            Vue Liste
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-400 hover:text-navy-600'}`}
          >
            Calendrier
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100">
            <Sparkles className="w-4 h-4" />
            <span>Générer via Sarah AI</span>
          </button>
          <button
            onClick={openCreate}
            className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Planifier</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative group flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input
                type="text"
                placeholder="Rechercher un plat, une date..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500/50 transition-all"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button className="p-3 text-gray-400 hover:text-navy-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-3 text-gray-400 hover:text-navy-600 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {menus.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun menu planifié pour cette année scolaire.
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Période</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Menu Principal</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Niveau Scolaire</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Coût Est.</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {menus.map((menu) => (
                  <MenuRow
                    key={menu.id}
                    menuId={menu.id}
                    date={menu.date ?? menu.menuDate ?? '—'}
                    period={menu.period ?? menu.mealType ?? '—'}
                    main={menu.main ?? menu.mainCourse ?? menu.dish ?? '—'}
                    level={menu.level ?? menu.schoolLevel ?? menu.targetLevel ?? 'Tous les niveaux'}
                    cost={menu.cost ?? menu.estimatedCost ?? 0}
                    status={menu.status ?? 'Brouillon'}
                    onEdit={() => openEdit(menu)}
                    onDelete={() => handleDelete(menu.id)}
                    actionLoading={actionLoading}
                  />
                ))}
              </tbody>
            </table>
          </div>
          )}

          <div className="p-8 border-t border-gray-50 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Affichage de {menus.length} menu{menus.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center space-x-2">
              <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                <ChevronLeft className="w-4 h-4 text-gray-400" />
              </button>
              <button className="px-4 py-2 border border-navy-500 bg-navy-50 text-navy-600 rounded-xl text-xs font-black shadow-sm shadow-navy-500/10">1</button>
              <button className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 p-8 flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="p-6 bg-navy-50 rounded-full mb-6">
            <Calendar className="w-12 h-12 text-navy-600" />
          </div>
          <h3 className="text-2xl font-black text-navy-900 mb-2 tracking-tight">Vue Calendrier Interactive</h3>
          <p className="text-gray-400 max-w-sm text-sm font-medium leading-relaxed">Organisez visuellement vos menus par semaine ou par mois avec la fluidité Academia Helm.</p>
          <button className="mt-8 px-8 py-3 bg-navy-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-navy-900/20" onClick={openCreate}>Activer la vue</button>
        </div>
      )}

      {/* Modal Planifier (création) */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-navy-900">Planifier un menu</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type de repas</label>
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="DEJEUNER">Déjeuner</option>
                  <option value="PETIT_DEJEUNER">Petit Déjeuner</option>
                  <option value="GOUTER">Goûter</option>
                  <option value="DINER">Dîner</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plat principal</label>
                <input
                  type="text"
                  placeholder="ex : Riz au poisson"
                  value={formData.dishes}
                  onChange={(e) => setFormData({ ...formData, dishes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modification */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-black text-navy-900">Modifier le menu</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type de repas</label>
                <select
                  value={formData.mealType}
                  onChange={(e) => setFormData({ ...formData, mealType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="DEJEUNER">Déjeuner</option>
                  <option value="PETIT_DEJEUNER">Petit Déjeuner</option>
                  <option value="GOUTER">Goûter</option>
                  <option value="DINER">Dîner</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plat principal</label>
                <input
                  type="text"
                  placeholder="ex : Riz au poisson"
                  value={formData.dishes}
                  onChange={(e) => setFormData({ ...formData, dishes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setEditOpen(false)}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleUpdate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ menuId, date, period, main, level, cost, status, onEdit, onDelete, actionLoading }: any) {
  const statusColors: any = {
    'Publié': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Brouillon': 'bg-gray-50 text-gray-500 border-gray-100',
    'Modifié': 'bg-amber-50 text-amber-600 border-amber-100',
  };
  const formattedCost = typeof cost === 'number' ? `${cost.toLocaleString('fr-FR')} F` : cost;
  const isLoading = actionLoading === menuId;

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-navy-50 rounded-xl group-hover:bg-white transition-colors">
            <Calendar className="w-4 h-4 text-navy-600" />
          </div>
          <div>
            <p className="text-sm font-black text-navy-900 tracking-tight">{date}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <Clock className="w-3 h-3 text-gray-400" />
              <p className="text-[10px] font-bold text-gray-400 uppercase">{period}</p>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <ChefHat className="w-4 h-4 text-navy-300" />
          <p className="text-sm font-bold text-navy-800">{main}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-2.5 py-1 rounded-lg w-fit">{level}</p>
      </td>
      <td className="px-8 py-6 text-center">
        <p className="text-sm font-black text-navy-900">{formattedCost}</p>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit flex items-center space-x-1.5 ${statusColors[status] ?? statusColors['Brouillon']}`}>
          {status === 'Publié' && <CheckCircle2 className="w-3 h-3" />}
          <span>{status}</span>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-1">
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-lg transition-all"><Eye className="w-4 h-4" /></button>
          <button
            onClick={onEdit}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all disabled:opacity-50"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
