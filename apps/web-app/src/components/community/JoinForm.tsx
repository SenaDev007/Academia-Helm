'use client';

/**
 * ============================================================================
 * JOIN FORM — Inscription à Academia Community (/community/join?invite=…)
 * ============================================================================
 * Crée le compte membre (approbation auto par défaut) puis redirige
 * directement vers l'espace. Un lien d'invitation pré-tague le membre
 * (prospect / client / partenaire) pour le pilotage marketing de l'équipe.
 * ============================================================================
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { communityApi } from '@/lib/community/client';

export function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get('invite') ?? undefined;

  const [form, setForm] = useState({ displayName: '', email: '', password: '', organization: '', country: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await communityApi.register({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        password: form.password,
        organization: form.organization.trim() || undefined,
        country: form.country.trim() || undefined,
        phone: form.phone.trim() || undefined,
        inviteToken,
      });
      if (res.pending) {
        setPending(true);
      } else {
        router.replace('/community/space');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Inscription impossible — réessayez');
    } finally {
      setBusy(false);
    }
  };

  if (pending) {
    return (
      <div className="text-center py-10 space-y-4">
        <Clock className="w-12 h-12 text-[#f5b335] mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Compte créé — en attente de validation</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto">
          L&apos;équipe Academia Helm validera votre accès très rapidement.
          Vous pourrez ensuite vous connecter avec ces identifiants.
        </p>
        <Link href="/community/login" className="inline-block text-[#0b2f73] font-medium hover:underline text-sm">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  const fields = [
    { key: 'displayName', label: 'Nom d\u2019affichage *', placeholder: 'Ex : Akpovi Sènami', type: 'text', required: true },
    { key: 'email', label: 'Email *', placeholder: 'vous@ecole.com', type: 'email', required: true },
    { key: 'password', label: 'Mot de passe * (8 caractères min.)', placeholder: '••••••••', type: 'password', required: true },
    { key: 'organization', label: 'Établissement / organisation', placeholder: 'Ex : Complexe Scolaire Privé Entrepreneuriat', type: 'text', required: false },
    { key: 'country', label: 'Pays', placeholder: 'Ex : Bénin', type: 'text', required: false },
    { key: 'phone', label: 'Téléphone (WhatsApp)', placeholder: '+229 …', type: 'tel', required: false },
  ];

  return (
    <form onSubmit={submit} className="space-y-4">
      {inviteToken && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-[12.5px] text-emerald-800">
          <CheckCircle2 size={15} />
          Invitation détectée — votre compte sera pré-configuré.
        </div>
      )}
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-[11.5px] font-semibold text-slate-600 mb-1.5">{f.label}</label>
          <input
            type={f.type}
            value={(form as any)[f.key]}
            onChange={set(f.key)}
            placeholder={f.placeholder}
            required={f.required}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0b2f73] focus:ring-2 focus:ring-[#0b2f73]/10 transition"
          />
        </div>
      ))}
      {error && <p className="text-[12px] text-red-600 px-1">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0b2f73] text-white font-bold text-[14px] hover:bg-[#1d4fa5] disabled:opacity-50 transition-colors shadow-md"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {busy ? 'Création…' : 'Rejoindre la communauté'}
      </button>
      <p className="text-center text-[11.5px] text-slate-400">
        Déjà membre ?{' '}
        <Link href="/community/login" className="text-[#0b2f73] font-medium hover:underline">
          Connectez-vous
        </Link>
      </p>
    </form>
  );
}
