/**
 * Landing Page Institutionnelle - Patronat & Examens
 * 
 * Landing page dédiée pour les patronats d'écoles privées,
 * associations départementales et organismes organisateurs d'examens.
 * Design institutionnel, premium et sobre.
 * Même design system que CompleteLandingPage.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import FederisHeader from '../federis/FederisHeader';
import InstitutionalFooter from './InstitutionalFooter';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

export default function PatronatExamensLanding() {
  return (
    <div className="min-h-screen bg-white">
      <FederisHeader />

      {/* SECTION 1 — HERO (AUTORITÉ) */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#0b1d3a] pt-20">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-500 rounded-full blur-[100px] opacity-30"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center justify-center mb-6 space-x-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
            <span className="text-amber-400 font-bold text-xs uppercase tracking-widest">Academia Federis</span>
            <span className="text-white/40 text-xs">by Academia Helm</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-8 leading-[1.1] tracking-tight">
            Fédérer les écoles.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">Organiser les examens.</span>
            <br />
            Piloter la réussite.
          </h1>
          <p className="text-xl md:text-2xl text-blue-100/80 mb-12 max-w-3xl mx-auto leading-relaxed">
            La plateforme SaaS dédiée aux patronats scolaires privés pour gérer les écoles membres, organiser les examens inter-écoles et piloter les performances institutionnelles.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
            <Link
              href="/patronat/register"
              prefetch={true}
              className="bg-amber-500 text-blue-950 px-10 py-5 rounded-xl font-bold hover:bg-amber-400 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:-translate-y-1"
            >
              Créer un espace patronat
              <AppIcon name="arrowRight" size="action" />
            </Link>
            <Link
              href="/contact?subject=demo-federis"
              prefetch={true}
              className="bg-white/5 backdrop-blur-md text-white px-10 py-5 rounded-xl border border-white/20 font-bold hover:bg-white/10 transition-all duration-300 inline-flex items-center justify-center gap-2 hover:-translate-y-1"
            >
              Demander une démonstration
            </Link>
          </div>
          
          <div className="mt-16 flex items-center justify-center space-x-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
            <span className="text-white text-sm font-medium uppercase tracking-widest">Confiance & Rigueur Institutionnelle</span>
          </div>
        </div>
      </section>

      {/* SECTION 2 — PROBLÈME */}
      <section className="py-32 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-blue-950 mb-8 leading-tight">
                Dépassez les limites de la gestion manuelle
              </h2>
              <p className="text-xl text-gray-600 mb-12 leading-relaxed">
                Les patronats et réseaux scolaires font face à une complexité croissante qui freine leur pilotage et fragilise la sécurité des examens.
              </p>
              
              <ul className="space-y-6">
                {[
                  'Gestion complexe des écoles membres et des effectifs',
                  'Absence de données consolidées en temps réel',
                  'Organisation lourde et risquée des examens inter-écoles',
                  'Publication lente et peu traçable des résultats',
                  'Absence de statistiques fiables sur les performances'
                ].map((item, i) => (
                  <li key={i} className="flex items-start space-x-4">
                    <div className="mt-1 bg-red-100 p-1 rounded-full">
                      <AppIcon name="close" size="action" className="text-red-600" />
                    </div>
                    <span className="text-lg text-gray-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-amber-100 to-blue-50 rounded-[40px] -rotate-2"></div>
              <div className="relative bg-white p-10 rounded-[32px] shadow-2xl border border-gray-100">
                <div className="space-y-8">
                  <div className="flex items-center space-x-4 pb-6 border-b border-gray-100">
                    <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">!</div>
                    <div>
                      <h4 className="font-bold text-blue-950">Alerte Gouvernance</h4>
                      <p className="text-sm text-gray-500">Risque de non-conformité identifié</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 bg-gray-100 rounded-full w-full"></div>
                    <div className="h-4 bg-gray-100 rounded-full w-[80%]"></div>
                    <div className="h-4 bg-gray-100 rounded-full w-[90%]"></div>
                  </div>
                  <div className="pt-4">
                    <div className="text-red-600 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg inline-block">
                      Délai de publication : +15 jours de retard
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — SOLUTION ACADEMIA FEDERIS */}
      <section id="fonctionnalites" className="py-32 bg-[#0b1d3a] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-8">
              La solution de <span className="text-amber-400">gouvernance</span> totale
            </h2>
            <p className="text-xl text-blue-100/60 max-w-3xl mx-auto">
              Academia Federis centralise chaque aspect de la vie de votre patronat et de vos examens dans un écosystème unique et sécurisé.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Écoles membres', desc: 'Gestion des adhésions, effectifs et synchronisation Helm.', icon: 'building' },
              { title: 'Organisation Examens', desc: 'Calendriers, centres, salles et affectations automatiques.', icon: 'exams' },
              { title: 'Gestion Candidats', desc: 'Matricules, numéros de table et listes d\'émargement.', icon: 'user' },
              { title: 'Épreuves & Sujets', desc: 'Banque d\'épreuves sécurisée et corrigés barémés.', icon: 'document' },
              { title: 'Surveillance & PV', desc: 'Gestion des surveillants, chefs de centres et incidents.', icon: 'shieldCheck' },
              { title: 'Correction & Notes', desc: 'Anonymisation, double-correction et saisie verrouillée.', icon: 'edit' },
              { title: 'Délibération', desc: 'Calcul de moyennes, mentions et seuils de réussite.', icon: 'analytics' },
              { title: 'Publication Résultats', desc: 'Notification parents, bulletins et rapports consolidés.', icon: 'announcement' }
            ].map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[24px] hover:bg-white/10 transition-all duration-300 group">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <AppIcon name={f.icon as any} size="menu" className="text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-blue-100/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — CONNEXION ACADEMIA HELM */}
      <section className="py-32 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-blue-900 to-[#0b1d3a] rounded-[48px] p-12 md:p-20 relative overflow-hidden shadow-3xl">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-amber-500/10 skew-x-12 transform translate-x-20"></div>
            
            <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-block bg-amber-500/20 text-amber-400 px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase mb-6">
                  Interopérabilité Native
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
                  Connecté à l'écosystème Academia Helm
                </h2>
                <p className="text-xl text-blue-100/70 mb-10 leading-relaxed">
                  Les écoles membres utilisant déjà Academia Helm sont synchronisées instantanément. Accédez aux effectifs et aux candidats sans ressaisie manuelle.
                </p>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  {[
                    'Mapping automatique des classes',
                    'Synchronisation des candidats',
                    'Suivi des effectifs autorisés',
                    'Notification parents in-app'
                  ].map((item, i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <AppIcon name="check" size="action" className="text-blue-900" />
                      </div>
                      <span className="text-white font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute inset-0 bg-amber-500 rounded-full blur-[80px] opacity-20"></div>
                  <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[40px] shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                         <AppIcon name="refresh" size="menu" className="text-white animate-spin-slow" />
                      </div>
                      <div className="h-2 w-24 bg-white/10 rounded-full"></div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-white/20 rounded-full w-full"></div>
                          <div className="h-2 bg-white/10 rounded-full w-2/3"></div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-white/10 rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-white/20 rounded-full w-full"></div>
                          <div className="h-2 bg-white/10 rounded-full w-1/2"></div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/10 text-center">
                      <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Lien Academia Helm : ACTIF</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — PLANS D'ABONNEMENT */}
      <section id="tarification" className="py-32 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-bold text-blue-950 mb-8">Plans d'abonnement</h2>
            <p className="text-xl text-gray-500">Choisissez la structure adaptée à la taille de votre réseau scolaire.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                name: 'Starter',
                desc: 'Idéal pour les petits patronats communaux.',
                price: 'À partir de 100 000 FCFA',
                features: ['Écoles membres limitées', 'Examens simples', 'Import candidats Excel', 'Publication résultats standard'],
                color: 'blue'
              },
              {
                name: 'Professional',
                desc: 'Pour les patronats départementaux structurés.',
                price: 'À partir de 250 000 FCFA',
                features: ['Écoles illimitées', 'Centres d\'examen complexes', 'Gestion des surveillants & PV', 'Banque d\'épreuves sécurisée', 'Support prioritaire'],
                color: 'amber',
                popular: true
              },
              {
                name: 'Enterprise',
                desc: 'Solution sur mesure pour les grandes fédérations.',
                price: 'Sur devis',
                features: ['Gestion multi-départements', 'Anonymisation & Correction en ligne', 'Délibération assistée par IA', 'Dashboard statistiques avancé', 'Accompagnement dédié'],
                color: 'blue-dark'
              }
            ].map((plan, i) => (
              <div key={i} className={cn(
                "relative p-10 rounded-[32px] border-2 transition-all duration-300",
                plan.popular ? "border-amber-500 shadow-2xl scale-105 z-10" : "border-gray-100 hover:border-blue-200"
              )}>
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-blue-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                    Plus Populaire
                  </div>
                )}
                <h3 className="text-2xl font-bold text-blue-950 mb-2">{plan.name}</h3>
                <p className="text-gray-500 text-sm mb-6">{plan.desc}</p>
                <div className="text-3xl font-black text-blue-900 mb-8">{plan.price}</div>
                
                <ul className="space-y-4 mb-10">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-center space-x-3">
                      <div className="w-5 h-5 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <AppIcon name="check" size="action" className="text-blue-600" />
                      </div>
                      <span className="text-gray-600 text-sm font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  href="/patronat/register"
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-center block transition-all",
                    plan.popular ? "bg-amber-500 text-blue-950 hover:bg-amber-400 shadow-lg" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                  )}
                >
                  Choisir ce plan
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — CTA FINAL */}
      <section className="py-32 bg-[#0b1d3a] px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[-20%] left-[20%] w-full h-full bg-blue-600 rounded-full blur-[150px]"></div>
        </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
            Prêt à moderniser votre <span className="text-amber-400">gouvernance scolaire ?</span>
          </h2>
          <p className="text-xl text-blue-100/60 mb-12">
            Créez votre espace Academia Federis dès aujourd'hui et rejoignez la révolution de l'éducation privée.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6">
            <Link
              href="/patronat/register"
              className="bg-amber-500 text-blue-950 px-12 py-5 rounded-xl font-bold text-lg hover:bg-amber-400 transition-all shadow-xl"
            >
              Créer mon espace Federis
            </Link>
            <Link
              href="/contact"
              className="bg-white/5 border border-white/20 text-white px-12 py-5 rounded-xl font-bold text-lg hover:bg-white/10 transition-all"
            >
              Contacter l'équipe
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER INSTITUTIONNEL */}
      <div className="bg-blue-900 border-t-2 border-gold-500/20">
        <InstitutionalFooter />
      </div>
    </div>
  );
}

