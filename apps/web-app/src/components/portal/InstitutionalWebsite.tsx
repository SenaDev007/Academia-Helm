'use client';

/**
 * ============================================================================
 * INSTITUTIONAL WEBSITE — Site institutionnel multi-tenant conforme CDC
 * ============================================================================
 *
 * Refonte complète selon le Cahier des Charges « Site institutionnel
 * multi-tenant des établissements » (Academia Helm — YEHI OR Tech, v1.0).
 *
 * 10 sections (de la Navbar au Footer) :
 *   3.1  Navbar (fixe, sticky, transparente → opaque navy après 80px)
 *   3.2  Hero (gradient navy → bleu, overlay 40%, H1, CTA or + contour blanc,
 *        bandeau 3-4 chiffres clés)
 *   3.3  À propos / Présentation (H2 liseré or, mission/vision, mot du directeur
 *        avec bordure gauche or, zig-zag texte/image)
 *   3.4  Excellence académique / Programmes (H2, grille cartes Maternelle/Primaire/
 *        Secondaire, points de différenciation à icônes)
 *   3.5  Corps enseignant (H2, grille 3-8 profils, ratio encadrant/élève badge or)
 *   3.6  Vie scolaire / Actualités (H2, 3-6 cartes actualités + galerie photo)
 *   3.7  Admissions (H2 sur fond navy texte blanc, timeline 4 étapes, documents,
 *        CTA or "Commencer ma candidature")
 *   3.8  Témoignages (H2, carrousel témoignages, logos partenaires niveaux de gris)
 *   3.9  Contact (H2, coordonnées, iframe OpenStreetMap, formulaire)
 *   3.10 Footer multi-colonnes (logo, navigation, portails, légal + ligne de bas)
 *
 * Palette CDC :
 *   - Bleu Marine Institutionnel : #0B1E4D
 *   - Bleu Académique             : #1E4FA3
 *   - Or Prestige                 : #F5B700
 *   - Gris Ardoise                : #2E3440
 *   - Gris Perle                  : #F4F6FA
 *   - Blanc                       : #FFFFFF
 *
 * Signature préservée :
 *   export default function InstitutionalWebsite({ schoolInfo, subdomain }: Props)
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import {
  Loader2, MapPin, Phone, Mail, ChevronRight, ChevronLeft, Calendar,
  Quote, FileText, Sparkles,
  Building2, GraduationCap, Users, Globe, ArrowRight, Star, Images,
  CheckCircle2, Award, BookOpen, Microscope, Palette, Trophy, Languages,
  Baby, School, Library, Clock, Send, Image as ImageIcon, MessageCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import LogoCircle from '@/components/ui/LogoCircle';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { type PortalType } from '@/lib/auth/role-portal-map';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import TenantAiChatbot from '@/components/portal/TenantAiChatbot';
import TenantStructuredData from '@/components/portal/TenantStructuredData';
import TenantRecruitmentBanner from '@/components/portal/TenantRecruitmentBanner';
import { ContactForm } from '@/components/portal/ContactForm';
import TenantFooter from '@/components/ui/footer-column';
import TenantHeader from '@/components/portal/TenantHeader';
import { resolveTenantColors, themeToColors, type TenantColors } from '@/lib/tenant/use-tenant-colors';
import { getThemeById, type Theme, type ThemeMode } from '@/lib/themes/themes.config';
import { tenantThemeService } from '@/services/tenant-theme.service';
import { ThemeApplier } from '@/lib/themes/theme-applier';
import {
  DEFAULT_WEBSITE_CONFIG,
  DEFAULT_NEWS_ARTICLES,
  DEFAULT_EVENTS,
  DEFAULT_GALLERY_ITEMS,
  DEFAULT_TESTIMONIALS,
  DEFAULT_FAQ_ITEMS,
  DEFAULT_PORTAL_IMAGES,
  withDefault,
  shouldShowSection,
} from '@/lib/tenant/default-cms-content';
import SchoolLocationMap from '@/components/portal/SchoolLocationMap';

interface SchoolPortalInfo {
  tenantId?: string | null;
  name: string; slug: string; logoUrl: string | null; city: string | null;
  phone: string | null; address: string | null; primaryColor: string | null;
  secondaryColor: string | null; slogan: string | null; motto: string | null;
  schoolAcronym?: string | null;
}

interface WebsiteData {
  website: any; newsArticles: any[]; events: any[]; galleryItems: any[];
  testimonials: any[]; faqItems: any[];
}

/**
 * Coordonnées publiques de l'établissement — source : module Paramètres →
 * Identité (API publique /tenant-website/public/:slug/identity-info).
 * Contacts + adresse + GPS exact (configuré via Paramètres → Géolocalisation).
 */
interface IdentityInfo {
  configured?: boolean;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  schoolInfo?: SchoolPortalInfo | null;
  subdomain?: string | null;
}

// ─── Programmes par défaut (3 cycles — Maternelle, Primaire, Secondaire) ──
const DEFAULT_PROGRAMS = [
  {
    id: 'maternelle',
    title: 'Maternelle',
    description: "Éveil, épanouissement et premiers apprentissages dans un cadre bienveillant et stimulant.",
    Icon: Baby,
    levels: 'Petite, Moyenne & Grande section',
  },
  {
    id: 'primaire',
    title: 'Primaire',
    description: "Acquisition des fondamentaux : lecture, écriture, calcul et développement de la curiosité.",
    Icon: School,
    levels: 'CP au CM2',
  },
  {
    id: 'secondaire',
    title: 'Secondaire',
    description: "Approfondissement des savoirs, orientation et préparation aux examens nationaux.",
    Icon: Library,
    levels: '6e à Terminale',
  },
];

// ─── Points de différenciation (CDC 3.4) ──
const DEFAULT_DIFFERENTIATORS = [
  { title: 'Bilinguisme', description: "Enseignement français-anglais dès le primaire", Icon: Languages },
  { title: 'STEM', description: "Sciences, technologie, ingénierie & mathématiques", Icon: Microscope },
  { title: 'Arts', description: "Théâtre, musique, arts plastiques", Icon: Palette },
  { title: 'Sport', description: "Éducation physique & compétitions scolaires", Icon: Trophy },
];

// ─── Corps enseignant par défaut (CDC 3.5) ──
const DEFAULT_FACULTY = [
  { name: 'M. Koffi Adjovi', role: 'Directeur pédagogique', subject: 'Mathématiques' },
  { name: 'Mme Aïcha Bello', role: 'Directrice Maternelle', subject: 'Petite section' },
  { name: 'M. Jean Houngbo', role: 'Responsable Primaire', subject: 'Français' },
  { name: 'Mme Fatou Diallo', role: 'Responsable Secondaire', subject: 'Sciences physiques' },
];

// ─── Étapes d'admission (CDC 3.7) ──
const ADMISSION_STEPS = [
  { num: 1, title: 'Candidature', description: "Remplissez le formulaire de pré-inscription en ligne.", Icon: FileText },
  { num: 2, title: 'Évaluation', description: "Test d'admission et étude du dossier scolaire.", Icon: BookOpen },
  { num: 3, title: 'Entretien', description: "Rencontre avec la direction et l'équipe pédagogique.", Icon: Users },
  { num: 4, title: 'Confirmation', description: "Inscription définitive et remise des accès portails.", Icon: CheckCircle2 },
];

// ─── Documents requis (CDC 3.7) ──
const REQUIRED_DOCUMENTS = [
  'Acte de naissance (original + copie)',
  'Bulletins de notes des 2 dernières années',
  'Certificat de transfert (en cas de changement d\'établissement)',
  '2 photos d\'identité récentes',
  'Carnet de vaccination à jour',
  'Copie de la pièce d\'identité du parent/tuteur',
];

