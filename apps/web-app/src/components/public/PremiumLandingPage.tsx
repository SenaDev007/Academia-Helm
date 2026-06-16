/**
 * Premium Landing Page Component
 * 
 * Refonte complète orientée conversion avec palette logo Academia Helm.
 */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useMemo, useState, useEffect } from 'react';
import {
  ShieldCheck,
  Brain,
  WifiOff,
  Wallet,
  GraduationCap,
  Users,
  ArrowRight,
  DoorOpen,
  BookOpen,
  Megaphone,
  // Modules bento icons
  GraduationCap as GradIcon,
  Banknote,
  ClipboardCheck,
  LayoutGrid,
  UserCog,
  MessageSquare,
  Bus,
  Utensils,
  Pill,
  BookMarked,
  FlaskConical,
  ShoppingBag,
  Radio,
  // Features section
  Gauge,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import { LoadingScreen } from '@/components/loading/LoadingScreen';
import { LoadingScreenMobile } from '@/components/loading/LoadingScreenMobile';
import { BLOG_POSTS } from '@/content/blog/posts';

const SaraWidget = dynamic(() => import('./SaraWidget'), {
  ssr: false,
  loading: () => null,
});

const ReviewsSection = dynamic(() => import('@/components/landing/ReviewsSection'), {
  ssr: false,
  loading: () => null,
});

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

// Note: les anciennes constantes de motion (featureCardMotion, moduleCardMotion,
// pricingCardMotion) ont été inlinées dans les composants lors de la refonte 2026.

function AnimatedHeadline({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const words = text.split(' ');
  return (
    <span className={`${className ?? ''} [word-break:normal] [overflow-wrap:normal] hyphens-none`}>
      {words.map((word, wordIndex) => (
        <span key={`${word}-${wordIndex}`} className="inline-flex whitespace-nowrap">
          {Array.from(word).map((char, charIndex) => {
            const globalIndex = words
              .slice(0, wordIndex)
              .reduce((acc, w) => acc + w.length, 0) + charIndex + wordIndex;
            return (
              <motion.span
                key={`${char}-${wordIndex}-${charIndex}`}
                initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.38,
                  ease: 'easeOut',
                  delay: delay + globalIndex * 0.018,
                }}
                className="inline-block will-change-transform"
              >
                {char}
              </motion.span>
            );
          })}
          {wordIndex < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}

const features = [
  {
    title: 'Pilotage centralisé',
    desc: 'Décisions basées sur des indicateurs fiables : élèves, finances, examens, RH. Un cockpit unique pour toute la direction.',
    icon: Users,
    stat: '360°',
    statLabel: 'visibilité temps réel',
    accent: 'from-[#0b2f73] to-[#144798]',
  },
  {
    title: 'ORION intégré',
    desc: "L'IA de direction qui transforme vos données en alertes intelligentes, priorités automatiques et recommandations concrètes.",
    icon: Brain,
    stat: 'IA',
    statLabel: 'décisionnelle native',
    accent: 'from-[#f5b335] to-[#e89a1f]',
  },
  {
    title: 'Offline-first',
    desc: 'Continuité totale des opérations même sans internet. Saisies locales journalisées, puis synchronisation sécurisée automatique.',
    icon: WifiOff,
    stat: '24/7',
    statLabel: 'disponibilité réseau',
    accent: 'from-[#0b2f73] to-[#1d4fa5]',
  },
  {
    title: 'Conformité & sécurité',
    desc: 'Architecture multi-tenant stricte, RBAC granulaire, audit immuable, RLS PostgreSQL. Vos données restent souveraines et tracées.',
    icon: ShieldCheck,
    stat: 'RBAC',
    statLabel: '+ audit immuable',
    accent: 'from-[#0b2f73] to-[#071d49]',
  },
];

/**
 * Modules de l'application — bento grid moderne.
 * `span` contrôle la taille dans la grille bento (col-span / row-span).
 * `tone` contrôle la couleur de l'icône (pastille douce).
 */
type ModuleTone = 'navy' | 'gold' | 'emerald' | 'indigo' | 'rose' | 'sky' | 'violet' | 'amber';
interface ModuleItem {
  title: string;
  text: string;
  icon: typeof Users;
  tone: ModuleTone;
  span?: 'wide' | 'tall' | 'normal';
  featured?: boolean;
}

const moduleToneClasses: Record<ModuleTone, { bg: string; ring: string; text: string }> = {
  navy:    { bg: 'bg-[#0b2f73]/10',  ring: 'ring-[#0b2f73]/20',  text: 'text-[#0b2f73]' },
  gold:    { bg: 'bg-[#f5b335]/15',  ring: 'ring-[#f5b335]/30',  text: 'text-[#a67410]' },
  emerald: { bg: 'bg-emerald-50',     ring: 'ring-emerald-200',    text: 'text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',      ring: 'ring-indigo-200',     text: 'text-indigo-700' },
  rose:    { bg: 'bg-rose-50',        ring: 'ring-rose-200',       text: 'text-rose-700' },
  sky:     { bg: 'bg-sky-50',         ring: 'ring-sky-200',        text: 'text-sky-700' },
  violet:  { bg: 'bg-violet-50',      ring: 'ring-violet-200',     text: 'text-violet-700' },
  amber:   { bg: 'bg-amber-50',       ring: 'ring-amber-200',      text: 'text-amber-700' },
};

const modules: ModuleItem[] = [
  {
    title: 'Élèves & Scolarité',
    text: 'Admissions, dossiers numériques, absences, transferts inter-écoles, documents officiels, suivi complet du cycle scolaire.',
    icon: GradIcon,
    tone: 'navy',
    span: 'wide',
    featured: true,
  },
  {
    title: 'Finances & Économat',
    text: 'Paiements, recouvrement, dépenses, trésorerie, clôtures journalières et reçus certifiés.',
    icon: Banknote,
    tone: 'gold',
    span: 'normal',
  },
  {
    title: 'Examens & Bulletins',
    text: 'Saisie des notes, calculs automatiques, bulletins PDF, conseils de classe et audits académiques.',
    icon: ClipboardCheck,
    tone: 'indigo',
    span: 'normal',
  },
  {
    title: 'Organisation pédagogique',
    text: 'Classes, matières, emploi du temps, cahiers de texte, plans de leçon et stocks de matériel.',
    icon: LayoutGrid,
    tone: 'emerald',
    span: 'tall',
    featured: true,
  },
  {
    title: 'RH & Personnel',
    text: 'Contrats, présence, paie, CNSS, rôles, habilitations, organigramme et recrutement assisté par IA.',
    icon: UserCog,
    tone: 'rose',
    span: 'normal',
  },
  {
    title: 'Communication',
    text: 'SMS, e-mail, WhatsApp, annonces, templates, automatisations et messagerie interne.',
    icon: MessageSquare,
    tone: 'sky',
    span: 'normal',
  },
  {
    title: 'Transport',
    text: 'Véhicules, itinéraires, chauffeurs, arrêts, présences et incidents.',
    icon: Bus,
    tone: 'amber',
    span: 'normal',
  },
  {
    title: 'Cantine',
    text: 'Menus, inscriptions, présences, stocks, fournisseurs et paiements.',
    icon: Utensils,
    tone: 'violet',
    span: 'normal',
  },
  {
    title: 'Infirmerie',
    text: 'Dossiers médicaux, visites, urgences, autorisations et vigilance allergies.',
    icon: Pill,
    tone: 'rose',
    span: 'normal',
  },
  {
    title: 'Bibliothèque',
    text: 'Catalogue, prêts, retours, pénalités, ressources numériques et recommandations.',
    icon: BookMarked,
    tone: 'navy',
    span: 'normal',
  },
  {
    title: 'Laboratoire',
    text: 'Équipements, stocks, sessions pratiques, maintenance et incidents de sécurité.',
    icon: FlaskConical,
    tone: 'emerald',
    span: 'normal',
  },
  {
    title: 'Boutique',
    text: 'Produits, commandes, stocks, fournisseurs et rapports de ventes.',
    icon: ShoppingBag,
    tone: 'gold',
    span: 'normal',
  },
  {
    title: 'EduCast',
    text: 'Chaînes enseignants, contenus, webinaires, playlists et monétisation.',
    icon: Radio,
    tone: 'violet',
    span: 'wide',
  },
];

/** Aperçu blog sur la landing (les articles MDX auto-générés apparaissent aussi sur /blog). */
const featuredBlogPosts = BLOG_POSTS.slice(0, 3);

/** Établissement avec offres d'emploi */
interface BannerSchool {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  activeJobsCount: number;
}

/** Bande défilante animée — appels d'offres par établissement avec liens cliquables */
function RecruitmentBanner() {
  const [schools, setSchools] = useState<BannerSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchActiveSchools() {
      try {
        const res = await fetch('/api/public/schools/with-jobs');
        if (!res.ok) { setIsLoading(false); return; }
        const data = await res.json();
        if (Array.isArray(data) && !cancelled) {
          // Ne garder que les écoles avec au moins 1 offre active
          const active = data
            .filter((s: any) => (s.activeJobsCount ?? 0) > 0)
            .map((s: any) => ({
              id: s.id,
              tenantId: s.tenantId ?? s.id,
              name: s.schoolName || s.name,
              schoolName: s.schoolName || s.name,
              slug: s.slug,
              logoUrl: s.logoUrl,
              city: s.city,
              country: s.country,
              activeJobsCount: s.activeJobsCount ?? 0,
            }));
          setSchools(active);
        }
      } catch {
        // Silently fail — banner is non-critical
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchActiveSchools();
    return () => { cancelled = true; };
  }, []);

  // En cours de chargement : afficher un bandeau simplifié
  if (isLoading) {
    return (
      <div className="overflow-hidden relative shadow-lg select-none z-[40]">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
        <div className="flex items-center gap-3 relative z-10 py-2.5 px-4">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#f5b335] shadow-md">
            <Megaphone className="h-3.5 w-3.5 text-[#0b2f73]" />
          </div>
          <span className="text-white/70 text-sm font-medium">Chargement des appels d&apos;offres…</span>
        </div>
      </div>
    );
  }

  // Aucune école avec offres : ne pas afficher
  if (schools.length === 0) return null;

  const totalJobs = schools.reduce((sum, s) => sum + s.activeJobsCount, 0);

  // Chaque item = une carte école cliquable + séparateur
  const bannerItems = schools.map((school) => (
    <Link
      key={school.id}
      href={`/jobs?school=${school.slug}`}
      className="flex items-center gap-2.5 bg-white/90 hover:bg-white rounded-full px-4 py-1.5 transition-all duration-200 border border-[#f5b335]/30 hover:border-[#f5b335]/70 hover:scale-[1.03] shadow-sm hover:shadow-md shrink-0 group"
    >
      {school.logoUrl ? (
        <Image
          src={school.logoUrl}
          alt={school.name}
          width={24}
          height={24}
          className="w-6 h-6 rounded-full object-cover ring-2 ring-[#f5b335]/30"
        />
      ) : (
        <span className="w-6 h-6 rounded-full bg-[#0b2f73] flex items-center justify-center text-[10px] font-bold text-[#f5b335] ring-2 ring-[#f5b335]/30">
          {school.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="text-[#0b2f73] text-sm font-semibold whitespace-nowrap group-hover:underline">
        {school.name}
      </span>
      {school.city && (
        <span className="text-[#1d4fa5]/60 text-xs whitespace-nowrap hidden sm:inline">
          • {school.city}
        </span>
      )}
      <span className="inline-flex items-center justify-center bg-[#0b2f73] text-[#f5b335] text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1.5">
        {school.activeJobsCount}
      </span>
      <span className="text-[#0b2f73]/70 text-xs whitespace-nowrap">
        offre{school.activeJobsCount > 1 ? 's' : ''}
      </span>
    </Link>
  ));

  // Dupliquer les items pour le défilement continu (2 copies = boucle parfaite)
  const duplicatedItems = [...bannerItems, ...bannerItems];

  return (
    <div
      className="overflow-hidden relative shadow-lg select-none z-[40]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => {
        setTimeout(() => setIsPaused(false), 2500);
      }}
    >
      {/* Fond premium avec dégradé et motifs */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
      <div className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />

      {/* Shimmer lumineux */}
      <div className="absolute inset-0 opacity-10 overflow-hidden">
        <div
          className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          style={{ animation: 'bannerShimmer 4s ease-in-out infinite' }}
        />
      </div>

      {/* Ligne dorée en haut */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
      {/* Ligne dorée en bas */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />

      {/* En-tête fixe à gauche — caché sur mobile, visible sur md+ */}
      <div className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 items-center bg-gradient-to-r from-[#0b2f73] via-[#0b2f73] to-transparent pr-8 pl-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f5b335] shadow-md">
            <Megaphone className="h-4 w-4 text-[#0b2f73]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[#f5b335] text-[10px] font-bold uppercase tracking-wider leading-tight">Appels d&apos;offres</span>
            <span className="text-white text-xs font-semibold leading-tight">
              {totalJobs} offre{totalJobs > 1 ? 's' : ''} • {schools.length} établis.{schools.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Résumé mobile — icône + compteur */}
      <div className="flex md:hidden absolute left-2 top-0 bottom-0 z-20 items-center">
        <div className="flex items-center gap-1.5 bg-[#f5b335] rounded-full px-2 py-0.5">
          <Megaphone className="h-3 w-3 text-[#0b2f73]" />
          <span className="text-[#0b2f73] text-[10px] font-bold">{totalJobs}</span>
        </div>
      </div>

      {/* Zone défilante */}
      <div
        className="flex items-center gap-4 relative z-10 py-2.5 pl-16 md:pl-56"
        style={{
          animation: 'bannerScroll 60s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
          width: 'max-content',
        }}
      >
        {duplicatedItems.map((item, i) => (
          <div key={`item-${i}`} className="flex items-center gap-4 shrink-0">
            {item}
            <span className="text-[#f5b335]/40 text-lg">|</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bannerShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @keyframes bannerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes heroPortalPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3), 0 0 0 0 rgba(245, 179, 53, 0.4);
          }
          50% {
            box-shadow: 0 0 16px 4px rgba(255, 255, 255, 0.15), 0 0 24px 6px rgba(245, 179, 53, 0.3);
          }
        }
        @keyframes heroPortalGlow {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(245, 179, 53, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 10px rgba(245, 179, 53, 0.8));
          }
        }
      `}</style>
    </div>
  );
}

const LANDING_MIN_LOADING_MS = 6000;

export default function PremiumLandingPage() {
  const [showContent, setShowContent] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Détecter mobile pour le loading screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Loading minimum de 6 secondes avant d'afficher le contenu
  useEffect(() => {
    const startTime = Date.now();
    const totalSteps = 90;
    const stepDuration = LANDING_MIN_LOADING_MS / totalSteps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= LANDING_MIN_LOADING_MS) {
        setLoadingProgress(100);
        clearInterval(interval);
        // Petit délai pour l'animation de 100%
        setTimeout(() => setShowContent(true), 300);
      } else {
        const baseProgress = (currentStep / totalSteps) * 90;
        setLoadingProgress(Math.min(Math.round(baseProgress), 90));
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 24,
    mass: 0.2,
  });
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -36]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.68]);
  const cinemaBlueOpacity = useTransform(scrollYProgress, [0.05, 0.35], [0, 0.26]);
  const cinemaGoldOpacity = useTransform(scrollYProgress, [0.3, 0.7], [0, 0.2]);
  const cinemaNavyOpacity = useTransform(scrollYProgress, [0.62, 0.98], [0, 0.24]);
  const heroParticles = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, index) => {
        const x = (index * 37) % 100;
        const y = (index * 17) % 100;
        const size = 4 + (index % 4) * 2;
        const duration = 7 + (index % 5);
        const delay = (index % 6) * 0.35;
        return { id: index, x, y, size, duration, delay };
      }),
    []
  );

  // Afficher le loading screen pendant 6 secondes minimum
  // Sur mobile : LoadingScreenMobile (CSS-only, léger)
  // Sur desktop : LoadingScreen (framer-motion, animations riches)
  if (!showContent) {
    const loadingMessage = { title: 'Bienvenue sur', subtitle: 'Plateforme de pilotage éducatif nouvelle génération' };

    if (isMobile) {
      return (
        <LoadingScreenMobile
          message={loadingMessage}
          progress={loadingProgress}
          showProgress={true}
          variant="pwa"
          minDuration={0}
        />
      );
    }

    return (
      <LoadingScreen
        message={loadingMessage}
        progress={loadingProgress}
        showProgress={true}
        variant="orion"
      />
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 [word-break:normal] [overflow-wrap:normal] hyphens-none">
      <Header />

      {/* Espace pour la navbar fixe + petit espacement avant la bande */}
      <div className="h-16 md:h-18" aria-hidden />

      <RecruitmentBanner />
      
      <motion.div
        style={{ scaleX: progress }}
        className="fixed top-14 md:top-16 left-0 right-0 h-1 bg-gradient-to-r from-[#f5b335] via-[#ffd166] to-[#0b2f73] origin-left z-50"
      />
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <motion.div
          style={{ opacity: cinemaBlueOpacity }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(29,79,165,0.45),transparent_55%)]"
        />
        <motion.div
          style={{ opacity: cinemaGoldOpacity }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_85%_40%,rgba(245,179,53,0.35),transparent_52%)]"
        />
        <motion.div
          style={{ opacity: cinemaNavyOpacity }}
          className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(11,47,115,0.28),transparent)]"
        />
      </div>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5]">
        <Image
          src="/images/AH background.webp"
          alt="Fond hero Academia Helm"
          fill
          className="object-cover opacity-45"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#0b2f73]/64" />
        <div className="absolute inset-0 opacity-12 bg-[radial-gradient(circle_at_top_right,#f5b335_0%,transparent_45%)]" />

        <motion.div
          animate={{ y: [0, -12, 0], opacity: [0.35, 0.75, 0.35] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-10 -left-8 w-56 h-56 rounded-full bg-amber-300/20 blur-3xl"
        />
        <div className="absolute inset-0 pointer-events-none">
          {heroParticles.map((particle) => (
            <motion.span
              key={particle.id}
              className="absolute rounded-full bg-white/55"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: particle.size,
                height: particle.size,
              }}
              animate={{
                y: [0, -18, 0],
                opacity: [0.25, 0.75, 0.25],
                scale: [1, 1.08, 1],
              }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: particle.delay,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <motion.div variants={staggerContainer} initial={false} animate="show">
              <p className="inline-flex items-center rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 px-4 py-1 text-sm font-semibold mb-6">
                Plateforme de pilotage éducatif
              </p>

              <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
                <AnimatedHeadline text="Le cockpit digital de votre établissement." />
              </motion.h1>

              <motion.p variants={fadeUp} className="mt-6 text-blue-100 text-lg leading-relaxed max-w-2xl">
                Academia Helm unifie toute la gestion scolaire dans une interface claire, élégante et robuste.
                Vous pilotez, vos équipes exécutent, l&apos;institution progresse.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-9 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <motion.div
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative"
                >
                  <motion.span
                    animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.6, repeat: Infinity }}
                    className="absolute inset-0 rounded-xl bg-amber-300/40 blur-md"
                  />

                  <Link
                    href="/signup"
                    className="relative inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-7 py-3.5 font-bold text-[#0b2f73] hover:bg-[#f7c359] transition-colors min-h-[48px]"
                  >
                    Démarrer maintenant
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </motion.div>

                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    href="/portal"
                    className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-amber-300/40 bg-white/10 px-7 py-3.5 font-semibold text-white hover:bg-white/20 transition-colors min-h-[48px]"
                    style={{ animation: 'heroPortalPulse 2.5s ease-in-out infinite' }}
                  >
                    Accéder au portail
                    <DoorOpen className="ml-2 w-4 h-4" style={{ animation: 'heroPortalGlow 2.5s ease-in-out infinite' }} />
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial={false}
              animate="show"
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative"
            >
              <motion.div
                animate={{ rotateZ: [0, -0.8, 0, 0.8, 0], y: [0, -3, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md p-4 md:p-6 shadow-2xl"
              >
                <div className="rounded-2xl border border-white/15 overflow-hidden">
                  <video
                    className="w-full h-72 md:h-80 object-cover bg-[#071d49]"
                    controls
                    preload="none"
                    playsInline
                    poster="/images/Miniature Présentation Academia Hub.webp"
                  >
                    <source src="/videos/academia-hub-presentation.mp4" type="video/mp4" />
                    Votre navigateur ne supporte pas la lecture video.
                  </video>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-white">
                  <motion.div whileHover={{ scale: 1.03 }} className="rounded-xl bg-[#0b2f73]/72 border border-white/18 p-3">
                    <p className="text-xs text-blue-50">Taux de recouvrement</p>
                    <p className="text-xl font-extrabold text-white">+12%</p>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.03 }} className="rounded-xl bg-[#0b2f73]/72 border border-white/18 p-3">
                    <p className="text-xs text-blue-50">Absentéisme</p>
                    <p className="text-xl font-extrabold text-white">-8%</p>
                  </motion.div>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION — DIRECTION SCOLAIRE MODERNE, SANS COMPROMIS                   */}
      {/* ===================================================================== */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-white via-[#f8fafc] to-white overflow-hidden">
        {/* Décor subtil — gradient radial navy + points dorés */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-[radial-gradient(circle,rgba(11,47,115,0.08),transparent_70%)]" />
          <div className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.10),transparent_70%)]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* En-tête — eyebrow + titre + sous-titre */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-3xl mx-auto text-center mb-14 md:mb-20"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/8 border border-[#0b2f73]/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#0b2f73] mb-5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Pourquoi Academia Helm
            </motion.span>

            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight"
            >
              <AnimatedHeadline text="Une direction scolaire moderne, sans compromis" />
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto"
            >
              Pensée pour les écoles exigeantes : fiabilité opérationnelle, performance mesurable,
              lisibilité totale. Chaque décision s&apos;appuie sur des données fiables, chaque action
              est tracée et auditable.
            </motion.p>

            {/* Ligne décorative dorée */}
            <motion.div
              variants={fadeUp}
              className="mt-8 flex items-center justify-center gap-3"
              aria-hidden
            >
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#f5b335]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#f5b335]" />
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#f5b335]" />
            </motion.div>
          </motion.div>

          {/* Grille features 2×2 — cartes premium avec icône gradient, stat, hover lift */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6"
          >
            {features.map((item, idx) => (
              <motion.article
                key={item.title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                className="group relative rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-[0_2px_20px_-8px_rgba(11,47,115,0.10)] hover:shadow-[0_24px_60px_-20px_rgba(11,47,115,0.30)] hover:border-[#0b2f73]/30 transition-all duration-300 overflow-hidden"
              >
                {/* Halo coloré au hover */}
                <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-to-br ${item.accent} opacity-0 group-hover:opacity-[0.12] blur-3xl transition-opacity duration-500`} />

                {/* Numéro de carte (subtil) */}
                <span className="absolute top-6 right-6 text-5xl font-black text-slate-100 group-hover:text-[#0b2f73]/8 transition-colors leading-none select-none">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div className="relative flex items-start gap-5">
                  {/* Pastille icône avec gradient */}
                  <motion.div
                    whileHover={{ rotate: 6, scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                    className={`shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${item.accent} flex items-center justify-center shadow-lg`}
                  >
                    <item.icon className="w-6 h-6 md:w-7 md:h-7 text-white" strokeWidth={2.2} />
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl md:text-2xl font-bold text-[#0b2f73] group-hover:text-[#144798] transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed">
                      {item.desc}
                    </p>

                    {/* Stat badge */}
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-50 border border-slate-200 px-3 py-1.5">
                      <span className="text-sm font-extrabold text-[#0b2f73]">{item.stat}</span>
                      <span className="text-xs text-slate-500">— {item.statLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Barre dorée animée en bas */}
                <motion.span
                  className="absolute bottom-0 left-0 h-[3px] bg-gradient-to-r from-[#f5b335] via-[#ffd166] to-[#f5b335] rounded-t-full"
                  initial={{ width: 0 }}
                  whileInView={{ width: '100%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.2 + idx * 0.1, ease: 'easeOut' }}
                />
              </motion.article>
            ))}
          </motion.div>

          {/* Bandeau preuves / trust */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-14 md:mt-20 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 text-center"
          >
            {[
              { icon: Gauge,   label: 'Performance',   value: 'Optimisée' },
              { icon: Lock,    label: 'Sécurité',      value: 'Niveau entreprise' },
              { icon: Sparkles,label: 'Expérience',    value: 'Premium' },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0b2f73]/8 flex items-center justify-center">
                  <p.icon className="w-5 h-5 text-[#0b2f73]" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{p.label}</p>
                  <p className="text-sm font-bold text-[#0b2f73]">{p.value}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION — MODULES DE L'APPLICATION (BENTO GRID)                        */}
      {/* ===================================================================== */}
      <section className="relative py-20 md:py-28 bg-gradient-to-b from-[#0a1d3f] via-[#0b2f73] to-[#0a1d3f] text-white overflow-hidden">
        {/* Décor — grille de points + halos */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.06] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.18),transparent_70%)]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(29,79,165,0.35),transparent_70%)]" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* En-tête */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12 md:mb-16">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="max-w-2xl"
            >
              <motion.span
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/15 border border-[#f5b335]/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#f5b335] mb-5"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Modules de l&apos;application
              </motion.span>

              <motion.h2
                variants={fadeUp}
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-[1.15] tracking-tight"
              >
                <AnimatedHeadline text="Une suite complète pour piloter toute l'institution" delay={0.03} />
              </motion.h2>

              <motion.p
                variants={fadeUp}
                className="mt-5 text-base md:text-lg text-blue-100/80 leading-relaxed"
              >
                Treize modules métier couvrant l&apos;intégralité du cycle éducatif, financiers et opérationnel —
                du cœur scolaire aux services de vie. Chacun activable et facturable indépendamment.
              </motion.p>
            </motion.div>

            <motion.div variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/modules"
                className="inline-flex items-center gap-2 rounded-xl bg-[#f5b335] px-6 py-3 text-[#0b2f73] font-bold text-sm hover:bg-[#f7c359] transition-colors shadow-lg shadow-[#f5b335]/20"
              >
                Explorer tous les modules
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>

          {/* Bento grid — 4 colonnes sur lg, layout asymétrique */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 auto-rows-[minmax(160px,auto)]"
          >
            {modules.map((module) => {
              const tones = moduleToneClasses[module.tone];
              const colSpan =
                module.span === 'wide' ? 'col-span-2 lg:col-span-2' : 'col-span-1';
              const rowSpan =
                module.span === 'tall' ? 'row-span-2' : 'row-span-1';

              return (
                <motion.article
                  key={module.title}
                  variants={fadeUp}
                  whileHover={{ y: -6, scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 250, damping: 20 }}
                  className={`group relative ${colSpan} ${rowSpan} rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 md:p-6 hover:border-[#f5b335]/40 hover:bg-white/[0.07] transition-all duration-300 overflow-hidden flex flex-col`}
                >
                  {/* Halo doré au hover */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#f5b335] opacity-0 group-hover:opacity-[0.15] blur-3xl transition-opacity duration-500" />

                  {/* Pastille icône colorée */}
                  <div className={`relative w-12 h-12 rounded-2xl ${tones.bg} ${tones.ring} ring-1 flex items-center justify-center mb-4`}>
                    <module.icon className={`w-6 h-6 ${tones.text}`} strokeWidth={2.2} />
                  </div>

                  {/* Titre */}
                  <h3 className="relative text-base md:text-lg font-bold text-white group-hover:text-[#f5b335] transition-colors leading-tight">
                    {module.title}
                  </h3>

                  {/* Description */}
                  <p className="relative mt-2 text-sm text-blue-100/70 leading-relaxed flex-1">
                    {module.text}
                  </p>

                  {/* Lien "Explorer" qui apparaît au hover */}
                  <div className="relative mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#f5b335] opacity-0 group-hover:opacity-100 transition-opacity">
                    Explorer
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </div>

                  {/* Badge "Cœur" pour les modules featured */}
                  {module.featured && (
                    <span className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-[#f5b335]/15 border border-[#f5b335]/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#f5b335]">
                      Cœur
                    </span>
                  )}
                </motion.article>
              );
            })}
          </motion.div>

          {/* Note en bas — modules complémentaires activables */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-10 text-center text-sm text-blue-100/60"
          >
            Modules complémentaires activables selon vos besoins ·
            <span className="text-[#f5b335] font-semibold"> Tarification dynamique</span> adaptée à la taille de votre établissement
          </motion.p>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION — RESSOURCES (BLOG & EXPERTISE)                                */}
      {/* ===================================================================== */}
      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.18 }}
        variants={staggerContainer}
        className="relative bg-gradient-to-b from-white via-[#fefdf8] to-white py-20 md:py-28 overflow-hidden"
      >
        {/* Décor — halos dorés subtils */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 -right-32 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.12),transparent_70%)]" />
          <div className="absolute bottom-20 -left-32 w-[380px] h-[380px] rounded-full bg-[radial-gradient(circle,rgba(11,47,115,0.08),transparent_70%)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* En-tête — eyebrow + titre + CTA */}
          <div className="mb-12 md:mb-16 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <motion.div variants={fadeUp} className="max-w-2xl">
              <motion.span
                variants={fadeUp}
                className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/15 border border-[#f5b335]/30 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#a67410] mb-5"
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Ressources
              </motion.span>

              <motion.h2
                variants={fadeUp}
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0b2f73] leading-[1.15] tracking-tight"
              >
                Blog & expertise gestion scolaire
              </motion.h2>

              <motion.p
                variants={fadeUp}
                className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed max-w-2xl"
              >
                Guides pratiques, retours terrain et analyses stratégiques : digitalisation, finance,
                pilotage d&apos;établissement — pensés pour les écoles en Afrique.
              </motion.p>
            </motion.div>

            <motion.div variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/blog"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0b2f73] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#144798] shadow-lg shadow-[#0b2f73]/20"
              >
                Voir tous les articles
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {/* Grille 3 colonnes — cartes blog premium avec hover lift + accent doré */}
          <motion.div
            variants={staggerContainer}
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            {featuredBlogPosts.map((post, idx) => (
              <motion.div
                key={post.slug}
                variants={fadeUp}
                whileHover={{ y: -8 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                className="group"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="relative block h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_2px_20px_-8px_rgba(11,47,115,0.08)] transition-all duration-300 hover:border-[#0b2f73]/30 hover:shadow-[0_28px_60px_-20px_rgba(11,47,115,0.28)]"
                >
                  {/* Header coloré avec dégradé navy→gold */}
                  <div className="relative h-32 bg-gradient-to-br from-[#0b2f73] via-[#144798] to-[#1d4fa5] overflow-hidden">
                    {/* Motif géométrique */}
                    <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_30%,rgba(245,179,53,0.5),transparent_50%)]" />
                    <div className="absolute inset-0 opacity-15 bg-[linear-gradient(45deg,transparent_45%,rgba(255,255,255,0.5)_50%,transparent_55%)] [background-size:18px_18px]" />

                    {/* Numéro d'article */}
                    <span className="absolute top-4 left-4 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 text-white text-sm font-bold">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    {/* Icône décorative */}
                    <BookOpen className="absolute bottom-4 right-4 w-8 h-8 text-white/30 group-hover:text-[#f5b335]/70 transition-colors" />
                  </div>

                  {/* Body */}
                  <div className="p-6">
                    <h3 className="line-clamp-2 text-lg font-bold text-[#0b2f73] group-hover:text-[#144798] transition-colors leading-snug">
                      {post.title}
                    </h3>
                    <p className="mt-3 line-clamp-3 text-sm text-slate-600 leading-relaxed">
                      {post.description}
                    </p>

                    {/* Footer carte */}
                    <div className="mt-5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0b2f73] group-hover:text-[#144798]">
                        Lire l&apos;article
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Article
                      </span>
                    </div>
                  </div>

                  {/* Barre dorée animée en bas */}
                  <span className="absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full bg-gradient-to-r from-[#f5b335] to-[#ffd166] transition-all duration-500" />
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Bandeau newsletter / CTA secondaire */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-12 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 text-center"
          >
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-[#0b2f73]">+ de nouveaux articles</span> publiés chaque semaine
            </p>
            <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-300" />
            <Link
              href="/blog"
              className="text-sm font-semibold text-[#0b2f73] hover:text-[#144798] underline-offset-4 hover:underline"
            >
              Parcourir le blog complet →
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ===================================================================== */}
      {/* SECTION — ORION IA DE DIRECTION (FOND DORÉ CRÈME, TEXTES NAVY)         */}
      {/* ===================================================================== */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-[#fff7e6] via-[#fef0c7] to-[#fde68a] overflow-hidden">
        {/* Décor — halos dorés + motif points */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.40),transparent_65%)]" />
          <div className="absolute bottom-0 left-0 w-[460px] h-[460px] rounded-full bg-[radial-gradient(circle,rgba(168,116,16,0.18),transparent_65%)]" />
          <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle,rgba(11,47,115,0.6)_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Colonne gauche — pitch */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            >
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 rounded-full bg-[#0b2f73]/10 border border-[#0b2f73]/20 px-4 py-1.5 text-[#0b2f73] text-sm font-bold mb-5">
                <Brain className="w-4 h-4" />
                ORION IA de direction
              </div>

              {/* Titre */}
              <h2 className="text-3xl md:text-5xl font-extrabold leading-[1.15] tracking-tight text-[#0b2f73]">
                <AnimatedHeadline text="ORION vous aide à décider plus vite et plus juste." delay={0.04} />
              </h2>

              {/* Description */}
              <p className="mt-5 text-[#0b2f73]/80 text-base md:text-lg leading-relaxed">
                Alertes intelligentes, priorités automatiques, lecture immédiate de la santé académique et
                financière. ORION transforme vos données en actions concrètes pour la direction.
              </p>

              {/* Liste bénéfices — cartes miniatures premium */}
              <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Indicateurs', desc: 'Résumé auto des KPI critiques' },
                  { label: 'Alertes',     desc: 'Risques élèves, finances, ops' },
                  { label: 'Recommandations', desc: 'Actions concrètes pour la semaine' },
                ].map((b) => (
                  <div
                    key={b.label}
                    className="rounded-2xl bg-white/70 backdrop-blur-sm border border-[#0b2f73]/15 p-4 hover:bg-white hover:border-[#0b2f73]/30 transition-all"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-[#a67410]">{b.label}</p>
                    <p className="mt-1 text-sm text-[#0b2f73] font-medium leading-snug">{b.desc}</p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="mt-9">
                <Link
                  href="/orion"
                  className="inline-flex items-center justify-center rounded-xl bg-[#0b2f73] px-7 py-3.5 font-bold text-white hover:bg-[#144798] transition-colors min-h-[48px] shadow-lg shadow-[#0b2f73]/20"
                >
                  Découvrir ORION
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            {/* Colonne droite — carte simulation ORION premium */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              className="relative"
            >
              {/* Halo derrière la carte */}
              <div className="absolute -inset-6 bg-gradient-to-br from-[#0b2f73]/15 to-[#f5b335]/30 rounded-[2.5rem] blur-2xl" />

              <div className="relative rounded-3xl border border-[#0b2f73]/15 bg-white/80 backdrop-blur-md p-6 md:p-7 shadow-[0_30px_80px_-30px_rgba(11,47,115,0.45)]">
                {/* Header carte — logo + badge live */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <Image
                      src="/images/ORION-Academia-Hub.webp"
                      alt="ORION Academia Helm"
                      width={44}
                      height={44}
                      className="w-11 h-11 object-contain"
                      sizes="44px"
                    />
                    <div>
                      <p className="font-bold text-[#0b2f73] text-sm leading-tight">Simulation ORION</p>
                      <p className="text-xs text-slate-500">Analyse hebdomadaire</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>

                {/* KPIs miniatures */}
                <div className="grid grid-cols-3 gap-2.5 mb-5">
                  {[
                    { label: 'Recouvrement', value: '+12%', tone: 'text-emerald-600' },
                    { label: 'Absentéisme',  value: '-8%',  tone: 'text-emerald-600' },
                    { label: 'Retards',      value: '3 classes', tone: 'text-amber-600' },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl bg-[#f8fafc] border border-slate-200 p-3"
                    >
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{kpi.label}</p>
                      <p className={`text-base md:text-lg font-extrabold ${kpi.tone} mt-0.5`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>

                {/* Bulle de recommandation ORION */}
                <div className="relative rounded-2xl bg-gradient-to-br from-[#0b2f73] to-[#144798] p-5 text-white overflow-hidden">
                  <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#f5b335]/20 blur-2xl" />
                  <div className="relative flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-[#f5b335]/20 border border-[#f5b335]/40 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#f5b335]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#f5b335] mb-1.5">
                        Recommandation ORION
                      </p>
                      <p className="text-sm leading-relaxed text-blue-50">
                        &laquo;Votre taux de recouvrement progresse de 12%. Les retards sont concentrés sur
                        3 classes. Recommandation : lancer une relance ciblée avant vendredi.&raquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer carte */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-[#0b2f73]" />
                    IA GLM-5.1
                  </span>
                  <span>Mis à jour il y a 2 min</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION — TARIFICATION (FOND NAVY FONCÉ, CARTES PREMIUM)               */}
      {/* ===================================================================== */}
      <section id="tarification" className="relative py-20 md:py-28 bg-gradient-to-b from-[#0a1d3f] via-[#0b2f73] to-[#0a1d3f] text-white overflow-hidden">
        {/* Décor — halos + grille */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.18),transparent_70%)]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(29,79,165,0.35),transparent_70%)]" />
          <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* En-tête centré */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-3xl mx-auto text-center mb-14 md:mb-16"
          >
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full bg-[#f5b335]/15 border border-[#f5b335]/30 px-4 py-1.5 text-[#f5b335] font-bold text-xs uppercase tracking-wider mb-5"
            >
              <Wallet className="w-3.5 h-3.5" />
              Tarification transparente
            </motion.span>

            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-[1.15] tracking-tight"
            >
              <AnimatedHeadline text="Une offre claire, évolutive et institutionnelle" delay={0.03} />
            </motion.h2>

            <motion.p
              variants={fadeUp}
              className="mt-5 text-base md:text-lg text-blue-100/80 leading-relaxed max-w-2xl mx-auto"
            >
              Tous les modules essentiels sont inclus. Vous choisissez selon la taille de votre établissement,
              puis vous activez les options dont vous avez besoin — sans surprise, sans frais cachés.
            </motion.p>
          </motion.div>

          {/* Grille 3 plans — carte centrale mise en avant */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch"
          >
            {[
              {
                name: 'SEED',
                badge: '1 à 150 élèves',
                tagline: 'Pour démarrer',
                desc: 'Idéal pour les petites structures : tous les modules essentiels inclus, sans engagement long terme.',
                featured: false,
                features: ['Modules cœur inclus', 'Support standard', 'Offline-first', '1 établissement'],
              },
              {
                name: 'GROW',
                badge: '151 à 400 élèves',
                tagline: 'Pour croître',
                desc: 'Pour les établissements en croissance : modules avancés, ORION IA, et options de personnalisation.',
                featured: true,
                features: ['Tous modules cœur + avancés', 'ORION IA inclus', 'Support prioritaire', 'Options activables', 'Multi-niveaux'],
              },
              {
                name: 'LEAD',
                badge: '401+ élèves',
                tagline: 'Pour leader',
                desc: 'Pour les grandes institutions et groupes scolaires : tarifs dégressifs, accompagnement dédié.',
                featured: false,
                features: ['Tous modules + EduCast', 'ORION + ATLAS', 'Account manager dédié', 'Groupe scolaire', 'SLA sur-mesure'],
              },
            ].map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={{ y: -8 }}
                transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                className={`relative rounded-3xl p-6 md:p-7 flex flex-col overflow-hidden transition-all duration-300 ${
                  plan.featured
                    ? 'bg-gradient-to-br from-[#f5b335]/15 to-[#f5b335]/5 border-2 border-[#f5b335]/50 shadow-[0_30px_80px_-30px_rgba(245,179,53,0.45)] md:scale-105'
                    : 'bg-white/[0.05] border border-white/15 hover:border-[#f5b335]/30 backdrop-blur-sm'
                }`}
              >
                {/* Badge "Recommandé" pour le plan central */}
                {plan.featured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5b335] px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0b2f73] shadow-lg">
                      <Sparkles className="w-3 h-3" />
                      Recommandé
                    </span>
                  </div>
                )}

                {/* Tagline + badge taille */}
                <div className="flex items-center justify-between mb-4 mt-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    plan.featured
                      ? 'bg-[#0b2f73] text-[#f5b335]'
                      : 'bg-white/10 text-blue-100 border border-white/20'
                  }`}>
                    {plan.badge}
                  </span>
                  <span className={`text-xs font-semibold ${plan.featured ? 'text-[#f5b335]' : 'text-blue-200/60'}`}>
                    {plan.tagline}
                  </span>
                </div>

                {/* Nom du plan */}
                <h3 className={`text-3xl font-extrabold tracking-tight ${plan.featured ? 'text-[#f5b335]' : 'text-white'}`}>
                  {plan.name}
                </h3>

                {/* Description */}
                <p className="mt-3 text-sm text-blue-100/75 leading-relaxed min-h-[60px]">
                  {plan.desc}
                </p>

                {/* Liste features */}
                <ul className="mt-5 space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-blue-50/90">
                      <span className={`mt-0.5 inline-flex shrink-0 w-4 h-4 items-center justify-center rounded-full ${
                        plan.featured ? 'bg-[#f5b335]/20 text-[#f5b335]' : 'bg-white/10 text-blue-200'
                      }`}>
                        <svg viewBox="0 0 16 16" className="w-2.5 h-2.5" fill="currentColor" aria-hidden>
                          <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.97 2.97 6.97-6.97a.75.75 0 0 1 1.06 0Z"/>
                        </svg>
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <motion.div
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="mt-6"
                >
                  <Link
                    href="/pricing"
                    className={`w-full inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold text-sm transition-colors min-h-[44px] ${
                      plan.featured
                        ? 'bg-[#f5b335] text-[#0b2f73] hover:bg-[#f7c359]'
                        : 'bg-white/10 border border-white/30 text-white hover:bg-white/20'
                    }`}
                  >
                    Choisir {plan.name}
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>

          {/* CTA secondaire + rassurance */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="mt-12 md:mt-14 flex flex-col items-center gap-5 text-center"
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-8 py-3.5 font-bold text-[#0b2f73] hover:bg-[#f7c359] transition-colors min-h-[48px] shadow-lg shadow-[#f5b335]/20"
              >
                Voir la grille complète
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-blue-100/60">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#f5b335]" />
                Sans engagement caché
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#f5b335]" />
                Paiement Mobile Money & carte
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#f5b335]" />
                Souscription initiale + abonnement évolutif
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <ReviewsSection />

      <section className="py-16 md:py-20 bg-gradient-to-r from-[#0b2f73] to-[#144798] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            animate={{ y: [0, -5, 0], rotate: [0, -6, 0, 6, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-300/40 mb-5"
          >
            <GraduationCap className="w-8 h-8 text-amber-300" />
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-extrabold">
            <AnimatedHeadline text="Passez au pilotage scolaire nouvelle génération" delay={0.03} />
          </h2>
          <p className="mt-4 text-blue-100 text-lg">
            Équipez votre établissement d&apos;un système fiable, élégant et prêt pour la croissance.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-8 py-3.5 font-bold text-[#0b2f73] hover:bg-[#f7c359] transition-colors min-h-[48px]"
              >
                Créer mon établissement
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/portal"
                className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-white/10 px-8 py-3.5 font-semibold hover:bg-white/20 transition-colors min-h-[48px]"
              >
                Accéder à un portail
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      <div
        id="hero-cta-sticky"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden w-[calc(100%-2rem)] max-w-md"
      >
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="backdrop-blur-md bg-[#0b2f73]/90 border border-amber-300/30 rounded-2xl p-2 shadow-2xl"
        >
          <Link
            href="/signup"
            className="w-full inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-5 py-3 font-bold text-[#0b2f73] min-h-[48px]"
          >
            Démarrer Academia Helm
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </motion.div>
      </div>

      <Footer2 />

      <SaraWidget />
    </div>
  );
}

