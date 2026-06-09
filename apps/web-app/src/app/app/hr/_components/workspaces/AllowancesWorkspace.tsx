'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Search, DollarSign, Edit, Trash2, Award, User, Layers, Check, X, AlertCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
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
  
  // Modal states
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  // Form states - Type
  const [typeName, setTypeName] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [typeAmount, setTypeAmount] = useState('');
  const [typeCategory, setTypeCategory] = useState('HOUSING'); // HOUSING, TRANSPORT, MEAL, etc.
  const [savingType, setSavingType] = useState(false);

  // Form states - Assignment
  const [assignType, setAssignType] = useState('');
  const [assignAmount, setAssignAmount] = useState('');
  const [assignStartDate, setAssignStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignEndDate, setAssignEndDate] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!tenant?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Load allowance types
        const types = await hrFetch<any[]>(hrUrl('allowances/types', { tenantId: tenant.id }));
        setAllowanceTypes(types);

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

  async function handleCreateType(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      setSavingType(true);
      await hrFetch(hrUrl('allowances/types', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          name: typeName,
          code: typeCode,
          description: typeDescription,
          amount: parseFloat(typeAmount) || undefined,
          defaultAmount: parseFloat(typeAmount) || undefined,
          category: typeCategory,
        },
      });
      // Refresh types
      const types = await hrFetch<any[]>(hrUrl('allowances/types', { tenantId: tenant.id }));
      setAllowanceTypes(types);
      setIsTypeModalOpen(false);
      // Reset form
      setTypeName('');
      setTypeCode('');
      setTypeDescription('');
      setTypeAmount('');
      toast({ variant: 'success', title: 'Type d\'indemnité créé avec succès' });
    } catch (err) {
      console.error('Error creating allowance type:', err);
      toast({ variant: 'error', title: 'Erreur: création du type d\'indemnité' });
    } finally {
      setSavingType(false);
    }
  }

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

  return (
    <>
    {confirmDialog.dialog}
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
      {/* Sidebar - Staff List */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-900 text-sm">Collaborateurs</h4>
            <button
              onClick={() => setIsTypeModalOpen(true)}
              className="text-xs font-bold text-[#1A2BA6] hover:underline flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> Gérer les types
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[450px] overflow-y-auto space-y-1">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-50 animate-pulse rounded-lg mt-1" />)
            ) : staffList.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Aucun collaborateur</p>
            ) : (
              staffList.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg text-left transition-all',
                    selectedStaff?.id === member.id ? 'bg-slate-50 border border-slate-300' : 'hover:bg-slate-50 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                      {member.firstName?.[0]}{member.lastName?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{member.firstName} {member.lastName}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{member.staffCode}</p>
                    </div>
                  </div>
                </button>
              ))
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
                  if (allowanceTypes.length === 0) {
                    toast({ variant: 'warning', title: 'Veuillez d\'abord ajouter des types d\'indemnités via "Gérer les types".' });
                    return;
                  }
                  setAssignType(allowanceTypes[0].id);
                  setAssignAmount(allowanceTypes[0].defaultAmount.toString());
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
              <h4 className="font-bold text-slate-900 text-sm">Indemnités Actives</h4>
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
                          <p className="text-xs text-slate-500">Code: {item.allowanceType?.code} · Depuis le {new Date(item.startDate).toLocaleDateString('fr-FR')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-base font-bold text-slate-900">{Number(item.amount).toLocaleString('fr-FR')} FCFA</p>
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

      {/* Modal - Create Type */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-900 text-base">Nouveau type d'indemnité</h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleCreateType} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom</label>
                <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeName} onChange={(e) => setTypeName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Code</label>
                  <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeCode} onChange={(e) => setTypeCode(e.target.value)} placeholder="Ex: LOGEMENT" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Montant par défaut</label>
                  <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={typeAmount} onChange={(e) => setTypeAmount(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description</label>
                <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm h-20" value={typeDescription} onChange={(e) => setTypeDescription(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsTypeModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">Annuler</button>
                <button type="submit" disabled={savingType} className="px-4 py-2 text-white rounded-lg text-sm font-semibold" style={{ backgroundColor: PRIMARY }}>
                  {savingType ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

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
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-[#1A2BA6]"
                  value={assignType}
                  onChange={(e) => {
                    setAssignType(e.target.value);
                    const selected = allowanceTypes.find(t => t.id === e.target.value);
                    if (selected) setAssignAmount(selected.defaultAmount.toString());
                  }}
                >
                  {allowanceTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.defaultAmount} FCFA)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Montant Spécifique (FCFA)</label>
                <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignAmount} onChange={(e) => setAssignAmount(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date d'effet</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date de fin (Optionnel)</label>
                  <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={assignEndDate} onChange={(e) => setAssignEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm">Annuler</button>
                <button type="submit" disabled={savingAssign} className="px-4 py-2 text-white rounded-lg text-sm font-semibold" style={{ backgroundColor: PRIMARY }}>
                  {savingAssign ? 'Assignation...' : 'Assigner'}
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
