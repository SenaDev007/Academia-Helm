'use client';

import { useState } from 'react';
import { X, User, Mail, Phone, Briefcase, Calendar, Shield, Loader2, ArrowRight, ArrowLeft, FileText, CheckCircle, Upload, DollarSign, CreditCard } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';

const PRIMARY = '#1A2BA6';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

export function OnboardingWizardModal({ isOpen, onClose, onSuccess, tenantId }: OnboardingWizardModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Identity
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    category: 'ADMIN',
    position: '',
    gender: 'MALE',
    birthDate: '',
    // Step 2: Documents (actual File objects for upload)
    cvFile: null as File | null,
    cniFile: null as File | null,
    birthCertFile: null as File | null,
    // Step 3: Contract
    contractType: 'CDD',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    baseSalary: '150000',
    paymentMode: 'BANK',
  });

  if (!isOpen) return null;

  const update = (field: string, value: any) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      handleNext();
      return;
    }

    try {
      setLoading(true);
      // 1. Create Staff Profile
      let staffId: string;
      try {
        const staffResponse = await hrFetch<any>(hrUrl('staff', { tenantId }), {
          method: 'POST',
          body: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email || undefined,
            phone: formData.phone || undefined,
            category: formData.category,
            position: formData.position || undefined,
            gender: formData.gender,
            birthDate: formData.birthDate || null,
            status: 'ACTIVE',
          },
        });
        staffId = staffResponse.id;
        if (!staffId) {
          throw new Error('Réponse invalide : ID du personnel manquant');
        }
      } catch (err: any) {
        throw new Error(`Étape 1 (Identité) : ${err?.message || 'Erreur lors de la création du personnel'}`);
      }

      // 2. Upload Documents using multipart form data (actual file uploads)
      try {
        const docUploads: Promise<any>[] = [];
        const uploadDoc = async (file: File, documentType: string) => {
          const docFormData = new FormData();
          docFormData.append('file', file);
          docFormData.append('documentType', documentType);
          return hrFetch(hrUrl(`staff/${staffId}/documents`, { tenantId }), {
            method: 'POST',
            body: docFormData,
          });
        };
        if (formData.cvFile) docUploads.push(uploadDoc(formData.cvFile, 'CV'));
        if (formData.cniFile) docUploads.push(uploadDoc(formData.cniFile, 'CNI'));
        if (formData.birthCertFile) docUploads.push(uploadDoc(formData.birthCertFile, 'BIRTH_CERTIFICATE'));

        if (docUploads.length > 0) {
          await Promise.all(docUploads);
        }
      } catch (err: any) {
        throw new Error(`Étape 2 (Documents) : ${err?.message || 'Erreur lors du téléversement des documents'}`);
      }

      // 3. Create Employment Contract
      try {
        const contractBody: any = {
          staffId,
          contractType: formData.contractType,
          startDate: formData.startDate || new Date().toISOString().split('T')[0],
          baseSalary: parseFloat(formData.baseSalary) || 0,
          paymentMode: formData.paymentMode,
          status: 'PENDING',
        };
        // Only include endDate if it has a value (avoid empty string validation error)
        if (formData.endDate) {
          contractBody.endDate = formData.endDate;
        }
        await hrFetch(hrUrl('contracts', { tenantId }), {
          method: 'POST',
          body: contractBody,
        });
      } catch (err: any) {
        throw new Error(`Étape 3 (Contrat) : ${err?.message || 'Erreur lors de la création du contrat'}`);
      }

      toast({ variant: 'success', title: 'Recrutement & Onboarding finalisés avec succès' });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'error', title: "Erreur lors de la finalisation du recrutement", description: err?.message || 'Veuillez vérifier les données saisies et réessayer.' });
    } finally {
      setLoading(false);
    }
  };

  const stepsHeader = [
    { num: 1, label: 'Identité' },
    { num: 2, label: 'Documents' },
    { num: 3, label: 'Contrat & Emploi' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Processus de Recrutement & Onboarding</h3>
              <p className="text-xs text-white/70">Création de dossier, pièces justificatives et contrat de travail</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          {stepsHeader.map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  backgroundColor: step >= s.num ? PRIMARY : '#E2E8F0',
                  color: step >= s.num ? '#FFFFFF' : '#64748B',
                }}
              >
                {step > s.num ? <CheckCircle className="h-4 w-4" /> : s.num}
              </div>
              <span className={`text-xs font-bold ${step >= s.num ? 'text-slate-800' : 'text-slate-400'}`}>
                {s.label}
              </span>
              {idx < 2 && <div className="w-12 h-[2px] bg-slate-200 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step1"
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Prénom</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex : Kouadio"
                      className={inputClass}
                      value={formData.firstName}
                      onChange={(e) => update('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nom de famille</label>
                    <input
                      required
                      type="text"
                      placeholder="Ex : Koffi"
                      className={inputClass}
                      value={formData.lastName}
                      onChange={(e) => update('lastName', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email professionnel</label>
                    <input
                      type="email"
                      placeholder="prenom.nom@ecole.ci"
                      className={inputClass}
                      value={formData.email}
                      onChange={(e) => update('email', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <input
                      type="tel"
                      placeholder="+225 07 00 00 00 00"
                      className={inputClass}
                      value={formData.phone}
                      onChange={(e) => update('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Catégorie</label>
                    <select
                      className={inputClass}
                      value={formData.category}
                      onChange={(e) => update('category', e.target.value)}
                    >
                      <option value="PEDAGOGICAL">Corps Enseignant</option>
                      <option value="ADMIN">Administration</option>
                      <option value="SUPPORT">Personnel d'appui</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Poste occupé</label>
                    <input
                      type="text"
                      placeholder="Ex : Professeur de SVT, Comptable..."
                      className={inputClass}
                      value={formData.position}
                      onChange={(e) => update('position', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Genre</label>
                    <select
                      className={inputClass}
                      value={formData.gender}
                      onChange={(e) => update('gender', e.target.value)}
                    >
                      <option value="MALE">Masculin</option>
                      <option value="FEMALE">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date de naissance</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={formData.birthDate}
                      onChange={(e) => update('birthDate', e.target.value)}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step2"
                className="space-y-4"
              >
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl text-xs text-blue-800 flex gap-2">
                  <BadgeInfo className="h-4 w-4 shrink-0 text-blue-600" />
                  <span>Veuillez téléverser les documents obligatoires du dossier de recrutement pour constitution du dossier RH.</span>
                </div>

                {[
                  { key: 'cvFile', label: 'Curriculum Vitae (CV)' },
                  { key: 'cniFile', label: "Pièce d'Identité / Passeport" },
                  { key: 'birthCertFile', label: "Acte de Naissance" },
                ].map((doc) => {
                  const file = formData[doc.key as keyof typeof formData] as File | null;
                  return (
                    <div key={doc.key} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">{doc.label}</p>
                          <p className="text-xs text-slate-400">
                            {file ? `${file.name} (${(file.size / 1024).toFixed(1)} Ko)` : 'Aucun fichier sélectionné'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file && (
                          <button
                            type="button"
                            onClick={() => update(doc.key, null)}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            title="Supprimer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition">
                          <Upload className="h-3.5 w-3.5" /> Choisir
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const selectedFile = e.target.files?.[0];
                              if (selectedFile) update(doc.key, selectedFile);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                key="step3"
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Type de contrat</label>
                    <select
                      className={inputClass}
                      value={formData.contractType}
                      onChange={(e) => update('contractType', e.target.value)}
                    >
                      <option value="CDD">Contrat à Durée Déterminée (CDD)</option>
                      <option value="CDI">Contrat à Durée Indéterminée (CDI)</option>
                      <option value="VACATAIRE">Vacataire</option>
                      <option value="STAGE">Stage</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Salaire de Base (Mensuel)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        required
                        type="number"
                        className={inputClass + ' pl-9'}
                        value={formData.baseSalary}
                        onChange={(e) => update('baseSalary', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date de prise d'effet</label>
                    <input
                      required
                      type="date"
                      className={inputClass}
                      value={formData.startDate}
                      onChange={(e) => update('startDate', e.target.value)}
                    />
                  </div>
                  {formData.contractType !== 'CDI' && (
                    <div>
                      <label className={labelClass}>Date de fin de contrat</label>
                      <input
                        type="date"
                        className={inputClass}
                        value={formData.endDate}
                        onChange={(e) => update('endDate', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Mode de paiement</label>
                  <select
                    className={inputClass}
                    value={formData.paymentMode}
                    onChange={(e) => update('paymentMode', e.target.value)}
                  >
                    <option value="BANK">Virement Bancaire</option>
                    <option value="CASH">Espèces</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-6">
            <button
              type="button"
              disabled={step === 1 || loading}
              onClick={handlePrev}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Finalisation...
                </>
              ) : step === 3 ? (
                <>
                  <CheckCircle className="h-4 w-4" /> Recruter & Onboarder
                </>
              ) : (
                <>
                  Suivant <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Minimal placeholder so typescript doesn't throw if imports check for BadgeInfo
function BadgeInfo({ className }: { className?: string }) {
  return <Shield className={className} />;
}
