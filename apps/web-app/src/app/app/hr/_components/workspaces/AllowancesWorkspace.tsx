'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, DollarSign, Edit, Trash2, Award, X, AlertCircle, Wallet } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import {
  LevelSectionHeader,
  splitByLevel,
  staffLevelCategory,
  useSecondaryLevelEnabled,
} from '../level-separation';
import { motion } from 'framer-motion';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';

export function AllowancesWorkspace() {
  const confirmDialog = useConfirmDialog();
  const { tenant } = useModuleContext();
  const [allowanceTypes, setAllowanceTypes] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [staffAllowances, setStaffAllowances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state - Assignment
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Modal state - Edition du montant (modifiable à tout moment)
  const [editingAllowance, setEditingAllowance] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Form states - Assignment
  const [assignType, setAssignType] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignEndDate, setAssignEndDate] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!tenant?.id) return;
      try {
        setLoading(true);
        // ⭐ Types d'indemnité : liste COMPLÈTE auto-provisionnée par le serveur
        //    (catalogue de 22 types — voir allowance-catalog.ts). Plus besoin de
        //    créer les types à la main : le sélecteur liste toujours tout.
        const types = await hrFetch<any[]>(hrUrl('allowances/types', { tenantId: tenant.id }));
        setAllowanceTypes(Array.isArray(types) ? types : []);

        // Load staff list
        const staff = await hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }));
        setStaffList(staff);
        if (staff.length > 0) {
          setSelectedStaff(staff[0]);
        }
      } catch (err) {
        console.error('Error loading allowances data:', err);
        toast({ variant: 'error', title: 'Erreur: chargement des données d\'indemnités' });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tenant?.id]);

  useEffect(() => {
    async function loadStaffAllowances() {
      if (!tenant?.id || !selectedStaff?.id) return;
      try {
        const list = await hrFetch<any[]>(hrUrl(`allowances/staff/${selectedStaff.id}`, { tenantId: tenant.id }));
        setStaffAllowances(list);
      } catch (err) {
        console.error('Error loading staff allowances:', err);
        toast({ variant: 'error', title: 'Erreur: chargement des indemnités du collaborateur' });
      }
    }
    loadStaffAllowances();
  }, [tenant?.id, selectedStaff?.id]);

  async function handleAssignAllowance(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id || !selectedStaff?.id) return;
    try {
      setSavingAssign(true);
      await hrFetch(hrUrl('allowances/assignments', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          staffId: selectedStaff.id,
          allowanceTypeId: assignType,
          amount: parseFloat(assignAmount),
          effectiveDate: assignStartDate ? new Date(assignStartDate).toISOString() : new Date().toISOString(),
          startDate: assignStartDate ? new Date(assignStartDate).toISOString() : new Date().toISOString(),
          endDate: assignEndDate ? new Date(assignEndDate).toISOString() : undefined,
        },
      });
      // Refresh staff allowances
      const list = await hrFetch<any[]>(hrUrl(`allowances/staff/${selectedStaff.id}`, { tenantId: tenant.id }));
      setStaffAllowances(list);
      setIsAssignModalOpen(false);
      toast({ variant: 'success', title: 'Indemnité assignée avec succès' });
    } catch (err) {
      console.error('Error assigning allowance:', err);
      toast({ variant: 'error', title: 'Erreur: assignation de l\'indemnité' });
    } finally {
      setSavingAssign(false);
    }
  }

  // ⭐ Modification du montant d'une indemnité — possible À TOUT MOMENT.
  //    Le montant est répercuté sur la fiche de paie dès la prochaine génération.
  async function handleUpdateAllowance(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id || !editingAllowance?.id) return;
    try {
      setSavingEdit(true);
      await hrFetch(hrUrl(`allowances/assignments/${editingAllowance.id}`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: {
          amount: parseFloat(editAmount),
          effectiveDate: editStartDate ? new Date(editStartDate).toISOString() : undefined,
          endDate: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        },
      });
      const list = await hrFetch<any[]>(hrUrl(`allowances/staff/${selectedStaff.id}`, { tenantId: tenant.id }));
      setStaffAllowances(list);
      setEditingAllowance(null);
      toast({ variant: 'success', title: 'Montant de l\'indemnité mis à jour' });
    } catch (err) {
      console.error('Error updating allowance:', err);
      toast({ variant: 'error', title: 'Erreur: mise à jour de l\'indemnité' });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleRemoveAssignment(id: string) {
    const ok = await confirmDialog.danger('Cette indemnité sera définitivement supprimée du collaborateur.', 'Supprimer l\'indemnité');
    if (!ok) return;
    try {
      await hrFetch(hrUrl(`allowances/assignments/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      // Refresh list
      const list = await hrFetch<any[]>(hrUrl(`allowances/staff/${selectedStaff.id}`, { tenantId: tenant.id }));
      setStaffAllowances(list);
      toast({ variant: 'success', title: 'Indemnité supprimée avec succès' });
    } catch (err) {
      console.error('Error removing assignment:', err);
      toast({ variant: 'error', title: 'Erreur: suppression de l\'indemnité' });
    }
  }

  const totalMonthly = staffAllowances.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // ⭐ 2026-11-26 — Séparation par niveau (retour promoteur) : la liste des
  //    collaborateurs (indemnités) sépare Maternelle & Primaire / Secondaire.
  const secondaryEnabled = useSecondaryLevelEnabled();
  const staffLevelGroups = secondaryEnabled
    ? splitByLevel(staffList, staffLevelCategory)
    : null;

  /** Bouton de sélection d'un collaborateur (liste latérale). */
  const renderStaffButton = (member: any) => (
    <button
      key={member.id}
      onClick={() => setSelectedStaff(member)}
      className={cn(
        'w-full flex items-center justify-between p-3 rounded-lg text-left transition-all',
        selectedStaff?.id === member.id ? 'bg-slate-50 border border-slate-300' : 'hover:bg-slate-50 border border-transparent'
      )}
    >
      <div className="flex items-center gap-3">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={`${member.firstName} ${member.lastName}`} className="w-8 h-8 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
            {member.firstName?.[0]}{member.lastName?.[0]}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-slate-900">{member.firstName} {member.lastName}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{member.staffCode}</p>
        </div>
      </div>
    </button>
  );

  return (
    <>
    {confirmDialog.dialog}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* Sidebar - Staff List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <h4 className="font-bold text-slate-900 text-sm">Collaborateurs</h4>
          <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto space-y-1">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-lg mt-1" />)
            ) : staffList.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Aucun collaborateur</p>
            ) : staffLevelGroups ? (
              <div className="space-y-4">
                {([
                  ['MATERNEL_PRIMAIRE', staffLevelGroups.maternelPrimaire],
                  ['SECONDAIRE', staffLevelGroups.secondaire],
                ] as const).map(([category, members]) => (
                  <div key={category} className="space-y-1">
                    <LevelSectionHeader category={category} count={members.length} className="my-1" />
                    {members.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">Aucun personnel {category === 'SECONDAIRE' ? 'du secondaire' : 'maternelle & primaire'}.</p>
                    ) : (
                      members.map(renderStaffButton)
                    )}
                  </div>
                ))}
              </div>
            ) : (
              staffList.map(renderStaffButton)
            )}
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="lg:col-span-8 space-y-6">
        {selectedStaff ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Indemnités de {selectedStaff.firstName} {selectedStaff.lastName}
                </h3>
                <p className="text-sm text-slate-500">{selectedStaff.position} · {selectedStaff.staffCode}</p>
              </div>
              <button
                onClick={() => {
                  setAssignType(allowanceTypes[0]?.id || '');
                  // No default amount — school enters it manually
                  setAssignAmount('');
                  setAssignStartDate(new Date().toISOString().split('T')[0]);
                  setAssignEndDate('');
                  setIsAssignModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                style={{ backgroundColor: PRIMARY }}
              >
                <Plus className="h-4 w-4" /> Assigner une indemnité
              </button>
            </div>

            {/* List of assigned allowances */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">Indemnités Actives</h4>
                {staffAllowances.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Total mensuel : {formatCurrency(totalMonthly)}
                  </span>
                )}
              </div>
              <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden">
                {staffAllowances.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Aucune indemnité assignée à ce collaborateur
                  </div>
                ) : (
                  staffAllowances.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <Award className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{item.allowanceType?.name}</p>
                          <p className="text-xs text-slate-500">Code: {item.allowanceType?.code} · Depuis le {new Date(item.startDate || item.effectiveDate).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-base font-bold text-slate-900">{formatCurrency(item.amount)}</p>
                        <button
                          onClick={() => {
                            setEditingAllowance(item);
                            setEditAmount(String(item.amount ?? ''));
                            setEditStartDate((item.startDate || item.effectiveDate || new Date()).toISOString().split('T')[0]);
                            setEditEndDate(item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '');
                          }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-[#1A2BA6] transition-colors"
                          title="Modifier le montant"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveAssignment(item.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm">
            <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Aucun collaborateur disponible</h3>
          </div>
        )}
      </div>

      {/* Modal - Assign */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base">Assigner une indemnité</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleAssignAllowance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type d'indemnité</label>
                {allowanceTypes.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                    <strong>Chargement de la liste complète des types…</strong><br />
                    Réessayez dans un instant — le catalogue est provisionné automatiquement par le serveur.
                  </div>
                ) : (
                  <select
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                    value={assignType}
                    onChange={(e) => setAssignType(e.target.value)}
                    required
                  >
                    {allowanceTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Montant (F CFA) — à définir</label>
                <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignAmount} onChange={(e) => setAssignAmount(e.target.value)} placeholder="Saisir le montant" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date d'effet</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date de fin (Optionnel)</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignEndDate} onChange={(e) => setAssignEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">Annuler</button>
                <button type="submit" disabled={savingAssign || !assignType} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: PRIMARY }}>
                  {savingAssign ? 'Assignation...' : 'Assigner'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal - Edition du montant (à tout moment) */}
      {editingAllowance && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base">Modifier l'indemnité</h3>
              <button onClick={() => setEditingAllowance(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-sm font-bold text-slate-800">{editingAllowance.allowanceType?.name}</p>
              <p className="text-[11px] text-slate-500">
                {selectedStaff?.firstName} {selectedStaff?.lastName} · Montant actuel : {formatCurrency(editingAllowance.amount)}
              </p>
            </div>
            <form onSubmit={handleUpdateAllowance} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nouveau montant (F CFA)</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  placeholder="Saisir le nouveau montant"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Modifiable à tout moment — le nouveau montant s'applique dès la prochaine génération de la paie.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date d'effet</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date de fin (Optionnel)</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setEditingAllowance(null)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">Annuler</button>
                <button type="submit" disabled={savingEdit} className="px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: PRIMARY }}>
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
    </>
  );
}
