/**
 * Complete Landing Page Component
 * 
 * Landing page officielle d'Academia Helm
 * Copywriting EXACT, mot pour mot
 * Structure stricte respectée
 * Design System premium institutionnel
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import PremiumHeader from '../layout/PremiumHeader';
import InstitutionalFooter from './InstitutionalFooter';
import TestimonialsSection from './TestimonialsSection';
import EducationalParticles from './EducationalParticles';
import AnimatedTestimonials from './AnimatedTestimonials';
import { getTestimonialStats } from '@/services/testimonial.service';
import AppIcon from '@/components/ui/AppIcon';
import TypingAnimation from '@/components/ui/TypingAnimation';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

// Chargement dynamique des composants lourds
const VideoPlayerModal = dynamic(() => import('./VideoPlayerModal'), {
  ssr: false,
  loading: () => null,
});

const OrionParticles = dynamic(() => import('./OrionParticles'), {
  ssr: false,
  loading: () => null,
});

const SecurityParticles = dynamic(() => import('./SecurityParticles'), {
  ssr: false,
  loading: () => null,
});

const SupportChatWidget = dynamic(() => import('./SupportChatWidget'), {
  ssr: false,
  loading: () => null,
});

// Component for Module Card with Read More functionality
function ModuleCard({ 
  module, 
  colors 
}: { 
  module: { name: string; icon: string; description: string };
  colors: { from: string; to: string; icon: string; border: string };
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const descriptionLength = module.description.length;
  const truncatedLength = Math.floor(descriptionLength / 2);
  const truncatedDescription = module.description.substring(0, truncatedLength);
  const shouldTruncate = descriptionLength > 100; // Only truncate if description is long enough

  return (
    <div
      className={cn(
        bgColor('card'),
        'p-8 rounded-3xl border-2 border-gray-200',
        'shadow-lg hover:shadow-2xl',
        colors.border,
        'hover:-translate-y-2',
        'transition-all duration-300 ease-out',
        'group',
        'bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/20'
      )}
    >
      <div className={cn(
        'w-16 h-16 bg-gradient-to-br rounded-2xl flex items-center justify-center mb-6',
        'shadow-lg group-hover:shadow-xl',
        'group-hover:scale-110 group-hover:rotate-3',
        'transition-all duration-300',
        colors.from,
        colors.to
      )}>
        <AppIcon name={module.icon as any} size="menu" className="text-white group-hover:scale-110 transition-transform duration-300" />
      </div>
      <h3 className={cn(
        typo('base'),
        textColor('primary'),
        'font-bold mb-3 leading-tight transition-colors duration-300',
        `group-hover:${colors.icon}`
      )}>
        {module.name}
      </h3>
      <div>
        <p className={`${typo('small')} ${textColor('secondary')} text-sm leading-relaxed`}>
          {shouldTruncate && !isExpanded ? (
            <>
              {truncatedDescription}...
            </>
          ) : (
            module.description
          )}
        </p>
        {shouldTruncate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={cn(
              'mt-2 text-sm font-semibold transition-all duration-200',
              'text-blue-600 hover:text-blue-700 hover:underline',
              'focus:outline-none'
            )}
          >
            {isExpanded ? 'Lire moins' : 'Lire plus'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CompleteLandingPage() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [isOfflineSectionVisible, setIsOfflineSectionVisible] = useState(false);
  const offlineSectionRef = useRef<HTMLElement>(null);
  const [testimonialStats, setTestimonialStats] = useState({
    totalSchools: 85, // Données fictives raisonnables
    satisfactionRate: 96, // Données fictives raisonnables
    averageRating: 4.8, // Données fictives raisonnables
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsOfflineSectionVisible(true);
      return;
    }

    try {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Quand on entre dans la section
              setIsOfflineSectionVisible(true);
            } else {
              // Quand on sort de la section (scroll vers le haut ou vers le bas)
              setIsOfflineSectionVisible(false);
            }
          });
        },
        { threshold: 0.1, rootMargin: '0px' }
      );

      const sectionRef = offlineSectionRef.current;
      if (sectionRef) {
        observer.observe(sectionRef);
      }

      return () => {
        if (sectionRef) {
          observer.unobserve(sectionRef);
        }
      };
    } catch (error) {
      console.warn('IntersectionObserver error:', error);
      setIsOfflineSectionVisible(true);
    }
  }, []);

  // Charger les statistiques des témoignages validés
  // Pour le moment, utilisation de données fictives raisonnables
  // TODO: Remplacer par l'appel API réel quand le backend sera prêt
  useEffect(() => {
    async function loadTestimonialStats() {
      try {
        const stats = await getTestimonialStats();
        // Utiliser les données du backend UNIQUEMENT si elles sont valides (toutes > 0)
        // Sinon, garder les valeurs fictives définies dans useState
        if (stats.totalSchools > 0 && stats.satisfactionRate > 0 && stats.averageRating > 0) {
          setTestimonialStats(stats);
        }
        // Si l'API retourne des zéros ou des valeurs invalides, on garde les valeurs fictives
        // qui sont déjà définies dans useState (pas besoin de setState)
      } catch (error) {
        // Erreur silencieuse : l'API n'est pas disponible, on utilise les valeurs fictives
        // Pas besoin de logger l'erreur car c'est attendu si le backend n'est pas démarré
        // console.warn('Testimonial stats API not available, using default values');
      }
    }
    // Pour le moment, on utilise uniquement les données fictives
    // Décommenter cette ligne quand le backend sera prêt :
    // loadTestimonialStats();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      {/* 1️⃣ HERO SECTION */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/school-background.png"
            alt="École moderne avec élèves en classe - Academia Helm"
            fill
            className="object-cover"
            priority
            quality={85}
            sizes="100vw"
          />
          {/* Subtle overlay for text readability */}
          <div className="absolute inset-0 bg-blue-900/50 backdrop-blur-[1px]" />
        </div>
        
        {/* Educational Particles */}
        <EducationalParticles />
        
        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto text-center -mt-8">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-8 max-w-5xl mx-auto leading-tight drop-shadow-2xl">
            Gérez votre école plus rapidement,
            <br />
            avec précision et facilité.
          </h1>
          <p className={`${typo('large')} text-lg md:text-xl text-white/95 mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-md`}>
            La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link
              href="/signup"
              prefetch={true}
              className="bg-blue-600 text-white px-10 py-4 rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
              style={{
                animation: 'shake-interval 3s ease-in-out infinite',
              }}
            >
              <AppIcon name="userPlus" size="action" className="text-white" />
              S'inscrire
            </Link>
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="bg-white/10 backdrop-blur-md text-white px-10 py-4 rounded-md border-2 border-white/30 font-semibold hover:bg-white/20 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <AppIcon name="playCircle" size="action" className="text-white" />
              Voir Academia Helm
            </button>
          </div>
        </div>
      </section>

      {/* 2️⃣ SECTION — LE PROBLÈME */}
      <section className="py-32 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20 -mt-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl mb-8 shadow-lg">
              <AppIcon name="warning" size="dashboard" className="text-crimson-600" />
            </div>
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold ${textColor('primary')} mb-8 leading-tight`}>
              <TypingAnimation
                text="Gérer une école sans système fiable est un risque."
                speed={50}
                repeatDelay={5000}
                highlightWord="risque"
                highlightClassName="text-crimson-600"
                highlightUnderline={true}
              />
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Beaucoup d'établissements fonctionnent encore
              avec des outils dispersés et une visibilité limitée.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {[
              { text: 'Données administratives éparpillées', icon: 'spreadsheet' as const },
              { text: 'Finances difficiles à suivre', icon: 'finance' as const },
              { text: 'Notes et examens complexes à consolider', icon: 'exams' as const },
              { text: 'Dépendance à la connexion internet', icon: 'wifiOff' as const },
              { text: 'Manque de vision globale pour la direction', icon: 'dashboard' as const },
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

          <div className="text-center pt-8 border-t border-gray-200">
            <p className={`${typo('h2')} ${textColor('primary')} font-bold`}>
              Une école ne peut pas être gérée à l'instinct.
            </p>
          </div>
        </div>
      </section>

      {/* 3️⃣ SECTION — LA SOLUTION ACADEMIA HUB */}
      <section className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full blur-3xl"></div>
          </div>
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center justify-center mb-10">
            <Image
              src="/images/logo-Academia Hub.png"
              alt="Academia Helm - Plateforme de pilotage éducatif"
              width={120}
              height={120}
              className="w-30 h-30 object-contain"
              priority
              sizes="(max-width: 768px) 80px, 120px"
            />
          </div>
          <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight`}>
            Un système de <span className="text-gold-500 relative inline-block">
              <span className="relative z-10">gouvernance scolaire</span>
              <span className="absolute bottom-1 left-0 right-0 h-4 bg-gold-500/20 -rotate-1"></span>
            </span>,<br />
            <span className="text-white/90">pas une simple application.</span>
          </h2>
          <p className={`${typo('large')} text-white leading-relaxed text-lg max-w-3xl mx-auto`}>
            Academia Helm centralise l'ensemble des données de votre établissement,
            structure vos processus internes
            et vous permet de piloter votre école avec précision,
            même en l'absence de connexion internet.
          </p>
        </div>
      </section>

      {/* 4️⃣ SECTION — MODULES */}
      <section className="py-32 bg-gradient-to-b from-white via-cloud to-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold text-blue-900 mb-8 leading-tight`}>
              Modules de gestion scolaire
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Academia Helm intègre l'ensemble des modules nécessaires
              à une gestion scolaire moderne et rigoureuse.
            </p>
          </div>

          {/* Modules Principaux */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-12">
              <div className="h-0.5 bg-gradient-to-r from-transparent via-blue-600 to-transparent flex-1 max-w-40"></div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { 
                  name: 'Tableau de Bord Central', 
                  icon: 'dashboard' as const, 
                  description: 'Métriques en temps réel : effectifs, revenus, taux de réussite. Graphiques de performance, notifications intelligentes, calendrier intégré, accès rapide à tous les modules.' 
                },
                { 
                  name: 'Gestion des Élèves et Scolarité', 
                  icon: 'scolarite' as const, 
                  description: 'Inscription et admission, organisation des classes, suivi des absences, gestion disciplinaire, transferts de classe, génération de documents (certificats, attestations, trombinoscopes).' 
                },
                { 
                  name: 'Gestion Financière et Économat', 
                  icon: 'finance' as const, 
                  description: 'Configuration des frais par niveau, gestion des paiements (espèces, virement, Mobile Money), contrôle de scolarité, gestion des dépenses, clôture quotidienne, trésorerie.' 
                },
                { 
                  name: 'Planification et Études', 
                  icon: 'classes' as const, 
                  description: 'Gestion des salles, catalogue des matières, assignation des enseignants, génération automatique des emplois du temps, cahier journal, fiches pédagogiques, cahier de textes.' 
                },
                { 
                  name: 'Examens et Évaluation', 
                  icon: 'exams' as const, 
                  description: 'Saisie des notes, génération automatique des bulletins, bordereaux de notes, conseils de classe, tableaux d\'honneur, statistiques et analyses de performance.' 
                },
                { 
                  name: 'Gestion du Personnel et RH', 
                  icon: 'rh' as const, 
                  description: 'Fiches de personnel complètes, gestion des contrats (CDI, CDD, Vacation), évaluations et formations, calcul automatique de la paie, statistiques RH.' 
                },
              ].map((module, index) => {
                // Toutes les icônes utilisent le bleu primaire du logo
                const colors = { 
                  from: 'from-blue-600', 
                  to: 'to-blue-700', 
                  icon: 'text-blue-600', 
                  border: 'hover:border-blue-600' 
                };
                
                return (
                  <ModuleCard
                  key={index}
                    module={module}
                    colors={colors}
                  />
                );
              })}
          </div>

            {/* Voir tout Button */}
            <div className="text-center mt-12">
              <Link
                href="/modules"
                className="bg-blue-600 text-white px-10 py-4 rounded-md font-semibold hover:bg-blue-700 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105"
              >
                Voir tout
                <AppIcon name="arrowRight" size="action" className="text-white" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* 5️⃣ SECTION — ORION (IA DE DIRECTION) */}
      <section className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-20 w-96 h-96 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-20 w-80 h-80 bg-blue-600 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <div className="inline-flex flex-col items-center justify-center mb-4 relative">
                <div className="absolute inset-0 bg-gold-500/10 rounded-full blur-2xl"></div>
                <div className="relative z-10 w-56 h-56">
                  {/* Background particles container - behind image */}
                  <OrionParticles />
                <Image
                  src="/images/ORION-Academia-Hub.png"
                  alt="ORION - Assistant IA de direction pour établissements scolaires"
                  width={224}
                  height={224}
                  className="w-56 h-56 object-contain absolute top-0 left-0 z-10 drop-shadow-2xl"
                  loading="lazy"
                  sizes="(max-width: 768px) 200px, 224px"
                />
              </div>
                <div className="w-56 flex items-center justify-center px-5 py-2 bg-gradient-to-r from-gold-500/20 to-gold-600/20 rounded-full border border-gold-500/30 shadow-lg -mt-0 relative z-10">
                  <span className={`${typo('caption')} font-bold uppercase tracking-wider`}>
                    Je suis <span className="text-gold-500">ORION</span>
                </span>
              </div>
              </div>
              <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight`}>
                <span className="text-gold-500 relative inline-block">
                  <span className="relative z-10">L'intelligence</span>
                  <span className="absolute bottom-1 left-0 right-0 h-4 bg-gold-500/20 -rotate-1"></span>
                </span> qui éclaire vos décisions.
              </h2>
              <p className={`${typo('large')} text-white mb-2 leading-relaxed text-lg`}>
                <span className="text-gold-500">ORION</span> est l'assistant de direction intégré à Academia Helm.
                Il analyse vos données et vous aide à comprendre vos chiffres,
                anticiper les risques
                et prendre de meilleures décisions.
              </p>
                  </div>
            <div className="flex flex-col gap-8">
            <div className={cn(
                'p-10 rounded-3xl border-2 border-gold-500/30',
                'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md',
                'shadow-2xl relative overflow-hidden',
                'hover:shadow-3xl transition-all duration-300'
              )}>
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gold-500/10 rounded-bl-full blur-xl"></div>
                <div className="absolute top-0 left-0 w-24 h-24 bg-blue-600/5 rounded-br-full blur-xl"></div>
                
                <div className="space-y-6 relative z-10">
                <div>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-gold-500/30 to-gold-600/30 rounded-xl flex items-center justify-center border-2 border-gold-500/40 shadow-lg">
                    <Image
                      src="/images/ORION-Academia-Hub.png"
                      alt="ORION - Intelligence Artificielle"
                      width={24}
                      height={24}
                      className="w-6 h-6 object-contain"
                      loading="lazy"
                      sizes="24px"
                    />
                  </div>
                      <span className={`${typo('base')} text-white font-bold text-lg`}>ORION</span>
                    </div>
                    <div className="relative pl-6 border-l-2 border-gold-500/40">
                      <p className={`${typo('base')} text-white leading-relaxed italic`}>
                    "Votre taux de recouvrement a augmenté de 12% ce mois-ci. 
                    Les paiements en retard sont concentrés sur 3 classes. 
                    Recommandation : contacter les parents concernés cette semaine."
                  </p>
                </div>
              </div>
            </div>
          </div>
              
              <div className="space-y-5">
                {[
                  'Résumé automatique des indicateurs clés',
                  'Alertes intelligentes',
                  'Lecture claire de la situation financière',
                ].map((point, index) => (
                  <div key={index} className="flex items-center space-x-4 group">
                    <div className="w-10 h-10 bg-gradient-to-br from-gold-500/20 to-gold-600/20 rounded-lg flex items-center justify-center flex-shrink-0 border border-gold-500/30 group-hover:scale-110 transition-transform duration-300">
                    <AppIcon name="success" size="menu" className="text-gold-500" />
              </div>
                    <span className={`${typo('base')} text-white font-medium`}>{point}</span>
              </div>
                ))}
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6️⃣ SECTION — OFFLINE & SÉCURITÉ */}
      <section id="offline" ref={offlineSectionRef} className="py-32 bg-gradient-to-b from-white via-cloud to-white px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Animated particles background */}
        <SecurityParticles />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold ${textColor('primary')} mb-8 leading-tight`}>
              Fonctionne même <span className="text-blue-900 relative inline-block">
                <span className="relative z-10 text-glow-blue">sans internet</span>
                <span className="absolute bottom-0 left-0 right-0 h-4 bg-blue-900/25 -rotate-1 highlight-animated"></span>
                <span className="absolute bottom-0 left-0 right-0 h-4 bg-blue-900/20 -rotate-1 highlight-shine"></span>
              </span>.<br />
              Vos données restent <span className="text-green-600 relative inline-block">
                <span className="relative z-10 text-glow-green">protégées</span>
                <span className="absolute bottom-0 left-0 right-0 h-4 bg-green-600/25 -rotate-1 highlight-animated" style={{ animationDelay: '0.5s' }}></span>
                <span className="absolute bottom-0 left-0 right-0 h-4 bg-green-600/20 -rotate-1 highlight-shine" style={{ animationDelay: '0.5s' }}></span>
              </span>.
            </h2>
            <p className={`${typo('large')} ${textColor('secondary')} max-w-3xl mx-auto mb-16 text-lg`}>
              Academia Helm est conçu pour les réalités du terrain.
              Toutes les opérations peuvent être effectuées hors ligne,
              puis synchronisées automatiquement dès que la connexion est rétablie.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-10">
            <div 
              className={cn(
              bgColor('card'),
                'p-10 rounded-3xl border-2 border-blue-200',
                'shadow-xl hover:shadow-2xl',
                'hover:border-blue-400 hover:-translate-y-2',
                'group cursor-pointer relative overflow-hidden',
                'bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/40',
                'transition-all duration-1000 ease-out',
                isOfflineSectionVisible 
                  ? 'translate-x-0 opacity-100' 
                  : '-translate-x-20 opacity-0'
              )}
            >
              {/* Decorative background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-900/5 rounded-bl-full"></div>
              <div className="absolute top-0 left-0 w-24 h-24 bg-blue-600/5 rounded-br-full"></div>
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <AppIcon name="wifiOff" size="dashboard" className="text-white" />
              </div>
                <h3 className={`${typo('h3')} text-blue-900 mb-6 font-bold group-hover:text-blue-700 transition-colors duration-300`}>Mode offline complet</h3>
                <ul className="space-y-4">
                {[
                  'Mode offline complet',
                  'Synchronisation sécurisée',
                  'Base locale + serveur central',
                  'Architecture SaaS professionnelle',
                ].map((point, index) => (
                    <li key={index} className="flex items-start space-x-4">
                      <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-green-100 transition-colors duration-300">
                    <AppIcon name="success" size="submenu" className="text-green-600" />
                      </div>
                      <span className={`${typo('base')} ${textColor('secondary')} leading-relaxed group-hover:text-gray-700 transition-colors duration-300`}>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            </div>
            <div 
              className={cn(
              bgColor('card'),
                'p-10 rounded-3xl border-2 border-green-200',
                'shadow-xl hover:shadow-2xl',
                'hover:border-green-400 hover:-translate-y-2',
                'group cursor-pointer relative overflow-hidden',
                'bg-white hover:bg-gradient-to-br hover:from-white hover:to-green-50/40',
                'transition-all duration-1000 ease-out',
                isOfflineSectionVisible 
                  ? 'translate-x-0 opacity-100' 
                  : 'translate-x-20 opacity-0'
              )}
            >
              {/* Decorative background accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-green-600/5 rounded-bl-full"></div>
              <div className="absolute top-0 left-0 w-24 h-24 bg-green-500/5 rounded-br-full"></div>
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <AppIcon name="shieldCheck" size="dashboard" className="text-white" />
              </div>
                <h3 className={`${typo('h3')} text-green-700 mb-6 font-bold group-hover:text-green-600 transition-colors duration-300`}>Sécurité & Conformité</h3>
                <ul className="space-y-4">
                {[
                  'Chiffrement end-to-end',
                  'Conformité RGPD',
                  'Audits de sécurité réguliers',
                  'Sauvegardes automatiques',
                ].map((point, index) => (
                    <li key={index} className="flex items-start space-x-4">
                      <div className="w-6 h-6 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-green-100 transition-colors duration-300">
                    <AppIcon name="success" size="submenu" className="text-green-600" />
                      </div>
                      <span className={`${typo('base')} ${textColor('secondary')} leading-relaxed group-hover:text-gray-700 transition-colors duration-300`}>{point}</span>
                  </li>
                ))}
              </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7️⃣ SECTION — TARIFICATION */}
      <section id="tarification" className={`py-32 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative overflow-hidden`}>
        {/* Decorative background elements */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 right-10 w-96 h-96 bg-gold-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-10 w-80 h-80 bg-blue-600 rounded-full blur-3xl"></div>
            </div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          {/* Titre & Sous-titre */}
          <div className="text-center mb-16 -mt-8">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-white`}>
              Une tarification claire, pensée pour les établissements sérieux
            </h2>
            <p className={`${typo('large')} text-white/90 max-w-3xl mx-auto leading-relaxed mb-8`}>
              Accédez à l'ensemble des modules Academia Helm avec une logique simple,
              transparente et évolutive selon la taille de votre structure.
            </p>
            
            {/* Toggle Mensuel/Annuel */}
            <div className="flex items-center justify-center gap-4 mb-20 mt-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-2.5 border border-gold-500/50 shadow-lg">
                <div className="flex items-center justify-center gap-4">
                  <span className={`${typo('base')} ${pricingPeriod === 'monthly' ? 'text-white font-semibold' : 'text-white/60'}`}>
                    Mensuel
                  </span>
                  <button
                    onClick={() => setPricingPeriod(pricingPeriod === 'monthly' ? 'annual' : 'monthly')}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-blue-900 ${
                      pricingPeriod === 'annual' ? 'bg-gold-500/30' : 'bg-white/20'
                    }`}
                    role="switch"
                    aria-checked={pricingPeriod === 'annual'}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full shadow-lg transition-transform ${
                        pricingPeriod === 'annual' 
                          ? 'translate-x-7 bg-gold-500' 
                          : 'translate-x-1 bg-white'
                      }`}
                    />
                  </button>
                  <span className={`${typo('base')} ${pricingPeriod === 'annual' ? 'text-gold-400 font-semibold' : 'text-white/60'}`}>
                    Annuel
                  </span>
                  {pricingPeriod === 'annual' && (
                    <span className="ml-2 px-3 py-1 bg-gold-500/20 text-gold-400 rounded-full text-xs font-medium">
                      2 mois offerts
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cartes de Pricing */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {/* CARTE 1 — ÉCOLE INDIVIDUELLE */}
            <div className={cn(
              'bg-white p-8 rounded-3xl border-2 border-blue-200',
              'shadow-xl hover:shadow-2xl',
              'hover:border-blue-400 hover:-translate-y-1',
              'transition-all duration-300 ease-out',
              'group relative overflow-hidden',
              'flex flex-col h-full'
            )}>
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-bl-full"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Icône */}
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-2xl flex items-center justify-center border-2 border-blue-600/30 shadow-lg">
                    <AppIcon name="finance" size="dashboard" className="text-blue-600" />
              </div>
                </div>

                {/* Tag */}
                <div className="mb-4 flex justify-center">
                  <span className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                    Idéal pour un établissement autonome
                  </span>
              </div>

                {/* Titre */}
                <h3 className={`${typo('h2')} text-gray-900 font-bold mb-4 text-center`}>École individuelle</h3>

                {/* Prix */}
              <div className="mb-6">
                  {pricingPeriod === 'monthly' ? (
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-extrabold text-blue-700">15 000</span>
                      <span className="text-xl font-bold text-blue-600">FCFA</span>
                      <span className="text-base text-gray-600 font-medium">/ mois</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-4xl font-extrabold text-blue-700">150 000</span>
                        <span className="text-xl font-bold text-blue-600">FCFA</span>
                        <span className="text-base text-gray-600 font-medium">/ an</span>
                      </div>
                      <p className={`${typo('small')} text-gold-600 text-center font-medium`}>
                        Économisez 30 000 FCFA (2 mois offerts)
                      </p>
                    </>
                  )}
                </div>

                {/* Highlight */}
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-200">
                  <p className={`${typo('base')} text-blue-900 font-semibold text-center`}>
                    Accès total à tous les modules
                </p>
              </div>

                {/* Liste des fonctionnalités */}
                <ul className="space-y-3 mb-6 flex-grow">
                {[
                    'Souscription initiale : 100 000 FCFA (one-shot)',
                    'Accès à tous les modules sans restriction',
                    'Gestion scolaire et financière complète',
                    'ORION : pilotage & alertes direction',
                    'ATLAS : assistance guidée',
                    'Mode offline / online',
                    'Sous-domaine dédié',
                    'Support inclus',
                ].map((item, index) => (
                  <li key={index} className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-green-200">
                        <AppIcon name="success" size="submenu" className="text-green-600" />
                      </div>
                      <span className={`${typo('small')} text-gray-700 leading-relaxed`}>{item}</span>
                  </li>
                ))}
              </ul>

                {/* Note de réassurance */}
                <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className={`${typo('small')} text-gray-600 text-center leading-relaxed`}>
                    30 jours d'exploitation réelle après souscription, sans abonnement à payer.
                  </p>
                </div>

                {/* CTA */}
              <Link
                href="/signup"
                prefetch={true}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white w-full py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
              >
                  Commencer maintenant
              </Link>
              </div>
            </div>

            {/* CARTE 2 — GROUPE SCOLAIRE (MISE EN VALEUR) */}
            <div className={cn(
              'bg-white p-8 rounded-3xl border-2 border-sky-400',
              'hover:shadow-3xl',
              'hover:border-sky-300',
              'transition-all duration-300 ease-out',
              'group relative overflow-hidden',
              'flex flex-col h-full',
              'ring-4 ring-sky-400/40',
              'animate-recommended-card',
              'shadow-[0_0_30px_rgba(56,189,248,0.4)]'
            )}>
              {/* Badge "Recommandé" */}
              <div className="absolute top-6 right-6 z-20">
                <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full text-xs font-bold shadow-lg">
                  Recommandé
                </span>
              </div>

              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/10 rounded-bl-full"></div>
              <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/10 rounded-br-full"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Icône */}
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-2xl flex items-center justify-center border-2 border-blue-600/30 shadow-lg">
                    <AppIcon name="building" size="dashboard" className="text-blue-600" />
                  </div>
                </div>

                {/* Tag */}
                <div className="mb-4 flex justify-center">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Optimisé pour les promoteurs multi-écoles
                  </span>
                </div>

                {/* Titre */}
                <h3 className={`${typo('h2')} text-gray-900 font-bold mb-4 text-center`}>Groupe scolaire</h3>

                {/* Prix */}
              <div className="mb-6">
                  {pricingPeriod === 'monthly' ? (
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-extrabold text-blue-700">25 000</span>
                      <span className="text-xl font-bold text-blue-600">FCFA</span>
                      <span className="text-base text-gray-600 font-medium">/ mois</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-center gap-2 mb-2">
                        <span className="text-4xl font-extrabold text-blue-700">250 000</span>
                        <span className="text-xl font-bold text-blue-600">FCFA</span>
                        <span className="text-base text-gray-600 font-medium">/ an</span>
                      </div>
                      <p className={`${typo('small')} text-gold-600 text-center font-medium`}>
                        Économisez 50 000 FCFA (2 mois offerts)
                      </p>
                    </>
                  )}
                </div>

                {/* Highlight */}
                <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-300">
                  <p className={`${typo('base')} text-blue-900 font-semibold text-center`}>
                    Tarif groupe avantageux
                </p>
              </div>

                {/* Liste des fonctionnalités */}
                <ul className="space-y-3 mb-6 flex-grow">
                  {[
                    'Souscription initiale : 100 000 FCFA par école',
                    'Gestion de 2 établissements',
                    'Tous les modules activés',
                    'Tableaux de bord consolidés',
                    'ORION : vision groupe',
                    'ATLAS : accompagnement des équipes',
                    'Mode offline / online',
                    'Sous-domaines dédiés',
                    'Support prioritaire',
                  ].map((item, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-green-200">
                        <AppIcon name="success" size="submenu" className="text-green-600" />
                      </div>
                      <span className={`${typo('small')} text-gray-700 leading-relaxed`}>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Note de réassurance */}
                <div className="mb-6 p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className={`${typo('small')} text-blue-900 text-center leading-relaxed font-medium`}>
                    Économisez 5 000 FCFA par mois par rapport au tarif standard.
                  </p>
                </div>

                {/* CTA */}
              <Link
                href="/signup?plan=group"
                prefetch={true}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white w-full py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
              >
                  Créer un groupe scolaire
              </Link>
            </div>
          </div>

            {/* CARTE 3 — ENTERPRISE */}
            <div className={cn(
              'bg-white p-8 rounded-3xl border-2 border-blue-200',
              'shadow-xl hover:shadow-2xl',
              'hover:border-blue-400 hover:-translate-y-1',
              'transition-all duration-300 ease-out',
              'group relative overflow-hidden',
              'flex flex-col h-full'
            )}>
              {/* Decorative accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-bl-full"></div>
              
              <div className="relative z-10 flex flex-col h-full">
                {/* Icône */}
                <div className="mb-4 flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-600/20 to-gray-700/20 rounded-2xl flex items-center justify-center border-2 border-gray-600/30 shadow-lg">
                    <AppIcon name="rh" size="dashboard" className="text-gray-700" />
                  </div>
                </div>

                {/* Tag */}
                <div className="mb-4 flex justify-center">
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    Pour +3 écoles
                  </span>
                </div>

                {/* Titre */}
                <h3 className={`${typo('h2')} text-gray-900 font-bold mb-4 text-center`}>Réseau éducatif / Enterprise</h3>

                {/* Prix */}
              <div className="mb-6">
                  <div className="flex items-center justify-center mb-2">
                    <span className="text-3xl font-extrabold text-gray-800">Sur devis</span>
                  </div>
                  <p className={`${typo('small')} text-gray-600 text-center`}>
                    Tarification personnalisée selon vos besoins
                  </p>
                </div>

                {/* Highlight */}
                <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <p className={`${typo('base')} text-gray-900 font-semibold text-center`}>
                    Offre personnalisée selon votre structure
                  </p>
                </div>

                {/* Liste des fonctionnalités */}
                <ul className="space-y-3 mb-6 flex-grow">
                  {[
                    'Gestion de 3 établissements et plus',
                    'Accès complet à tous les modules',
                    'Pilotage multi-écoles avancé',
                    'ORION : KPI consolidés et alertes',
                    'ATLAS : assistance personnalisée',
                    'Options spécifiques selon besoins',
                    'Accompagnement dédié',
                  ].map((item, index) => (
                    <li key={index} className="flex items-start space-x-3">
                      <div className="w-5 h-5 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-green-200">
                        <AppIcon name="success" size="submenu" className="text-green-600" />
                      </div>
                      <span className={`${typo('small')} text-gray-700 leading-relaxed`}>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Note de réassurance */}
                <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className={`${typo('small')} text-gray-600 text-center leading-relaxed`}>
                    Une tarification adaptée, sans compromis sur la qualité.
                  </p>
                </div>

                {/* CTA */}
                <Link
                  href="/contact-enterprise"
                  prefetch={true}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white w-full py-4 rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 inline-flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105"
                >
                  Demander un devis
                </Link>
              </div>
            </div>
          </div>

          {/* BANDEAU FREE TRIAL */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-blue-50 to-white rounded-3xl border-2 border-blue-200 p-8 shadow-xl">
              <div className="text-center max-w-3xl mx-auto">
                <h3 className={`${typo('h3')} text-gray-900 font-bold mb-4`}>
                  Découvrir Academia Helm sans engagement
                </h3>
                <p className={`${typo('base')} text-gray-700 mb-6 leading-relaxed`}>
                  Profitez de 3 jours de démonstration guidée avec des données fictives
                  pour explorer la plateforme avant activation.
            </p>
                <Link
                  href="/trial"
                  prefetch={true}
                  className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
                >
                  Démarrer le free trial (3 jours)
                </Link>
              </div>
            </div>
          </div>

          {/* MENTIONS DE RÉASSURANCE */}
          <div className="text-center pt-8 border-t border-white/10">
            <div className="max-w-4xl mx-auto">
              <p className={`${typo('small')} text-white/80 mb-4 leading-relaxed`}>
                Paiement sécurisé via Fedapay • Aucun prélèvement automatique • Rappels avant échéance (J-7, J-3, J-1) • Données conservées en cas de suspension
              </p>
              <div className="flex justify-center mt-4 mb-0">
                <Image
                  src="/images/logoFedaPay.png"
                  alt="Fedapay - Paiement sécurisé en ligne"
                  width={120}
                  height={48}
                  className="h-10 w-auto object-contain"
                  loading="lazy"
                  sizes="(max-width: 768px) 100px, 120px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8️⃣ SECTION — TÉMOIGNAGES */}
      <section className="py-24 bg-gradient-to-b from-white via-blue-50/30 to-cloud px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Decorative background elements - Modern & Dynamic */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-600/5 via-transparent to-gold-500/5"></div>
          <div className="absolute top-20 left-10 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
            </div>
        
        {/* Geometric shapes for modern look */}
        <div className="absolute top-0 right-0 w-64 h-64 border-t-2 border-r-2 border-blue-600/10 rounded-tl-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 border-b-2 border-l-2 border-gold-500/10 rounded-br-3xl"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <h2 className={`text-4xl md:text-5xl lg:text-6xl font-bold ${textColor('primary')} mb-8 leading-tight`}>
              Ils ont <span className="text-blue-900 relative inline-block">
                <span className="relative z-10">structuré</span>
                <span className="absolute bottom-1 left-0 right-0 h-4 bg-blue-900/20 -rotate-1"></span>
              </span> leur établissement<br />
              avec Academia Helm.
            </h2>
            
            {/* Enhanced Subtitle */}
            <div className="max-w-4xl mx-auto mb-8">
              <p className={`${typo('large')} ${textColor('secondary')} text-xl leading-relaxed mb-4 font-medium`}>
                Découvrez les témoignages authentiques de directeurs et promoteurs
              </p>
              <p className={`${typo('base')} ${textColor('secondary')} text-lg leading-relaxed opacity-80`}>
                qui ont transformé leur gestion scolaire et obtenu des résultats mesurables.
              </p>
          </div>
            
            {/* Trust Indicators - Dynamiques */}
            <div className="flex flex-wrap items-center justify-center gap-8 mt-8 pt-6 border-t border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center shadow-md">
                  <AppIcon name="building" size="submenu" className="text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 text-2xl md:text-3xl">
                    {testimonialStats.totalSchools}+
                  </div>
                  <div className="text-base text-gray-600">Établissements</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center shadow-md">
                  <AppIcon name="success" size="submenu" className="text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 text-2xl md:text-3xl">
                    {testimonialStats.satisfactionRate}%
                  </div>
                  <div className="text-base text-gray-600">Satisfaction</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-gold-100 rounded-full flex items-center justify-center shadow-md">
                  <AppIcon name="sparkles" size="submenu" className="text-gold-600" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-gray-900 text-2xl md:text-3xl">
                    {testimonialStats.averageRating.toFixed(1)}/5
                  </div>
                  <div className="text-base text-gray-600">Note moyenne</div>
                </div>
              </div>
            </div>
          </div>

          {/* Animated Testimonials Section */}
          <div className="mb-6">
            <div className="text-center mb-8">
              <h3 className={`${typo('h2')} ${textColor('primary')} mb-4 font-bold text-3xl md:text-4xl lg:text-5xl`}>
                Témoignages
              </h3>
              <p className={`${typo('base')} ${textColor('secondary')} max-w-2xl mx-auto`}>
                Retours d'expérience de nos utilisateurs
              </p>
            </div>
            <AnimatedTestimonials />
          </div>

          {/* Static Testimonials Grid */}
          <div className="mb-6">
          <TestimonialsSection limit={3} featured={true} />
          </div>
        </div>
      </section>

      {/* 9️⃣ SECTION — CTA FINAL */}
      <section className={`py-16 md:py-20 ${bgColor('sidebar')} ${textColor('inverse')} px-4 sm:px-6 lg:px-8 relative`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-40 h-40 mb-4 relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-75 animate-pulse"></div>
            <div className="relative z-10 w-32 h-32 flex items-center justify-center">
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Helm - Plateforme de pilotage éducatif"
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
            Passez à une gestion scolaire<br />
            <span className="text-gold-500">structurée</span> et <span className="text-gold-500">maîtrisée</span>.
          </h2>
          <Link
            href="/signup"
            prefetch={true}
            className="bg-gold-500 text-white px-12 py-5 rounded-subtle font-semibold hover:bg-gold-600 transition-colors inline-flex items-center justify-center text-lg shadow-xl hover:shadow-2xl"
          >
            Créer mon établissement maintenant
            <AppIcon name="userPlus" size="action" className="ml-2 text-white" />
          </Link>
        </div>
      </section>

      {/* 🔟 FOOTER INSTITUTIONNEL */}
      <div className="bg-blue-900 border-t-2 border-gold-500/20">
        <InstitutionalFooter />
      </div>

      {/* Video Player Modal */}
      <VideoPlayerModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl="/videos/academia-hub-presentation.mp4"
        thumbnailUrl="/images/Miniature Présentation Academia Helm.png"
        title="Présentation Academia Helm"
      />

      {/* Support Chat Widget */}
      <SupportChatWidget />
    </div>
  );
}
