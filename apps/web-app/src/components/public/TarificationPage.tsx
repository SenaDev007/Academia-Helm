'use client';

/**
 * Tarification Page — Academia Helm
 *
 * Page de tarification DYNAMIQUE — fetch les plans depuis l'API
 * (GET /api/public/pricing/plans) au lieu d'avoir les prix codés en dur.
 *
 * ⭐ Alignée sur le contrat d'abonnement Academia Helm (Article 4) :
 *   - 4 plans : Helm Essentiel / Croissance / Performance / Institution
 *   - Facturation ANNUELLE uniquement (pas d'option mensuelle)
 *   - Frais d'activation uniformes : 500 000 FCFA
 *   - Add-ons : bilingue 100 000 FCFA/an, WhatsApp gratuit, SMS/Email/Voice au prix coûtant
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
  AlertCircle,
  Languages,
  Sparkles,
  Loader2,
  MessageSquare,
  Mail,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Footer2 } from '@/components/ui/footer-2';

// ─── Liens FedaPay directs (page de paiement hébergée par FedaPay) ────────
// ⭐ Configuration fournie par le client (14 août 2026) :
//    Chaque plan a son propre lien FedaPay qui pré-remplit le montant
//    d'activation + le libellé du plan.
//    ⚠️ RÉVISION TARIFAIRE : l'activation est passée de 300 000 à 500 000 FCFA.
//    Les liens hébergés FedaPay ci-dessous doivent être recréés dans le
//    tableau de bord FedaPay avec le NOUVEAU montant (500 000 FCFA), puis
//    mis à jour ici (sinon la page de paiement FedaPay encaissera 300 000).
//    L'option bilingue a son propre lien séparé (100 000 FCFA/an — ⚠️ à
//    recréer dans FedaPay avec le nouveau montant).
const FEDAPAY_LINKS: Record<string, string> = {
  SEED: 'https://me.fedapay.com/fR9fHMGM',     // Helm Essentiel — activation (à recréer à 500 000)
  GROW: 'https://me.fedapay.com/C10KvvLW',     // Helm Croissance — activation (à recréer à 500 000)
  LEAD: 'https://me.fedapay.com/UwOWk2GZ',     // Helm Performance — activation (à recréer à 500 000)
  NETWORK: 'https://me.fedapay.com/IlZhBDDi',  // Helm Institution — activation (à recréer à 500 000)
  BILINGUAL: 'https://me.fedapay.com/JZSXICow', // Option bilingue — 100k/an (à recréer à 100 000)
};

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

  // Add-ons (contrat Article 4) — bilingue 100 000 FCFA/an (révision tarifaire)
  const bilingualYearly = plans[0]?.bilingualYearly || 100000;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] text-white py-20 px-4">
          <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
          {/* Glowing floating circles (signature Win Agro) */}
          <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.15),transparent_70%)] animate-float" />
          <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(29,79,165,0.20),transparent_70%)] animate-float" style={{ animationDelay: '2s' }} />
          {/* SVG noise grain (texture premium Win Agro) */}
          <svg
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay"
          >
            <filter id="noiseFilter-tarif-hero">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter-tarif-hero)" />
          </svg>
          <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay pointer-events-none" />
          <div className="relative max-w-5xl mx-auto text-center">
            {/* Badge avec ping pulse (signature Win Agro) */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6 animate-pulse-slow">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5b335] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f5b335]" />
              </span>
              <Sparkles className="w-4 h-4 text-[#f5b335]" />
              <span className="text-sm font-semibold">21 modules métier + 6 modules complémentaires inclus — sans restriction</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 font-serif">
              Une tarification <span className="text-[#f5b335]">simple</span> et <span className="text-[#f5b335]">transparente</span>
            </h1>
            {/* Animated underline separator (signature Win Agro) */}
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto my-5 rounded-full"
              style={{ background: '#f5b335' }}
            />
            <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
              Choisissez le plan adapté à la taille de votre établissement. Facturation
              annuelle, frais d&apos;activation uniques de 500 000 FCFA, WhatsApp illimité
              inclus dans tous les plans.
            </p>

            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full p-1 border border-white/20">
              <span className="px-6 py-2 rounded-full text-sm font-bold bg-[#f5b335] text-[#0a1d3f] btn-shimmer">
                Facturation annuelle
              </span>
              <span className="px-6 py-2 text-sm font-bold text-blue-100">
                Frais d&apos;activation : 500 000 FCFA
              </span>
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
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─── Add-ons (Article 4 du contrat) ─── */}
        <section className="py-16 px-4 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-black text-[#0b2f73] mb-3">
                Add-ons & canaux de communication
              </h2>
              <p className="text-sm md:text-base text-slate-600 max-w-3xl mx-auto">
                Alignés sur le contrat d&apos;abonnement (Article 4). WhatsApp est gratuit
                et illimité dans tous les plans. SMS, Email et Voice sont refacturés au
                prix coûtant selon la consommation réelle.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Bilingue */}
              <div className="bg-white rounded-2xl p-6 border-2 border-[#f5b335]/30 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5b335] to-[#e0a020] flex items-center justify-center">
                    <Languages className="w-5 h-5 text-[#0a1d3f]" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-[#0b2f73]">Option bilingue FR/EN</h3>
                </div>
                <p className="text-3xl font-black text-[#f5b335] mb-1">
                  {formatFCFA(bilingualYearly)}
                </p>
                <p className="text-xs text-slate-500 mb-3">par an · en supplément du plan</p>
                <p className="text-xs text-slate-600">
                  Interface et documents générés en FR et EN simultanément. Séparation
                  des matières, examens et bulletins par langue.
                </p>
                {/* ⭐ Bouton "Payer l'option bilingue" → ouvre FedaPay direct */}
                <a
                  href={FEDAPAY_LINKS.BILINGUAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#f5b335] text-[#0a1d3f] rounded-lg text-xs font-bold hover:scale-105 transition-transform"
                >
                  Payer l'option bilingue <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* WhatsApp */}
              <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-[#0b2f73]">WhatsApp</h3>
                </div>
                <p className="text-3xl font-black text-emerald-600 mb-1">Gratuit</p>
                <p className="text-xs text-slate-500 mb-3">illimité · inclus dans tous les plans</p>
                <p className="text-xs text-slate-600">
                  Notifications parents, annonces, échanges sans limite. Aucun surcoût,
                  quelle que soit votre consommation.
                </p>
              </div>

              {/* SMS / Email / Voice */}
              <div className="bg-white rounded-2xl p-6 border-2 border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-[#0b2f73]">SMS · Email · Voice</h3>
                </div>
                <p className="text-3xl font-black text-slate-700 mb-1">Au prix coûtant</p>
                <p className="text-xs text-slate-500 mb-3">refacturation transparente</p>
                <div className="space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email selon consommation réelle
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> SMS / Voice selon pays de destination
                  </p>
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
              Créez votre école sur Academia Helm. Frais d&apos;activation de 500 000 FCFA
              à la signature, puis abonnement annuel à partir de 50 000 FCFA/an.
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
                question="Que comprend le frais d'activation de 500 000 FCFA ?"
                answer="Le frais d'activation unique de 500 000 FCFA est payable à la signature du contrat. Il couvre la configuration de votre établissement, l'initialisation de la plateforme, la formation initiale et le démarrage. Il est identique quel que soit le plan choisi."
              />
              <FAQItem
                question="Comment fonctionne la facturation annuelle ?"
                answer="Vous payez le frais d'activation à la signature, puis le frais annuel de votre plan (50 000 à 150 000 FCFA selon la tranche d'élèves) chaque année à la date d'échéance annuelle. Une pénalité de retard est applicable 15 jours après l'échéance, avec suspension possible du service."
              />
              <FAQItem
                question="Tous les modules sont-ils vraiment inclus ?"
                answer="Oui ! Contrat en main : 21 modules métier + 6 modules complémentaires sont inclus dans tous les plans, sans restriction. Web + Desktop + Mobile, offline-first, agents IA (ORION, SARA, ATLAS), paiements en ligne, multi-caisses, multi-niveaux, personnalisation de marque et site institutionnel."
              />
              <FAQItem
                question="Puis-je changer de plan en cours d'abonnement ?"
                answer="Oui, vous pouvez upgrader votre plan à tout moment si votre effectif augmente. Le changement prend effet immédiatement et le prorata est calculé automatiquement. Le downgrade prend effet au début du prochain cycle annuel."
              />
              <FAQItem
                question="Comment fonctionne l'option bilingue ?"
                answer="L'option bilingue FR/EN est un add-on de 100 000 FCFA/an qui permet de séparer les matières et examens pour les écoles qui enseignent en français ET en anglais. Elle peut être ajoutée à n'importe quel plan, quel que soit le nombre d'élèves."
              />
              <FAQItem
                question="Comment payer l'activation de mon compte ?"
                answer="Le paiement des frais d'activation (500 000 FCFA) se fait directement en ligne via FedaPay (Mobile Money ou carte bancaire). Cliquez sur le bouton « Payer l'activation via FedaPay » du plan choisi sur cette page. Après confirmation du paiement, vous recevez un email avec le lien de finalisation de votre contrat d'abonnement et la création de votre école."
              />
              <FAQItem
                question="Quels sont les autres moyens de paiement acceptés ?"
                answer="Conformément au contrat (Article 4) : virement bancaire, Mobile Money via FedaPay, ou espèces contre reçu. WhatsApp est gratuit et illimité dans tous les plans. Les SMS, emails et appels vocaux sont refacturés au prix coûtant selon la consommation."
              />
              <FAQItem
                question="Comment sont déterminées les tranches d'élèves ?"
                answer="Les tranches sont : Helm Essentiel (1-50 élèves), Helm Croissance (51-150 élèves), Helm Performance (151-400 élèves) et Helm Institution (401 élèves et +). Si votre effectif réel dépasse la limite de votre plan, vous serez invité à upgrader vers le plan supérieur."
              />
            </div>
          </div>
        </section>

        {/* ─── COMMUNAUTÉ — funnel post-achat (stratégie marketing) ─── */}
        <section className="pb-20 px-4">
          <div className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-[#0b2f73] to-[#1d4fa5] p-8 md:p-10 text-white relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#f5b335]/10 blur-2xl" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#f5b335] font-bold mb-2">
              En savoir plus avant de choisir ?
            </p>
            <h2 className="text-2xl font-black mb-3">
              Rejoignez Academia Community
            </h2>
            <p className="text-[14px] text-blue-100 leading-relaxed mb-6 max-w-xl">
              La communauté des dirigeants d&apos;établissements qui utilisent Academia Helm :
              conseils quotidiens de pilotage, démonstrations, réponses de l&apos;équipe
              et de la communauté — directement dans le produit, dès aujourd&apos;hui, gratuitement.
            </p>
            <a
              href="/community/join"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#f5b335] text-[#0b2f73] font-bold hover:bg-[#ffd666] transition-colors"
            >
              Découvrir la communauté
            </a>
          </div>
        </section>
      </main>
      <Footer2 />
    </>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────────

function PlanCard({ plan }: { plan: PricingPlan }) {
  // Contrat : facturation annuelle uniquement.
  const annual = plan.yearlyAmount;
  const isSurDevis = annual == null;
  const yearOneTotal = (annual ?? 0) + (plan.initialFee ?? 0);

  return (
    <div
      className={`relative rounded-3xl overflow-hidden transition-all duration-300 hover:scale-[1.02] flex flex-col h-full ${
        plan.isPopular
          ? 'bg-gradient-to-br from-[#0a1d3f] to-[#0b2f73] text-white shadow-2xl shadow-blue-300/50 ring-2 ring-[#f5b335]'
          : 'bg-white border-2 border-slate-100 shadow-lg hover:shadow-xl'
      }`}
    >
      {/* Badge Populaire — coin droit */}
      {plan.isPopular && (
        <div className="absolute top-3 right-3 z-10">
          <div
            className="flex items-center gap-1.5 bg-gradient-to-br from-[#f5b335] to-[#e0a020] text-[#0a1d3f] px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg"
            style={{ animation: 'badgeFloat 2.5s ease-in-out infinite' }}
          >
            <Sparkles className="w-3 h-3 fill-[#0a1d3f]" />
            Populaire
          </div>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col">
        {/* Nom + tagline */}
        <h3 className={`text-xl font-black mb-1 ${plan.isPopular ? 'text-white' : 'text-[#0b2f73]'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm mb-3 ${plan.isPopular ? 'text-blue-200' : 'text-slate-500'}`}>
          {plan.tagline}
        </p>

        {/* Nombre d'élèves */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-4 self-start ${
          plan.isPopular ? 'bg-white/10 text-blue-200' : 'bg-blue-50 text-[#0b2f73]'
        }`}>
          <Users className="w-3.5 h-3.5" />
          {studentRange(plan)}
        </div>

        {/* Prix annuel */}
        <div className="mb-3">
          {isSurDevis ? (
            <div className={`text-3xl font-black ${plan.isPopular ? 'text-[#f5b335]' : 'text-[#0b2f73]'}`}>
              Sur devis
            </div>
          ) : (
            <>
              <div className={`text-3xl font-black ${plan.isPopular ? 'text-[#f5b335]' : 'text-[#0b2f73]'}`}>
                {formatFCFA(annual)}
              </div>
              <div className={`text-xs font-medium ${plan.isPopular ? 'text-blue-200' : 'text-slate-400'}`}>
                par an · frais annuels
              </div>
            </>
          )}
        </div>

        {/* Frais d'activation — MISE EN VALEUR */}
        <div className={`rounded-xl p-3 mb-3 flex items-center justify-between ${
          plan.isPopular
            ? 'bg-[#f5b335]/15 border border-[#f5b335]/30'
            : 'bg-amber-50 border border-amber-200'
        }`}>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
              plan.isPopular ? 'text-[#f5b335]' : 'text-amber-700'
            }`}>
              Frais d&apos;activation
            </div>
            <div className={`text-lg font-black ${
              plan.isPopular ? 'text-[#f5b335]' : 'text-amber-900'
            }`}>
              {formatFCFA(plan.initialFee)}
            </div>
          </div>
          <div className={`text-[10px] font-medium text-right ${
            plan.isPopular ? 'text-blue-200' : 'text-amber-600'
          }`}>
            Paiement<br />unique
          </div>
        </div>

        {/* Total Année 1 */}
        <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${
          plan.isPopular
            ? 'bg-emerald-400/15 border border-emerald-400/30'
            : 'bg-emerald-50 border border-emerald-200'
        }`}>
          <div>
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
              plan.isPopular ? 'text-emerald-300' : 'text-emerald-700'
            }`}>
              Coût total Année 1
            </div>
            <div className={`text-lg font-black ${
              plan.isPopular ? 'text-white' : 'text-emerald-900'
            }`}>
              {formatFCFA(yearOneTotal)}
            </div>
          </div>
          <div className={`text-[10px] font-medium text-right ${
            plan.isPopular ? 'text-emerald-200' : 'text-emerald-600'
          }`}>
            Activation<br />+ Annuel
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-6 flex-1">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.isPopular ? 'text-[#f5b335]' : 'text-emerald-500'}`} />
              <span className={plan.isPopular ? 'text-blue-100' : 'text-slate-600'}>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA — Paiement direct via FedaPay (lien hébergé) */}
        {(() => {
          const fedapayUrl = FEDAPAY_LINKS[plan.code];
          if (isSurDevis || !fedapayUrl) {
            return (
              <Link
                href="/signup"
                className={`block text-center py-3 rounded-xl font-bold text-sm transition-all mt-auto ${
                  plan.isPopular
                    ? 'bg-[#f5b335] text-[#0a1d3f] hover:scale-105'
                    : 'bg-[#0b2f73] text-white hover:bg-[#144798]'
                }`}
              >
                Demander un devis
              </Link>
            );
          }
          return (
            <a
              href={fedapayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`group block text-center py-3 rounded-xl font-bold text-sm transition-all mt-auto ${
                plan.isPopular
                  ? 'bg-[#f5b335] text-[#0a1d3f] hover:scale-105'
                  : 'bg-[#0b2f73] text-white hover:bg-[#144798]'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                Payer l'activation via FedaPay
                <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </a>
          );
        })()}
      </div>

      {/* Animations */}
      {plan.isPopular && (
        <style jsx>{`
          @keyframes badgeFloat {
            0%, 100% { transform: translateY(0); box-shadow: 0 4px 12px rgba(245, 179, 53, 0.4); }
            50% { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(245, 179, 53, 0.6); }
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
