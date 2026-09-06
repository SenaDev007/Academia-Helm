'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, User, ArrowLeft, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { compressImageFileToDataUrl } from '@/lib/media';
import { toast } from '@/components/ui/toast';
import { OnboardingState, INITIAL_STATE } from './types';
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

// ⭐ RH Bénin — barème fiscal en vigueur (payroll_fiscal_rates, via l'API) :
// hints SMIG / AIB / CNSS pour la validation et l'aide à la saisie, SANS taux
// codé en dur côté front. Cache module-level 60 s (pattern PortalSwitchButton).
let fiscalHintsCache: { data: any; at: number } | null = null;
async function loadFiscalHints(): Promise<any | null> {
  if (fiscalHintsCache && Date.now() - fiscalHintsCache.at < 60_000) return fiscalHintsCache.data;
  try {
    const res = await fetch('/api/hr/payroll/fiscal-rates?countryCode=BJ', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    fiscalHintsCache = { data, at: Date.now() };
    return data;
  } catch {
    return null;
  }
}

// ⭐ CDC §9 — paramétrage RH « embauche & contrats » de l'école (motifs CDD,
// seuil durée cumulée, test de qualification) : cache 60 s, même pattern.
let hrSettingsCache: { data: any; at: number } | null = null;
async function loadHrContractSettings(tenantId: string): Promise<any | null> {
  if (hrSettingsCache && Date.now() - hrSettingsCache.at < 60_000) return hrSettingsCache.data;
  try {
    const res = await fetch(`/api/hr/contracts/settings?tenantId=${encodeURIComponent(tenantId)}`, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    hrSettingsCache = { data, at: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export function OnboardingWizard({ isOpen, onClose, onSuccess, tenantId }: OnboardingWizardProps) {
  const [state, setState] = useState<OnboardingState>({ ...INITIAL_STATE });
  const [savingStep, setSavingStep] = useState(false);
  const [fiscalHints, setFiscalHints] = useState<any | null>(null);
  const [hrSettings, setHrSettings] = useState<any | null>(null);
  const [cddChain, setCddChain] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadFiscalHints().then(setFiscalHints);
      loadHrContractSettings(tenantId).then((data) => {
        setHrSettings(data);
        // ⭐ CDC §5 — alimente l'état du test d'aide à la qualification (config école)
        if (data) {
          setState((prev) => ({
            ...prev,
            qualificationTest: {
              ...prev.qualificationTest,
              enabled: data.testQualificationEnabled !== false,
              questions: Array.isArray(data.testQuestions) ? data.testQuestions : [],
            },
          }));
        }
      });
    }
  }, [isOpen, tenantId]);

  // ⭐ CDC §4.3 — chaîne CDD du personnel (compteur + durée cumulée) chargée
  //    à l'entrée à l'étape 4 pour un statut salarié
  useEffect(() => {
    if (
      state.currentStep === 4 &&
      state.staffId &&
      state.employment.statutContractuel &&
      state.employment.statutContractuel !== 'PRESTATAIRE_SERVICE'
    ) {
      hrFetch<any>(hrUrl(`contracts/staff/${state.staffId}/cdd-chain`, { tenantId }))
        .then(setCddChain)
        .catch(() => setCddChain(null));
    } else {
      setCddChain(null);
    }
  }, [state.currentStep, state.staffId, state.employment.statutContractuel, tenantId]);

  if (!isOpen) return null;

  const staffFullName = `${state.identity.firstName} ${state.identity.lastName}`.trim();

  // ─── Step Validation ─────────────────────────────────────────────
  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 1:
        return !!(state.identity.firstName && state.identity.lastName && state.identity.email && state.identity.phone && state.identity.birthDate && state.identity.nationalId);
      case 2:
        // ⭐ Statut contractuel BLOQUANT — avant tout champ financier (étape 4)
        return !!(state.employment.position && state.employment.hireDate && state.employment.statutContractuel);
      case 3:
        // ⭐ Tous les documents sont optionnels en embauche interne — l'utilisateur
        //    peut téléverser ce qu'il a maintenant et continuer. Aucune contrainte.
        return true;
      case 4: {
        // ⭐ Validation conditionnelle selon le statut contractuel
        const statut = state.employment.statutContractuel;
        if (statut === 'PRESTATAIRE_SERVICE') {
          const amount = parseFloat(state.contract.prestationAmount);
          return !!(
            state.contract.prestationPaymentMode &&
            amount > 0 &&
            state.contract.prestationDescription.trim().length >= 10 &&
            state.contract.prestationCalendrier.trim().length >= 3 &&
            state.contract.startDate &&
            state.contract.endDate
          );
        }
        // Salariés (déclarés ou non) : type + salaire ≥ SMIG + dates
        // ⭐ CDC §4.3 — CDD : date de fin + motif OBLIGATOIRES ; CDI : pas de fin
        const smig = Number(fiscalHints?.smig) > 0 ? Number(fiscalHints.smig) : 52000;
        const salaire = parseFloat(state.contract.baseSalary);
        const cnssOk = statut !== 'SALARIE_DECLARE' || !!state.contract.cnssNumber.trim();
        if (state.contract.contractType === 'CDD') {
          return !!(
            salaire >= smig &&
            state.contract.startDate &&
            state.contract.endDate &&
            state.contract.cddMotif.trim().length >= 3 &&
            cnssOk
          );
        }
        // CDI : pas de date de fin exigée
        return !!(
          salaire >= smig &&
          state.contract.startDate &&
          cnssOk
        );
      }
      case 5:
        return state.articlesSaved;
      case 6:
        // En mode présentiel : les deux signatures doivent être présentes.
        // En mode différé : seule la signature employeur est requise
        // (l'employé signera à distance via l'email envoyé à l'étape 7).
        if (state.signatureMode === 'differe') {
          return state.employerSigned;
        }
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
        await hrFetch(hrUrl('recruitment/candidates', { tenantId }), {
          method: 'POST',
          body: {
            firstName: state.identity.firstName,
            lastName: state.identity.lastName,
            email: state.identity.email,
            phone: state.identity.phone,
            staffId: staffResponse.id, // Lier le staff créé
            status: 'ÉLIGIBLE',
            source: 'INTERNAL_HIRE', // Le backend crée automatiquement un HrJob "Interne" + une application ÉLIGIBLE
          },
        });
      } catch (err) {
        // Non bloquant — le staff est créé, le candidat est optionnel
        console.warn('[OnboardingWizard] Failed to create HrCandidate:', err);
      }
    }
  };

  const saveStep2AndAdvance = async () => {
    if (!state.staffId) return;
    const updateBody: any = {
      position: state.employment.position || undefined,
      department: state.employment.department || undefined,
      roleType: state.employment.roleType,
      hireDate: state.employment.hireDate || undefined,
      qualifications: state.employment.qualifications || undefined,
      // ⭐ Statut contractuel (définition initiale — dérivation du document de paie côté serveur)
      statutContractuel: state.employment.statutContractuel || undefined,
    };

    // ⭐ Multi-poste : si le staff est aussi enseignant, on met à jour
    //    son roleType vers TEACHER (pour qu'il apparaisse dans l'équipe
    //    enseignante) et on stocke le poste secondaire dans position
    //    (si le poste principal est vide) ou on le concatène.
    if (state.employment.isAlsoTeacher && state.employment.secondaryPosition) {
      // Si le roleType principal est ADMIN/SUPPORT/DIRECTOR, on garde ce
      // roleType pour le compte User (credentials) mais on met à jour
      // le schoolLevelId pour qu'il apparaisse dans l'équipe enseignante.
      // Le poste secondaire est stocké dans qualifications (à la fin) pour
      // que le contrat puisse le refléter.
      const secondaryInfo = `\n\nPoste secondaire : ${state.employment.secondaryPosition} (Enseignant)`;
      updateBody.qualifications = (state.employment.qualifications || '') + secondaryInfo;
    }

    await hrFetch(hrUrl(`staff/${state.staffId}`, { tenantId }), {
      method: 'PUT',
      body: updateBody,
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

    const statut = state.employment.statutContractuel;
    const isPrestation = statut === 'PRESTATAIRE_SERVICE';
    const isDeclare = statut === 'SALARIE_DECLARE';

    // Update staff with CNSS, IFU, bank details (including Mobile Money for FedaPay)
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

    const staffBody: any = {
      bankDetails: Object.keys(bankDetails).length > 0 ? bankDetails : undefined,
    };
    if (isDeclare) {
      // N° CNSS obligatoire pour un salarié déclaré (validation miroir du serveur)
      staffBody.cnssNumber = state.contract.cnssNumber || undefined;
    }
    if (isPrestation) {
      staffBody.ifuNumber = state.contract.ifuNumber || undefined;
      staffBody.prestationPaymentMode = state.contract.prestationPaymentMode;
      staffBody.prestationAmount = parseFloat(state.contract.prestationAmount) || undefined;
    } else if (!isDeclare) {
      staffBody.cnssNumber = state.contract.cnssNumber || undefined;
    }

    await hrFetch(hrUrl(`staff/${state.staffId}`, { tenantId }), {
      method: 'PUT',
      body: staffBody,
    });

    // Create contract if not yet created
    if (!state.contractId) {
      const contractBody: any = {
        staffId: state.staffId,
        startDate: state.contract.startDate,
        paymentMode: state.contract.paymentMode,
        status: 'DRAFT',
        ...(statut ? { statutContractuel: statut } : {}),
      };

      if (isPrestation) {
        // ⭐ Contrat de prestation de services — jamais un contrat de travail
        contractBody.contractType = 'PRESTATION';
        contractBody.prestationPaymentMode = state.contract.prestationPaymentMode;
        contractBody.prestationAmount = parseFloat(state.contract.prestationAmount) || 0;
        contractBody.baseSalary =
          state.contract.prestationPaymentMode === 'FORFAIT'
            ? parseFloat(state.contract.prestationAmount) || 0
            : 0;
        if (state.contract.endDate) contractBody.endDate = state.contract.endDate;
        contractBody.terms = {
          prestation: {
            description: state.contract.prestationDescription.trim(),
            calendrier: state.contract.prestationCalendrier.trim(),
            renouvelable: state.contract.prestationRenouvelable,
            confidentialite: state.contract.prestationConfidentialite,
            proprieteContenus: state.contract.prestationPropriete,
          },
        };
      } else {
        // Salarié (déclaré ou non déclaré) — CDC §4 : CDI/CDD uniquement
        contractBody.contractType = state.contract.contractType;
        contractBody.baseSalary = parseFloat(state.contract.baseSalary) || 0;
        // ⭐ CDC §4.3 — CDD : date de fin + motif ; CDI : pas de date de fin
        if (state.contract.contractType === 'CDD' && state.contract.endDate) {
          contractBody.endDate = state.contract.endDate;
        } else {
          contractBody.endDate = null;
        }
        if (state.contract.contractType === 'CDD' && state.contract.cddMotif.trim()) {
          contractBody.cddMotif = state.contract.cddMotif.trim();
        }
        if (state.contract.contractType === 'CDI' && state.contract.periodeEssaiMois !== '') {
          contractBody.periodeEssaiMois = parseInt(state.contract.periodeEssaiMois, 10) || 0;
        }
      }

      // ⭐ CDC §4.4 — traçabilité de la décision de statut (optionnel)
      if (state.contract.justificationStatut.trim()) {
        contractBody.justificationStatut = state.contract.justificationStatut.trim();
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
        case 6:
          // ⭐ Mode différé : quand on quitte l'étape 6 (signature employeur
          //    fait), on appelle completeOnboarding(asyncSign: true) pour
          //    envoyer l'email de signature à l'employé. Le staff reste
          //    PENDING_HIRE, le contrat reste PENDING. L'étape 7 affichera
          //    "Email envoyé, en attente de signature à distance" et pollera
          //    jusqu'à ce que l'employé signe à distance via le lien email.
          if (state.signatureMode === 'differe' && state.staffId && state.contractId) {
            try {
              await hrFetch(hrUrl('contracts/onboarding/complete', { tenantId }), {
                method: 'POST',
                body: {
                  staffId: state.staffId,
                  contractId: state.contractId,
                  sendEmail: state.sendEmail,
                  asyncSign: true,
                },
              });
              toast({
                variant: 'success',
                title: 'Email de signature envoyé',
                description: `Un email a été envoyé à ${state.identity.email}. L'employé(e) pourra signer à distance via le lien sécurisé.`,
              });
            } catch (err: any) {
              toast({ variant: 'error', title: 'Erreur envoi email', description: err?.message });
              setSavingStep(false);
              return; // Ne pas avancer à l'étape 7 si l'envoi échoue
            }
          }
          break;
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
                  qualificationTest={state.qualificationTest}
                  onQualificationChange={(patch) =>
                    setState((prev) => ({ ...prev, qualificationTest: { ...prev.qualificationTest, ...patch } }))
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
                  statutContractuel={state.employment.statutContractuel}
                  roleType={state.employment.roleType}
                  fiscalHints={fiscalHints}
                  hrSettings={hrSettings}
                  cddChain={cddChain}
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
                  signatureMode={state.signatureMode}
                  onSignatureModeChange={(mode) =>
                    setState((prev) => ({ ...prev, signatureMode: mode }))
                  }
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
                  signatureMode={state.signatureMode}
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
