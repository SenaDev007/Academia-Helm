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

const featureCardMotion = {
  whileHover: {
    y: -8,
    rotateX: 5,
    rotateY: -3,
    boxShadow: '0 18px 42px rgba(11,47,115,0.16)',
  },
  transition: { type: 'spring', stiffness: 240, damping: 18 } as const,
};

const moduleCardMotion = {
  whileHover: {
    y: -6,
    scale: 1.018,
    boxShadow: '0 20px 44px rgba(11,47,115,0.14)',
  },
  transition: { type: 'spring', stiffness: 230, damping: 20 } as const,
};

const pricingCardMotion = {
  whileHover: {
    y: -5,
    scale: 1.012,
    boxShadow: '0 16px 34px rgba(0,0,0,0.22)',
  },
  transition: { type: 'spring', stiffness: 220, damping: 18 } as const,
};

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
    desc: 'Décisions basées sur des indicateurs fiables : élèves, finances, examens, RH.',
    icon: Users,
  },
  {
    title: 'ORION intégré',
    desc: "L'IA de direction qui transforme les données en alertes et priorités concrètes.",
    icon: Brain,
  },
  {
    title: 'Offline-first',
    desc: 'Continuité des opérations même sans internet, puis synchronisation sécurisée.',
    icon: WifiOff,
  },
  {
    title: 'Conformité & sécurité',
    desc: 'Architecture multi-tenant, accès contrôlé, traçabilité et protection continue.',
    icon: ShieldCheck,
  },
];

