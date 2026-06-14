'use client';

import React, { useState } from 'react';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import {
  Mail,
  Phone,
  MapPin,
  Send,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Building2,
  User,
} from 'lucide-react';

/* ─── Palette ─── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/* ─── Types ─── */
interface FormState {
  name: string;
  email: string;
  phone: string;
  establishment: string;
  subject: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
}

const SUBJECT_OPTIONS = [
  { value: '', label: 'Sélectionnez un objet' },
  { value: 'Demande de démonstration', label: 'Demande de démonstration' },
  { value: 'Demande de devis', label: 'Demande de devis' },
  { value: 'Support technique', label: 'Support technique' },
  { value: 'Partenariat', label: 'Partenariat' },
  { value: 'Autre', label: 'Autre' },
];

/* ══════════════════════════════════════════════════════════════════════
   Contact Page
   ══════════════════════════════════════════════════════════════════════ */
export default function ContactPage() {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    phone: '',
    establishment: '',
    subject: '',
    message: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  /* ─── Validation ─── */
  const validate = (): FormErrors => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Le nom complet est requis';
    if (!form.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "L'email n'est pas valide";
    if (form.phone && !/^[+\d\s()-]{6,20}$/.test(form.phone)) e.phone = 'Le numéro de téléphone n\'est pas valide';
    if (!form.subject) e.subject = "L'objet est requis";
    if (!form.message.trim()) e.message = 'Le message est requis';
    else if (form.message.trim().length < 20) e.message = 'Le message doit contenir au moins 20 caractères';
    return e;
  };

  /* ─── Submit handler ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setToast({ type: 'success', message: 'Votre message a été envoyé avec succès ! Nous vous répondrons sous 48h.' });
        setForm({ name: '', email: '', phone: '', establishment: '', subject: '', message: '' });
        setErrors({});
      } else {
        setToast({ type: 'error', message: data.error || "Une erreur est survenue. Veuillez réessayer." });
      }
    } catch {
      setToast({ type: 'error', message: 'Erreur réseau. Veuillez vérifier votre connexion et réessayer.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToast(null), 6000);
    }
  };

  /* ─── Input change helper ─── */
  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof FormErrors];
        return next;
      });
    }
  };

  /* ══════════════════════════  RENDER  ══════════════════════════ */
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="h-14" />

      {/* ── A. Hero Section ── */}
      <section
        className="relative overflow-hidden py-12 md:py-16 px-4 sm:px-6 lg:px-8"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent 70%)`, transform: 'translate(30%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-10" style={{ background: `radial-gradient(circle, ${GOLD}, transparent 70%)`, transform: 'translate(-30%, 30%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Gold accent badge */}
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 shadow-lg"
            style={{ backgroundColor: GOLD, color: NAVY }}
          >
            <MessageCircle className="w-4 h-4" />
            Nous sommes là pour vous
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Parlons de votre projet{' '}
            <span style={{ color: GOLD }}>éducatif</span>
          </h1>

          <p className="text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
            Que vous soyez directeur d&apos;établissement, promoteur ou partenaire, l&apos;équipe Academia Helm
            vous accompagne pour transformer votre école avec le cockpit digital le plus avancé d&apos;Afrique de l&apos;Ouest.
          </p>
        </div>
      </section>

      {/* ── B. Contact Info Cards ── */}
      <section className="py-8 md:py-10 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Email */}
            <div
              className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${NAVY}08, ${BLUE}08)` }} />
              <div className="relative z-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>Email</h3>
                <a
                  href="mailto:support@academiahelm.com"
                  className="text-sm font-medium hover:underline transition-colors"
                  style={{ color: BLUE }}
                >
                  support@academiahelm.com
                </a>
                <p className="text-xs text-gray-400 mt-2">Réponse sous 48h ouvrées</p>
              </div>
            </div>

            {/* Téléphone */}
            <div
              className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${NAVY}08, ${BLUE}08)` }} />
              <div className="relative z-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>Téléphone</h3>
                <a
                  href="tel:+2290141360803"
                  className="text-sm font-medium hover:underline transition-colors"
                  style={{ color: BLUE }}
                >
                  +229 01 41 36 08 03
                </a>
                <p className="text-xs text-gray-400 mt-2">Lun-Ven, 8h-17h (GMT+1)</p>
              </div>
            </div>

            {/* Adresse */}
            <div
              className="group relative bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-center overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `linear-gradient(135deg, ${NAVY}08, ${BLUE}08)` }} />
              <div className="relative z-10">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:scale-110 transition-transform duration-300"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: NAVY }}>Adresse</h3>
                <p className="text-sm font-medium" style={{ color: BLUE }}>
                  Parakou, Bénin
                </p>
                <p className="text-xs text-gray-400 mt-1">Afrique de l&apos;Ouest</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── C. Main Content Area ── */}
      <section className="py-8 md:py-12 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">

            {/* ── Left Column: Contact Form (3 cols) ── */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6 sm:p-8 md:p-10">
                <div className="mb-5">
                  <h2 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: NAVY }}>
                    Envoyez-nous un message
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Remplissez le formulaire ci-dessous et notre équipe vous répondra dans les plus brefs délais.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  {/* Nom complet */}
                  <div>
                    <label htmlFor="contact-name" className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                      <User className="w-4 h-4" style={{ color: GOLD }} />
                      Nom complet <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ex : Jean Dupont"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-transparent focus:ring-2"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
                  </div>

                  {/* Email + Téléphone row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contact-email" className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                        <Mail className="w-4 h-4" style={{ color: GOLD }} />
                        Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="jean@ecole.com"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-transparent focus:ring-2"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      />
                      {errors.email && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
                    </div>

                    <div>
                      <label htmlFor="contact-phone" className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                        <Phone className="w-4 h-4" style={{ color: GOLD }} />
                        Téléphone
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="+229 01 41 36 08 03"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-transparent focus:ring-2"
                        style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                      />
                      {errors.phone && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.phone}</p>}
                    </div>
                  </div>

                  {/* Établissement */}
                  <div>
                    <label htmlFor="contact-establishment" className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                      <Building2 className="w-4 h-4" style={{ color: GOLD }} />
                      Établissement
                    </label>
                    <input
                      id="contact-establishment"
                      type="text"
                      value={form.establishment}
                      onChange={(e) => handleChange('establishment', e.target.value)}
                      placeholder="Nom de votre école ou institution"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-transparent focus:ring-2"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                  </div>

                  {/* Objet */}
                  <div>
                    <label htmlFor="contact-subject" className="flex items-center gap-2 text-sm font-semibold mb-1.5" style={{ color: NAVY }}>
                      Objet <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="contact-subject"
                      value={form.subject}
                      onChange={(e) => handleChange('subject', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 appearance-none cursor-pointer"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    >
                      {SUBJECT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} disabled={!opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {errors.subject && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.subject}</p>}
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="contact-message" className="text-sm font-semibold mb-1.5 block" style={{ color: NAVY }}>
                      Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      rows={5}
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      placeholder="Décrivez votre besoin, votre projet ou votre question... (minimum 20 caractères)"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:border-transparent focus:ring-2 resize-y"
                      style={{ '--tw-ring-color': GOLD } as React.CSSProperties}
                    />
                    <div className="flex justify-between items-center mt-1">
                      {errors.message ? (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.message}</p>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {form.message.length > 0 && `${form.message.length} caractère${form.message.length > 1 ? 's' : ''}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-base font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, #e09a1f)` }}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Envoyer le message
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ── Right Column: Map + Info (2 cols) ── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100">
                  <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: NAVY }}>
                    <MapPin className="w-5 h-5" style={{ color: GOLD }} />
                    Notre localisation
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Parakou, Bénin — Afrique de l&apos;Ouest</p>
                </div>
                <div className="relative w-full" style={{ paddingBottom: '75%' }}>
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d61488.56242828572!2d2.5797!3d9.3372!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x1025db8a3e9b9b9b%3A0x8e8e8e8e8e8e8e8e!2sParakou%2C%20B%C3%A9nin!5e0!3m2!1sfr!2sfr!4v1234567890"
                    width="100%"
                    height="100%"
                    style={{ border: 0, position: 'absolute', top: 0, left: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Carte Parakou, Bénin"
                  />
                </div>
              </div>

              {/* Quick Info Panel */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-5 sm:p-6">
                <h3 className="text-lg font-bold mb-4" style={{ color: NAVY }}>
                  Informations pratiques
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${NAVY}10` }}>
                      <Mail className="w-5 h-5" style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>Email</p>
                      <a href="mailto:support@academiahelm.com" className="text-sm text-gray-500 hover:underline">
                        support@academiahelm.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${NAVY}10` }}>
                      <Phone className="w-5 h-5" style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>Téléphone</p>
                      <a href="tel:+2290141360803" className="text-sm text-gray-500 hover:underline">
                        +229 01 41 36 08 03
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${NAVY}10` }}>
                      <MapPin className="w-5 h-5" style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>Adresse</p>
                      <p className="text-sm text-gray-500">Parakou, Bénin — Afrique de l&apos;Ouest</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${GOLD}20` }}>
                      <MessageCircle className="w-5 h-5" style={{ color: GOLD }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: NAVY }}>WhatsApp</p>
                      <a
                        href="https://wa.me/2290141360803"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-600 hover:underline font-medium"
                      >
                        Discuter sur WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                {/* Hours */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-semibold mb-2" style={{ color: NAVY }}>Horaires de support</h4>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>Lundi — Vendredi</span>
                      <span className="font-medium text-gray-700">8h — 17h (GMT+1)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Samedi</span>
                      <span className="font-medium text-gray-700">9h — 13h (GMT+1)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dimanche</span>
                      <span className="font-medium text-gray-400">Fermé</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── D. Footer ── */}
      <div className="mt-auto">
        <Footer2 />
      </div>

      {/* ── Toast notification ── */}
      {toast && (
        <div className="fixed top-20 right-4 z-[60] max-w-sm animate-in slide-in-from-right duration-300">
          <div
            className={`flex items-start gap-3 rounded-xl px-5 py-4 shadow-2xl border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className={`text-sm font-semibold ${toast.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}>
                {toast.type === 'success' ? 'Message envoyé !' : 'Erreur'}
              </p>
              <p className={`text-xs mt-0.5 ${toast.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Floating WhatsApp Button ── */}
      <a
        href="https://wa.me/2290141360803"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contacter via WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 group"
      >
        <MessageCircle className="w-7 h-7 text-white group-hover:animate-pulse" />
        {/* Tooltip */}
        <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-md">
          Écrivez-nous sur WhatsApp
        </span>
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-30" />
      </a>
    </div>
  );
}
