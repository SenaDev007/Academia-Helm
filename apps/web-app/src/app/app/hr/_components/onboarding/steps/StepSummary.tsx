'use client';

import { useState } from 'react';
import { CheckCircle, User, FileText, PenTool, Mail, Loader2, PartyPopper, Send } from 'lucide-react';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

interface StepSummaryProps {
  staffId: string | null;
  contractId: string | null;
  tenantId: string;
  staffFullName: string;
  identity: any;
  employment: any;
  contract: any;
  signatureMode: 'presentiel' | 'differe';
  employerSigned: boolean;
  employeeSigned: boolean;
  sendEmail: boolean;
  onSendEmailChange: (v: boolean) => void;
  onCompleted: () => void;
}

export function StepSummary({
  staffId,
  contractId,
  tenantId,
  staffFullName,
  identity,
  employment,
  contract,
  signatureMode,
  employerSigned,
  employeeSigned,
  sendEmail,
  onSendEmailChange,
  onCompleted,
}: StepSummaryProps) {
  const [finalizing, setFinalizing] = useState(false);
  const [completed, setCompleted] = useState(false);

  // ⭐ canFinalize dépend du mode :
  //    - présentiel : employeur ET employé doivent avoir signé
  //    - différé    : seul l'employeur doit avoir signé (l'employé signera à distance)
  const canFinalize = signatureMode === 'differe'
    ? !!(staffId && contractId && employerSigned)
    : !!(staffId && contractId && employerSigned && employeeSigned);

  const handleFinalize = async () => {
    if (!staffId || !contractId) return;
    try {
      setFinalizing(true);
      await hrFetch(hrUrl('contracts/onboarding/complete', { tenantId }), {
        method: 'POST',
        body: {
          staffId,
          contractId,
          sendEmail,
          // ⭐ asyncSign=true en mode différé : le backend va
          //   - skipper l'activation du staff (reste PENDING_HIRE)
          //   - skipper l'avancement de HrApplication (reste ÉLIGIBLE)
          //   - générer un token de signature
          //   - envoyer notifyHired avec le lien de signature
          //   Quand l'employé signera à distance (signContract EMPLOYE),
          //   le backend activera le staff, avancera HrApplication à EMBAUCHÉ
          //   et créera les credentials.
          asyncSign: signatureMode === 'differe',
        },
      });
      setCompleted(true);
      onCompleted();
      toast({
        variant: 'success',
        title: signatureMode === 'differe'
          ? 'Email de signature envoyé !'
          : 'Onboarding finalisé avec succès !',
      });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur lors de la finalisation', description: err?.message });
    } finally {
      setFinalizing(false);
    }
  };

  const contractTypeLabels: Record<string, string> = {
    CDI: 'Contrat à Durée Indéterminée',
    CDD: 'Contrat à Durée Déterminée',
    VACATAIRE: 'Contrat de Vacation',
    STAGE: 'Convention de Stage',
    CONSULTANT: 'Contrat de Consultation',
  };

  const roleTypeLabels: Record<string, string> = {
    TEACHER: 'Corps Enseignant',
    ADMIN: 'Administration',
    SUPPORT: "Personnel d'appui",
    DIRECTOR: 'Direction',
  };

  if (completed) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
          <PartyPopper className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          {signatureMode === 'differe' ? 'Email de signature envoyé !' : 'Onboarding Terminé !'}
        </h3>
        <p className="text-sm text-slate-500">
          {signatureMode === 'differe' ? (
            <>
              Le contrat a été envoyé par email à <strong>{staffFullName}</strong>.
              Lorsqu&apos;il cliquera sur le lien et signera à distance, son compte sera activé
              et ses identifiants de connexion lui seront envoyés automatiquement.
            </>
          ) : (
            <>
              Le dossier de <strong>{staffFullName}</strong> a été créé avec succès. Le contrat est signé et en vigueur.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <CheckCircle className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Récapitulatif &amp; Finalisation</h4>
          <p className="text-[11px] text-slate-400">Vérifiez les informations avant de finaliser l&apos;onboarding</p>
        </div>
      </div>

      {/* Staff Info */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-[#1d4fa5]" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Informations du Personnel</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-xs text-slate-400">Nom complet</span><p className="font-bold text-slate-800">{staffFullName}</p></div>
          <div><span className="text-xs text-slate-400">Email</span><p className="font-semibold text-slate-700">{identity.email || '—'}</p></div>
          <div><span className="text-xs text-slate-400">Téléphone</span><p className="font-semibold text-slate-700">{identity.phone || '—'}</p></div>
          <div><span className="text-xs text-slate-400">Poste</span><p className="font-semibold text-slate-700">{employment.position || '—'}</p></div>
          <div><span className="text-xs text-slate-400">Catégorie</span><p className="font-semibold text-slate-700">{roleTypeLabels[employment.roleType] || employment.roleType}</p></div>
          <div><span className="text-xs text-slate-400">Nationalité</span><p className="font-semibold text-slate-700">{identity.nationality || '—'}</p></div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 text-[#1d4fa5]" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Contrat de Travail</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div><span className="text-xs text-slate-400">Type</span><p className="font-bold text-slate-800">{contractTypeLabels[contract.contractType] || contract.contractType}</p></div>
          <div><span className="text-xs text-slate-400">Date de début</span><p className="font-semibold text-slate-700">{contract.startDate}</p></div>
          <div><span className="text-xs text-slate-400">Salaire</span><p className="font-bold text-[#0b2f73]">{parseInt(contract.baseSalary || '0').toLocaleString('fr-FR')} XOF</p></div>
        </div>
      </div>

      {/* Signatures */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <PenTool className="h-4 w-4 text-[#1d4fa5]" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Signatures</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className={`flex items-center gap-2 p-2 rounded-lg ${employerSigned ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-semibold">{employerSigned ? 'Employeur signé' : 'Employeur non signé'}</span>
          </div>
          {signatureMode === 'presentiel' ? (
            <div className={`flex items-center gap-2 p-2 rounded-lg ${employeeSigned ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-semibold">{employeeSigned ? 'Employé signé' : 'Employé non signé'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 text-blue-700">
              <Mail className="h-4 w-4" />
              <span className="text-sm font-semibold">Employé signera à distance</span>
            </div>
          )}
        </div>
      </div>

      {/* ⭐ Info spécifique au mode différé */}
      {signatureMode === 'differe' && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/30">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h5 className="text-sm font-bold text-slate-800 mb-1">Signature à distance</h5>
              <p className="text-[12px] text-slate-600">
                En cliquant sur &laquo; Finaliser &raquo;, un email sera envoyé à <strong>{identity.email}</strong> avec
                un lien sécurisé. L&apos;employé(e) signera à distance — le contrat passera à ACTIF,
                son compte sera activé et ses identifiants lui seront envoyés automatiquement.
                Cette procédure est identique au flux de recrutement public.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email notification */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => onSendEmailChange(e.target.checked)}
            className="rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]"
          />
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">
              {signatureMode === 'differe'
                ? "Envoyer l'email de signature à l'employé(e) (recommandé)"
                : "Envoyer une copie du contrat signé à l'employé(e)"}
            </span>
          </div>
        </label>
      </div>

      {/* Finalize Button */}
      <button
        type="button"
        onClick={handleFinalize}
        disabled={finalizing || !canFinalize}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 transition hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}
      >
        {finalizing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : signatureMode === 'differe' ? (
          <Send className="h-5 w-5" />
        ) : (
          <CheckCircle className="h-5 w-5" />
        )}
        {finalizing
          ? (signatureMode === 'differe' ? 'Envoi en cours...' : 'Finalisation en cours...')
          : (signatureMode === 'differe' ? 'Envoyer le contrat pour signature à distance' : 'Finaliser l\'Onboarding')}
      </button>

      {!canFinalize && (
        <p className="text-center text-xs text-amber-600">
          Veuillez compléter toutes les étapes précédentes (notamment la signature employeur) avant de finaliser.
        </p>
      )}
    </div>
  );
}
