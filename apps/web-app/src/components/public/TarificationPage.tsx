'use client';

/**
 * Tarification Page — Academia Helm
 *
 * Page de tarification DYNAMIQUE — fetch les plans depuis l'API
 * (GET /api/public/pricing/plans) au lieu d'avoir les prix codés en dur.
 *
 * Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335, White
 */

import { useState, useEffect } from 'react';
import { Header } from '@/components/ui/header-1';
import Link from 'next/link';
import {
  CheckCircle,
  Users,
  ArrowRight,
  Shield,
  Zap,
  Star,
  Loader2,
  AlertCircle,
  Languages,
  Sparkles,
} from 'lucide-react';
import { Footer2 } from '@/components/ui/footer-2';

// ─── Types ───────────────────────────────────────────────────────────────

interface PricingPlan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  studentMin: number;
  studentMax: number | null;
  initialFee: number;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
  bilingualMonthly: number | null;
  bilingualYearly: number | null;
  features: string[];
  isPopular: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatFCFA(amount: number | null | undefined): string {
  if (amount == null) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function studentRange(plan: PricingPlan): string {
  if (plan.studentMax == null) return `${plan.studentMin}+ élèves`;
  return `${plan.studentMin} - ${plan.studentMax} élèves`;
}

// ─── Composant principal ─────────────────────────────────────────────────

export default function TarificationPage() {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetch('/api/public/pricing/plans', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPlans(data);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, []);

  const bilingualMonthly = plans[0]?.bilingualMonthly || 10000;
  const bilingualYearly = plans[0]?.bilingualYearly || 100000;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] text-white py-20 px-4">
          <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.15),transparent_70%)]" />
          <div className="relative max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-[#f5b335]" />
              <span className="text-sm font-semibold">Tous les modules inclus — sans restriction</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
              Une tarification <span className="text-[#f5b335]">simple</span> et <span className="text-[#f5b335]">transparente</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
              Choisissez le plan adapté à la taille de votre établissement. Tous les modules sont inclus.
              30 jours d'essai gratuit après la souscription initiale.
            </p>

            {/* Toggle Mensuel / Annuel */}
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full p-1 border border-white/20">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-[#f5b335] text-[#0a1d3f]' : 'text-blue-100 hover:text-white'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                  billingCycle === 'yearly' ? 'bg-[#f5b335] text-[#0a1d3f]' : 'text-blue-100 hover:text-white'
                }`}
              >
                Annuel <span className="text-xs opacity-80">(-2 mois)</span>
              </button>
            </div>
          </div>
        </section>

        {/* ─── Plans ─── */}
        <section className="py-16 px-4 -mt-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-[#0b2f73] animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Chargement des plans...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
                <p className="text-rose-600 font-bold mb-2">Erreur de chargement</p>
                <p className="text-sm text-slate-500">{error}</p>
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-slate-500 font-medium">Aucun plan disponible pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} billingCycle={billingCycle} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Option Bilingue ─── */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#1d4fa5] text-white shadow-2xl">
              {/* Décor */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.2),transparent_70%)]" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[radial-gradient(circle,rgba(29,79,165,0.3),transparent_70%)]" />

              <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
                {/* Icône */}
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#f5b335] to-[#e0a020] flex items-center justify-center shadow-xl shadow-amber-500/20">
                    <Languages className="w-10 h-10 text-[#0a1d3f]" strokeWidth={2.5} />
                  </div>
                </div>

                {/* Texte */}
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-[#f5b335]/20 border border-[#f5b335]/30 rounded-full px-3 py-1 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-[#f5b335]" />
                    <span className="text-[10px] font-bold text-[#f5b335] uppercase tracking-wider">Add-on optionnel</span>
                  </div>
                  <h3 className="text-2xl font-black mb-2">Option Bilingue</h3>
                  <p className="text-blue-100 text-sm leading-relaxed max-w-md">
                    Séparation des matières et examens pour les écoles bilingues (français / anglais).
                    Gérez les programmes des deux langues indépendamment, avec des bulletins adaptés.
                  </p>
                </div>

                {/* Prix */}
                <div className="text-center md:text-right flex-shrink-0">
                  <div className="text-3xl font-black text-[#f5b335] mb-1">
                    {formatFCFA(billingCycle === 'monthly' ? bilingualMonthly : bilingualYearly)}
                  </div>
                  <div className="text-xs text-blue-200 font-medium mb-3">
                    {billingCycle === 'monthly' ? 'par mois' : 'par an'}
                  </div>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                  >
                    Ajouter l'option <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] text-white">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Prêt à transformer votre établissement ?
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              Créez votre école sur Academia Helm et bénéficiez de 30 jours d'essai gratuit.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-[#f5b335] text-[#0a1d3f] px-8 py-4 rounded-xl font-black text-lg hover:scale-105 transition-transform shadow-xl"
            >
              Créer mon école <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-black text-[#0b2f73] mb-8 text-center">Questions fréquentes</h2>
            <div className="space-y-4">
              <FAQItem
                question="Que se passe-t-il après la souscription initiale ?"
                answer="Vous payez le frais de souscription initial une seule fois. Vous avez ensuite 30 jours d'essai gratuit avec accès à tous les modules. Après ces 30 jours, l'abonnement mensuel (ou annuel) démarre automatiquement."
              />
              <FAQItem
                question="Tous les modules sont-ils vraiment inclus ?"
                answer="Oui ! Contrairement à nos concurrents, nous ne limitons pas les modules. Vous avez accès à tous les modules principaux et supplémentaires, quel que soit votre plan. La seule différence entre les plans est le nombre d'élèves et le niveau de support."
              />
              <FAQItem
                question="Puis-je changer de plan en cours d'abonnement ?"
                answer="Oui, vous pouvez upgrader votre plan à tout moment. Le changement prend effet immédiatement et le prorata est calculé automatiquement. Le downgrade prend effet au début du prochain cycle de facturation."
              />
              <FAQItem
                question="Comment fonctionne l'option bilingue ?"
                answer="L'option bilingue est un add-on qui permet de séparer les matières et examens pour les écoles qui enseignent en français ET en anglais. Elle peut être ajoutée à n'importe quel plan, moyennant un supplément mensuel ou annuel."
              />
              <FAQItem
                question="Quels sont les moyens de paiement acceptés ?"
                answer="Nous acceptons les paiements par carte bancaire (Visa, Mastercard), mobile money (FedaPay) et virement bancaire. Le paiement annuel bénéficie de 2 mois gratuits."
              />
            </div>
          </div>
        </section>
      </main>
      <Footer2 />
    </>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function PlanCard({ plan, billingCycle }: { plan: PricingPlan; billingCycle: 'monthly' | 'yearly' }) {
  const monthly = billingCycle === 'monthly' ? plan.monthlyAmount : plan.yearlyAmount;
  const isSurDevis = monthly == null;

  return (
    <div
      className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.02] ${
        plan.isPopular
          ? 'bg-gradient-to-br from-[#0a1d3f] to-[#0b2f73] text-white shadow-2xl shadow-blue-300/50 ring-2 ring-[#f5b335] animate-[glow_3s_ease-in-out_infinite]'
          : 'bg-white border-2 border-slate-100 shadow-lg hover:shadow-xl'
      }`}
      style={
        plan.isPopular
          ? {
              animation: 'glowPulse 3s ease-in-out infinite',
            }
          : undefined
      }
    >
      {/* Badge Populaire */}
      {plan.isPopular && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-[#f5b335] via-[#e0a020] to-[#f5b335] text-[#0a1d3f] py-1.5 px-4 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wider">
          <Star className="w-3.5 h-3.5 fill-[#0a1d3f]" />
          Populaire
        </div>
      )}

      <div className={`p-6 ${plan.isPopular ? 'pt-10' : ''}`}>
        {/* Nom + tagline */}
        <h3 className={`text-xl font-black mb-1 ${plan.isPopular ? 'text-white' : 'text-[#0b2f73]'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm mb-3 ${plan.isPopular ? 'text-blue-200' : 'text-slate-500'}`}>
          {plan.tagline}
        </p>

        {/* Nombre d'élèves */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-4 ${
          plan.isPopular ? 'bg-white/10 text-blue-200' : 'bg-blue-50 text-[#0b2f73]'
        }`}>
          <Users className="w-3.5 h-3.5" />
          {studentRange(plan)}
        </div>

        {/* Prix */}
        <div className="mb-4">
          {isSurDevis ? (
            <div className={`text-3xl font-black ${plan.isPopular ? 'text-[#f5b335]' : 'text-[#0b2f73]'}`}>
              Sur devis
            </div>
          ) : (
            <>
              <div className={`text-3xl font-black ${plan.isPopular ? 'text-[#f5b335]' : 'text-[#0b2f73]'}`}>
                {formatFCFA(monthly)}
              </div>
              <div className={`text-xs font-medium ${plan.isPopular ? 'text-blue-200' : 'text-slate-400'}`}>
                {billingCycle === 'monthly' ? 'par mois' : 'par an'}
              </div>
            </>
          )}
        </div>

        {/* Souscription initiale */}
        <div className={`text-xs font-medium mb-4 pb-4 border-b ${
          plan.isPopular ? 'text-blue-200 border-white/10' : 'text-slate-500 border-slate-100'
        }`}>
          Souscription initiale : <span className="font-bold">{formatFCFA(plan.initialFee)}</span>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-6">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.isPopular ? 'text-[#f5b335]' : 'text-emerald-500'}`} />
              <span className={plan.isPopular ? 'text-blue-100' : 'text-slate-600'}>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/signup"
          className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${
            plan.isPopular
              ? 'bg-[#f5b335] text-[#0a1d3f] hover:scale-105'
              : 'bg-[#0b2f73] text-white hover:bg-[#144798]'
          }`}
        >
          {isSurDevis ? 'Demander un devis' : 'Choisir ce plan'}
        </Link>
      </div>

      {/* Animation glow keyframes injectées inline */}
      {plan.isPopular && (
        <style jsx>{`
          @keyframes glowPulse {
            0%, 100% {
              box-shadow: 0 0 20px rgba(245, 179, 53, 0.3), 0 0 40px rgba(245, 179, 53, 0.1);
            }
            50% {
              box-shadow: 0 0 30px rgba(245, 179, 53, 0.5), 0 0 60px rgba(245, 179, 53, 0.2);
            }
          }
        `}</style>
      )}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-bold text-sm text-[#0b2f73]">{question}</span>
        <span className={`text-[#0b2f73] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="p-4 pt-0 text-sm text-slate-600 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
