'use client';

import { useState, useEffect } from 'react';
import { X, Pencil, Loader2, Calendar, DollarSign, Briefcase, FileCheck, AlertCircle } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';

const PRIMARY = '#1A2BA6';

const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI — Contrat à Durée Indéterminée' },
  { value: 'CDD', label: 'CDD — Contrat à Durée Déterminée' },
  { value: 'VACATAIRE', label: 'Vacataire — Contrat de Vacation' },
  { value: 'STAGE', label: 'Stage — Convention de Stage' },
  { value: 'CONSULTANT', label: 'Consultant — Contrat de Consultation' },
];

const PAYMENT_MODES = [
  { value: 'BANK', label: 'Virement bancaire' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
];

interface ContractEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: any;
}

export function ContractEditModal({ isOpen, onClose, onSuccess, contract }: ContractEditModalProps) {
  const { tenant } = useModuleContext();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    contractType: '',
    startDate: '',
    endDate: '',
    baseSalary: '',
    paymentMode: '',
  });

  // Pre-fill form when contract changes or modal opens
  useEffect(() => {
    if (contract && isOpen) {
      // Handle Prisma Decimal serialization (can be string, number, or object)
      const rawSalary = contract.baseSalary;
      let salaryStr = '';
      if (rawSalary != null) {
        if (typeof rawSalary === 'object' && rawSalary.$numberDecimal) {
          salaryStr = rawSalary.$numberDecimal;
        } else {
          salaryStr = String(rawSalary);
        }
      }

      // Handle dates (can be ISO string or Date object)
      const formatDate = (d: any): string => {
        if (!d) return '';
        try {
          const date = typeof d === 'string' ? new Date(d) : d;
          return date.toISOString().split('T')[0];
        } catch {
          return '';
        }
      };

      setFormData({
        contractType: contract.contractType || '',
        startDate: formatDate(contract.startDate),
        endDate: formatDate(contract.endDate),
        baseSalary: salaryStr,
        paymentMode: contract.paymentMode || '',
      });
    }
  }, [contract, isOpen]);

  if (!isOpen) return null;

  const isSigned = !!contract?.signedAt;
  if (isSigned) return null;

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.contractType) {
      toast({ variant: 'error', title: 'Veuillez sélectionner un type de contrat.' });
      return;
    }
    if (!formData.startDate) {
      toast({ variant: 'error', title: 'Veuillez renseigner la date de prise d\'effet.' });
      return;
    }
    if (!formData.baseSalary || isNaN(parseFloat(formData.baseSalary)) || parseFloat(formData.baseSalary) < 0) {
      toast({ variant: 'error', title: 'Veuillez renseigner un salaire de base valide.' });
      return;
    }
    if (!formData.paymentMode) {
      toast({ variant: 'error', title: 'Veuillez sélectionner un mode de règlement.' });
      return;
    }

    try {
      setLoading(true);
      await hrFetch(hrUrl(`contracts/${contract.id}`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: {
          contractType: formData.contractType,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
          baseSalary: parseFloat(formData.baseSalary),
          paymentMode: formData.paymentMode,
        },
      });
      toast({ variant: 'success', title: 'Contrat modifié avec succès !' });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast({ variant: 'error', title: 'Erreur lors de la modification du contrat.' });
    } finally {
      setLoading(false);
    }
  }

  const isCdi = formData.contractType === 'CDI';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 text-white" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Modifier le Contrat</h3>
              <p className="text-[10px] text-white/70">
                {contract?.staff?.firstName} {contract?.staff?.lastName} — {contract?.contractType}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Notice */}
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-800 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>
              Ce contrat n&apos;a pas encore été signé. Vous pouvez modifier ses termes librement.
              Après signature, toute modification nécessitera un avenant.
            </p>
          </div>

          {/* Contract Type */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              <span className="inline-flex items-center gap-1"><FileCheck className="h-3 w-3" /> Type de contrat</span>
            </label>
            <select
              value={formData.contractType}
              onChange={(e) => updateField('contractType', e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 bg-white appearance-none cursor-pointer"
            >
              <option value="" disabled>Sélectionner un type</option>
              {CONTRACT_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>

          {/* Date row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Date de prise d&apos;effet</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => updateField('startDate', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
            </div>
            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Date de fin {isCdi && <span className="normal-case text-slate-400">(optionnelle)</span>}</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
                placeholder={isCdi ? 'Durée indéterminée' : ''}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              />
              {isCdi && !formData.endDate && (
                <p className="text-[10px] text-slate-400 mt-1">CDI : pas de date de fin requise</p>
              )}
            </div>
          </div>

          {/* Salary + Payment Mode */}
          <div className="grid grid-cols-2 gap-4">
            {/* Base Salary */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" /> Salaire de base</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.baseSalary}
                  onChange={(e) => updateField('baseSalary', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-14 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">FCFA</span>
              </div>
            </div>
            {/* Payment Mode */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" /> Mode de règlement</span>
              </label>
              <select
                value={formData.paymentMode}
                onChange={(e) => updateField('paymentMode', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 bg-white appearance-none cursor-pointer"
              >
                <option value="" disabled>Sélectionner</option>
                {PAYMENT_MODES.map((pm) => (
                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
              ) : (
                <><Pencil className="h-4 w-4" /> Enregistrer</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
