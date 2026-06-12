/**
 * ============================================================================
 * CONTRACT TERMINATION MODAL (Résiliation de contrat)
 * ============================================================================
 * Professional contract termination workflow with:
 * - Termination reason & date
 * - Automatic staff status update option
 * - Termination type selection
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  X, AlertTriangle, Loader2, FileX2, Clock, User,
} from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';
const DANGER = '#DC2626';

const CONTRACT_TERMINATION_TYPES: Record<string, { label: string; description: string }> = {
  RESIGNATION:      { label: 'Démission',              description: 'Le collaborateur démissionne' },
  DISMISSAL:        { label: 'Licenciement',            description: 'Licenciement à l\'initiative de l\'employeur' },
  MUTUAL_AGREEMENT: { label: 'Rupture conventionnelle', description: 'Accord mutuel de résiliation' },
  END_OF_CONTRACT:  { label: 'Fin de contrat',          description: 'Le contrat arrive à son terme' },
  OTHER:            { label: 'Autre',                   description: 'Autre motif de résiliation' },
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

interface ContractTerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: {
    id: string;
    contractType: string;
    startDate: string;
    endDate?: string;
    baseSalary: number;
    staff?: {
      id: string;
      firstName: string;
      lastName: string;
      position?: string;
    };
  } | null;
  tenantId: string;
}

export function ContractTerminationModal({
  isOpen,
  onClose,
  onSuccess,
  contract,
  tenantId,
}: ContractTerminationModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const [form, setForm] = useState({
    reason: '',
    terminatedAt: new Date().toISOString().split('T')[0],
    terminationType: 'RESIGNATION',
    updateStaffStatus: true,
  });

  if (!isOpen || !contract) return null;

  const staffName = contract.staff
    ? `${contract.staff.firstName} ${contract.staff.lastName}`
    : 'N/A';

  const selectedType = CONTRACT_TERMINATION_TYPES[form.terminationType];

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await hrFetch<any>(hrUrl(`contracts/${contract.id}/terminate`, { tenantId }), {
        method: 'PUT',
        body: {
          reason: form.reason,
          terminatedAt: form.terminatedAt ? new Date(form.terminatedAt).toISOString() : undefined,
          terminationType: form.terminationType,
          updateStaffStatus: form.updateStaffStatus,
        },
      });

      toast({
        variant: 'success',
        title: `Contrat résilié avec succès`,
      });
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: err.message || 'Erreur lors de la résiliation du contrat',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setForm({
      reason: '',
      terminatedAt: new Date().toISOString().split('T')[0],
      terminationType: 'RESIGNATION',
      updateStaffStatus: true,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: DANGER }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2"><FileX2 className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-bold">Résiliation de contrat</h3>
              <p className="text-xs text-white/70">
                {contract.contractType} — {staffName}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'form' ? (
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Contract Info Summary */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-sm font-bold text-slate-800">{staffName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="font-semibold">{contract.contractType}</span>
                <span>
                  {new Date(contract.startDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                  {' → '}
                  {contract.endDate
                    ? new Date(contract.endDate).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
                    : 'Indéfini'}
                </span>
              </div>
            </div>

            {/* Termination Type */}
            <div>
              <label className={labelClass}>Type de résiliation *</label>
              <div className="space-y-2">
                {Object.entries(CONTRACT_TERMINATION_TYPES).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, terminationType: key })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all text-sm flex items-center gap-3 ${
                      form.terminationType === key
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${form.terminationType === key ? 'bg-red-500' : 'bg-slate-300'}`} />
                    <div>
                      <span className="font-bold text-slate-800">{cfg.label}</span>
                      <p className="text-[10px] text-slate-500">{cfg.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Date & Reason */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date de résiliation</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.terminatedAt}
                  onChange={(e) => setForm({ ...form, terminatedAt: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Motif *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Raison de la résiliation…"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Update Staff Status Toggle */}
            <label className="flex items-start gap-3 p-3 rounded-xl border-2 border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition">
              <input
                type="checkbox"
                checked={form.updateStaffStatus}
                onChange={(e) => setForm({ ...form, updateStaffStatus: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-[#1A2BA6] focus:ring-[#1A2BA6] mt-0.5"
              />
              <div>
                <span className="text-sm font-bold text-slate-800">Mettre à jour le statut du collaborateur</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Si c&apos;est le dernier contrat actif, le collaborateur sera automatiquement marqué comme inactif.
                </p>
              </div>
            </label>
          </div>
        ) : (
          /* Confirmation Step */
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800">Confirmer la résiliation</h4>
                <p className="text-sm text-red-700 mt-1">
                  Vous allez résilier le contrat <strong>{contract.contractType}</strong> de{' '}
                  <strong>{staffName}</strong> pour motif{' '}
                  <strong>{selectedType?.label}</strong>.
                </p>
                {form.updateStaffStatus && (
                  <p className="text-xs text-red-600 mt-2">
                    Le statut du collaborateur sera mis à jour automatiquement si c&apos;est son dernier contrat actif.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type</p>
                <p className="text-sm font-bold text-slate-900">{selectedType?.label}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Motif</p>
                <p className="text-sm font-bold text-slate-900">{form.reason || 'Non précisé'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
          >
            Annuler
          </button>
          <div className="flex gap-3">
            {step === 'form' ? (
              <button
                type="button"
                disabled={!form.reason}
                onClick={() => setStep('confirm')}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: DANGER }}
              >
                <AlertTriangle className="h-4 w-4" /> Vérifier et confirmer
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: DANGER }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileX2 className="h-4 w-4" />}
                  Confirmer la résiliation
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
