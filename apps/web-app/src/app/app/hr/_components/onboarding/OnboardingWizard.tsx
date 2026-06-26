'use client';

import { useState, useCallback } from 'react';
import { X, User, ArrowLeft, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { compressImageFileToDataUrl } from '@/lib/media';
import { toast } from '@/components/ui/toast';
import { OnboardingState, INITIAL_STATE, REQUIRED_DOCUMENTS } from './types';
import { StepIndicator } from './components/StepIndicator';
import { StepIdentity } from './steps/StepIdentity';
import { StepEmployment } from './steps/StepEmployment';
import { StepDocuments } from './steps/StepDocuments';
import { StepContract } from './steps/StepContract';
import { StepPreview } from './steps/StepPreview';
import { StepSignatures } from './steps/StepSignatures';
import { StepSummary } from './steps/StepSummary';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';

export function OnboardingWizard({ isOpen, onClose, onSuccess, tenantId }: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState>({ ...INITIAL_STATE });
  const [savingStep, setSavingStep] = useState(false);

  if (!isOpen) return null;

  const staffFullName = `${state.identity.firstName} ${state.identity.lastName}`.trim();

  // ─── Step Validation ─────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 1:
        return !!(state.identity.firstName && state.identity.lastName && state.identity.email && state.identity.phone && state.identity.birthDate && state.identity.nationalId);
      case 2:
        return !!(state.employment.position && state.employment.hireDate);
      case 3: {
        // Required docs must have files selected
        const hasAllRequired = REQUIRED_DOCUMENTS.every(
          (doc) => state.documents[doc] || state.uploadedDocuments[doc]
        );
        return hasAllRequired;
      }
      case 4:
        return !!(state.contract.contractType && state.contract.baseSalary && state.contract.startDate);
      case 5:
        return state.articlesSaved;
      case 6:
        return state.employerSigned && state.employeeSigned;
      case 7:
        return true;
      default:
        return false;
    }
  };

  // ─── API Persistence (Progressive Save) ──────────────────────────
  const saveStep1AndAdvance = async () => {
    if (state.staffId) {
      // Update existing staff
      await hrFetch(hrUrl(`staff/${state.staffId}`, { tenantId }), {
        method: 'PUT',
        body: {
          firstName: state.identity.firstName,
          lastName: state.identity.lastName,
          email: state.identity.email,
          phone: state.identity.phone,
          gender: state.identity.gender,
          birthDate: state.identity.birthDate || null,
          nationality: state.identity.nationality || undefined,
          maritalStatus: state.identity.maritalStatus || undefined,
          numberOfChildren: state.identity.numberOfChildren || undefined,
          nationalId: state.identity.nationalId || undefined,
          address: state.identity.address || undefined,
        },
      });
    } else {
      // Create new staff
      const staffResponse = await hrFetch<any>(hrUrl('staff', { tenantId }), {
        method: 'POST',
        body: {
          firstName: state.identity.firstName,
          lastName: state.identity.lastName,
          email: state.identity.email,
          phone: state.identity.phone,
          gender: state.identity.gender,
          birthDate: state.identity.birthDate || null,
          nationality: state.identity.nationality || undefined,
          maritalStatus: state.identity.maritalStatus || undefined,
          numberOfChildren: state.identity.numberOfChildren || undefined,
          nationalId: state.identity.nationalId || undefined,
          address: state.identity.address || undefined,
          status: 'PENDING_HIRE', // Harmonisé avec le pipeline de recrutement
        },
      });
      setState((prev) => ({ ...prev, staffId: staffResponse.id }));

      // Créer également un HrCandidate + HrApplication au statut ÉLIGIBLE
      // pour que le staff apparaisse dans l'onglet Embauche (section candidats à déclarer éligible)
      try {
        const candidateResponse = await hrFetch<any>(hrUrl('recruitment/candidates', { tenantId }), {
          method: 'POST',
          body: {
            firstName: state.identity.firstName,
            lastName: state.identity.lastName,
            email: state.identity.email,
            phone: state.identity.phone,
            staffId: staffResponse.id, // Lier le staff créé
            status: 'ÉLIGIBLE',
            source: 'INTERNAL_HIRE', // Indique que c'est un recrutement interne
          },
        });

        // Créer une application au statut ÉLIGIBLE
        if (candidateResponse?.id) {
          await hrFetch(hrUrl('recruitment/applications', { tenantId }), {
            method: 'POST',
            body: {
              candidateId: candidateResponse.id,
              status: 'ÉLIGIBLE',
              staffId: staffResponse.id,
            },
          });
        }
      } catch (err) {
        // Non bloquant — le staff est créé, le candidat est optionnel
        console.warn('[OnboardingWizard] Failed to create HrCandidate:', err);
      }
    }
  };

  const saveStep2AndAdvance = async () => {
    if (!state.staffId) return;
    await hrFetch(hrUrl(`staff/${state.staffId}`, { tenantId }), {
      method: 'PUT',
      body: {
        position: state.employment.position || undefined,
        department: state.employment.department || undefined,
        roleType: state.employment.roleType,
        hireDate: state.employment.hireDate || undefined,
        qualifications: state.employment.qualifications || undefined,
      },
    });
  };

  const saveStep3AndAdvance = async () => {
    if (!state.staffId) return;
    const uploadPromises: Promise<any>[] = [];
    for (const [docType, file] of Object.entries(state.documents)) {
      if (file && !state.uploadedDocuments[docType]) {
        uploadPromises.push(
          (async () => {
            // ─── Pattern data URL (identique au logo école + photo profil) ───
            // Images : compression côté navigateur ; PDF/autres : lecture directe
            const isImage = file.type.startsWith('image/');
            let fileDataUrl: string;
            if (isImage) {
              fileDataUrl = await compressImageFileToDataUrl(file, {
                maxEdge: 1600,
                quality: 0.85,
                mimeType: 'image/jpeg',
              });
            } else {
              fileDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
                reader.readAsDataURL(file);
              });
            }

            await hrFetch(hrUrl(`staff/${state.staffId}/upload-document`, { tenantId }), {
              method: 'POST',
              body: {
                documentType: docType,
                fileName: file.name,
                fileDataUrl,
                mimeType: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
                fileSize: file.size,
              },
            });

            setState((prev) => ({
              ...prev,
              uploadedDocuments: { ...prev.uploadedDocuments, [docType]: true },
            }));
          })()
        );
      }
    }
    await Promise.all(uploadPromises);
  };

  const saveStep4AndAdvance = async () => {
    if (!state.staffId) return;

    // Update staff with CNSS, IFU, bank details (including Mobile Money for FeexPay)
    const bankDetails: any = {};
    if (state.contract.paymentMode === 'BANK' && state.contract.bankName) {
      bankDetails.bankName = state.contract.bankName;
      bankDetails.accountNumber = state.contract.accountNumber;
      bankDetails.accountName = state.contract.accountHolder;
    }
    if (state.contract.paymentMode === 'MOBILE_MONEY' && state.contract.mobileMoneyNumber) {
      bankDetails.mobileMoneyNumber = state.contract.mobileMoneyNumber;
      bankDetails.mobileMoneyOperator = state.contract.mobileMoneyOperator;
    }

    await hrFetch(hrUrl(`staff/${state.staffId}`, { tenantId }), {
      method: 'PUT',
      body: {
        cnssNumber: state.contract.cnssNumber || undefined,
        ifuNumber: state.contract.ifuNumber || undefined,
        bankDetails: Object.keys(bankDetails).length > 0 ? bankDetails : undefined,
      },
    });

    // Create contract if not yet created
    if (!state.contractId) {
      const contractBody: any = {
        staffId: state.staffId,
        contractType: state.contract.contractType,
        startDate: state.contract.startDate,
        baseSalary: parseFloat(state.contract.baseSalary) || 0,
        paymentMode: state.contract.paymentMode,
        status: 'DRAFT',
      };
      if (state.contract.endDate) {
        contractBody.endDate = state.contract.endDate;
      }
      const contractResponse = await hrFetch<any>(hrUrl('contracts', { tenantId }), {
        method: 'POST',
        body: contractBody,
      });
      setState((prev) => ({ ...prev, contractId: contractResponse.id }));
    }
  };

  // ─── Navigation ──────────────────────────────────────────────────
  const handleNext = async () => {
    try {
      setSavingStep(true);
      switch (state.currentStep) {
        case 1:
          await saveStep1AndAdvance();
          break;
        case 2:
          await saveStep2AndAdvance();
          break;
        case 3:
          await saveStep3AndAdvance();
          break;
        case 4:
          await saveStep4AndAdvance();
          break;
        // Steps 5-6-7 handle their own persistence
      }
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1, error: null }));
    } catch (err: any) {
      const message = err?.message || 'Erreur lors de la sauvegarde';
      toast({ variant: 'error', title: `Étape ${state.currentStep}`, description: message });
      setState((prev) => ({ ...prev, error: message }));
    } finally {
      setSavingStep(false);
    }
  };

  const handlePrev = () => {
    if (state.currentStep > 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleClose = () => {
    // Rafraîchir la liste si un staff a été créé (dès l'étape 1), même si
    // l'utilisateur n'a pas terminé tout le wizard (étapes 2-7).
    // Avant, onSuccess() n'était appelé que si state.completed était true,
    // ce qui rendait le staff invisible jusqu'à un rechargement manuel.
    if (state.staffId || state.completed) {
      onSuccess();
    }
    onClose();
    setState({ ...INITIAL_STATE });
  };

  const stepTitles: Record<number, string> = {
    1: 'Identité & Informations Personnelles',
    2: 'Classification & Emploi',
    3: 'Pièces Justificatives',
    4: 'Contrat de Travail',
    5: 'Aperçu & Édition du Contrat',
    6: 'Signatures Électroniques',
    7: 'Récapitulatif & Finalisation',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 text-white shrink-0" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Processus d&apos;Embauche Professionnel</h3>
              <p className="text-xs text-white/70">{stepTitles[state.currentStep]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/60 font-semibold">
              Étape {state.currentStep}/7
            </span>
            <button onClick={handleClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={state.currentStep} />

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {state.currentStep === 1 && (
                <StepIdentity
                  identity={state.identity}
                  onUpdate={(field, value) =>
                    setState((prev) => ({ ...prev, identity: { ...prev.identity, [field]: value } }))
                  }
                />
              )}
              {state.currentStep === 2 && (
                <StepEmployment
                  employment={state.employment}
                  onUpdate={(field, value) =>
                    setState((prev) => ({ ...prev, employment: { ...prev.employment, [field]: value } }))
                  }
                />
              )}
              {state.currentStep === 3 && (
                <StepDocuments
                  documents={state.documents}
                  uploadedDocuments={state.uploadedDocuments}
                  onFileSelect={(docType, file) =>
                    setState((prev) => ({ ...prev, documents: { ...prev.documents, [docType]: file } }))
                  }
                  onFileRemove={(docType) =>
                    setState((prev) => ({ ...prev, documents: { ...prev.documents, [docType]: null } }))
                  }
                />
              )}
              {state.currentStep === 4 && (
                <StepContract
                  contract={state.contract}
                  onUpdate={(field, value) =>
                    setState((prev) => ({ ...prev, contract: { ...prev.contract, [field]: value } }))
                  }
                />
              )}
              {state.currentStep === 5 && (
                <StepPreview
                  contractId={state.contractId}
                  tenantId={tenantId}
                  articlesSaved={state.articlesSaved}
                  onArticlesSaved={() => setState((prev) => ({ ...prev, articlesSaved: true }))}
                  onPdfGenerated={() => setState((prev) => ({ ...prev, pdfGenerated: true }))}
                />
              )}
              {state.currentStep === 6 && (
                <StepSignatures
                  contractId={state.contractId}
                  tenantId={tenantId}
                  staffFullName={staffFullName}
                  employerSigned={state.employerSigned}
                  employeeSigned={state.employeeSigned}
                  onEmployerSigned={(sigData) =>
                    setState((prev) => ({ ...prev, employerSigned: true, employerSignatureData: sigData }))
                  }
                  onEmployeeSigned={(sigData) =>
                    setState((prev) => ({ ...prev, employeeSigned: true, employeeSignatureData: sigData }))
                  }
                />
              )}
              {state.currentStep === 7 && (
                <StepSummary
                  staffId={state.staffId}
                  contractId={state.contractId}
                  tenantId={tenantId}
                  staffFullName={staffFullName}
                  identity={state.identity}
                  employment={state.employment}
                  contract={state.contract}
                  employerSigned={state.employerSigned}
                  employeeSigned={state.employeeSigned}
                  sendEmail={state.sendEmail}
                  onSendEmailChange={(v) => setState((prev) => ({ ...prev, sendEmail: v }))}
                  onCompleted={() => setState((prev) => ({ ...prev, completed: true }))}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Controls */}
        {state.currentStep < 7 && (
          <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <button
              type="button"
              disabled={state.currentStep === 1 || savingStep}
              onClick={handlePrev}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>

            <button
              type="button"
              disabled={!canProceed() || savingStep}
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-40 transition"
              style={{ backgroundColor: BLUE }}
            >
              {savingStep ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sauvegarde...
                </>
              ) : (
                <>
                  Suivant <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* Completed state close button */}
        {state.completed && (
          <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition hover:opacity-90"
              style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
            >
              <CheckCircle className="h-5 w-5" /> Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
