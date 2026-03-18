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
import PatronatHeader from '../patronat/PatronatHeader';
import InstitutionalFooter from './InstitutionalFooter';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

export default function PatronatExamensLanding() {
  return (
    <div className="min-h-screen bg-white">
      <PatronatHeader />

      {/* SECTION 1 — HERO (AUTORITÉ) */}
      <section className="relative min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 pt-20">
        {/* Background decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-gold-500 rounded-full blur-3xl"></div>
        </div>
        
        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto text-center -mt-8">
          <div className="inline-flex items-center justify-center mb-8">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm - Logo institutionnel"
              width={120}
              height={120}
              className="w-30 h-30 object-contain"
              priority
              sizes="(max-width: 768px) 80px, 120px"
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 max-w-5xl mx-auto leading-tight drop-shadow-2xl">
            La plateforme institutionnelle
            <br />
            pour l'organisation des examens
            <br />
            des écoles privées
          </h1>
          <p className={`${typo('large')} text-lg md:text-xl text-white/95 mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-md`}>
            Centralisez les inscriptions, sécurisez les données
            et pilotez les examens nationaux avec rigueur.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href="/patronat/register"
              prefetch={true}
              className="bg-gold-500 text-white px-10 py-4 rounded-md font-semibold hover:bg-gold-600 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <AppIcon name="userPlus" size="action" className="text-white" />
              Créer un compte Patronat
            </Link>
            <Link
              href="/contact?subject=demo-institutionnelle"
              prefetch={true}
              className="bg-white/10 backdrop-blur-md text-white px-10 py-4 rounded-md border-2 border-white/30 font-semibold hover:bg-white/20 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <AppIcon name="calendar" size="action" className="text-white" />
              Demander une démo institutionnelle
            </Link>
            {/* Bouton provisoire - Accès Dashboard Patronat */}
            <Link
              href="/patronat/dashboard"
              prefetch={true}
              className="bg-green-600 text-white px-8 py-4 rounded-md font-semibold hover:bg-green-700 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-green-400"
              title="Bouton provisoire - Accès direct au dashboard Patronat"
            >
              <AppIcon name="dashboard" size="action" className="text-white" />
              Dashboard Patronat (Test)
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2 — PROBLÈMES ACTUELS */}
      <section className="py-32 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20 -mt-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl mb-8 shadow-lg">
              <AppIcon name="warning" size="dashboard" className="text-crimson-600" />
            </div>
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold ${textColor('primary')} mb-8 leading-tight`}>
              Les défis actuels de l'organisation des examens
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              L'organisation manuelle des examens nationaux génère des risques
              et des complications pour les patronats et les établissements.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              { text: 'Erreurs d\'inscription manuelles', icon: 'spreadsheet' as const },
              { text: 'Données incohérentes entre écoles', icon: 'wifiOff' as const },
              { text: 'Gestion papier non traçable', icon: 'document' as const },
              { text: 'Conflits patronat / établissements', icon: 'warning' as const },
              { text: 'Difficultés de supervision', icon: 'dashboard' as const },
            ].map((problem, index) => (
              <div
                key={index}
                className={cn(
                  bgColor('card'),
                  'p-8 rounded-3xl border-2 border-gray-200',
                  'shadow-lg hover:shadow-2xl',
                  'hover:border-crimson-300 hover:-translate-y-2',
                  'transition-all duration-300 ease-out',
                  'group cursor-pointer',
                  'bg-white hover:bg-gradient-to-br hover:from-white hover:to-red-50/30'
                )}
              >
                <div className="flex items-start space-x-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:from-red-100 group-hover:to-red-200">
                    <AppIcon name={problem.icon} size="menu" className="text-crimson-600 group-hover:text-crimson-700 transition-colors duration-300" />
                  </div>
                  <p className={`${typo('base')} ${textColor('primary')} font-semibold leading-relaxed pt-2 group-hover:text-crimson-700 transition-colors duration-300`}>
                    {problem.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 3 — LA SOLUTION ACADEMIA HUB */}
      <section id="fonctionnalites" className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center mb-10">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm - Logo de la plateforme institutionnelle"
              width={120}
              height={120}
              className="w-30 h-30 object-contain"
              priority
              sizes="(max-width: 768px) 80px, 120px"
            />
          </div>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight`}>
            La solution <span className="text-gold-500 relative inline-block">
              <span className="relative z-10">Academia Helm</span>
              <span className="absolute bottom-1 left-0 right-0 h-4 bg-gold-500/20 -rotate-1"></span>
            </span>
          </h2>
          <p className={`${typo('large')} text-white leading-relaxed text-lg max-w-3xl mx-auto mb-16`}>
            Une plateforme dédiée aux patronats et organismes organisateurs d'examens,
            conçue pour centraliser, sécuriser et piloter l'ensemble du processus.
          </p>

          {/* Blocs de fonctionnalités */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                title: 'Inscription en ligne des candidats',
                description: 'Formulaire sécurisé et centralisé pour toutes les écoles du département.',
                icon: 'userPlus' as const,
              },
              { 
                title: 'Gestion centralisée des écoles',
                description: 'Rattachement des établissements, suivi des inscriptions par école.',
                icon: 'building' as const,
              },
              { 
                title: 'Numéros de table et matricules automatiques',
                description: 'Génération automatique et sécurisée des identifiants candidats.',
                icon: 'document' as const,
              },
              { 
                title: 'Listes de surveillance',
                description: 'Génération automatique des listes par salle, par centre d\'examen.',
                icon: 'exams' as const,
              },
              { 
                title: 'Relevés de notes sécurisés',
                description: 'Saisie centralisée, validation par niveau, export sécurisé.',
                icon: 'shieldCheck' as const,
              },
              { 
                title: 'Banque d\'épreuves partagée',
                description: 'Stockage sécurisé des sujets, accès contrôlé par rôle.',
                icon: 'document' as const,
                id: 'banque-epreuves',
              },
            ].map((feature, index) => {
              const colors = { 
                from: 'from-blue-600', 
                to: 'to-blue-700', 
                icon: 'text-blue-600', 
                border: 'hover:border-blue-600' 
              };
              
              return (
                <div
                  key={index}
                  className={cn(
                    bgColor('card'),
                    'p-8 rounded-3xl border-2 border-gray-200',
                    'shadow-lg hover:shadow-2xl',
                    colors.border,
                    'hover:-translate-y-2',
                    'transition-all duration-300 ease-out',
                    'group',
                    'bg-white/10 backdrop-blur-md hover:bg-white/15 border-white/20'
                  )}
                >
                  <div className={cn(
                    'w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center mb-6',
                    'shadow-lg group-hover:shadow-xl',
                    'group-hover:scale-110 group-hover:rotate-3',
                    'transition-all duration-300',
                    'from-gold-500/30 to-gold-600/30'
                  )}>
                    <AppIcon name={feature.icon} size="menu" className="text-white group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className={cn(
                    typo('base'),
                    'text-white font-bold mb-3 leading-tight transition-colors duration-300',
                  )}>
                    {feature.title}
                  </h3>
                  <p className={`${typo('small')} text-white/80 text-sm leading-relaxed`}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 4 — COMMENT ÇA FONCTIONNE */}
      <section id="processus" className="py-32 bg-gradient-to-b from-white via-cloud to-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-blue-900 mb-8 leading-tight`}>
              Comment ça fonctionne
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Un processus simple, structuré et sécurisé en 5 étapes.
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '1',
                title: 'Le patronat crée son compte',
                description: 'Inscription institutionnelle avec validation des documents officiels.',
              },
              {
                step: '2',
                title: 'Il rattache les écoles du département',
                description: 'Ajout des établissements membres, configuration des accès par école.',
              },
              {
                step: '3',
                title: 'Les écoles inscrivent leurs candidats',
                description: 'Chaque établissement saisit ses candidats via son interface dédiée.',
              },
              {
                step: '4',
                title: 'Le patronat organise l\'examen',
                description: 'Génération des listes, attribution des salles, gestion des épreuves.',
              },
              {
                step: '5',
                title: 'Les résultats sont centralisés et sécurisés',
                description: 'Saisie des notes, validation, génération des relevés officiels.',
              },
            ].map((item, index) => (
              <div
                key={index}
                className={cn(
                  bgColor('card'),
                  'p-8 rounded-3xl border-2 border-blue-200',
                  'shadow-lg hover:shadow-2xl',
                  'hover:border-blue-400 hover:-translate-y-1',
                  'transition-all duration-300 ease-out',
                  'group relative overflow-hidden',
                  'bg-white'
                )}
              >
                <div className="flex items-start space-x-6">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <span className="text-2xl font-bold text-white">{item.step}</span>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h3 className={`${typo('h3')} text-blue-900 mb-3 font-bold group-hover:text-blue-700 transition-colors duration-300`}>
                      {item.title}
                    </h3>
                    <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — SÉCURITÉ & CONFORMITÉ */}
      <section id="securite" className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-20 w-96 h-96 bg-green-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-20 w-80 h-80 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl mb-8 shadow-lg">
              <AppIcon name="shieldCheck" size="dashboard" className="text-green-600" />
            </div>
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight`}>
              Sécurité & Conformité
            </h2>
            <p className={`${typo('large')} text-white/90 max-w-3xl mx-auto mb-16 text-lg`}>
              Une architecture sécurisée et traçable, conçue pour les exigences institutionnelles.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10">
            {[
              {
                title: 'Cloisonnement strict des données',
                description: 'Chaque patronat et chaque école accède uniquement à ses données. Isolation totale entre organisations.',
                icon: 'shieldCheck' as const,
              },
              {
                title: 'Audit logs complets',
                description: 'Traçabilité de toutes les opérations : qui a fait quoi, quand, depuis où. Historique immuable.',
                icon: 'document' as const,
              },
              {
                title: 'Accès par rôle',
                description: 'Permissions granulaires : patronat, direction d\'école, secrétariat. Contrôle d\'accès strict.',
                icon: 'user' as const,
              },
              {
                title: 'Traçabilité des opérations',
                description: 'Journalisation de toutes les modifications : inscriptions, notes, validations. Historique complet.',
                icon: 'clock' as const,
              },
              {
                title: 'Historique officiel',
                description: 'Conservation sécurisée des données d\'examens. Export légal pour archivage institutionnel.',
                icon: 'archive' as const,
              },
            ].map((item, index) => (
              <div
                key={index}
                className={cn(
                  'p-10 rounded-3xl border-2 border-white/20',
                  'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md',
                  'shadow-2xl relative overflow-hidden',
                  'hover:shadow-3xl transition-all duration-300',
                  'hover:border-white/30'
                )}
              >
                <div className="w-16 h-16 bg-gradient-to-br from-green-500/30 to-green-600/30 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                  <AppIcon name={item.icon} size="dashboard" className="text-white" />
                </div>
                <h3 className={`${typo('h3')} text-white mb-4 font-bold`}>
                  {item.title}
                </h3>
                <p className={`${typo('base')} text-white/80 leading-relaxed`}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 6 — MODÈLE ÉCONOMIQUE */}
      <section id="tarification" className="py-32 bg-gradient-to-b from-white via-cloud to-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-blue-900 mb-8 leading-tight`}>
              Modèle économique
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Une tarification claire et indépendante, pensée pour les organisations institutionnelles.
            </p>
          </div>

          <div className={cn(
            bgColor('card'),
            'p-10 rounded-3xl border-2 border-blue-200',
            'shadow-xl',
            'bg-white'
          )}>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <AppIcon name="finance" size="menu" className="text-white" />
                </div>
                <div>
                  <h3 className={`${typo('h3')} text-blue-900 mb-2 font-bold`}>
                    Souscription patronat
                  </h3>
                  <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed`}>
                    Abonnement mensuel dédié aux patronats et organismes organisateurs d'examens.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-gold-500 to-gold-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <AppIcon name="calendar" size="menu" className="text-white" />
                </div>
                <div>
                  <h3 className={`${typo('h3')} text-blue-900 mb-2 font-bold`}>
                    Abonnement mensuel
                  </h3>
                  <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed`}>
                    Tarification simple et transparente, adaptée aux besoins institutionnels.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <AppIcon name="building" size="menu" className="text-white" />
                </div>
                <div>
                  <h3 className={`${typo('h3')} text-blue-900 mb-2 font-bold`}>
                    Tarification indépendante des écoles
                  </h3>
                  <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed`}>
                    Le patronat souscrit son abonnement. Les écoles membres utilisent la plateforme sans coût supplémentaire.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <AppIcon name="sparkles" size="menu" className="text-white" />
                </div>
                <div>
                  <h3 className={`${typo('h3')} text-blue-900 mb-2 font-bold`}>
                    Valeur institutionnelle justifiée
                  </h3>
                  <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed`}>
                    Investissement rentable : réduction des erreurs, gain de temps, crédibilité renforcée.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 pt-8 border-t border-gray-200 text-center">
              <Link
                href="/contact?subject=tarification-patronat"
                prefetch={true}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
              >
                <AppIcon name="calendar" size="action" className="text-white" />
                Demander un devis personnalisé
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7 — CTA FINAL (CLOSER) */}
      <section className={`py-16 md:py-20 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-40 h-40 mb-4 relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-75 animate-pulse"></div>
            <div className="relative z-10 w-32 h-32 flex items-center justify-center">
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Helm - Logo institutionnel"
                width={128}
                height={128}
                className="w-full h-full object-contain drop-shadow-2xl"
                loading="lazy"
                sizes="(max-width: 768px) 100px, 128px"
                style={{ filter: 'brightness(1.2) drop-shadow(0 0 20px rgba(37, 99, 235, 0.8))' }}
              />
            </div>
          </div>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight`}>
            Passez à une organisation moderne,
            <br />
            <span className="text-gold-500">rigoureuse</span> et <span className="text-gold-500">crédible</span>
            <br />
            des examens.
          </h2>
          <Link
            href="/patronat/register"
            prefetch={true}
            className="bg-gold-500 text-white px-12 py-5 rounded-subtle font-semibold hover:bg-gold-600 transition-colors inline-flex items-center justify-center text-lg shadow-xl hover:shadow-2xl"
          >
            Créer un compte Patronat
            <AppIcon name="userPlus" size="action" className="ml-2 text-white" />
          </Link>
        </div>
      </section>

      {/* FOOTER INSTITUTIONNEL */}
      <div className="bg-blue-900 border-t-2 border-gold-500/20">
        <InstitutionalFooter />
      </div>
    </div>
  );
}

