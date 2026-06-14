'use client';

import { useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto mt-8 max-w-md rounded-xl bg-[#f5b335]/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5b335]/20">
          <svg className="h-6 w-6 text-[#f5b335]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-white">Merci pour votre inscription !</p>
        <p className="mt-1 text-sm text-white/60">
          Vous recevrez nos meilleurs articles chaque semaine.
        </p>
      </div>
    );
  }

  return (
    <>
      <form
        className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
        onSubmit={handleSubmit}
      >
        <input
          type="email"
          placeholder="votre@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 rounded-xl border-2 border-white/10 bg-white/10 px-5 py-3.5 text-sm text-white placeholder-white/40 outline-none transition-all duration-200 focus:border-[#f5b335] focus:ring-2 focus:ring-[#f5b335]/20"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f5b335] px-7 py-3.5 text-sm font-bold text-[#0b2f73] shadow-lg shadow-[#f5b335]/20 transition-all duration-200 hover:bg-[#f5c04a] hover:shadow-xl hover:shadow-[#f5b335]/30 active:scale-[0.98]"
        >
          S&apos;abonner
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </form>

      <p className="mt-4 text-xs text-white/30">
        Aucun spam. Désabonnement en un clic. Nous respectons votre vie privée.
      </p>
    </>
  );
}
