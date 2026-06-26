'use client';

/**
 * ============================================================================
 * ContactForm — Formulaire de contact public pour le site institutionnel
 * ============================================================================
 *
 * POST vers /api/tenant-website/public/{tenantSlug}/contact
 *
 * 100% non-technique : aucun slug visible, validation inline, feedback clair.
 * ============================================================================
 */

import { useState } from 'react';
import { Send, Check, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  tenantSlug: string;
  accentColor?: string; // hex or hsl
  primaryColor?: string;
}

export function ContactForm({ tenantSlug, accentColor = '#f5b335', primaryColor = '#0b2f73' }: Props) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation simple
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus('error');
      setErrorMsg('Veuillez remplir au moins votre nom, votre email et votre message.');
      return;
    }

    // Validation email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setStatus('error');
      setErrorMsg('Votre adresse email ne semble pas valide.');
      return;
    }

    if (form.message.length > 5000) {
      setStatus('error');
      setErrorMsg('Votre message est trop long (max 5000 caractères).');
      return;
    }

    setStatus('sending');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/tenant-website/public/${encodeURIComponent(tenantSlug)}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `Erreur ${res.status}`);
      }

      setStatus('success');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      setTimeout(() => setStatus('idle'), 6000);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message || 'Une erreur est survenue. Veuillez réessayer.');
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:border-transparent outline-none transition text-sm';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  if (status === 'success') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">Message envoyé !</h3>
        <p className="text-sm text-slate-600">
          Merci pour votre message. L'établissement vous répondra dans les meilleurs délais.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nom complet *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            placeholder="Jean Dupont"
          />
        </div>
        <div>
          <label className={labelClass}>Email *</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
            placeholder="jean.dupont@email.com"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Téléphone (optionnel)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputClass}
            placeholder="+229 00 00 00 00"
          />
        </div>
        <div>
          <label className={labelClass}>Objet (optionnel)</label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            className={inputClass}
            placeholder="Demande d'information"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Message *</label>
        <textarea
          required
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className={`${inputClass} resize-y`}
          placeholder="Votre message…"
          maxLength={5000}
        />
        <p className="text-xs text-slate-400 mt-1 text-right">{form.message.length} / 5000</p>
      </div>

      {status === 'error' && errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 flex-1">{errorMsg}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: primaryColor }}
      >
        {status === 'sending' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Envoyer le message
          </>
        )}
      </button>
    </form>
  );
}