const modules = [
  { title: 'Élèves & Scolarité', text: 'Admissions, dossiers, absences, documents, suivi du cycle.' },
  { title: 'Finances & Économat', text: 'Paiements, recouvrement, dépenses, trésorerie et clôtures.' },
  { title: 'Examens & Bulletins', text: 'Saisie des notes, calculs, bulletins et statistiques scolaires.' },
  { title: 'Organisation pédagogique', text: 'Classes, matières, emploi du temps, planification et suivi.' },
  { title: 'RH & Personnel', text: 'Contrats, présence, rôles, habilitations et administration RH.' },
  { title: 'Communication', text: 'Canaux, messages, automatisations et communication institutionnelle.' },
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

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0b2f73]">
              <AnimatedHeadline text="Une direction scolaire moderne, sans compromis" />
            </h2>
            <p className="mt-4 text-slate-600 text-lg">
              Pensée pour les écoles exigeantes : fiabilité, performance, lisibilité.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {features.map((item) => (
              <motion.div
                key={item.title}
                variants={fadeUp}
                whileHover={featureCardMotion.whileHover}
                transition={featureCardMotion.transition}
                className="rounded-2xl border border-blue-100 bg-gradient-to-b from-white to-blue-50 p-6 shadow-sm hover:shadow-lg transition-shadow"
              >
                <motion.div
                  whileHover={{ rotate: 8 }}
                  className="w-11 h-11 rounded-xl bg-[#0b2f73] text-white flex items-center justify-center"
                >
                  <item.icon className="w-5 h-5" />
                </motion.div>
                <h3 className="mt-4 text-xl font-bold text-[#0b2f73]">{item.title}</h3>
                <p className="mt-2 text-slate-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0b2f73]">
              <AnimatedHeadline text="Modules & cartes métier" delay={0.05} />
            </h2>
            <Link
              href="/modules"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0b2f73] px-5 py-2.5 text-white font-semibold hover:bg-[#144798] transition-colors"
            >
              Tout voir
            </Link>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.22 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {modules.map((module) => (
              <motion.article
                key={module.title}
                variants={fadeUp}
                whileHover={moduleCardMotion.whileHover}
                transition={moduleCardMotion.transition}
                className="group rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-xl transition-all"
              >
                <motion.div
                  whileHover={{ width: 56 }}
                  className="w-10 h-1 rounded-full bg-[#f5b335] mb-4 transition-all"
                />
                <h3 className="text-lg font-bold text-[#0b2f73] group-hover:text-[#144798]">
                  {module.title}
                </h3>
                <p className="mt-2 text-slate-600">{module.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      <motion.section
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.18 }}
        variants={staggerContainer}
        className="border-t border-slate-100 bg-white py-16 md:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <motion.div variants={fadeUp}>
              <motion.p
                variants={fadeUp}
                className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-sm font-semibold text-[#0b2f73]"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Ressources
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl font-extrabold text-[#0b2f73] md:text-4xl">
                Blog & expertise gestion scolaire
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-3 max-w-2xl text-lg text-slate-600">
                Guides pratiques : digitalisation, finance, pilotage d&apos;établissement — pensés pour les écoles en
                Afrique.
              </motion.p>
            </motion.div>
            <motion.div variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/blog"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0b2f73] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#144798]"
              >
                Voir tous les articles
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
          <motion.div variants={fadeUp} className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featuredBlogPosts.map((post) => (
              <motion.div
                key={post.slug}
                variants={fadeUp}
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 } as const}
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-slate-200 bg-slate-50/90 p-6 transition-all hover:border-[#0b2f73]/25 hover:shadow-lg"
                >
                  <h3 className="line-clamp-2 text-lg font-bold text-[#0b2f73] group-hover:text-[#144798]">
                    {post.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600">{post.description}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#0b2f73]">
                    Lire l&apos;article
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      <section className="py-16 md:py-24 bg-[#0b2f73] text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_30%,#f5b335_0%,transparent_45%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-amber-200 text-sm font-semibold mb-5">
                <Brain className="w-4 h-4" />
                ORION IA de direction
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                <AnimatedHeadline text="ORION vous aide à décider plus vite et plus juste." delay={0.04} />
              </h2>
              <p className="mt-4 text-blue-100 text-lg leading-relaxed">
                Alertes intelligentes, priorités automatiques, lecture immédiate de la santé académique et
                financière. ORION transforme vos données en actions concrètes pour la direction.
              </p>
              <ul className="mt-6 space-y-3 text-blue-50">
                {[
                  'Résumé automatique des indicateurs critiques',
                  'Alertes précoces sur risques élèves, finances et opérations',
                  'Recommandations concrètes pour la semaine',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-300/20 text-amber-300 text-xs">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} className="mt-8">
                <Link
                  href="/orion"
                  className="inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-7 py-3.5 font-bold text-[#0b2f73] hover:bg-[#f7c359] transition-colors min-h-[48px]"
                >
                  Découvrir ORION
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.1 }}
              className="rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-4">
                <Image
                  src="/images/ORION-Academia-Hub.webp"
                  alt="ORION Academia Helm"
                  width={52}
                  height={52}
                  className="w-12 h-12 object-contain"
                  sizes="48px"
                />
                <p className="font-semibold text-amber-200">Simulation ORION</p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-[#0b2f73]/55 p-5 text-blue-50 leading-relaxed">
                "Votre taux de recouvrement progresse de 12%. Les retards sont concentrés sur 3 classes.
                Recommandation : lancer une relance ciblée avant vendredi."
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="tarification" className="py-16 md:py-24 bg-[#0b2f73] text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-400/10 px-4 py-1.5 text-amber-300 font-semibold text-sm mb-6">
            <Wallet className="w-4 h-4" />
            Tarification transparente
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
            <AnimatedHeadline text="Une offre claire, évolutive et institutionnelle" delay={0.03} />
          </h2>
          <p className="mt-4 text-blue-100 text-lg">
            Tous les modules essentiels sont inclus. Vous choisissez selon la taille de votre établissement.
          </p>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.22 }}
            className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 text-left"
          >
            {[
              { name: 'SEED', badge: '1 à 150 élèves' },
              { name: 'GROW', badge: '151 à 400 élèves' },
              { name: 'LEAD', badge: '401+ élèves' },
            ].map((plan) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                whileHover={pricingCardMotion.whileHover}
                transition={pricingCardMotion.transition}
                className="rounded-2xl border border-white/20 bg-white/10 p-5"
              >
                <span className="inline-flex rounded-full bg-amber-400/20 border border-amber-300/40 px-3 py-1 text-xs text-amber-200 font-semibold">
                  {plan.badge}
                </span>
                <h3 className="mt-3 text-xl font-bold">{plan.name}</h3>
                <p className="mt-2 text-blue-100 text-sm">
                  Souscription initiale + abonnement adapté à la croissance de votre structure.
                </p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/pricing"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#f5b335] px-8 py-3.5 font-bold text-[#0b2f73] hover:bg-[#f7c359] transition-colors min-h-[48px]"
            >
              Voir la grille complète
            </Link>
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

