/**
 * ============================================================================
 * EQUIPMENTS INVENTORY
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Microscope, Search, Filter, MoreVertical, Wrench, Download, Plus, Edit, Trash2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface EquipmentItem {
  id?: string;
  name?: string;
  category?: string;
  equipmentCategory?: string;
  labName?: string;
  lab?: string;
  laboratory?: string;
  status?: string;
  condition?: string;
  lastMaintenance?: string;
  lastMaintenanceDate?: string;
  maintenanceAt?: string;
}

export default function EquipmentsInventory() {
  const { academicYear } = useModuleContext();
  // Note: GET labs/equipment peut nécessiter un labId selon le backend. Si l'endpoint global n'existe pas,
  // une erreur sera affichée dans le bandeau d'avertissement.
  const { data: equipments, loading, error, refetch } = useModulesList<EquipmentItem>(
    'labs',
    'equipment',
    academicYear?.id,
  );

  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [maintenanceEquipId, setMaintenanceEquipId] = useState<string | null>(null);
  const [equipForm, setEquipForm] = useState({ labId: '', name: '', type: '', status: 'GOOD' });
  const [maintenanceForm, setMaintenanceForm] = useState({ type: 'PREVENTIVE', cost: 0, date: '' });

  const openCreateModal = () => {
    setEditingId(null);
    setEquipForm({ labId: '', name: '', type: '', status: 'GOOD' });
    setEquipModalOpen(true);
  };

  const openEditModal = (eq: any) => {
    setEditingId(eq?.id ?? null);
    setEquipForm({
      labId: eq?.labId ?? '',
      name: eq?.name ?? '',
      type: eq?.category ?? eq?.equipmentCategory ?? '',
      status: eq?.status ?? eq?.condition ?? 'GOOD',
    });
    setEquipModalOpen(true);
  };

  const openMaintenanceModal = (equipId: string) => {
    setMaintenanceEquipId(equipId);
    setMaintenanceForm({ type: 'PREVENTIVE', cost: 0, date: '' });
    setMaintenanceModalOpen(true);
  };

  const handleSubmitEquipment = async () => {
    try {
      setSubmitting(true);
      if (editingId) {
        await modulesApi.put(`labs/equipment/${editingId}`, equipForm, buildModulesApiOptions(academicYear?.id));
      } else {
        await modulesApi.post(`labs/${equipForm.labId}/equipment`, equipForm, buildModulesApiOptions(academicYear?.id));
      }
      setEquipModalOpen(false);
      setEquipForm({ labId: '', name: '', type: '', status: 'GOOD' });
      setEditingId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement de l\'équipement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cet équipement ?')) return;
    try {
      setActionLoading(id);
      await modulesApi.delete(`labs/equipment/${id}`, buildModulesApiOptions(academicYear?.id));
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la suppression');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateMaintenance = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(`labs/equipment/${maintenanceEquipId}/maintenance`, maintenanceForm, buildModulesApiOptions(academicYear?.id));
      setMaintenanceModalOpen(false);
      setMaintenanceForm({ type: 'PREVENTIVE', cost: 0, date: '' });
      setMaintenanceEquipId(null);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'enregistrement de la maintenance');
    } finally {
      setSubmitting(false);
    }
  };

  const safeEquipments = equipments ?? [];

  const getStatusBadge = (status: string) => {
    const s = (status ?? '').toString().toUpperCase();
    switch (s) {
      case 'NEW': return <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">Neuf</span>;
      case 'GOOD': return <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">Bon État</span>;
      case 'AVERAGE': return <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">Moyen</span>;
      case 'OUT_OF_ORDER': return <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest">HS</span>;
      default: return <span className="px-2 py-1 rounded-lg bg-gray-50 text-gray-500 text-[10px] font-black uppercase tracking-widest">{status || '—'}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des équipements...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les équipements. {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un équipement (nom, code, catégorie)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Équipement</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Laboratoire</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">État</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernière Maintenance</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {safeEquipments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-8 py-16 text-center text-gray-500">
                  Aucun équipement disponible pour cette année scolaire.
                </td>
              </tr>
            ) : (
              safeEquipments.map((eq: any, i: number) => (
                <EquipmentRow
                  key={eq?.id ?? `eq-${i}`}
                  eq={eq}
                  index={i}
                  getStatusBadge={getStatusBadge}
                  actionLoading={actionLoading}
                  onEdit={() => openEditModal(eq)}
                  onDelete={() => eq?.id && handleDeleteEquipment(eq.id)}
                  onMaintenance={() => eq?.id && openMaintenanceModal(eq.id)}
                />
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Equipment Modal */}
      {equipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Modifier l\'Équipement' : 'Ajouter un Équipement'}</h3>
              <button onClick={() => setEquipModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Laboratoire</label>
                <input type="text" value={equipForm.labId} onChange={(e) => setEquipForm({ ...equipForm, labId: e.target.value })} disabled={!!editingId} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nom</label>
                <input type="text" value={equipForm.name} onChange={(e) => setEquipForm({ ...equipForm, name: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
                <input type="text" value={equipForm.type} onChange={(e) => setEquipForm({ ...equipForm, type: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">État</label>
                <select value={equipForm.status} onChange={(e) => setEquipForm({ ...equipForm, status: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="NEW">Neuf</option>
                  <option value="GOOD">Bon État</option>
                  <option value="AVERAGE">Moyen</option>
                  <option value="OUT_OF_ORDER">HS</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setEquipModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleSubmitEquipment} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : editingId ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {maintenanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Enregistrer une Maintenance</h3>
              <button onClick={() => setMaintenanceModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Type</label>
                <select value={maintenanceForm.type} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, type: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="PREVENTIVE">Préventive</option>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="CALIBRATION">Étalonnage</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coût</label>
                <input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input type="date" value={maintenanceForm.date} onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setMaintenanceModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateMaintenance} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EquipmentRow({ eq, index, getStatusBadge, actionLoading, onEdit, onDelete, onMaintenance }: any) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
    >
      <td className="px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-white group-hover:scale-110 transition-all">
            <Microscope className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
          </div>
          <div>
            <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{eq?.name ?? `Équipement #${index + 1}`}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{eq?.id ?? `EQ-${index}`}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-5">
        <span className="text-sm font-bold text-slate-600">{eq?.category ?? eq?.equipmentCategory ?? '—'}</span>
      </td>
      <td className="px-8 py-5">
        <span className="text-sm font-bold text-slate-600">{eq?.labName ?? eq?.lab ?? eq?.laboratory ?? '—'}</span>
      </td>
      <td className="px-8 py-5">
        {getStatusBadge(eq?.status ?? eq?.condition ?? 'GOOD')}
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center text-xs font-bold text-slate-500">
          <Wrench className="w-3.5 h-3.5 mr-2 text-slate-300" />
          {eq?.lastMaintenance ?? eq?.lastMaintenanceDate ?? (eq?.maintenanceAt ? new Date(eq.maintenanceAt).toLocaleDateString('fr-FR') : 'N/A')}
        </div>
      </td>
      <td className="px-8 py-5 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-xl transition-colors" title="Modifier">
            <Edit className="w-4 h-4 text-slate-400 hover:text-blue-600" />
          </button>
          <button onClick={onMaintenance} className="p-2 hover:bg-amber-50 rounded-xl transition-colors" title="Maintenance">
            <Wrench className="w-4 h-4 text-slate-400 hover:text-amber-600" />
          </button>
          <button onClick={onDelete} disabled={actionLoading === eq?.id} className="p-2 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50" title="Supprimer">
            <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />
          </button>
          <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <MoreVertical className="w-5 h-5 text-slate-300" />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}
