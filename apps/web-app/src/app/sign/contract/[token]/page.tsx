'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Euro,
  Building2,
  User,
  PenTool,
  ShieldCheck,
} from 'lucide-react';
import { SignatureCanvas } from '@/components/public/SignatureCanvas';
import { PublicShell, PublicCard, HELM_NAVY, HELM_BLUE, HELM_GOLD } from '@/components/public/PublicShell';

interface ContractInfo {
  token: string;
  contractId: string;
  tenantId: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  paymentMode: string;
  status: string;
  isAlreadySigned: boolean;
  staffFirstName: string;
  staffLastName: string;
  staffEmail: string;
  staffPosition: string;
  schoolName: string;
  schoolLogoUrl: string | null;
  employerSignedAt: string | null;
  employerSignerName: string | null;
}

type PageState = 'loading' | 'valid' | 'expired' | 'used' | 'already-signed' | 'not-found' | 'success' | 'error';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatSalary(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: 'Contrat à Durée Indéterminée (CDI)',
  CDD: 'Contrat à Durée Déterminée (CDD)',
  VACATAIRE: 'Contrat Vacataire',
  STAGE: 'Convention de Stage',
  CONSULTANT: 'Contrat de Consultant',
  APPRENTISSAGE: "Contrat d'Apprentissage",
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  BANK: 'Virement bancaire',
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CHEQUE: 'Chèque',
};

