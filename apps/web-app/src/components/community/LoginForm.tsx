'use client';

/**
 * LOGIN FORM — Connexion à Academia Community (/community/login)
 * Cookie httpOnly posé par le BFF ; redirection vers l'espace.
 * ============================================================================
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { communityApi } from '@/lib/community/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <p className="text-center text-[11.5px] text-slate-400">
        Pas encore membre ?{' '}
        <Link href="/community/join" className="text-[#0b2f73] font-medium hover:underline">
          Rejoindre (gratuit)
        </Link>
      </p>
    </form>
  );
}
