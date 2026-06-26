'use client';

/**
 * ============================================================================
 * INSTITUTIONAL WEBSITE — Site institutionnel intelligent des écoles
 * ============================================================================
 *
 * Design aligné sur la PremiumLandingPage du site principal :
 *   - Header navy avec effet limelight doré
 *   - Hero avec gradient navy + particules
 *   - Sections avec cards blanches, ombres douces, coins arrondis
 *   - Palette : Navy #0b2f73, Blue #1d4fa5, Gold #f5b335
 *   - Typographie : bold/black pour titres, medium pour corps
 *   - Animations framer-motion discrètes
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import {
  Loader2, MapPin, Phone, Mail, ChevronRight, Calendar,
  Quote, Menu, X, ExternalLink, FileText,
  Building2, GraduationCap, Users, Globe, ArrowRight, Star, Images,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import LogoCircle from '@/components/ui/LogoCircle';
import { BRAND } from '@/lib/brand';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { type PortalType } from '@/lib/auth/role-portal-map';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import TenantAiChatbot from '@/components/portal/TenantAiChatbot';
import TenantStructuredData from '@/components/portal/TenantStructuredData';
import TenantRecruitmentBanner from '@/components/portal/TenantRecruitmentBanner';
import { ContactForm } from '@/components/portal/ContactForm';
import { NotchNav } from '@/components/ui/notch-nav';
import TenantFooter from '@/components/ui/footer-column';
import TenantHeader from '@/components/portal/TenantHeader';
import { resolveTenantColors } from '@/lib/tenant/use-tenant-colors';
import {
  DEFAULT_WEBSITE_CONFIG,
  DEFAULT_NEWS_ARTICLES,
  DEFAULT_EVENTS,
  DEFAULT_GALLERY_ITEMS,
  DEFAULT_TESTIMONIALS,
  DEFAULT_FAQ_ITEMS,
  withDefault,
  shouldShowSection,
} from '@/lib/tenant/default-cms-content';

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

interface Props {
  schoolInfo?: SchoolPortalInfo | null;
  subdomain?: string | null;
}

const PORTAL_DEFS = [
  { type: 'SCHOOL' as PortalType, title: 'École', subtitle: 'Direction & administration', icon: Building2 },
  { type: 'TEACHER' as PortalType, title: 'Enseignant', subtitle: 'Pédagogie & suivi', icon: GraduationCap },
  { type: 'PARENT' as PortalType, title: 'Parent / Élève', subtitle: 'Suivi & communication', icon: Users },
];

export default function InstitutionalWebsite({ schoolInfo, subdomain }: Props) {
  const [schoolData, setSchoolData] = useState<SchoolPortalInfo | null>(schoolInfo || null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [tenantId, setTenantId] = useState<string | null>((schoolInfo as any)?.tenantId || (schoolInfo as any)?.id || null);
  const [isLoading, setIsLoading] = useState(!schoolInfo);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const slug = subdomain || extractTenantSlug(typeof window !== 'undefined' ? window.location.hostname : '') || schoolInfo?.slug || '';

  useEffect(() => {
    if (!schoolInfo && slug) loadSchoolData();
    if (slug) loadWebsiteData();
  }, [slug]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const loadSchoolData = async () => {
    try {
      const res = await fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchoolData(data);
        if (data?.tenantId) setTenantId(data.tenantId);
        else if (data?.id) setTenantId(data.id);
      }
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  const loadWebsiteData = async () => {
    try {
      const res = await fetch(`/api/tenant-website/public/${slug}`, { cache: 'no-store' });
      if (res.ok) setWebsiteData(await res.json());
    } catch (e) { console.error(e); }
  };

  const handlePortalClick = (type: PortalType) => {
    if (type === 'PUBLIC') window.location.href = `/public/pre-enrollment?school=${slug}`;
    else window.location.href = `/login?portal=${type}&tenant=${slug}&school_name=${encodeURIComponent(schoolData?.name || '')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  // ─── Merge des données réelles + valeurs par défaut ──
  // Si le tenant n'a pas configuré son CMS, on utilise DEFAULT_WEBSITE_CONFIG
  // pour que toutes les sections soient visibles avec du contenu de démo.
  // Les vraies valeurs (si elles existent) remplacent les défauts.
  const rawWebsite = websiteData?.website;
  const website = rawWebsite || DEFAULT_WEBSITE_CONFIG;
  const schoolName = schoolData?.name || 'Établissement Scolaire';
  const schoolAcronym = schoolData?.schoolAcronym || null;
  const schoolDisplayName = schoolAcronym || schoolName;
  const schoolLogo = schoolData?.logoUrl;
  const schoolSlogan = schoolData?.slogan || withDefault(rawWebsite?.heroSubtitle, DEFAULT_WEBSITE_CONFIG.heroSubtitle);

  // ─── Résolution dynamique de la palette de couleurs ──
  // Si l'école a configuré customColors → utilise ses couleurs
  // Sinon → fallback sur la palette Helm par défaut
  const colors = resolveTenantColors(rawWebsite?.customColors);
  const NAVY = colors.primary;
  const BLUE = colors.secondary;
  const GOLD = colors.accent;
  const DARK = colors.dark;

  // ─── Hero avec defaults ──
  const heroTitle = withDefault(rawWebsite?.heroTitle, DEFAULT_WEBSITE_CONFIG.heroTitle);
  const heroSubtitle = withDefault(rawWebsite?.heroSubtitle, DEFAULT_WEBSITE_CONFIG.heroSubtitle);
  const heroImage = rawWebsite?.heroImageUrl || null;
  const heroCtaText = withDefault(rawWebsite?.heroCtaText, DEFAULT_WEBSITE_CONFIG.heroCtaText);
  const heroCtaUrl = withDefault(rawWebsite?.heroCtaUrl, DEFAULT_WEBSITE_CONFIG.heroCtaUrl);

  // ─── Chiffres clés avec defaults ──
  const keyFigures = withDefault(rawWebsite?.keyFigures, DEFAULT_WEBSITE_CONFIG.keyFigures);

  // ─── Collections avec defaults ──
  const newsArticles = (websiteData?.newsArticles && websiteData.newsArticles.length > 0)
    ? websiteData.newsArticles
    : DEFAULT_NEWS_ARTICLES;
  const events = (websiteData?.events && websiteData.events.length > 0)
    ? websiteData.events
    : DEFAULT_EVENTS;
  const galleryItems = (websiteData?.galleryItems && websiteData.galleryItems.length > 0)
    ? websiteData.galleryItems
    : DEFAULT_GALLERY_ITEMS;
  const testimonials = (websiteData?.testimonials && websiteData.testimonials.length > 0)
    ? websiteData.testimonials
    : DEFAULT_TESTIMONIALS;
  const faqItems = (websiteData?.faqItems && websiteData.faqItems.length > 0)
    ? websiteData.faqItems
    : DEFAULT_FAQ_ITEMS;

  const navLinks = [
    { label: 'Accueil', href: '#hero' },
    { label: 'Présentation', href: '#presentation' },
    { label: 'Admissions', href: '#admissions' },
    { label: 'Vie scolaire', href: '#vie-scolaire' },
    { label: 'Actualités', href: '#actualites' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Recrutement', href: '/jobs' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <TenantStructuredData
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAddress={withDefault(rawWebsite?.contactAddress, DEFAULT_WEBSITE_CONFIG.contactAddress) || schoolData?.address || undefined}
        schoolPhone={withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone) || schoolData?.phone || undefined}
        schoolEmail={withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail) || undefined}
        schoolWebsite={typeof window !== 'undefined' ? window.location.origin : ''}
        schoolSlogan={schoolSlogan || undefined}
        schoolCity={schoolData?.city || undefined}
        socialLinks={website?.socialLinks || undefined}
      />

      {/* ═══ HEADER ═══ */}
      <TenantHeader
        schoolName={schoolName}
        schoolAcronym={schoolAcronym}
        schoolLogo={schoolLogo || undefined}
        schoolSlogan={schoolSlogan || undefined}
        colors={colors}
        activeNav="Accueil"
      />


      {/* ═══ BANDE RECRUTEMENT ═══ */}
      <div className="pt-14 md:pt-16">
        <TenantRecruitmentBanner tenantId={tenantId || undefined} tenantSlug={slug} />
      </div>

      {/* ═══ HERO ═══ */}
      <section id="hero" className="relative min-h-[560px] md:min-h-[640px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {heroImage ? (
            <Image src={heroImage} alt={schoolName} fill priority className="object-cover" sizes="100vw" />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${DARK} 100%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />
        </div>
        <FloatingEduParticles count={18} opacityMultiplier={1.2} variant="light" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">Bienvenue</span>
            </div>
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 drop-shadow-lg">
              {heroTitle}
            </h1>
            <p className="text-base md:text-xl text-blue-50/80 mb-8 max-w-2xl mx-auto leading-relaxed">
              {heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => handlePortalClick('PUBLIC')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#0b2f73] shadow-lg transition-all hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e1f)` }}>
                {heroCtaText} <ChevronRight size={16} />
              </button>
              <a href="#contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white border-2 border-white/30 hover:bg-white/10 transition-all backdrop-blur-sm">
                Nous contacter
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ CHIFFRES CLÉS ═══ */}
      {keyFigures.length > 0 && (
        <section className="relative -mt-12 z-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {keyFigures.map((fig: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="bg-white rounded-2xl p-5 shadow-lg border border-slate-100 text-center hover:shadow-xl transition-all">
                  <div className="text-2xl md:text-3xl font-black mb-1" style={{ color: NAVY }}>{fig.value}</div>
                  <div className="text-xs text-slate-500 font-medium">{fig.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ MOTS DU PROMOTEUR / DIRECTEUR ═══ */}
      {(shouldShowSection(rawWebsite?.promoterIsActive) || shouldShowSection(rawWebsite?.directorIsActive)) ? (
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-6">
              {shouldShowSection(rawWebsite?.promoterIsActive) && (
                <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100">
                  <Quote className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                  <h3 className="text-base font-bold text-slate-900 mb-3">Mot du Promoteur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-5">{withDefault(website.promoterWord, DEFAULT_WEBSITE_CONFIG.promoterWord)}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    {website.promoterPhotoUrl && <img src={website.promoterPhotoUrl} alt={website.promoterName || ''} className="w-10 h-10 rounded-full object-cover" />}
                    <div><p className="text-sm font-bold text-slate-900">{withDefault(website.promoterName, DEFAULT_WEBSITE_CONFIG.promoterName)}</p><p className="text-xs text-slate-400">Promoteur</p></div>
                  </div>
                </motion.div>
              )}
              {shouldShowSection(rawWebsite?.directorIsActive) && (
                <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100">
                  <Quote className="h-7 w-7 mb-3" style={{ color: BLUE }} />
                  <h3 className="text-base font-bold text-slate-900 mb-3">Mot du Directeur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-5">{withDefault(website.directorWord, DEFAULT_WEBSITE_CONFIG.directorWord)}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    {website.directorPhotoUrl && <img src={website.directorPhotoUrl} alt={website.directorName || ''} className="w-10 h-10 rounded-full object-cover" />}
                    <div><p className="text-sm font-bold text-slate-900">{withDefault(website.directorName, DEFAULT_WEBSITE_CONFIG.directorName)}</p><p className="text-xs text-slate-400">Directeur</p></div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ PRÉSENTATION ═══ */}
      {shouldShowSection(rawWebsite?.presentationIsActive) && (
        <section id="presentation" className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">{withDefault(website.presentationTitle, DEFAULT_WEBSITE_CONFIG.presentationTitle)}</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            {website.presentationImageUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
                <img src={website.presentationImageUrl} alt="Présentation" className="w-full h-56 md:h-72 object-cover" />
              </div>
            )}
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{withDefault(website.presentationContent, DEFAULT_WEBSITE_CONFIG.presentationContent)}</p>
          </div>
        </section>
      )}

      {/* ═══ ADMISSIONS ═══ */}
      {shouldShowSection(rawWebsite?.admissionsIsActive) && (
        <section id="admissions" className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">{withDefault(website.admissionsTitle, DEFAULT_WEBSITE_CONFIG.admissionsTitle)}</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{withDefault(website.admissionsContent, DEFAULT_WEBSITE_CONFIG.admissionsContent)}</p>
            <div className="mt-8 text-center">
              <a
                href={heroCtaUrl}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
              >
                {heroCtaText}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ═══ VIE SCOLAIRE ═══ */}
      {shouldShowSection(rawWebsite?.schoolLifeIsActive) && (
        <section id="vie-scolaire" className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">{withDefault(website.schoolLifeTitle, DEFAULT_WEBSITE_CONFIG.schoolLifeTitle)}</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{withDefault(website.schoolLifeContent, DEFAULT_WEBSITE_CONFIG.schoolLifeContent)}</p>
          </div>
        </section>
      )}

      {/* ═══ ACTUALITÉS ═══ */}
      {newsArticles.length > 0 && (
        <section id="actualites" className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Actualités</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {newsArticles.slice(0, 3).map((article: any) => (
                <motion.article key={article.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => { if (article.slug) window.location.href = `/actualites/${article.slug}`; }}>
                  {article.coverImageUrl ? (
                    <div className="h-44 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-44 overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}30, ${GOLD}20)` }}>
                      <FileText className="w-10 h-10 text-white/30" />
                    </div>
                  )}
                  <div className="p-5">
                    {article.category && <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2" style={{ background: `${NAVY}15`, color: NAVY }}>{article.category}</span>}
                    <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2">{article.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{article.excerpt || article.content}</p>
                    {article.publishedAt && <p className="text-xs text-slate-400">{new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ AGENDA ═══ */}
      {events.length > 0 && (
        <section id="agenda" className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Agenda</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="space-y-3">
              {events.slice(0, 5).map((event: any) => (
                <div key={event.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:shadow-sm transition-all bg-white">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}>
                    <span className="text-base font-black leading-none">{new Date(event.startDate).getDate()}</span>
                    <span className="text-[9px] uppercase leading-none mt-0.5">{new Date(event.startDate).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{event.title}</h3>
                    {event.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{event.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      {event.location && <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>}
                      <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(event.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ GALERIE ═══ */}
      {galleryItems.length > 0 && (
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Galerie</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {galleryItems.slice(0, 8).map((item: any) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY}40, ${GOLD}30)` }}>
                      <Images className="w-8 h-8 text-white/40" />
                    </div>
                  )}
                  {item.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">{item.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TÉMOIGNAGES ═══ */}
      {testimonials.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Témoignages</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.slice(0, 6).map((t: any) => (
                <div key={t.id} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex gap-1 mb-3">{Array.from({ length: t.rating || 5 }).map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}</div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4 italic">"{t.content}"</p>
                  <div className="flex items-center gap-3">
                    {t.authorPhotoUrl && <img src={t.authorPhotoUrl} alt={t.authorName} className="w-9 h-9 rounded-full object-cover" />}
                    <div><p className="text-sm font-bold text-slate-900">{t.authorName}</p>{t.authorRole && <p className="text-xs text-slate-500">{t.authorRole}</p>}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ FAQ ═══ */}
      {faqItems.length > 0 && (
        <section id="faq" className="py-16 md:py-20 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Questions fréquentes</h2>
              <p className="text-sm text-slate-500">Les réponses aux questions les plus posées par les parents</p>
              <div className="w-16 h-1 mx-auto mt-3 rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="space-y-4">
              {faqItems.map((item: any, idx: number) => (
                <details
                  key={item.id || idx}
                  className="group bg-slate-50 rounded-xl border border-slate-100 overflow-hidden hover:border-slate-200 transition"
                >
                  <summary className="flex items-center justify-between cursor-pointer p-4 sm:p-5 select-none">
                    <h3 className="text-base font-semibold text-slate-900 pr-4">{item.question}</h3>
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 group-open:rotate-45 transition-transform" style={{ background: GOLD + '20', color: NAVY }}>
                      +
                    </span>
                  </summary>
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="py-16 md:py-20 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Coordonnées */}
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Contactez-nous</h2>
              <div className="w-16 h-1 mb-6 rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Une question sur l'inscription, les programmes ou la vie scolaire ? N'hésitez pas à nous écrire — nous vous répondrons dans les meilleurs délais.
              </p>
              <div className="space-y-3">
                {withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail) && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: NAVY + '15' }}>
                      <Mail className="w-4 h-4" style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <a href={`mailto:${withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail)}`} className="text-sm font-semibold text-slate-900 hover:underline">
                        {withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail)}
                      </a>
                    </div>
                  </div>
                )}
                {withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone) && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: GOLD + '15' }}>
                      <Phone className="w-4 h-4" style={{ color: GOLD }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Téléphone</p>
                      <a href={`tel:${withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone)}`} className="text-sm font-semibold text-slate-900 hover:underline">
                        {withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone)}
                      </a>
                    </div>
                  </div>
                )}
                {withDefault(rawWebsite?.contactAddress, DEFAULT_WEBSITE_CONFIG.contactAddress) && (
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: NAVY + '15' }}>
                      <MapPin className="w-4 h-4" style={{ color: NAVY }} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Adresse</p>
                      <p className="text-sm font-semibold text-slate-900">{withDefault(rawWebsite?.contactAddress, DEFAULT_WEBSITE_CONFIG.contactAddress)}</p>
                    </div>
                  </div>
                )}
              </div>
              {website?.contactMapUrl && (
                <a
                  href={website.contactMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold hover:underline"
                  style={{ color: BLUE }}
                >
                  <MapPin className="w-4 h-4" />
                  Voir sur Google Maps
                </a>
              )}
            </div>

            {/* Formulaire */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8">
              <ContactForm tenantSlug={slug} accentColor={GOLD} primaryColor={NAVY} />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ACCÈS PORTAILS ═══ */}
      <section id="portails" className="relative py-16 md:py-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 60%, ${DARK} 100%)` }}>
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <FloatingEduParticles count={12} opacityMultiplier={1.2} variant="light" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Accédez à votre espace</h2>
          <p className="text-blue-100/70 mb-8 max-w-2xl mx-auto text-sm md:text-base">Choisissez le portail correspondant à votre profil pour vous connecter.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PORTAL_DEFS.map((portal, idx) => {
              const Icon = portal.icon;
              return (
                <button key={portal.type} onClick={() => handlePortalClick(portal.type)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/8 backdrop-blur-md border border-white/15 hover:bg-white/15 hover:border-white/30 transition-all">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: idx === 0 ? GOLD : idx === 1 ? '#34d399' : '#60a5fa' }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div><p className="text-sm font-bold text-white">{portal.title}</p><p className="text-[11px] text-blue-100/60">{portal.subtitle}</p></div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <TenantFooter
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAcronym={schoolData?.schoolAcronym || undefined}
        schoolSlogan={schoolSlogan || undefined}
        schoolAddress={withDefault(rawWebsite?.contactAddress, DEFAULT_WEBSITE_CONFIG.contactAddress) || schoolData?.address || undefined}
        schoolCity={schoolData?.city || undefined}
        schoolPhone={withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone) || schoolData?.phone || undefined}
        schoolEmail={withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail) || undefined}
        contactEmail={withDefault(rawWebsite?.contactEmail, DEFAULT_WEBSITE_CONFIG.contactEmail) || undefined}
        contactPhone={withDefault(rawWebsite?.contactPhone, DEFAULT_WEBSITE_CONFIG.contactPhone) || undefined}
        contactAddress={withDefault(rawWebsite?.contactAddress, DEFAULT_WEBSITE_CONFIG.contactAddress) || undefined}
        footerAboutText={withDefault(rawWebsite?.footerAboutText, DEFAULT_WEBSITE_CONFIG.footerAboutText) || undefined}
        footerCopyrightText={withDefault(rawWebsite?.footerCopyrightText, DEFAULT_WEBSITE_CONFIG.footerCopyrightText) || undefined}
        socialLinks={website?.socialLinks || undefined}
        navLinks={navLinks}
      />

      {website?.aiEnabled && (
        <TenantAiChatbot tenantSlug={slug} welcomeMessage={withDefault(website.aiWelcomeMessage, DEFAULT_WEBSITE_CONFIG.aiWelcomeMessage) || undefined} faqItems={faqItems} />
      )}
    </div>
  );
}
