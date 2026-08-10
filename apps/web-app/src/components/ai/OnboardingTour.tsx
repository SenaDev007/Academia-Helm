'use client';

/**
 * ============================================================================
 * OnboardingTour — Parcours d'onboarding guidé par Sarah
 * ============================================================================
 *
 * Affiche une invitation dynamique au premier login de l'utilisateur :
 *   "Bienvenue ! Voulez-vous un parcours guidé par Sarah ?"
 *
 * Si l'utilisateur accepte :
 *   - Sarah explique chaque module étape par étape (1, 2, 3, 4, 5...)
 *   - Bouton Skip à chaque étape pour quitter
 *   - Bouton "Étape suivante" pour avancer
 *   - À la fin, message de remerciement
 *
 * Si l'utilisateur refuse :
 *   - Le widget Sarah reste disponible en bas à droite
 *
 * Stockage : localStorage 'sarah-onboarding-completed' = 'true'
 * → ne s'affiche plus après la 1ère fois
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, Check, Sparkles, Building2, Users, GraduationCap,
  DollarSign, Calendar, FileText, BarChart3, Settings, Compass,
} from 'lucide-react';

const AH = {
  navy900: '#0A2A5E',
  navy800: '#103E91',
  navy700: '#1D4FA5',
  gold500: '#F5B335',
  gold600: '#D99725',
  white: '#FFFFFF',
  online: '#22C55E',
  graphite500: '#6B7280',
  graphite700: '#374151',
};

interface TourStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  route?: string;
  sarahMessage: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: 'Bienvenue sur Academia Helm !',
    description: 'Je suis Sarah, votre guide. Je vais vous présenter les modules clés de la plateforme en 6 étapes rapides.',
    icon: <Sparkles className="w-6 h-6" />,
    sarahMessage: "Shalom ! Je suis **Sarah**, votre conseillère. Laissez-moi vous guider à travers les modules essentiels. Vous pouvez skipper à tout moment si vous préférez explorer seul.",
  },
  {
    id: 2,
    title: 'Tableau de bord',
    description: "Vue d'ensemble de votre établissement : effectifs, finances, statistiques en temps réel.",
    icon: <BarChart3 className="w-6 h-6" />,
    route: '/app',
    sarahMessage: "Le **Tableau de bord** est votre point de départ. Vous y trouvez les KPIs principaux : effectifs, recettes, taux de présence. C'est ici que vous revenez chaque matin.",
  },
  {
    id: 3,
    title: 'Élèves & Inscriptions',
    description: 'Gérez les élèves, inscriptions, transferts et documents scolaires.',
    icon: <Users className="w-6 h-6" />,
    route: '/app/students',
    sarahMessage: "Le module **Élèves** centralise tout : inscriptions, matricules, photos, dossiers. Vous pouvez importer en masse via Excel et générer des cartes scolaires.",
  },
  {
    id: 4,
    title: 'Pédagogie',
    description: 'Emplois du temps, cahiers de texte, saisie des notes et bulletins.',
    icon: <GraduationCap className="w-6 h-6" />,
    route: '/app/pedagogy',
    sarahMessage: "Le module **Pédagogie** gère les emplois du temps, cahiers de texte, et la saisie des notes via SaisieMaster. Les bulletins sont générés automatiquement.",
  },
  {
    id: 5,
    title: 'Finance',
    description: 'Frais de scolarité, paiements, reçus, relances automatiques.',
    icon: <DollarSign className="w-6 h-6" />,
    route: '/app/finance',
    sarahMessage: "Le module **Finance** gère les frais, paiements FedaPay, reçus PDF, et les relances automatiques. Vous pouvez suivre les arriérés par élève.",
  },
  {
    id: 6,
    title: 'Ressources Humaines',
    description: 'Staff, contrats, bulletins de paie, congés et recrutement.',
    icon: <Building2 className="w-6 h-6" />,
    route: '/app/hr',
    sarahMessage: "Le module **RH** gère le staff : contrats PDF, bulletins de paie, congés, et même le recrutement avec questionnaires et entretiens.",
  },
  {
    id: 7,
    title: 'Sarah, votre assistante',
    description: 'Je reste disponible en bas à droite pour vous aider à tout moment !',
    icon: <Compass className="w-6 h-6" />,
    sarahMessage: "Et bien sûr, **je suis toujours là** ! Cliquez sur ma photo en bas à droite pour me poser une question. Je connais tous les modules. Bonne découverte ! 🎉",
  },
];

const STORAGE_KEY = 'sarah-onboarding-completed';
const TOUR_VERSION = 'v1-2026-08';

export default function OnboardingTour() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  // ⭐ Case à cocher "Ne plus afficher" — par défaut décochée.
  //    Si cochée au moment du "Non merci", on persiste le skip définitivement.
  //    Sinon, le "Non merci" ferme juste pour cette session (re-affiché au prochain login).
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const router = useRouter();

  // Vérifier au montage si l'utilisateur a déjà fait le tour
  useEffect(() => {
    try {
      const completed = localStorage.getItem(`${STORAGE_KEY}-${TOUR_VERSION}`);
      const skipped = localStorage.getItem(`${STORAGE_KEY}-skipped`);
      if (!completed && !skipped) {
        // Délai de 2s après le login pour ne pas perturber
        const timer = setTimeout(() => setShowPrompt(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage peut être indisponible (SSR, incognito)
    }
  }, []);

  const handleAccept = () => {
    setShowPrompt(false);
    setTourActive(true);
    setCurrentStep(0);
  };

  // ⭐ "Non merci" — ferme le modal.
  //    Si la case "Ne plus afficher" est cochée → persiste le skip définitivement.
  //    Sinon → ferme juste pour cette session (le modal réapparaîtra au prochain login).
  //    Avant : le "Non merci" persistait TOUJOURS le skip, ce qui était trop
  //    agressif (un clic malencontreux supprimait définitivement l'onboarding).
  const handleDecline = () => {
    setShowPrompt(false);
    if (dontShowAgain) {
      try {
        localStorage.setItem(`${STORAGE_KEY}-skipped`, 'true');
      } catch {}
    }
    // Reset la case pour la prochaine fois
    setDontShowAgain(false);
  };

  // ⭐ Fermer via le X — ne persiste JAMAIS le skip (juste ferme pour cette session).
  //    Avant : handleDecline était appelé → skip persisté même si l'utilisateur
  //    voulait juste fermer le modal pour le voir plus tard.
  const handleClose = () => {
    setShowPrompt(false);
    setDontShowAgain(false);
  };

  const handleNext = () => {
    const step = TOUR_STEPS[currentStep];
    // Naviguer vers la route si définie
    if (step.route && currentStep > 0) {
      router.push(step.route);
    }
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Fin du tour
      handleFinish();
    }
  };

  const handleSkip = () => {
    setTourActive(false);
    try {
      localStorage.setItem(`${STORAGE_KEY}-skipped`, 'true');
    } catch {}
  };

  const handleFinish = () => {
    setTourActive(false);
    try {
      localStorage.setItem(`${STORAGE_KEY}-${TOUR_VERSION}`, 'true');
    } catch {}
  };

  const step = TOUR_STEPS[currentStep];
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <>
      {/* ─── PROMPT INITIAL — "Voulez-vous un parcours guidé ?" ─── */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
            style={{ background: 'rgba(10,42,94,0.6)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              {/* Header avec photo Sarah */}
              <div
                className="relative px-6 py-5 flex items-center gap-4"
                style={{ background: `linear-gradient(135deg, ${AH.navy900}, ${AH.navy700})` }}
              >
                <div className="relative w-14 h-14 rounded-full overflow-hidden ring-2 flex-shrink-0"
                  style={{ '--tw-ring-color': AH.gold500 } as React.CSSProperties}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                    style={{ backgroundColor: AH.online, borderColor: AH.navy900 }}
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg">Sarah vous accueille</h2>
                  <p className="text-white/70 text-xs">Academia Helm · Onboarding</p>
                </div>
                <button
                  onClick={handleClose}
                  className="text-white/60 hover:text-white p-1"
                  aria-label="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu */}
              <div className="px-6 py-5">
                <p className="text-gray-700 text-sm leading-relaxed mb-4">
                  Bienvenue sur <strong>Academia Helm</strong> ! Je suis <strong>Sarah</strong>,
                  votre conseillère IA. Souhaitez-vous un <strong>parcours guidé professionnel</strong> 
                  pour découvrir les modules clés de la plateforme ?
                </p>
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-600 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: AH.gold600 }} />
                    <span>
                      Je vous expliquerai chaque module (Élèves, Pédagogie, Finance, RH...) 
                      avec des conseils pratiques. Durée : ~3 minutes.
                    </span>
                  </p>
                </div>

                {/* ⭐ Case à cocher "Ne plus afficher" */}
                <label className="flex items-center gap-2 mb-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(e) => setDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-gray-600">Ne plus afficher ce message</span>
                </label>

                {/* Boutons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDecline}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {dontShowAgain ? 'Non merci, ne plus afficher' : 'Non merci'}
                  </button>
                  <button
                    onClick={handleAccept}
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${AH.navy700}, ${AH.navy900})` }}
                  >
                    Oui, guide-moi ✨
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── TOUR ACTIF — Étape par étape ─── */}
      <AnimatePresence>
        {tourActive && step && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-4 right-4 z-[1001] w-[360px] max-w-[calc(100vw-2rem)]"
          >
            <motion.div
              initial={{ y: 20, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Barre de progression */}
              <div className="h-1 bg-gray-200">
                <motion.div
                  className="h-full"
                  style={{ background: `linear-gradient(90deg, ${AH.gold500}, ${AH.gold600})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Header */}
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ background: `linear-gradient(135deg, ${AH.navy900}, ${AH.navy800})` }}
              >
                <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 flex-shrink-0"
                  style={{ '--tw-ring-color': AH.gold500 } as React.CSSProperties}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-sm">Sarah</h3>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-wider"
                      style={{ background: AH.gold500, color: AH.navy900 }}
                    >
                      Étape {step.id}/{TOUR_STEPS.length}
                    </span>
                  </div>
                  <p className="text-white/60 text-[10px]">Parcours d'onboarding</p>
                </div>
                <button
                  onClick={handleSkip}
                  className="text-white/60 hover:text-white text-xs font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors"
                >
                  Skip
                </button>
              </div>

              {/* Contenu de l'étape */}
              <div className="px-4 py-4">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${AH.navy700}15`, color: AH.navy700 }}
                  >
                    {step.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 mb-1">{step.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {/* Message de Sarah */}
                <div
                  className="rounded-lg p-3 text-xs leading-relaxed"
                  style={{ background: `${AH.gold500}10`, border: `1px solid ${AH.gold500}30` }}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: AH.gold600 }} />
                    <p className="text-gray-700" dangerouslySetInnerHTML={{
                      __html: step.sarahMessage.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    }} />
                  </div>
                </div>
              </div>

              {/* Footer — Navigation */}
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-1">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: i === currentStep ? '20px' : '6px',
                        background: i <= currentStep ? AH.gold500 : '#E5E7EB',
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm transition-all hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${AH.navy700}, ${AH.navy900})` }}
                >
                  {currentStep === TOUR_STEPS.length - 1 ? (
                    <>Terminer <Check className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Suivant <ChevronRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
