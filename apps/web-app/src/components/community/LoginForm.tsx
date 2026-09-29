'use client';

/**
 * LOGIN FORM — Connexion à Academia Community (/community/login)
 * Cookie httpOnly posé par le BFF ; redirection vers l'espace.
 * ============================================================================
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogIn, AlertCircle, School } from 'lucide-react';
import { communityApi } from '@/lib/community/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** ⭐ v2 — Pont applicatif : admin/enseignant déjà connecté à l'app →
   *  bouton unique (provision écoles/groupes automatique côté API) */
  const linkAppAccount = async () => {
    setLinkBusy(true);
    setError(null);
    try {
      await communityApi.provision();
      router.replace('/community/space');
    } catch (err: any) {
      setError(
        err?.status === 401
          ? 'Connectez-vous d\u2019abord à votre compte Academia Helm (app), puis revenez ici.'
          : err?.message ?? 'Liaison impossible',
      );
    } finally {
      setLinkBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await communityApi.login({ email: email.trim(), password });
      router.replace('/community/space');
    } catch (err: any) {
      setError(err?.message ?? 'Connexion impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-[11.5px] font-semibold text-slate-600 mb-1.5">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@ecole.com"
          required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0b2f73] focus:ring-2 focus:ring-[#0b2f73]/10 transition"
        />
      </div>
      <div>
        <label className="block text-[11.5px] font-semibold text-slate-600 mb-1.5">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#0b2f73] focus:ring-2 focus:ring-[#0b2f73]/10 transition"
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-[12px] text-red-600 px-1">
          <AlertCircle size={13} /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0b2f73] text-white font-bold text-[14px] hover:bg-[#1d4fa5] disabled:opacity-50 transition-colors shadow-md"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {busy ? 'Connexion…' : 'Entrer dans la communauté'}
      </button>

      {/* ⭐ v2 — Division : comptes écoles vs comptes communauté */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[10.5px] uppercase tracking-wider font-bold text-slate-400">ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* ⭐ v2 — Entrée directe avec le COMPTE ÉCOLE (provision automatique) */}
      <button
        type="button"
        onClick={linkAppAccount}
        disabled={linkBusy}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border-2 border-[#0b2f73]/20 text-[#0b2f73] font-bold text-[13px] hover:border-[#0b2f73] hover:bg-[#0b2f73]/5 disabled:opacity-50 transition-colors"
      >
        {linkBusy ? <Loader2 size={15} className="animate-spin" /> : <School size={15} />}
        {linkBusy ? 'Liaison…' : 'Entrer avec mon compte école Academia Helm'}
      </button>
      <p className="text-[10.5px] text-slate-400 text-center -mt-1">
        Administrateurs et enseignants : votre école et vos groupes sont ajoutés automatiquement.
      </p>

      <p className="text-center text-[11.5px] text-slate-400">
        Pas encore membre ?{' '}
        <Link href="/community/join" className="text-[#0b2f73] font-medium hover:underline">
          Rejoindre (gratuit)
        </Link>
      </p>
    </form>
  );
}
