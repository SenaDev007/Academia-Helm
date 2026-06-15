'use client';

import { useState } from 'react';
import { X, UserX, ArrowLeft, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { OffboardingState, INITIAL_OFFBOARDING_STATE, TERMINATION_TYPES, OFFBOARDING_STEPS } from './types';
import { SignatureCanvas } from '../onboarding/components/SignatureCanvas';

interface OffboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  staffId: string;
  staffName: string;
  staffPosition: string;
}

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

export function OffboardingWizard({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  staffId,
  staffName,
  staffPosition,
}: OffboardingWizardProps) {
  const [state, setState] = useState<OffboardingState>({ ...INITIAL_OFFBOARDING_STATE });
  const [savingStep, setSavingStep] = useState(false);

  // Signature state
  const [employerName, setEmployerName] = useState('');
  const [employerRole, setEmployerRole] = useState('Directeur');
  const [employerConsent, setEmployerConsent] = useState(false);
  const [employerSigData, setEmployerSigData] = useState<string | null>(null);
  const [signingEmployer, setSigningEmployer] = useState(false);

  const [employeeConsent, setEmployeeConsent] = useState(false);
  const [employeeSigData, setEmployeeSigData] = useState<string | null>(null);
  const [signingEmployee, setSigningEmployee] = useState(false);

  if (!isOpen) return null;

  const update = <K extends keyof OffboardingState>(key: K, value: OffboardingState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const selectedType = TERMINATION_TYPES.find((t) => t.key === state.terminationType);

  // ─── Step Validation ─────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 1:
        return !!(state.terminationType && state.effectiveDate);
      case 2:
        return !!state.reason;
      case 3:
        return true; // Checklist is optional
      case 4:
        return state.generatedDocuments.letter; // At least the letter must be generated
      case 5:
        return state.employerSigned && state.employeeSigned;
      case 6:
        return true;
      default:
        return false;
    }
  };

  // ─── Step Actions ────────────────────────────────────────────────
  const handleTerminate = async () => {
    try {
      setSavingStep(true);
      await hrFetch(hrUrl(`staff/${staffId}/terminate`, { tenantId }), {
        method: 'POST',
        body: {
          terminationType: state.terminationType,
          terminationDetails: {
            reason: state.reason,
            detailedReason: state.detailedReason,
            exitInterviewConducted: state.exitInterviewConducted,
            exitInterviewNotes: state.exitInterviewNotes,
            equipmentReturned: state.equipmentReturned,
            exitDocumentsProvided: state.exitDocumentsProvided,
            finalSettlementPaid: state.finalSettlementPaid,
            authorizedBy: state.authorizedBy,
            terminationLetterRef: state.terminationLetterRef,
          },
          noticePeriodDays: state.noticePeriodDays || undefined,
          lastWorkingDate: state.lastWorkingDate || undefined,
        },
      });
      update('terminated', true);
      toast({ variant: 'success', title: 'Personnel débauché avec succès' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur lors de la débauche', description: err?.message });
    } finally {
      setSavingStep(false);
    }
  };

  const handleGenerateDoc = async (docType: 'letter' | 'certificate' | 'settlement' | 'attestation') => {
    try {
      await hrFetch(hrUrl(`staff/${staffId}/termination/generate-pdf`, { tenantId, type: docType }), {
        method: 'POST',
      });
      setState((prev) => ({
        ...prev,
        generatedDocuments: { ...prev.generatedDocuments, [docType]: true },
      }));
      toast({ variant: 'success', title: `Document "${docType}" généré` });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de génération', description: err?.message });
    }
  };

  const handleEmployerSign = async () => {
    if (!employerSigData || !employerName || !employerConsent) return;
    try {
      setSigningEmployer(true);
      await hrFetch(hrUrl(`staff/${staffId}/termination/sign-document`, { tenantId }), {
        method: 'POST',
        body: {
          signatureData: employerSigData,
          signerName: employerName,
          signerRole: 'EMPLOYEUR',
          documentType: 'termination',
        },
      });
      update('employerSigned', true);
      toast({ variant: 'success', title: "Signature de l'employeur enregistrée" });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de signature', description: err?.message });
    } finally {
      setSigningEmployer(false);
    }
  };

  const handleEmployeeSign = async () => {
    if (!employeeSigData || !employeeConsent) return;
    try {
      setSigningEmployee(true);
      await hrFetch(hrUrl(`staff/${staffId}/termination/sign-document`, { tenantId }), {
        method: 'POST',
        body: {
          signatureData: employeeSigData,
          signerName: staffName,
          signerRole: 'EMPLOYE',
          documentType: 'termination',
        },
      });
      update('employeeSigned', true);
      toast({ variant: 'success', title: "Signature de l'employé enregistrée" });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de signature', description: err?.message });
    } finally {
      setSigningEmployee(false);
    }
  };

  const handleNext = () => {
    if (state.currentStep === 1) {
      // Auto-terminate after step 1+2 data is confirmed (happens at step 3)
    }
    if (state.currentStep < 6) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const handlePrev = () => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#1d4fa5] focus:ring-2 focus:ring-[#1d4fa5]/10 transition';
  const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 text-white shrink-0" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #7f1d1d 100%)` }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2"><UserX className="h-5 w-5" /></div>
            <div>
              <h3 className="text-base font-bold">Processus de Débauche</h3>
              <p className="text-xs text-white/70">{staffName} — {staffPosition}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 font-semibold">Étape {state.currentStep}/6</span>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 overflow-x-auto">
          {OFFBOARDING_STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = state.currentStep === stepNum;
            const isCompleted = state.currentStep > stepNum;
            return (
              <div key={stepNum} className="flex items-center gap-1.5 shrink-0">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                  style={{ backgroundColor: isCompleted ? '#059669' : isActive ? '#dc2626' : '#E2E8F0', color: isCompleted || isActive ? '#FFF' : '#94A3B8' }}>
                  {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : stepNum}
                </div>
                <span className={`text-[10px] font-bold hidden lg:inline ${isActive ? 'text-slate-800' : isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>{label}</span>
                {idx < OFFBOARDING_STEPS.length - 1 && <div className="w-4 h-[2px] rounded-full" style={{ backgroundColor: state.currentStep > stepNum ? '#059669' : '#E2E8F0' }} />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div key={state.currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

              {/* ── Step 1: Type & Dates ──────────────────────────── */}
              {state.currentStep === 1 && (
                <div className="space-y-5">
                  <h4 className="text-sm font-bold text-slate-800">Type de départ & Dates</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {TERMINATION_TYPES.map((t) => (
                      <button key={t.key} type="button" onClick={() => update('terminationType', t.key)}
                        className={`p-3 rounded-xl border-2 text-left transition ${state.terminationType === t.key ? 'border-slate-800 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          <span className="text-xs font-bold text-slate-800">{t.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-500">{t.description}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Date d&apos;effet *</label>
                      <input required type="date" className={inputClass} value={state.effectiveDate} onChange={(e) => update('effectiveDate', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Dernier jour travaillé</label>
                      <input type="date" className={inputClass} value={state.lastWorkingDate} onChange={(e) => update('lastWorkingDate', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Préavis (jours)</label>
                      <input type="number" min="0" className={inputClass} value={state.noticePeriodDays} onChange={(e) => update('noticePeriodDays', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 2: Reason & Details ──────────────────────── */}
              {state.currentStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Motif & Détails du départ</h4>
                  <div>
                    <label className={labelClass}>Motif principal *</label>
                    <input required type="text" placeholder="Ex : Raison personnelle, Restructuration..." className={inputClass} value={state.reason} onChange={(e) => update('reason', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Description détaillée</label>
                    <textarea placeholder="Détails complémentaires sur le motif du départ..." className={inputClass + ' min-h-[80px]'} value={state.detailedReason} onChange={(e) => update('detailedReason', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Autorisé par</label>
                      <input type="text" placeholder="Nom du responsable" className={inputClass} value={state.authorizedBy} onChange={(e) => update('authorizedBy', e.target.value)} />
                    </div>
                    <div>
                      <label className={labelClass}>Réf. lettre de débauche</label>
                      <input type="text" placeholder="REF-DEB-2025-001" className={inputClass} value={state.terminationLetterRef} onChange={(e) => update('terminationLetterRef', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 3: Checklist ─────────────────────────────── */}
              {state.currentStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Checklist de sortie</h4>
                  <p className="text-xs text-slate-400">Complétez les éléments de la checklist de départ du collaborateur.</p>
                  <div className="space-y-3">
                    {[
                      { key: 'exitInterviewConducted', label: 'Entretien de sortie effectué', desc: 'Un entretien de sortie a été réalisé avec le collaborateur' },
                      { key: 'equipmentReturned', label: 'Matériel restitué', desc: 'Tout le matériel (ordinateur, clés, etc.) a été rendu' },
                      { key: 'exitDocumentsProvided', label: 'Documents de sortie fournis', desc: 'Certificat de travail, attestation, etc. remis au collaborateur' },
                      { key: 'finalSettlementPaid', label: 'Solde de tout compte réglé', desc: 'Le règlement financier final a été effectué' },
                    ].map((item) => (
                      <label key={item.key} className="flex items-start gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                        <input type="checkbox" checked={(state as any)[item.key]} onChange={(e) => update(item.key as any, e.target.checked)} className="mt-1 rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                          <p className="text-xs text-slate-400">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {state.exitInterviewConducted && (
                    <div>
                      <label className={labelClass}>Notes de l&apos;entretien de sortie</label>
                      <textarea placeholder="Observations, retours du collaborateur..." className={inputClass + ' min-h-[80px]'} value={state.exitInterviewNotes} onChange={(e) => update('exitInterviewNotes', e.target.value)} />
                    </div>
                  )}
                  {/* Terminate button — triggers the actual staff termination */}
                  {!state.terminated ? (
                    <button type="button" onClick={handleTerminate} disabled={savingStep}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition">
                      {savingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                      {savingStep ? 'Débauche en cours...' : 'Confirmer la débauche du personnel'}
                    </button>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-semibold text-emerald-800">Personnel débauché — Statut mis à jour</span>
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Documents ─────────────────────────────── */}
              {state.currentStep === 4 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-800">Génération des documents de sortie</h4>
                  <p className="text-xs text-slate-400">Générez les documents légaux de fin de contrat. La lettre de débauche est obligatoire.</p>
                  {[
                    { key: 'letter' as const, label: 'Lettre de débauche', desc: 'Document principal formalisant le départ', required: true },
                    { key: 'certificate' as const, label: 'Certificat de travail', desc: 'Attestation obligatoire des fonctions exercées', required: false },
                    { key: 'settlement' as const, label: 'Reçu pour solde de tout compte', desc: 'Quittance financière de fin de contrat', required: false },
                    { key: 'attestation' as const, label: 'Attestation d\'employeur', desc: 'Pour CNSS, banques, etc.', required: false },
                  ].map((doc) => (
                    <div key={doc.key} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl bg-white">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800">{doc.label}</p>
                          {doc.required && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Obligatoire</span>}
                          {state.generatedDocuments[doc.key] && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                        </div>
                        <p className="text-xs text-slate-400">{doc.desc}</p>
                      </div>
                      <button type="button" onClick={() => handleGenerateDoc(doc.key)} disabled={state.generatedDocuments[doc.key]}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.generatedDocuments[doc.key] ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-[#1d4fa5] text-white hover:opacity-90'}`}>
                        {state.generatedDocuments[doc.key] ? 'Généré ✓' : 'Générer PDF'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Step 5: Signatures ────────────────────────────── */}
              {state.currentStep === 5 && (
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-slate-800">Signatures électroniques des documents</h4>
                  {/* Employer */}
                  <div className={`border rounded-xl p-4 ${state.employerSigned ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-bold text-slate-800">Signature de l&apos;Employeur</h5>
                      {state.employerSigned && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle className="h-4 w-4" /> Signé</span>}
                    </div>
                    {!state.employerSigned ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <input type="text" placeholder="Nom du signataire" value={employerName} onChange={(e) => setEmployerName(e.target.value)} className={inputClass} />
                          <select value={employerRole} onChange={(e) => setEmployerRole(e.target.value)} className={inputClass}>
                            <option value="Directeur">Directeur(rice)</option>
                            <option value="Responsable RH">Responsable RH</option>
                            <option value="Autre">Autre</option>
                          </select>
                        </div>
                        <SignatureCanvas onSignatureChange={(d) => setEmployerSigData(d)} placeholder="Signez au nom de l'établissement" />
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={employerConsent} onChange={(e) => setEmployerConsent(e.target.checked)} className="mt-1 rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]" />
                          <span className="text-[11px] text-slate-600">Je certifie signer au nom de l&apos;établissement en tant que {employerRole.toLowerCase()}.</span>
                        </label>
                        <button type="button" onClick={handleEmployerSign} disabled={signingEmployer || !employerSigData || !employerName || !employerConsent}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1d4fa5] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition">
                          {signingEmployer ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Signer en tant qu&apos;Employeur
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                        <div><p className="text-sm font-bold text-emerald-800">Signé par {employerName}</p><p className="text-xs text-emerald-600">En tant que {employerRole}</p></div>
                      </div>
                    )}
                  </div>
                  {/* Employee */}
                  <div className={`border rounded-xl p-4 ${!state.employerSigned ? 'border-slate-200 opacity-60' : state.employeeSigned ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-sm font-bold text-slate-800">Signature de l&apos;Employé(e)</h5>
                      {state.employeeSigned && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle className="h-4 w-4" /> Signé</span>}
                    </div>
                    {state.employerSigned && !state.employeeSigned ? (
                      <div className="space-y-3">
                        <div className="p-2 bg-slate-50 rounded-lg text-sm"><span className="text-xs font-semibold text-slate-500">Signataire :</span> <span className="font-bold text-slate-800">{staffName}</span></div>
                        <SignatureCanvas onSignatureChange={(d) => setEmployeeSigData(d)} placeholder="L'employé(e) signe ici" />
                        <label className="flex items-start gap-2 cursor-pointer">
                          <input type="checkbox" checked={employeeConsent} onChange={(e) => setEmployeeConsent(e.target.checked)} className="mt-1 rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]" />
                          <span className="text-[11px] text-slate-600">Je certifie avoir lu et compris les documents de fin de contrat.</span>
                        </label>
                        <button type="button" onClick={handleEmployeeSign} disabled={signingEmployee || !employeeSigData || !employeeConsent}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b2f73] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition">
                          {signingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Signer en tant qu&apos;Employé(e)
                        </button>
                      </div>
                    ) : state.employeeSigned ? (
                      <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                        <div><p className="text-sm font-bold text-emerald-800">Signé par {staffName}</p><p className="text-xs text-emerald-600">Employé(e)</p></div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-4">L&apos;employeur doit signer en premier.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 6: Confirmation ──────────────────────────── */}
              {state.currentStep === 6 && (
                <div className="text-center py-8 space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100"><CheckCircle className="h-8 w-8 text-emerald-600" /></div>
                  <h3 className="text-lg font-bold text-slate-800">Débauche finalisée !</h3>
                  <p className="text-sm text-slate-500">
                    Le dossier de débauche de <strong>{staffName}</strong> a été traité avec succès.
                    Tous les documents ont été générés et signés.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto text-left">
                    <div className="p-3 bg-slate-50 rounded-xl"><span className="text-xs text-slate-400">Type</span><p className="text-sm font-bold text-slate-800">{selectedType?.label}</p></div>
                    <div className="p-3 bg-slate-50 rounded-xl"><span className="text-xs text-slate-400">Date d&apos;effet</span><p className="text-sm font-bold text-slate-800">{state.effectiveDate}</p></div>
                    <div className="p-3 bg-slate-50 rounded-xl"><span className="text-xs text-slate-400">Lettre</span><p className="text-sm font-bold text-emerald-600">✓ Générée</p></div>
                    <div className="p-3 bg-slate-50 rounded-xl"><span className="text-xs text-slate-400">Signatures</span><p className="text-sm font-bold text-emerald-600">✓ Double signature</p></div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Controls */}
        {state.currentStep < 6 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <button type="button" disabled={state.currentStep === 1 || savingStep} onClick={handlePrev}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 transition">
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
            <button type="button" disabled={!canProceed() || savingStep} onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-40 transition"
              style={{ backgroundColor: state.currentStep >= 3 ? '#dc2626' : BLUE }}>
              {state.currentStep === 5 ? <><CheckCircle className="h-4 w-4" /> Finaliser</> : <><>Suivant</> <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        )}

        {state.currentStep === 6 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <button type="button" onClick={() => { onSuccess(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
              <CheckCircle className="h-5 w-5" /> Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