export default function ContractSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Resolve token from URL params
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  // Fetch contract info when token is available
  const fetchContractInfo = useCallback(async () => {
    if (!token) return;
    setState('loading');
    try {
      const res = await fetch(`/api/contracts-public/${token}`);
      const data = await res.json();

      if (!res.ok) {
        const msg = (data.message || '').toLowerCase();
        if (msg.includes('expiré') || msg.includes('expir')) {
          setState('expired');
        } else if (msg.includes('déjà été utilisé') || msg.includes('already been used')) {
          setState('used');
        } else if (msg.includes('déjà été signé') || msg.includes('déjà signé')) {
          setState('already-signed');
        } else if (msg.includes('introuvable') || msg.includes('invalide')) {
          setState('not-found');
        } else {
          setState('error');
        }
        return;
      }

      setContractInfo(data);
      setSignerName(`${data.staffFirstName} ${data.staffLastName}`.trim());
      setState('valid');
    } catch (err: any) {
      console.error('Error fetching contract info:', err);
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    fetchContractInfo();
  }, [fetchContractInfo]);

  // Handle signature submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !signatureData || !signerName.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/contracts-public/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          signerName: signerName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Erreur ${res.status}`);
      }

      setState('success');
    } catch (err: any) {
      console.error('Sign error:', err);
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────

  // Loading state
  if (state === 'loading') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Vérification du lien...">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: HELM_BLUE }} />
          <p className="text-slate-600 font-medium">Vérification du lien de signature...</p>
        </div>
      </PublicShell>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <PublicShell
        schoolName={contractInfo?.schoolName || 'Academia Helm'}
        schoolLogoUrl={contractInfo?.schoolLogoUrl}
        subtitle="Signature électronique de contrat"
      >
        <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden">
          <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" strokeWidth={2.5} />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">Contrat signé avec succès !</h1>
            <p className="text-emerald-100">
              Votre contrat a été signé électroniquement et est maintenant en vigueur.
            </p>
          </div>

          <div className="p-8 space-y-6">
            <div className="rounded-2xl p-5" style={{ background: `${HELM_NAVY}0a`, border: `1px solid ${HELM_BLUE}33` }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: HELM_BLUE }}>
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold mb-1" style={{ color: HELM_NAVY }}>Vos identifiants de connexion</h3>
                  <p className="text-sm" style={{ color: HELM_BLUE }}>
                    Un email contenant vos <strong>identifiants de connexion</strong> (nom
                    d&apos;utilisateur et mot de passe temporaire) vient d&apos;être envoyé à votre adresse{' '}
                    <strong>{contractInfo?.staffEmail}</strong>.
                  </p>
                  <p className="text-xs mt-2" style={{ color: HELM_BLUE, opacity: 0.85 }}>
                    Pensez à vérifier vos spams. Vous devrez changer ce mot de passe à votre
                    première connexion.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5">
              <h3 className="font-bold text-slate-700 mb-3">Prochaines étapes</h3>
              <ol className="space-y-2 text-sm text-slate-600">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: HELM_BLUE }}>1</span>
                  <span>Vérifiez votre boîte mail ({contractInfo?.staffEmail}) pour vos identifiants</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: HELM_BLUE }}>2</span>
                  <span>Connectez-vous à la plateforme Academia Helm avec ces identifiants</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white" style={{ background: HELM_BLUE }}>3</span>
                  <span>Modifiez votre mot de passe temporaire lors de la première connexion</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  // Error states (expired, used, already-signed, not-found, error)
  if (state !== 'valid') {
    const errorConfig = {
      expired: {
        icon: AlertCircle,
        title: 'Lien expiré',
        message:
          'Ce lien de signature a expiré. La période de validité (30 jours) est dépassée. Veuillez contacter l\'établissement pour obtenir un nouveau lien de signature.',
      },
      used: {
        icon: CheckCircle2,
        title: 'Lien déjà utilisé',
        message:
          'Ce lien de signature a déjà été utilisé. Le contrat a déjà été signé. Aucune action supplémentaire n\'est requise de votre part.',
      },
      'already-signed': {
        icon: CheckCircle2,
        title: 'Contrat déjà signé',
        message:
          'Ce contrat a déjà été signé. Aucune action supplémentaire n\'est requise de votre part.',
      },
      'not-found': {
        icon: AlertCircle,
        title: 'Lien invalide',
        message:
          'Ce lien de signature est invalide ou introuvable. Vérifiez que vous avez bien copié l\'URL complète depuis votre email.',
      },
      error: {
        icon: AlertCircle,
        title: 'Erreur',
        message:
          'Une erreur est survenue lors de la vérification du lien. Veuillez réessayer plus tard ou contacter l\'établissement.',
      },
    }[state];

    const Icon = errorConfig.icon;

    return (
      <PublicShell schoolName="Academia Helm" subtitle="Signature électronique">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-8 text-center" style={{ background: `linear-gradient(135deg, ${HELM_NAVY}, ${HELM_BLUE})` }}>
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
              <Icon className="w-12 h-12 text-rose-500" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">{errorConfig.title}</h1>
          </div>
          <div className="p-8 text-center">
            <p className="text-slate-600">{errorConfig.message}</p>
          </div>
        </div>
      </PublicShell>
    );
  }

  // Valid state — show contract info + signature form
  if (!contractInfo) return null;

  return (
    <PublicShell
      schoolName={contractInfo.schoolName}
      schoolLogoUrl={contractInfo.schoolLogoUrl}
      subtitle="Signature électronique de contrat"
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black" style={{ color: HELM_NAVY }}>
            Bonjour {contractInfo.staffFirstName} 👋
          </h1>
          <p className="text-slate-600">
            Veuillez vérifier les détails de votre contrat et le signer électroniquement ci-dessous.
          </p>
        </div>

        {/* Contract details card */}
        <PublicCard
          title="Détails du contrat"
          icon={<FileText className="w-5 h-5" />}
          accentColor={HELM_NAVY}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DetailItem icon={<Building2 className="w-4 h-4" />} label="Établissement" value={contractInfo.schoolName} />
            <DetailItem icon={<User className="w-4 h-4" />} label="Employé(e)" value={`${contractInfo.staffFirstName} ${contractInfo.staffLastName}`} />
            <DetailItem icon={<FileText className="w-4 h-4" />} label="Type de contrat" value={CONTRACT_TYPE_LABELS[contractInfo.contractType] || contractInfo.contractType} />
            <DetailItem icon={<Calendar className="w-4 h-4" />} label="Date de début" value={formatDate(contractInfo.startDate)} />
            {contractInfo.endDate && (
              <DetailItem icon={<Calendar className="w-4 h-4" />} label="Date de fin" value={formatDate(contractInfo.endDate)} />
            )}
            <DetailItem icon={<Euro className="w-4 h-4" />} label="Salaire de base" value={formatSalary(contractInfo.baseSalary)} />
            <DetailItem icon={<FileText className="w-4 h-4" />} label="Mode de paiement" value={PAYMENT_MODE_LABELS[contractInfo.paymentMode] || contractInfo.paymentMode} />
            {contractInfo.employerSignedAt && (
              <DetailItem icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} label="Signé par l'employeur" value={`${contractInfo.employerSignerName || '—'} le ${formatDate(contractInfo.employerSignedAt)}`} />
            )}
          </div>
        </PublicCard>

        {/* Signature form */}
        <form onSubmit={handleSubmit}>
          <PublicCard
            title="Votre signature électronique"
            icon={<PenTool className="w-5 h-5" />}
            accentColor={HELM_BLUE}
          >
            <div className="space-y-5">
              {/* Avertissement légal */}
              <div className="rounded-xl p-4" style={{ background: `${HELM_GOLD}10`, border: `1px solid ${HELM_GOLD}40` }}>
                <p className="text-sm" style={{ color: HELM_NAVY }}>
                  <strong>⚠️ Important :</strong> En signant ci-dessous, vous acceptez
                  électroniquement les termes de ce contrat. Votre signature a la même valeur
                  juridique qu&apos;une signature manuscrite. Votre adresse IP et l&apos;horodatage seront
                  enregistrés pour des raisons de sécurité et de traçabilité.
                </p>
              </div>

              {/* Nom du signataire */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nom complet du signataire
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Votre nom complet"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ce nom apparaîtra sur le contrat signé comme &quot;Signé par&quot;.
                </p>
              </div>

              {/* Canvas signature */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Votre signature <span className="text-rose-500">*</span>
                </label>
                <SignatureCanvas
                  width={500}
                  height={200}
                  onSignatureChange={setSignatureData}
                  placeholder="Dessinez votre signature ici (souris ou doigt)"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Dessinez votre signature dans le cadre ci-dessus. Cliquez sur l&apos;icône gomme en
                  haut à droite pour effacer et recommencer.
                </p>
              </div>

              {/* Error display */}
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-700 text-sm">Erreur lors de la signature</p>
                    <p className="text-rose-600 text-sm mt-1">{submitError}</p>
                  </div>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={!signatureData || !signerName.trim() || isSubmitting}
                className="w-full py-4 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${HELM_BLUE}, ${HELM_NAVY})` }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Signature en cours...
                  </>
                ) : (
                  <>
                    <PenTool className="w-5 h-5" /> Signer électroniquement le contrat
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-400">
                🔒 Votre signature est chiffrée et stockée de manière sécurisée. Elle est jointe
                au PDF du contrat et ne sera jamais utilisée à d&apos;autres fins.
              </p>
            </div>
          </PublicCard>
        </form>
      </div>
    </PublicShell>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-semibold text-slate-700 break-words">{value}</div>
      </div>
    </div>
  );
}
