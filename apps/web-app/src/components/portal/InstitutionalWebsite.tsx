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
  Quote, Menu, X, ExternalLink,
  Building2, GraduationCap, Users, Globe, ArrowRight, Star,
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

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

interface SchoolPortalInfo {
  name: string; slug: string; logoUrl: string | null; city: string | null;
  phone: string | null; address: string | null; primaryColor: string | null;
  secondaryColor: string | null; slogan: string | null; motto: string | null;
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
  { type: 'SCHOOL' as PortalType, title: 'École', subtitle: 'Direction & administration', icon: Building2, color: GOLD },
  { type: 'TEACHER' as PortalType, title: 'Enseignant', subtitle: 'Pédagogie & suivi', icon: GraduationCap, color: '#34d399' },
  { type: 'PARENT' as PortalType, title: 'Parent / Élève', subtitle: 'Suivi & communication', icon: Users, color: '#60a5fa' },
  { type: 'PUBLIC' as PortalType, title: 'Public', subtitle: 'Pré-inscription & infos', icon: Globe, color: '#c084fc' },
];

export default function InstitutionalWebsite({ schoolInfo, subdomain }: Props) {
  const [schoolData, setSchoolData] = useState<SchoolPortalInfo | null>(schoolInfo || null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
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
      if (res.ok) setSchoolData(await res.json());
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

  const website = websiteData?.website;
  const schoolName = schoolData?.name || 'Établissement Scolaire';
  const schoolLogo = schoolData?.logoUrl;
  const schoolSlogan = schoolData?.slogan || website?.heroSubtitle || '';

  const heroTitle = website?.heroTitle || schoolName;
  const heroSubtitle = website?.heroSubtitle || schoolSlogan || 'Excellence éducative et accompagnement personnalisé';
  const heroImage = website?.heroImageUrl;
  const heroCtaText = website?.heroCtaText || 'Pré-inscription';
  const keyFigures = Array.isArray(website?.keyFigures) ? website.keyFigures : [];
  const navLinks = [
    { label: 'Accueil', href: '#hero' },
    { label: 'Présentation', href: '#presentation' },
    { label: 'Actualités', href: '#actualites' },
    { label: 'Agenda', href: '#agenda' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <TenantStructuredData
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAddress={website?.contactAddress || schoolData?.address || undefined}
        schoolPhone={website?.contactPhone || schoolData?.phone || undefined}
        schoolEmail={website?.contactEmail || undefined}
        schoolWebsite={typeof window !== 'undefined' ? window.location.origin : ''}
        schoolSlogan={schoolSlogan || undefined}
        schoolCity={schoolData?.city || undefined}
        socialLinks={website?.socialLinks || undefined}
      />

      {/* ═══ HEADER ═══ */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)`
            : 'rgba(11, 47, 115, 0.95)',
          backdropFilter: 'blur(12px)',
          boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
        }}
      >
        {/* Ligne dorée supérieure */}
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo + Nom */}
            <a href="#hero" className="flex items-center gap-3 shrink-0">
              <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={36} />
              <div className="hidden sm:block">
                <h1 className="text-sm md:text-base font-bold text-white leading-tight">{schoolName}</h1>
                {schoolSlogan && <p className="text-[10px] text-amber-300/80 leading-tight">{schoolSlogan}</p>}
              </div>
            </a>

            {/* Navigation desktop */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href}
                  className="px-3 py-2 text-sm font-medium text-blue-100/80 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={() => handlePortalClick('PUBLIC')}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#0b2f73] bg-[#f5b335] hover:bg-[#e09e1f] transition-all shadow-sm hover:shadow-md">
                {heroCtaText} <ArrowRight size={14} />
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-white">
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden border-t border-white/10">
              <div className="px-4 py-3 space-y-1">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-blue-100/80 hover:bg-white/10 rounded-lg">
                    {link.label}
                  </a>
                ))}
                <button onClick={() => { setMobileMenuOpen(false); handlePortalClick('PUBLIC'); }}
                  className="block w-full text-left px-3 py-2 text-sm font-bold text-[#0b2f73] bg-[#f5b335] rounded-lg">
                  {heroCtaText}
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ═══ HERO ═══ */}
      <section id="hero" className="relative min-h-[560px] md:min-h-[640px] flex items-center justify-center pt-14 md:pt-16 overflow-hidden">
        <div className="absolute inset-0">
          {heroImage ? (
            <Image src={heroImage} alt={schoolName} fill priority className="object-cover" sizes="100vw" />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, #091f4a 100%)` }} />
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
      {(website?.promoterIsActive && website?.promoterWord) || (website?.directorIsActive && website?.directorWord) ? (
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-6">
              {website?.promoterIsActive && website?.promoterWord && (
                <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100">
                  <Quote className="h-7 w-7 mb-3" style={{ color: GOLD }} />
                  <h3 className="text-base font-bold text-slate-900 mb-3">Mot du Promoteur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-5">{website.promoterWord}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    {website.promoterPhotoUrl && <img src={website.promoterPhotoUrl} alt={website.promoterName || ''} className="w-10 h-10 rounded-full object-cover" />}
                    <div><p className="text-sm font-bold text-slate-900">{website.promoterName || 'Promoteur'}</p><p className="text-xs text-slate-400">Promoteur</p></div>
                  </div>
                </motion.div>
              )}
              {website?.directorIsActive && website?.directorWord && (
                <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-100">
                  <Quote className="h-7 w-7 mb-3" style={{ color: BLUE }} />
                  <h3 className="text-base font-bold text-slate-900 mb-3">Mot du Directeur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-5">{website.directorWord}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    {website.directorPhotoUrl && <img src={website.directorPhotoUrl} alt={website.directorName || ''} className="w-10 h-10 rounded-full object-cover" />}
                    <div><p className="text-sm font-bold text-slate-900">{website.directorName || 'Directeur'}</p><p className="text-xs text-slate-400">Directeur</p></div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ PRÉSENTATION ═══ */}
      {website?.presentationIsActive && website?.presentationContent && (
        <section id="presentation" className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">{website.presentationTitle || 'Présentation'}</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            {website.presentationImageUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
                <img src={website.presentationImageUrl} alt="Présentation" className="w-full h-56 md:h-72 object-cover" />
              </div>
            )}
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{website.presentationContent}</p>
          </div>
        </section>
      )}

      {/* ═══ ACTUALITÉS ═══ */}
      {websiteData?.newsArticles && websiteData.newsArticles.length > 0 && (
        <section id="actualites" className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Actualités</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {websiteData.newsArticles.slice(0, 3).map((article: any) => (
                <motion.article key={article.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-lg transition-all">
                  {article.coverImageUrl && <div className="h-44 overflow-hidden"><img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" /></div>}
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
      {websiteData?.events && websiteData.events.length > 0 && (
        <section id="agenda" className="py-16 md:py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Agenda</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="space-y-3">
              {websiteData.events.slice(0, 5).map((event: any) => (
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
      {websiteData?.galleryItems && websiteData.galleryItems.length > 0 && (
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Galerie</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {websiteData.galleryItems.slice(0, 8).map((item: any) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group">
                  <img src={item.imageUrl} alt={item.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {item.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">{item.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TÉMOIGNAGES ═══ */}
      {websiteData?.testimonials && websiteData.testimonials.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">Témoignages</h2>
              <div className="w-16 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {websiteData.testimonials.slice(0, 6).map((t: any) => (
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

      {/* ═══ ACCÈS PORTAILS ═══ */}
      <section className="relative py-16 md:py-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 60%, #091f4a 100%)` }}>
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
        <FloatingEduParticles count={12} opacityMultiplier={1.2} variant="light" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Accédez à votre espace</h2>
          <p className="text-blue-100/70 mb-8 max-w-2xl mx-auto text-sm md:text-base">Choisissez le portail correspondant à votre profil pour vous connecter.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {PORTAL_DEFS.map((portal) => {
              const Icon = portal.icon;
              return (
                <button key={portal.type} onClick={() => handlePortalClick(portal.type)}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-white/8 backdrop-blur-md border border-white/15 hover:bg-white/15 hover:border-white/30 transition-all">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: portal.color }}>
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
      <footer id="contact" className="bg-[#091f4a] text-slate-400 pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={32} />
                <h3 className="text-white font-bold text-sm">{schoolName}</h3>
              </div>
              {(website?.footerAboutText || schoolData?.slogan) && <p className="text-xs leading-relaxed">{website?.footerAboutText || schoolData?.slogan}</p>}
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-sm">Contact</h4>
              <ul className="space-y-2 text-xs">
                {(website?.contactAddress || schoolData?.address) && <li className="flex items-start gap-2"><MapPin size={14} className="shrink-0 mt-0.5" /> {website?.contactAddress || schoolData?.address}</li>}
                {(website?.contactPhone || schoolData?.phone) && <li className="flex items-center gap-2"><Phone size={14} className="shrink-0" /> {website?.contactPhone || schoolData?.phone}</li>}
                {website?.contactEmail && <li className="flex items-center gap-2"><Mail size={14} className="shrink-0" /> {website.contactEmail}</li>}
              </ul>
            </div>
            {website?.socialLinks && Object.keys(website.socialLinks).length > 0 && (
              <div>
                <h4 className="text-white font-bold mb-4 text-sm">Suivez-nous</h4>
                <div className="flex gap-3">
                  {Object.entries(website.socialLinks).map(([platform, url]) => url ? (
                    <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" title={platform}>
                      <ExternalLink size={14} />
                    </a>
                  ) : null)}
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs">{website?.footerCopyrightText || `© ${new Date().getFullYear()} ${schoolName}. Tous droits réservés.`}</p>
            <p className="text-xs flex items-center gap-1">Propulsé par <span className="font-bold text-white">Academia Helm</span></p>
          </div>
        </div>
      </footer>

      {website?.aiEnabled && (
        <TenantAiChatbot tenantSlug={slug} welcomeMessage={website.aiWelcomeMessage || undefined} faqItems={websiteData?.faqItems || []} />
      )}
    </div>
  );
}
