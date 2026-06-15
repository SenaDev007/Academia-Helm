/**
 * ============================================================================
 * STAFF TERMINATION MODAL (Débauche)
 * ============================================================================
 * Professional employee departure workflow with:
 * - 8 termination types (Démission, Licenciement, Rupture conventionnelle, etc.)
 * - Exit checklist (entretien de sortie, matériel, documents, solde)
 * - Preavis & last working date tracking
 * - Authorization & letter reference
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import {
  X, AlertTriangle, Loader2, CheckCircle2, UserX,
  FileText, Shield, Package, DollarSign, Clock,
} from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

const PRIMARY = '#1A2BA6';
const DANGER = '#DC2626';

const TERMINATION_TYPES: Record<string, { label: string; description: string; color: string }> = {
  RESIGNATION:       { label: 'Démission',                description: 'Le collaborateur quitte volontairement', color: '#F59E0B' },
  DISMISSAL:         { label: 'Licenciement',              description: 'Rupture à l\'initiative de l\'employeur', color: '#EF4444' },
  MUTUAL_AGREEMENT:  { label: 'Rupture conventionnelle',   description: 'Accord mutuel des deux parties', color: '#8B5CF6' },
  END_OF_CONTRACT:   { label: 'Fin de contrat',            description: 'Arrivée à échéance du CDD/stage', color: '#6B7280' },
  RETIREMENT:        { label: 'Retraite',                  description: 'Départ à la retraite', color: '#10B981' },
  DEATH:             { label: 'Décès',                     description: 'Décès du collaborateur', color: '#1F2937' },
  ABANDONMENT:       { label: 'Abandon de poste',          description: 'Départ sans préavis ni justification', color: '#F97316' },
  OTHER:             { label: 'Autre',                     description: 'Autre motif de départ', color: '#64748B' },
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

interface StaffTerminationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staff: {
    id: string;
    firstName: string;
    lastName: string;
    position?: string;
    employeeNumber?: string;
    tenantMatricule?: string;
    globalMatricule?: string;
    status: string;
  } | null;
  tenantId: string;
}

export function StaffTerminationModal({
  isOpen,
  onClose,
  onSuccess,
  staff,
  tenantId,
}: StaffTerminationModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const [form, setForm] = useState({
    terminationType: 'RESIGNATION',
    effectiveDate: new Date().toISOString().split('T')[0],
    lastWorkingDate: '',
    noticePeriodDays: '',
    reason: '',
    detailedReason: '',
    exitInterviewConducted: false,
    exitInterviewNotes: '',
    equipmentReturned: false,
    exitDocumentsProvided: false,
    finalSettlementPaid: false,
    authorizedBy: '',
    terminationLetterRef: '',
  });

  if (!isOpen || !staff) return null;

  const selectedType = TERMINATION_TYPES[form.terminationType];

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const body: any = {
        terminationType: form.terminationType,
        effectiveDate: new Date(form.effectiveDate).toISOString(),
        reason: form.reason || undefined,
        detailedReason: form.detailedReason || undefined,
        exitInterviewConducted: form.exitInterviewConducted,
        exitInterviewNotes: form.exitInterviewNotes || undefined,
        equipmentReturned: form.equipmentReturned,
        exitDocumentsProvided: form.exitDocumentsProvided,
        finalSettlementPaid: form.finalSettlementPaid,
        authorizedBy: form.authorizedBy || undefined,
        terminationLetterRef: form.terminationLetterRef || undefined,
      };
      if (form.lastWorkingDate) body.lastWorkingDate = new Date(form.lastWorkingDate).toISOString();
      if (form.noticePeriodDays) body.noticePeriodDays = parseInt(form.noticePeriodDays, 10);

      await hrFetch<any>(hrUrl(`staff/${staff.id}/terminate`, { tenantId }), {
        method: 'POST',
        body,
      });

      toast({
        variant: 'success',
        title: `Débauche de ${staff.firstName} ${staff.lastName} enregistrée avec succès`,
      });
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      toast({
        variant: 'error',
        title: err.message || 'Erreur lors de la débauche',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('form');
    setForm({
      terminationType: 'RESIGNATION',
      effectiveDate: new Date().toISOString().split('T')[0],
      lastWorkingDate: '',
      noticePeriodDays: '',
      reason: '',
      detailedReason: '',
      exitInterviewConducted: false,
      exitInterviewNotes: '',
      equipmentReturned: false,
      exitDocumentsProvided: false,
      finalSettlementPaid: false,
      authorizedBy: '',
      terminationLetterRef: '',
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const isFormValid = form.terminationType && form.effectiveDate;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: DANGER }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2"><UserX className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-bold">Débauche / Départ du collaborateur</h3>
              <p className="text-xs text-white/70">{staff.firstName} {staff.lastName} — {staff.position || staff.employeeNumber || 'N/A'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'form' ? (
          <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
            {/* Termination Type */}
            <div>
              <label className={labelClass}>Type de départ *</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TERMINATION_TYPES).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, terminationType: key })}
                    className={`text-left p-3 rounded-xl border-2 transition-all text-sm ${
                      form.terminationType === key
                        ? 'border-[#DC2626] bg-red-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="font-bold" style={{ color: form.terminationType === key ? DANGER : cfg.color }}>
                      {cfg.label}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">{cfg.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates & Notice */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Date d'effet *</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Dernier jour travaillé</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.lastWorkingDate}
                  onChange={(e) => setForm({ ...form, lastWorkingDate: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Préavis (jours)</label>
                <input
                  type="number"
                  className={inputClass}
                  placeholder="30"
                  value={form.noticePeriodDays}
                  onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })}
                  min={0}
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className={labelClass}>Motif du départ</label>
              <input
                type="text"
                className={inputClass}
                placeholder="Raison principale du départ…"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Motif détaillé</label>
              <textarea
                className={inputClass + ' min-h-[80px] resize-y'}
                placeholder="Description détaillée des circonstances du départ…"
                value={form.detailedReason}
                onChange={(e) => setForm({ ...form, detailedReason: e.target.value })}
              />
            </div>

            {/* Exit Checklist */}
            <div>
              <label className={labelClass + ' flex items-center gap-2'}>
                <Shield className="h-3.5 w-3.5" /> Checklist de sortie
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'exitInterviewConducted', label: 'Entretien de sortie effectué', icon: FileText },
                  { key: 'equipmentReturned', label: 'Matériel restitué', icon: Package },
                  { key: 'exitDocumentsProvided', label: 'Documents de sortie fournis', icon: FileText },
                  { key: 'finalSettlementPaid', label: 'Solde de tout compte réglé', icon: DollarSign },
                ].map(({ key, label, icon: Icon }) => (
                  <label
                    key={key}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      (form as any)[key]
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <Icon className={`h-4 w-4 ${(form as any)[key] ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="text-xs font-semibold text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Exit Interview Notes */}
            {form.exitInterviewConducted && (
              <div>
                <label className={labelClass}>Notes de l'entretien de sortie</label>
                <textarea
                  className={inputClass + ' min-h-[60px] resize-y'}
                  placeholder="Compte-rendu de l'entretien de sortie…"
                  value={form.exitInterviewNotes}
                  onChange={(e) => setForm({ ...form, exitInterviewNotes: e.target.value })}
                />
              </div>
            )}

            {/* Authorization & Reference */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Autorisé par</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Nom du responsable…"
                  value={form.authorizedBy}
                  onChange={(e) => setForm({ ...form, authorizedBy: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Réf. lettre de débauche</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="REF-DEB-2024-001"
                  value={form.terminationLetterRef}
                  onChange={(e) => setForm({ ...form, terminationLetterRef: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Confirmation Step */
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-800">Confirmer la débauche</h4>
                <p className="text-sm text-red-700 mt-1">
                  Vous êtes sur le point de procéder au départ de{' '}
                  <strong>{staff.firstName} {staff.lastName}</strong> pour le motif{' '}
                  <strong>{selectedType?.label}</strong> avec effet au{' '}
                  <strong>{new Date(form.effectiveDate).toLocaleDateString('fr-FR')}</strong>.
                </p>
                <p className="text-xs text-red-600 mt-2">
                  Cette action résiliera automatiquement tous les contrats actifs du collaborateur et mettra
                  son statut à INACTIF. Cette opération est réversible via la réactivation.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Type</p>
                <p className="text-sm font-bold" style={{ color: selectedType?.color }}>{selectedType?.label}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date d'effet</p>
                <p className="text-sm font-bold text-slate-900">{new Date(form.effectiveDate).toLocaleDateString('fr-FR')}</p>
              </div>
              {form.reason && (
                <div className="col-span-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Motif</p>
                  <p className="text-sm font-bold text-slate-900">{form.reason}</p>
                </div>
              )}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Checklist</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {form.exitInterviewConducted && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">Entretien</span>}
                  {form.equipmentReturned && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">Matériel</span>}
                  {form.exitDocumentsProvided && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">Documents</span>}
                  {form.finalSettlementPaid && <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded">Solde</span>}
                </div>
              </div>
              {form.authorizedBy && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Autorisé par</p>
                  <p className="text-sm font-bold text-slate-900">{form.authorizedBy}</p>
                </div>
              )}
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
                disabled={!isFormValid}
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
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  Confirmer la débauche
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