// ─── Témoignages carrousel (CDC 3.8) ──
// Utilise DEFAULT_TESTIMONIALS mais peut être surchargé par les données du tenant.

// ─── Logos partenaires (placeholder — gris par défaut, couleur au survol) ──
const PARTNER_LOGOS = [
  { name: 'Ministère de l\'Éducation', abbr: 'MEN' },
  { name: 'UNESCO', abbr: 'UNESCO' },
  { name: 'Confemen', abbr: 'CONFEMEN' },
  { name: 'Agence Universitaire Francophone', abbr: 'AUF' },
];

// ─── SectionHeader : H2 avec liseré or (CDC 3.3+) ──────────────────────────
function SectionHeader({
  eyebrow,
  title,
  subtitle,
  navy,
  gold,
  inverted = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  navy: string;
  gold: string;
  inverted?: boolean;
}) {
  const textColor = inverted ? '#FFFFFF' : '#0f172a';
  const subColor = inverted ? 'rgba(255,255,255,0.7)' : '#64748b';
  return (
    <div className="text-center mb-10 md:mb-14">
      {eyebrow && (
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider mb-4"
          style={{
            background: inverted ? `${gold}22` : `${navy}14`,
            border: `1px solid ${inverted ? `${gold}55` : `${navy}26`}`,
            color: inverted ? gold : navy,
          }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: gold }} />
          {eyebrow}
        </motion.span>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-3xl md:text-4xl font-extrabold tracking-tight mb-3"
        style={{ color: textColor }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
          className="text-sm md:text-base max-w-2xl mx-auto leading-relaxed"
          style={{ color: subColor }}
        >
          {subtitle}
        </motion.p>
      )}
      {/* Liseré or signature */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="mt-5 flex items-center justify-center gap-3"
        aria-hidden
      >
        <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber-400" />
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400" />
      </motion.div>
    </div>
  );
}

// ─── Hook : compteur animé au scroll (CDC 8 — Stats/Counter) ──
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const animate = (now: number) => {
              const progress = Math.min((now - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              setValue(Math.round(target * eased));
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

export default function InstitutionalWebsite({ schoolInfo, subdomain }: Props) {
  const [schoolData, setSchoolData] = useState<SchoolPortalInfo | null>(schoolInfo || null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  // ⭐ Coordonnées du module Paramètres (Identité établissement) — alimentent
  // la section Contact + la carte de localisation (GPS exact si configuré).
  const [identityInfo, setIdentityInfo] = useState<IdentityInfo | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(
    (schoolInfo as any)?.tenantId || (schoolInfo as any)?.id || null,
  );
  const [isLoading, setIsLoading] = useState(!schoolInfo);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  // ─── Thème officiel du tenant (40+ thèmes shadcn/ui) ──────────────────
  // Résolu depuis tenantThemeService.getPublicSettings(slug) → { themeId, mode }.
  // Quand un thème est actif, il PRIME sur customColors (CMS) et sur la palette
  // Helm par défaut. Sinon, fallback sur resolveTenantColors(customColors).
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');

  // ⭐ slug résolu côté client aussi (le SSR peut passer subdomain=null si l'API
  // timeout — le composant client doit pouvoir récupérer le slug depuis window.location).
  const [clientSlug, setClientSlug] = useState(subdomain || '');
  const slug = clientSlug || schoolInfo?.slug || '';

  useEffect(() => {
    // Si le slug n'est pas encore résolu, essayer de le récupérer depuis le hostname
    if (!clientSlug && typeof window !== 'undefined') {
      const detected = extractTenantSlug(window.location.hostname);
      if (detected) setClientSlug(detected);
    }
  }, [clientSlug]);

  useEffect(() => {
    if (!slug) {
      // Pas de slug → pas de données à charger → arrêter le loader
      if (isLoading) setIsLoading(false);
      return;
    }

    // ⚠️ PERFORMANCE : Si schoolInfo est déjà fourni par le Server Component,
    // SKIP loadSchoolData — il avait déjà été fait côté serveur via /tenants/by-subdomain.
    // On lance en parallèle (Promise.all) loadWebsiteData + loadThemeSettings
    // qui ne sont PAS déjà résolus côté serveur.
    if (schoolInfo) {
      // schoolInfo déjà présent → initialiser schoolData + tenantId
      setSchoolData(schoolInfo as any);
      if ((schoolInfo as any)?.tenantId) setTenantId((schoolInfo as any).tenantId);
      else if ((schoolInfo as any)?.id) setTenantId((schoolInfo as any).id);
      setIsLoading(false);
      // Charger en parallèle les données complémentaires
      Promise.all([loadWebsiteData(), loadThemeSettings(), loadIdentityInfo()]);
    } else {
      // Pas de schoolInfo → tout charger en parallèle (4 fetchs)
      Promise.all([
        loadSchoolData(),
        loadWebsiteData(),
        loadThemeSettings(),
        loadIdentityInfo(),
      ]).finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ⭐ Timeout de sécurité réduit de 10s à 5s — les 3 fetchs ont chacun un
  // timeout de 6s max, donc 6s devrait suffire. Si on est encore en loading
  // après 5s, on affiche le contenu par défaut (les données partielles
  // s'afficheront au fur et à mesure de leur arrivée).
  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const loadSchoolData = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`/api/public/schools/by-subdomain/${slug}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setSchoolData(data);
        if (data?.tenantId) setTenantId(data.tenantId);
        else if (data?.id) setTenantId(data.id);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      console.error(e);
    }
  };

  const loadWebsiteData = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`/api/tenant-website/public/${slug}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) setWebsiteData(await res.json());
    } catch (e) {
      clearTimeout(timeoutId);
      console.error(e);
    }
  };

  // ─── Coordonnées du module Paramètres → Identité (public) ────────────
  // GET /api/tenant-website/public/:slug/identity-info → contacts, adresse
  // et GPS exact de l'établissement. La section Contact utilise ces valeurs
  // quand le CMS n'a pas été configuré — la carte place le pin sur la VRAIE
  // position de l'école (ex: Parakou) au lieu d'un marker générique.
  const loadIdentityInfo = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`/api/tenant-website/public/${slug}/identity-info`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.configured) setIdentityInfo(data);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // Silencieux — fallback sur les valeurs CMS / schoolData / defaults
      console.debug('[identity-info] unavailable for', slug, e);
    }
  };

  // ─── Chargement du thème officiel du tenant (themeId + mode) ──
  // On récupère les settings publics via /api/tenant-theme/public/<slug>.
  // Si un themeId est retourné et qu'il correspond à un thème connu de
  // themes.config (40+ thèmes), on l'active — sinon on reste sur le fallback
  // customColors / Helm default.
  // ⚠️ Ajout d'un timeout de 6s — avant ce fetch n'en avait aucun et pouvait
  // bloquer indéfiniment le rendu.
  const loadThemeSettings = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const settings = await tenantThemeService.getPublicSettings(slug, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (settings?.themeId) {
        const theme = getThemeById(settings.themeId);
        if (theme) {
          setActiveTheme(theme);
          setThemeMode(settings.mode || 'light');
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // Silencieux : le tenant n'a peut-être pas configuré de thème officiel.
      // On conserve le fallback customColors / Helm default.
      console.debug('[theme] No official theme for tenant', slug, e);
    }
  };

  const handlePortalClick = (type: PortalType) => {
    if (type === 'PUBLIC') {
      window.location.href = `/public/pre-enrollment?school=${slug}`;
    } else {
      const params = new URLSearchParams({
        portal: type.toLowerCase(),
        tenant: slug,
        school_name: schoolData?.name || '',
      });
      window.location.href = `/login?${params.toString()}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0B1E4D' }} />
      </div>
    );
  }

  // ─── Merge des données réelles + valeurs par défaut ──
  const rawWebsite = websiteData?.website;
  const website = rawWebsite || DEFAULT_WEBSITE_CONFIG;
  const schoolName = schoolData?.name || 'Établissement Scolaire';
  const schoolAcronym = schoolData?.schoolAcronym || null;
  const schoolLogo = schoolData?.logoUrl;
  const schoolSlogan = schoolData?.slogan || withDefault(rawWebsite?.heroSubtitle, DEFAULT_WEBSITE_CONFIG.heroSubtitle);

  // ─── Palette de couleurs (CDC 2 — par défaut #0B1E4D / #1E4FA3 / #F5B700) ──
  // Stratégie de résolution (par priorité) :
  //   1. activeTheme (themeId officiel configuré via tenantThemeService) → themeToColors
  //   2. customColors (CMS — 2 à 4 couleurs personnalisées) → resolveTenantColors
  //   3. Palette Helm par défaut (fallback NAVY/BLUE/GOLD)
  const colors: TenantColors = activeTheme
    ? themeToColors(activeTheme, themeMode)
    : resolveTenantColors(rawWebsite?.customColors);
  const NAVY = colors.primary;
  const BLUE = colors.secondary;
  const GOLD = colors.accent;
  const DARK = colors.dark;
  const SLATE = '#2E3440';
  const PEARL = '#F4F6FA';

  // ─── Hero avec defaults ──
  const heroTitle = withDefault(rawWebsite?.heroTitle, DEFAULT_WEBSITE_CONFIG.heroTitle);
  const heroSubtitle = withDefault(rawWebsite?.heroSubtitle, DEFAULT_WEBSITE_CONFIG.heroSubtitle);
  const heroImage = rawWebsite?.heroImageUrl || null;
  const heroCtaText = withDefault(rawWebsite?.heroCtaText, 'Demander une admission');

  // ─── Chiffres clés (CDC 3.2 — bandeau 3-4 indicateurs) ──
  // ⭐ 2026-09-25 — Fix crash "Cannot read properties of undefined (reading 'slice')":
  //   Le contributeur 2026-09-22 a retiré keyFigures de DEFAULT_WEBSITE_CONFIG
  //   (état vide honnête). Si rawWebsite?.keyFigures est undefined ET
  //   DEFAULT_WEBSITE_CONFIG.keyFigures est aussi undefined, withDefault
  //   retournait undefined → .slice() crashait. On définit maintenant un
  //   fallback [] explicite + Array.isArray défensif.
  const rawKeyFigures = withDefault(rawWebsite?.keyFigures, (DEFAULT_WEBSITE_CONFIG as any).keyFigures);
  const safeKeyFigures: any[] = Array.isArray(rawKeyFigures) ? rawKeyFigures : [];
  const keyFigures = safeKeyFigures.slice(0, 4);

  // ─── Collections avec defaults ──
  const newsArticles = (websiteData?.newsArticles && websiteData.newsArticles.length > 0)
    ? websiteData.newsArticles
    : DEFAULT_NEWS_ARTICLES;
  const galleryItems = (websiteData?.galleryItems && websiteData.galleryItems.length > 0)
    ? websiteData.galleryItems
    : DEFAULT_GALLERY_ITEMS;
  const testimonials = (websiteData?.testimonials && websiteData.testimonials.length > 0)
    ? websiteData.testimonials
    : DEFAULT_TESTIMONIALS;
  const faqItems = (websiteData?.faqItems && websiteData.faqItems.length > 0)
    ? websiteData.faqItems
    : DEFAULT_FAQ_ITEMS;

  // ─── Sections CMS-connectées (avec fallback sur les defaults) ──────────
  // Programs, differentiators, faculty, admissionSteps, admissionDocuments
  // sont lus depuis rawWebsite (CMS) si présents et non vides, sinon fallback
  // sur les constantes par défaut. Permet à l'admin de surcharger ces sections
  // via le back-office CMS quand les champs seront exposés dans l'éditeur.
  //
  // Note : les objets DEFAULT_* contiennent une propriété `Icon` (composant
  // Lucide). Si le CMS retourne des données avec `iconName` (string) au lieu
  // de `Icon` (component), un résolveur d'icônes devra être ajouté.
  const programs = (rawWebsite?.programs && Array.isArray(rawWebsite.programs) && rawWebsite.programs.length > 0)
    ? rawWebsite.programs
    : DEFAULT_PROGRAMS;
  const differentiators = (rawWebsite?.differentiators && Array.isArray(rawWebsite.differentiators) && rawWebsite.differentiators.length > 0)
    ? rawWebsite.differentiators
    : DEFAULT_DIFFERENTIATORS;
  const faculty = (rawWebsite?.faculty && Array.isArray(rawWebsite.faculty) && rawWebsite.faculty.length > 0)
    ? rawWebsite.faculty
    : DEFAULT_FACULTY;
  const admissionSteps = (rawWebsite?.admissionSteps && Array.isArray(rawWebsite.admissionSteps) && rawWebsite.admissionSteps.length > 0)
    ? rawWebsite.admissionSteps
    : ADMISSION_STEPS;
  const admissionDocuments = (rawWebsite?.admissionDocuments && Array.isArray(rawWebsite.admissionDocuments) && rawWebsite.admissionDocuments.length > 0)
    ? rawWebsite.admissionDocuments
    : REQUIRED_DOCUMENTS;

  // ─── Titres & sous-titres de sections (CMS-connectés) ─────────────────
  // Chaque titre/sous-titre de section est lu depuis le CMS avec fallback sur
  // la valeur actuelle (préserve l'UI si le CMS n'est pas configuré).
  const presentationSubtitle = withDefault(
    rawWebsite?.presentationSubtitle,
    'Mission, vision et ancrage local au service de la réussite de chaque élève.',
  );
  const programsTitle = withDefault(rawWebsite?.programsTitle, 'Nos programmes');
  const programsSubtitle = withDefault(
    rawWebsite?.programsSubtitle,
    'De la maternelle au secondaire, un parcours pédagogique structuré et exigeant.',
  );
  const facultyTitle = withDefault(rawWebsite?.facultyTitle, 'Corps enseignant');
  const facultySubtitle = withDefault(
    rawWebsite?.facultySubtitle,
    'Une équipe pédagogique engagée et qualifiée au service de la réussite de chaque élève.',
  );
  const admissionTitle = withDefault(rawWebsite?.admissionTitle, 'Admissions');
  const admissionSubtitle = withDefault(
    rawWebsite?.admissionSubtitle,
    "Un parcours d'admission clair en 4 étapes pour rejoindre notre communauté éducative.",
  );
  const testimonialsTitle = withDefault(rawWebsite?.testimonialsTitle, 'Témoignages');
  const testimonialsSubtitle = withDefault(
    rawWebsite?.testimonialsSubtitle,
    'Ce que les parents, élèves et anciens élèves disent de notre établissement.',
  );
  const contactTitle = withDefault(rawWebsite?.contactTitle, 'Contact');
  const contactSubtitle = withDefault(
    rawWebsite?.contactSubtitle,
    "Une question sur l'inscription, les programmes ou la vie scolaire ? Écrivez-nous.",
  );
  const newsTitle = withDefault(rawWebsite?.newsTitle, "Actualités de l'établissement");
  const newsSubtitle = withDefault(
    rawWebsite?.newsSubtitle,
    'Suivez la vie de notre établissement : événements, résultats et moments forts.',
  );

  // ─── Coordonnées contact — dynamiques depuis le module Paramètres ────
  // Priorité : CMS (site web) > Paramètres → Identité > tenants table > défaut.
  // ⚠️ Fix : l'ancien code faisait tomber contactEmail sur schoolData.phone
  // (un numéro de téléphone dans le champ email) — corrigé.
  const contactEmail =
    withDefault(rawWebsite?.contactEmail, '') ||
    identityInfo?.email ||
    '';
  const contactPhone =
    withDefault(rawWebsite?.contactPhone, '') ||
    identityInfo?.phonePrimary ||
    identityInfo?.phoneSecondary ||
    schoolData?.phone ||
    '';
  const contactWhatsapp = identityInfo?.whatsapp || null;
  const contactAddress =
    withDefault(rawWebsite?.contactAddress, '') ||
    identityInfo?.address ||
    schoolData?.address ||
    '';
  const contactCity =
    identityInfo?.city ||
    schoolData?.city ||
    '';
  // GPS exact (module Paramètres → Identité → Géolocalisation) — utilisé par
  // SchoolLocationMap pour placer le pin sur la vraie position de l'école.
  const contactLatitude = identityInfo?.latitude ?? null;
  const contactLongitude = identityInfo?.longitude ?? null;

  // ─── Navigation CDC ──
  const navLinks = [
    { label: 'Accueil', href: '/#hero' },
    { label: 'À propos', href: '/#a-propos' },
    { label: 'Programmes', href: '/#programmes' },
    { label: 'Admissions', href: '/#admissions' },
    { label: 'Vie scolaire', href: '/#vie-scolaire' },
    { label: 'Actualités', href: '/#actualites' },
    { label: 'Contact', href: '/#contact' },
  ];

  // ─── Iframe OpenStreetMap (CDC 3.9) ──
  // ⚠️ Remplacée par <SchoolLocationMap /> : l'ancienne iframe était codée
  // en dur (marker à Porto-Novo + bbox Cotonou/Porto-Novo pour TOUTES les
  // écoles, y compris Parakou/Natitingou/Djougou...).

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Applique les variables CSS shadcn/ui du thème officiel sur <html> ───
          Permet aux composants shadcn/ui (boutons, cards, etc.) utilisés dans
          le site institutionnel de recevoir les couleurs du thème configuré
          par l'admin (ex: ocean-breeze, sunset-glow, etc.).
          Inactif si aucun thème officiel n'est configuré (fallback Helm). */}
      {activeTheme && (
        <ThemeApplier themeId={activeTheme.id} mode={themeMode} />
      )}

      <TenantStructuredData
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAddress={contactAddress || undefined}
        schoolPhone={contactPhone || undefined}
        schoolEmail={contactEmail || undefined}
        schoolWebsite={typeof window !== 'undefined' ? window.location.origin : ''}
        schoolSlogan={schoolSlogan || undefined}
        schoolCity={contactCity || undefined}
        socialLinks={website?.socialLinks || undefined}
      />

      {/* ═══ 3.1 NAVBAR (fixe, sticky, transparente → opaque navy après 80px) ═══ */}
      <TenantHeader
        schoolName={schoolName}
        schoolAcronym={schoolAcronym}
        schoolLogo={schoolLogo || undefined}
        schoolSlogan={schoolSlogan || undefined}
        colors={colors}
        activeNav="Accueil"
        transparentAtTop
        navLinks={navLinks}
        portalHref="/school-portal/portal"
      />

      {/* Bandeau recrutement (optionnel — non sticky, sous la navbar) */}
      <div className="pt-16 md:pt-20">
        <TenantRecruitmentBanner tenantId={tenantId || undefined} tenantSlug={slug} />
      </div>

      {/* ═══ 3.2 HERO — Design Win Agro (palette + polices Helm conservées) ═══ */}
      {/* Refonte Win Agro (2026-09-25) :
          - Fond image plein écran + dégradé navy multiply (style Win Agro)
          - Cercles blur flottants (animate-float) — signature Win Agro
          - Badge avec ping pulse (animate-pulse-slow)
          - H1 staggered avec underline accent animée sur mot clé
          - CTA primaire avec btn-shimmer + animation scale infinie
          - Slanted section divider en bas (clip-path)
          - SVG noise grain pour texture premium
          - bg-grain pour motif de fond */}
      <section
        id="hero"
        className="relative min-h-[90vh] flex items-center justify-center pt-24 pb-16 overflow-hidden bg-[#0B1E4D] text-white"
      >
        {/* 1. Premium Background Image + Navy Opacity Overlay */}
        <div className="absolute inset-0 z-0">
          {(heroImage || DEFAULT_PORTAL_IMAGES.hero) ? (
            <Image
              src={heroImage || DEFAULT_PORTAL_IMAGES.hero}
              alt={schoolName}
              fill
              priority
              sizes="100vw"
              className="object-cover object-center scale-102"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${DARK} 100%)` }}
            />
          )}

          {/* Dynamic mesh gradients overlaying photo (multiply blend) */}
          <div
            className="absolute inset-0 mix-blend-multiply"
            style={{ background: `linear-gradient(to bottom right, ${NAVY}f0, ${NAVY}cc, ${DARK}f0)` }}
          />

          {/* Glowing floating decorative circles (signature Win Agro) */}
          <div
            className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-[100px] animate-float"
            style={{ background: `${BLUE}33` }}
          />
          <div
            className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full blur-[150px] animate-float"
            style={{ background: `${GOLD}14`, animationDelay: '2s' }}
          />

          {/* SVG Noise Grain Filter (texture premium Win Agro) */}
          <svg
            viewBox="0 0 200 200"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none mix-blend-overlay"
          >
            <filter id="noiseFilter-ah-hero">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
            <rect width="100%" height="100%" filter="url(#noiseFilter-ah-hero)" />
          </svg>

          {/* Decorative Grid Patterns (grain) */}
          <div className="absolute inset-0 bg-grain opacity-[0.08] mix-blend-overlay" />
        </div>

        {/* Particules dorées flottantes (signature Academia Helm) */}
        <FloatingEduParticles count={18} opacityMultiplier={1.2} variant="light" />

        {/* 2. Hero Content Grid */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center">

            {/* Staggered Badge avec ping (signature Win Agro) */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider mb-8 animate-pulse-slow"
              style={{
                background: `${BLUE}33`,
                borderColor: `${BLUE}88`,
                color: GOLD,
              }}
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: GOLD }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: GOLD }} />
              </span>
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
              {schoolName}
            </motion.div>

            {/* Staggered Main Title (H1) — avec underline accent animée sur le mot clé */}
            <h1 className="font-serif font-extrabold text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6">
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
                className="block text-white"
              >
                {heroTitle}
              </motion.span>
              {heroSubtitle && (
                <motion.span
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
                  className="block mt-4 text-amber-300 font-black"
                >
                  <span className="relative inline-block">
                    Excellence éducative
                    <motion.span
                      animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                      transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                      className="absolute bottom-1 left-0 w-full h-[4px] rounded-full"
                      style={{ background: GOLD }}
                    />
                  </span>
                </motion.span>
              )}
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="text-base sm:text-lg md:text-xl text-blue-50/85 mb-10 max-w-2xl leading-relaxed"
            >
              {heroSubtitle}
            </motion.p>

            {/* Action CTAs — primaire avec btn-shimmer + animation scale infinie (style Win Agro) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.75, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full sm:w-auto"
            >
              <motion.button
                onClick={() => handlePortalClick('PUBLIC')}
                whileHover={{ scale: 1.05, boxShadow: `0px 10px 25px ${BLUE}66` }}
                whileTap={{ scale: 0.98 }}
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ scale: { repeat: Infinity, duration: 2.5, ease: "easeInOut" } }}
                className="w-full sm:w-auto px-8 py-4 rounded-full text-white font-bold text-base shadow-xl border flex items-center justify-center gap-2 cursor-pointer focus:outline-none btn-shimmer"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #e09e1f)`,
                  color: NAVY,
                  borderColor: GOLD,
                }}
              >
                {heroCtaText}
                <ChevronRight className="w-5 h-5 shrink-0" />
              </motion.button>

              <div className="flex items-center gap-2 text-sm text-blue-50/80 font-medium">
                <a
                  href="/school-portal/portal"
                  className="hover:text-amber-300 underline transition-colors cursor-pointer"
                >
                  Portail
                </a>
                <span>·</span>
                <a
                  href="#programmes"
                  className="hover:text-amber-300 underline transition-colors cursor-pointer"
                >
                  Nos programmes
                </a>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Elegant Slanted Section Divider (signature Win Agro) */}
        <div
          className="absolute bottom-0 left-0 right-0 h-8"
          style={{ background: PEARL, clipPath: "polygon(0 100%, 100% 100%, 100% 0)" }}
        />

        {/* Bandeau chiffres clés (CDC 3.2 — 3-4 indicateurs) */}
        {keyFigures.length > 0 && (
          <div className="relative z-20 w-full pb-24 pt-2 shrink-0 md:absolute md:bottom-8 md:left-0 md:right-0 md:pb-8 flex justify-center">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4 text-center">
                {keyFigures.map((fig: any, i: number) => (
                  <KeyFigureCard key={i} fig={fig} gold={GOLD} navy={NAVY} delay={i * 0.1} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══ 3.3 À PROPOS / PRÉSENTATION — Design Win Agro ═══ */}
      {shouldShowSection(rawWebsite?.presentationIsActive) && (
        <section id="a-propos" className="py-24 relative overflow-hidden" style={{ background: PEARL }}>
          {/* Decorative Blur Backgrounds (signature Win Agro) */}
          <div
            className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-3xl opacity-40 -z-10"
            style={{ background: `${NAVY}14` }}
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header avec badge + hook statement (style Win Agro) */}
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

              {/* 1. Narrative Content (60%) */}
              <div className="w-full lg:w-3/5 space-y-6">
                <div
                  className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ background: `${NAVY}14`, color: NAVY }}
                >
                  {withDefault(website.presentationTitle, 'À propos de notre école') === 'À propos de notre école' ? 'À Propos de notre établissement' : website.presentationTitle}
                </div>

                {/* Hook statement avec underline accent animée (style Win Agro) */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
                  style={{ color: NAVY }}
                >
                  &ldquo;{withDefault(website.presentationTitle, 'À propos de notre école')}&rdquo;
                </motion.h2>

                {/* Animated underline separator (signature Win Agro) */}
                <motion.div
                  animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                  transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                  className="h-1 w-16 rounded-full"
                  style={{ background: GOLD }}
                />

                {/* Structured Paragraphs */}
                <div
                  className="space-y-4 text-sm sm:text-base font-sans leading-relaxed"
                  style={{ color: '#475569' }}
                >
                  <p className="whitespace-pre-wrap">
                    {withDefault(website.presentationContent, DEFAULT_WEBSITE_CONFIG.presentationContent)}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: `${NAVY}10`, color: NAVY }}
                    >
                      <Award className="w-3.5 h-3.5" /> Excellence académique
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: `${GOLD}15`, color: '#a07d00' }}
                    >
                      <Users className="w-3.5 h-3.5" /> Accompagnement personnalisé
                    </span>
                  </div>
                </div>

                {/* Signature Area (style Win Agro) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-4">
                  <div>
                    <p className="font-serif text-xl font-extrabold italic flex items-center gap-1" style={{ color: NAVY }}>
                      On y va ensemble. <Sparkles className="w-5 h-5 shrink-0" style={{ color: GOLD }} />
                    </p>
                    <p className="font-sans text-xs font-bold uppercase tracking-wider mt-1" style={{ color: '#475569' }}>
                      {withDefault(website.directorName, DEFAULT_WEBSITE_CONFIG.directorName)} · Directeur/trice
                    </p>
                  </div>

                  <motion.a
                    href="#contact"
                    whileHover={{ scale: 1.05, boxShadow: `0 10px 20px ${NAVY}4d` }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-white font-bold text-base shadow-md cursor-pointer btn-shimmer"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    Prendre contact →
                  </motion.a>
                </div>
              </div>

              {/* 2. Image (40%) avec card-shimmer (style Win Agro) */}
              <div className="w-full lg:w-2/5 flex flex-col justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-xl card-shimmer group"
                >
                  {(website.presentationImageUrl || DEFAULT_PORTAL_IMAGES.presentation) ? (
                    <Image
                      src={website.presentationImageUrl || DEFAULT_PORTAL_IMAGES.presentation}
                      alt="Présentation"
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                    >
                      <Building2 className="w-20 h-20 text-white/30" />
                      <div className="absolute top-4 right-4 w-12 h-1 rounded-full" style={{ background: GOLD }} />
                    </div>
                  )}
                  {/* Halo doré décoratif (signature Win Agro) */}
                  <div
                    className="absolute top-0 right-0 w-24 h-24 rounded-full blur-xl pointer-events-none"
                    style={{ background: `${GOLD}1a` }}
                  />
                </motion.div>
              </div>
            </div>

            {/* Mot du directeur/fondateur — citation + portrait, bordure gauche or (CDC 3.3) */}
            {(shouldShowSection(rawWebsite?.directorIsActive) || shouldShowSection(rawWebsite?.promoterIsActive)) && (
              <div className="grid md:grid-cols-2 gap-6 mt-16">
                {shouldShowSection(rawWebsite?.promoterIsActive) && (
                  <DirectorWord
                    title="Mot du Promoteur"
                    text={withDefault(website.promoterWord, DEFAULT_WEBSITE_CONFIG.promoterWord)}
                    name={withDefault(website.promoterName, DEFAULT_WEBSITE_CONFIG.promoterName)}
                    photoUrl={website.promoterPhotoUrl}
                    role="Promoteur"
                    navy={NAVY}
                    gold={GOLD}
                    side="left"
                  />
                )}
                {shouldShowSection(rawWebsite?.directorIsActive) && (
                  <DirectorWord
                    title="Mot du Directeur"
                    text={withDefault(website.directorWord, DEFAULT_WEBSITE_CONFIG.directorWord)}
                    name={withDefault(website.directorName, DEFAULT_WEBSITE_CONFIG.directorName)}
                    photoUrl={website.directorPhotoUrl}
                    role="Directeur"
                    navy={NAVY}
                    gold={GOLD}
                    side="right"
                  />
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ 3.4 EXCELLENCE ACADÉMIQUE / PROGRAMMES — Design Win Agro ═══ */}
      <section id="programmes" className="py-24 bg-white relative overflow-hidden">
        {/* Decorative Blur Backgrounds (signature Win Agro) */}
        <div
          className="absolute bottom-10 right-0 w-72 h-72 rounded-full blur-3xl opacity-50 -z-10"
          style={{ background: `${NAVY}14` }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header avec badge + hook statement (style Win Agro) */}
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
              style={{ background: `${NAVY}14`, color: NAVY }}
            >
              Excellence académique
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
              style={{ color: NAVY }}
            >
              {programsTitle}
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto mt-6 rounded-full"
              style={{ background: GOLD }}
            />
            {programsSubtitle && (
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto mt-4">
                {programsSubtitle}
              </p>
            )}
          </div>

          {/* Grille de programmes — cards premium avec card-shimmer (style Win Agro) */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {programs.map((program: any, i: number) => (
              <motion.div
                key={program.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  boxShadow: `0 20px 25px -5px ${NAVY}14, 0 8px 10px -6px ${NAVY}14`,
                }}
                className="group relative bg-white rounded-2xl p-6 md:p-8 shadow-lg border border-slate-100 transition-all duration-300 overflow-hidden card-shimmer"
              >
                {/* Halo or au hover */}
                <div
                  className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-0 group-hover:opacity-[0.08] blur-3xl transition-opacity duration-500"
                  style={{ background: GOLD }}
                />
                <div className="relative">
                  {/* Icône avec animation rotate infinie (signature Win Agro) */}
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-md"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    <program.Icon className="w-7 h-7 text-white" />
                  </motion.div>
                  <h3 className="font-serif text-xl font-bold mb-2" style={{ color: NAVY }}>{program.title}</h3>
                  <p className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: GOLD }}>{program.levels}</p>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">{program.description}</p>
                  <button
                    onClick={() => { if (typeof window !== 'undefined') window.location.href = '/#admissions'; }}
                    className="inline-flex items-center gap-1.5 text-sm font-bold transition-all group-hover:gap-2.5"
                    style={{ color: NAVY }}
                  >
                    En savoir plus <ArrowRight size={14} />
                  </button>
                </div>
                {/* Liseré or en bas au hover */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                />
              </motion.div>
            ))}
          </div>

          {/* Points de différenciation — card premium Win Agro */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-3xl p-8 md:p-10 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${PEARL}, ${NAVY}0a)` }}
          >
            {/* Halo doré décoratif */}
            <div
              className="absolute top-0 right-0 w-24 h-24 rounded-full blur-xl pointer-events-none"
              style={{ background: `${GOLD}1a` }}
            />
            <h3 className="font-serif text-lg md:text-xl font-bold text-center mb-8" style={{ color: NAVY }}>
              Nos points de différenciation
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {differentiators.map((item: any, i: number) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-white/60 border border-white/40 hover:bg-white transition-all duration-300"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${GOLD}20` }}
                  >
                    <item.Icon className="w-5 h-5" style={{ color: '#a07d00' }} />
                  </motion.div>
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: NAVY }}>{item.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ 3.5 CORPS ENSEIGNANT / ENCADREMENT — Design Win Agro ═══ */}
      <section id="corps-enseignant" className="py-24 relative overflow-hidden" style={{ background: PEARL }}>
        {/* Decorative Blur Backgrounds (signature Win Agro) */}
        <div
          className="absolute top-1/2 left-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
          style={{ background: `${NAVY}0a` }}
        />
        <div
          className="absolute bottom-0 right-10 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ background: `${GOLD}14` }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header avec badge + hook statement (style Win Agro) */}
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
              style={{ background: `${NAVY}14`, color: NAVY }}
            >
              Notre équipe
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
              style={{ color: NAVY }}
            >
              {facultyTitle}
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto mt-6 rounded-full"
              style={{ background: GOLD }}
            />
            {facultySubtitle && (
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto mt-4">
                {facultySubtitle}
              </p>
            )}
          </div>

          {/* Ratio encadrant/élève — badge or premium avec pulse (style Win Agro) */}
          <div className="flex justify-center mb-10">
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="inline-flex items-center gap-3 px-5 py-3 rounded-full shadow-xl"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e1f)` }}
            >
              <Users className="w-5 h-5" style={{ color: NAVY }} />
              <span className="text-sm font-bold" style={{ color: NAVY }}>
                {facultyRatio}
              </span>
            </motion.div>
          </div>

          {/* Grille d'enseignants — cards premium avec card-shimmer (style Win Agro) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {faculty.map((member: any, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="group bg-white rounded-3xl p-6 text-center shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 card-shimmer"
              >
                {/* Portrait placeholder — bordure or au hover + scale (style Win Agro) */}
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold transition-all group-hover:ring-4 group-hover:ring-amber-400/40 group-hover:ring-offset-2"
                    style={{
                      background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`,
                      color: '#FFFFFF',
                    }}
                  >
                    {(member.name || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                  </motion.div>
                  {/* Halo doré décoratif */}
                  <div
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: GOLD }}
                  />
                </div>
                <h4 className="font-serif text-sm font-bold" style={{ color: NAVY }}>{member.name}</h4>
                <p className="text-xs font-bold mt-1 uppercase tracking-wider" style={{ color: GOLD }}>{member.role}</p>
                <p className="text-[11px] text-slate-500 mt-1">{member.subject}</p>
                {/* Separator line with shine (style Win Agro) */}
                <div
                  className="w-8 h-0.5 rounded-full mx-auto mt-3 opacity-50 group-hover:opacity-100 group-hover:w-12 transition-all duration-300"
                  style={{ background: GOLD }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 3.6 VIE SCOLAIRE / ACTUALITÉS — Design Win Agro ═══ */}
      <section id="vie-scolaire" className="py-24 bg-white relative overflow-hidden">
        {/* Decorative Blur Backgrounds (signature Win Agro) */}
        <div
          className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-3xl opacity-40 -z-10"
          style={{ background: `${NAVY}0a` }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header avec badge + hook statement (style Win Agro) */}
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
              style={{ background: `${NAVY}14`, color: NAVY }}
            >
              Vie scolaire
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
              style={{ color: NAVY }}
            >
              {newsTitle}
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto mt-6 rounded-full"
              style={{ background: GOLD }}
            />
            {newsSubtitle && (
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto mt-4">
                {newsSubtitle}
              </p>
            )}
          </div>

          {/* Flux d'actualités — cards premium avec card-shimmer + staggered (style Win Agro) */}
          {newsArticles.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
              {newsArticles.slice(0, 6).map((article: any, i: number) => (
                <motion.article
                  key={article.id || i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                  whileHover={{
                    y: -8,
                    scale: 1.02,
                    boxShadow: `0 20px 25px -5px ${NAVY}14, 0 8px 10px -6px ${NAVY}14`,
                  }}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 transition-all duration-300 cursor-pointer group card-shimmer"
                  onClick={() => { if (article.slug) window.location.href = `/actualites/${article.slug}`; }}
                >
                  {article.coverImageUrl || DEFAULT_PORTAL_IMAGES.news[i % DEFAULT_PORTAL_IMAGES.news.length] ? (
                    <div className="h-44 overflow-hidden relative">
                      <Image
                        src={article.coverImageUrl || DEFAULT_PORTAL_IMAGES.news[i % DEFAULT_PORTAL_IMAGES.news.length]}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Numéro de l'article en badge (style Win Agro) */}
                      <div
                        className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[10px] font-black shadow-sm"
                        style={{ color: NAVY }}
                      >
                        #{String(i + 1).padStart(2, '0')}
                      </div>
                    </div>
                  ) : (
                    <div className="h-44 overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}30, ${GOLD}20)` }}>
                      <FileText className="w-12 h-12 text-white/30" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      {article.category && (
                        <span
                          className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: `${NAVY}15`, color: NAVY }}
                        >
                          {article.category}
                        </span>
                      )}
                      {article.publishedAt && (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar size={11} />
                          {new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-base font-bold mb-2 line-clamp-2 transition-colors" style={{ color: NAVY }}>
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{article.excerpt || article.content}</p>
                    <span
                      className="inline-flex items-center gap-1 text-xs font-bold transition-all group-hover:gap-2"
                      style={{ color: NAVY }}
                    >
                      Lire la suite <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 mb-16">Aucune actualité pour le moment.</div>
          )}

          {/* Galerie photo — grille (CDC 3.6) */}
          {galleryItems.length > 0 && (
            <div id="galerie">
              <h3 className="text-xl md:text-2xl font-bold text-center mb-8" style={{ color: NAVY }}>
                Galerie — Vie scolaire en images
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galleryItems.slice(0, 8).map((item: any, i: number) => (
                  <motion.div
                    key={item.id || i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group"
                  >
                    {item.imageUrl || DEFAULT_PORTAL_IMAGES.gallery[i % DEFAULT_PORTAL_IMAGES.gallery.length] ? (
                      <Image
                        src={item.imageUrl || DEFAULT_PORTAL_IMAGES.gallery[i % DEFAULT_PORTAL_IMAGES.gallery.length]}
                        alt={item.caption || ''}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}40, ${GOLD}30)` }}>
                        <ImageIcon className="w-8 h-8 text-white/40" />
                      </div>
                    )}
                    {item.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.caption}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ 3.7 ADMISSIONS — fond navy, texte blanc (CDC 3.7) ═══ */}
      <section id="admissions" className="relative py-16 md:py-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${DARK} 100%)` }}>
        {/* Halo doré décoratif */}
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_top_right,#F5B700_0%,transparent_50%)]" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header avec badge + hook statement (style Win Agro, inverted) */}
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
              style={{ background: `${GOLD}22`, color: GOLD, border: `1px solid ${GOLD}55` }}
            >
              Rejoindre notre établissement
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug text-white"
            >
              {admissionTitle}
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto mt-6 rounded-full"
              style={{ background: GOLD }}
            />
            {admissionSubtitle && (
              <p className="text-sm md:text-base text-blue-100/70 max-w-2xl mx-auto mt-4">
                {admissionSubtitle}
              </p>
            )}
          </div>

          {/* Timeline horizontale desktop / verticale mobile (CDC 3.7) — Win Agro style */}
          <div className="mb-16">
            <div className="grid md:grid-cols-4 gap-6 md:gap-4 relative">
              {/* Ligne de timeline horizontale (desktop) */}
              <div
                className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5"
                style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD}55, ${GOLD})` }}
              />
              {admissionSteps.map((step: any, i: number) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.5, ease: "easeOut" }}
                  whileHover={{ y: -6 }}
                  className="relative text-center"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="relative inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 z-10"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, #e09e1f)`,
                      boxShadow: `0 0 0 4px ${DARK}`,
                    }}
                  >
                    <step.Icon className="w-7 h-7" style={{ color: NAVY }} />
                    {/* Numéro d'étape en badge */}
                    <span
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white text-xs font-bold flex items-center justify-center"
                      style={{ color: NAVY }}
                    >
                      {step.num}
                    </span>
                  </motion.div>
                  <h4 className="font-serif text-base font-bold text-white mb-2">{step.title}</h4>
                  <p className="text-xs text-blue-100/70 leading-relaxed px-2">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Documents requis + CTA final (CDC 3.7) — glass-panel Win Agro */}
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="glass-panel rounded-3xl p-6 md:p-8"
              style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <h3 className="font-serif text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" style={{ color: GOLD }} />
                Documents requis
              </h3>
              <ul className="space-y-2.5">
                {admissionDocuments.map((doc: any, i: number) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm text-blue-50/85"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                    <span>{typeof doc === 'string' ? doc : doc.label || doc.name || doc.title}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>

            {/* CTA final — "Commencer ma candidature" (or) avec btn-shimmer */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h3 className="font-serif text-2xl md:text-3xl font-extrabold text-white mb-3">
                Prêt à nous rejoindre ?
              </h3>
              <p className="text-blue-100/70 text-sm mb-6 max-w-md mx-auto">
                Démarrez votre candidature en ligne dès maintenant. Notre équipe vous accompagne à chaque étape.
              </p>
              <motion.button
                onClick={() => handlePortalClick('PUBLIC')}
                whileHover={{ scale: 1.05, boxShadow: `0px 10px 25px ${GOLD}66` }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold shadow-xl cursor-pointer btn-shimmer"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e1f)`, color: NAVY }}
              >
                Commencer ma candidature <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══ 3.8 TÉMOIGNAGES — Design Win Agro ═══ */}
      {testimonials.length > 0 && (
        <section id="temoignages" className="py-24 bg-white relative overflow-hidden">
          {/* Decorative Blur Backgrounds (signature Win Agro) */}
          <div
            className="absolute bottom-10 right-0 w-72 h-72 rounded-full blur-3xl opacity-50 -z-10"
            style={{ background: `${GOLD}14` }}
          />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            {/* Header avec badge + hook statement (style Win Agro) */}
            <div className="max-w-4xl mx-auto text-center mb-16">
              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
                style={{ background: `${NAVY}14`, color: NAVY }}
              >
                Ils nous font confiance
              </div>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
                style={{ color: NAVY }}
              >
                {testimonialsTitle}
              </motion.h2>
              <motion.div
                animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
                transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
                className="h-1 w-16 mx-auto mt-6 rounded-full"
                style={{ background: GOLD }}
              />
              {testimonialsSubtitle && (
                <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto mt-4">
                  {testimonialsSubtitle}
                </p>
              )}
            </div>

            {/* Carrousel témoignages (CDC 3.8 — un seul visible sur mobile) */}
            <div className="relative mb-12">
              <div className="overflow-hidden rounded-2xl">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTestimonial}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white border border-slate-100 rounded-2xl p-8 md:p-12 shadow-lg"
                  >
                    <Quote className="w-10 h-10 mb-4" style={{ color: GOLD }} />
                    <p className="text-lg md:text-xl text-slate-700 leading-relaxed italic mb-6">
                      &ldquo;{testimonials[activeTestimonial].content}&rdquo;
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`, color: '#FFFFFF' }}>
                        {(testimonials[activeTestimonial].authorName || '?').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <p className="font-bold" style={{ color: NAVY }}>{testimonials[activeTestimonial].authorName}</p>
                        {testimonials[activeTestimonial].authorRole && (
                          <p className="text-xs text-slate-500">{testimonials[activeTestimonial].authorRole}</p>
                        )}
                      </div>
                      <div className="ml-auto flex gap-0.5">
                        {Array.from({ length: testimonials[activeTestimonial].rating || 5 }).map((_, i) => (
                          <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Contrôles carrousel */}
              {testimonials.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
                    className="absolute left-2 md:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                    aria-label="Témoignage précédent"
                  >
                    <ChevronLeft className="w-5 h-5" style={{ color: NAVY }} />
                  </button>
                  <button
                    onClick={() => setActiveTestimonial((prev) => (prev + 1) % testimonials.length)}
                    className="absolute right-2 md:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                    aria-label="Témoignage suivant"
                  >
                    <ChevronRight className="w-5 h-5" style={{ color: NAVY }} />
                  </button>
                  {/* Dots indicateurs */}
                  <div className="flex justify-center gap-2 mt-6">
                    {testimonials.map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setActiveTestimonial(i)}
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: i === activeTestimonial ? 24 : 8,
                          background: i === activeTestimonial ? GOLD : '#cbd5e1',
                        }}
                        aria-label={`Aller au témoignage ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Logos partenaires / accréditations — niveaux de gris, couleur au survol (CDC 3.8) */}
            <div className="border-t border-slate-100 pt-10">
              <p className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-6">
                Partenaires & accréditations
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
                {PARTNER_LOGOS.map((partner, i) => (
                  <div
                    key={i}
                    className="grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-default"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                        {(partner.abbr || '??').slice(0, 2)}
                      </div>
                      <span className="text-xs font-semibold text-slate-600 hidden md:inline">{partner.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ 3.9 CONTACT — Design Win Agro ═══ */}
      <section id="contact" className="py-24 relative overflow-hidden" style={{ background: PEARL }}>
        {/* Decorative Blur Backgrounds (signature Win Agro) */}
        <div
          className="absolute top-1/2 left-0 w-72 h-72 rounded-full blur-3xl opacity-40 -z-10"
          style={{ background: `${NAVY}0a` }}
        />
        <div
          className="absolute bottom-0 right-10 w-96 h-96 rounded-full blur-[120px] pointer-events-none"
          style={{ background: `${GOLD}14` }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Header avec badge + hook statement (style Win Agro) */}
          <div className="max-w-4xl mx-auto text-center mb-16">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
              style={{ background: `${NAVY}14`, color: NAVY }}
            >
              Nous contacter
            </div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-snug"
              style={{ color: NAVY }}
            >
              {contactTitle}
            </motion.h2>
            <motion.div
              animate={{ scaleX: [0, 1, 1, 0], transformOrigin: ["0% 50%", "0% 50%", "100% 50%", "100% 50%"] }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
              className="h-1 w-16 mx-auto mt-6 rounded-full"
              style={{ background: GOLD }}
            />
            {contactSubtitle && (
              <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto mt-4">
                {contactSubtitle}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonne gauche : Coordonnées + Carte OpenStreetMap */}
            <div>
              {/* Coordonnées (CDC 3.9) */}
              <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 mb-6">
                <h3 className="text-lg font-bold mb-5" style={{ color: NAVY }}>Coordonnées</h3>
                <ul className="space-y-4">
                  {contactAddress && (
                    <li className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NAVY}12` }}>
                        <MapPin className="w-4 h-4" style={{ color: NAVY }} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Adresse</p>
                        <p className="text-sm font-semibold text-slate-900">{contactAddress}{contactCity ? `, ${contactCity}` : ''}</p>
                      </div>
                    </li>
                  )}
                  {contactPhone && (
                    <li className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${GOLD}15` }}>
                        <Phone className="w-4 h-4" style={{ color: '#a07d00' }} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Téléphone</p>
                        <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="text-sm font-semibold text-slate-900 hover:underline">{contactPhone}</a>
                      </div>
                    </li>
                  )}
                  {/* WhatsApp (module Paramètres → Identité) */}
                  {contactWhatsapp && (
                    <li className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `#25D36618` }}>
                        <MessageCircle className="w-4 h-4" style={{ color: '#128C7E' }} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">WhatsApp</p>
                        <a
                          href={`https://wa.me/${contactWhatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {contactWhatsapp}
                        </a>
                      </div>
                    </li>
                  )}
                  {contactEmail && (
                    <li className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${NAVY}12` }}>
                        <Mail className="w-4 h-4" style={{ color: NAVY }} />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">Email</p>
                        <a href={`mailto:${contactEmail}`} className="text-sm font-semibold text-slate-900 hover:underline">{contactEmail}</a>
                      </div>
                    </li>
                  )}
                  <li className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${GOLD}15` }}>
                      <Clock className="w-4 h-4" style={{ color: '#a07d00' }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Horaires</p>
                      <p className="text-sm font-semibold text-slate-900">Lun - Ven : 7h30 - 17h00</p>
                      <p className="text-xs text-slate-500">Sam : 8h00 - 12h00</p>
                    </div>
                  </li>
                </ul>
              </div>

              {/* Carte de localisation — position RÉELLE de l'école (CDC 3.9)
                  ⚠️ Fix : l'ancienne iframe était codée en dur (pin à
                  Porto-Novo pour toutes les écoles). SchoolLocationMap résout :
                  GPS exact (Paramètres) → géocodage adresse → ville → pays. */}
              <SchoolLocationMap
                latitude={contactLatitude}
                longitude={contactLongitude}
                address={contactAddress || null}
                city={contactCity || null}
                schoolName={schoolName}
                navy={NAVY}
              />
            </div>

            {/* Colonne droite : Formulaire de contact (nom, email, sujet, message) (CDC 3.9) */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: NAVY }}>
                <Send className="w-5 h-5" style={{ color: GOLD }} />
                Envoyez-nous un message
              </h3>
              <ContactForm tenantSlug={slug} accentColor={GOLD} primaryColor={NAVY} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3.10 FOOTER multi-colonnes (CDC 3.10) ═══ */}
      <TenantFooter
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAcronym={schoolData?.schoolAcronym || undefined}
        schoolSlogan={schoolSlogan || undefined}
        schoolAddress={contactAddress || schoolData?.address || undefined}
        schoolCity={contactCity || schoolData?.city || undefined}
        schoolPhone={contactPhone || schoolData?.phone || undefined}
        schoolEmail={contactEmail || undefined}
        contactEmail={contactEmail || undefined}
        contactPhone={contactPhone || undefined}
        contactAddress={contactAddress || undefined}
        footerAboutText={withDefault(rawWebsite?.footerAboutText, DEFAULT_WEBSITE_CONFIG.footerAboutText) || undefined}
        footerCopyrightText={withDefault(rawWebsite?.footerCopyrightText, DEFAULT_WEBSITE_CONFIG.footerCopyrightText) || undefined}
        socialLinks={website?.socialLinks || undefined}
        navLinks={navLinks}
        tenantSlug={slug}
      />

      {/* Chatbot IA (optionnel) */}
      {website?.aiEnabled && (
        <TenantAiChatbot
          tenantSlug={slug}
          welcomeMessage={withDefault(website.aiWelcomeMessage, DEFAULT_WEBSITE_CONFIG.aiWelcomeMessage) || undefined}
          faqItems={faqItems}
        />
      )}
    </div>
  );
}

// ─── Sous-composant : carte chiffre clé avec compteur animé (CDC 8) ──
function KeyFigureCard({ fig, gold, navy, delay }: { fig: any; gold: string; navy: string; delay: number }) {
  // Essayer d'extraire la partie numérique pour le compteur
  // ⭐ 2026-09-25 — Défense: fig.value peut être undefined/null si le CMS
  // fournit une keyFigure incomplète. On cast en string via String(...||'').
  const figValueStr = String(fig?.value ?? '');
  const numericMatch = figValueStr.match(/^(\d+)/);
  const targetNum = numericMatch ? parseInt(numericMatch[1], 10) : 0;
  const suffix = numericMatch ? figValueStr.slice(numericMatch[0].length) : '';
  const { value, ref } = useCountUp(targetNum, 1500);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 md:p-4 text-center card-shimmer transition-all duration-300"
    >
      <div className="text-xl md:text-2xl font-extrabold text-white">
        {targetNum > 0 ? `${value}${suffix}` : fig.value}
      </div>
      {/* Separator line with shine animation (style Win Agro) */}
      <div
        className="w-12 h-1 rounded-full mx-auto mt-1 mb-2 transition-all duration-300 group-hover:w-20"
        style={{ background: gold }}
      />
      <div className="text-[10px] md:text-xs text-blue-50/70 font-medium mt-0.5">{fig.label}</div>
    </motion.div>
  );
}

// ─── Sous-composant : Mot du directeur/fondateur avec bordure gauche or ──
function DirectorWord({
  title, text, name, photoUrl, role, navy, gold, side,
}: {
  title: string; text: string; name: string; photoUrl: string | null;
  role: string; navy: string; gold: string; side: 'left' | 'right';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: side === 'left' ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="relative bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100 overflow-hidden"
    >
      {/* Bordure gauche or (CDC 3.3) */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, ${gold}, ${gold}88)` }} />
      <Quote className="w-7 h-7 mb-3" style={{ color: gold }} />
      <h3 className="text-base font-bold mb-3" style={{ color: navy }}>{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-5 line-clamp-5">{text}</p>
      <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={44}
            height={44}
            className="rounded-full object-cover ring-2 ring-amber-300/40"
          />
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: `linear-gradient(135deg, ${navy}, #1E4FA3)`, color: '#FFFFFF' }}>
            {(name || '?').split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-slate-900">{name}</p>
          <p className="text-xs text-slate-500">{role}</p>
        </div>
      </div>
    </motion.div>
  );
}
