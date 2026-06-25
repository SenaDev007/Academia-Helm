'use client';

/**
 * ============================================================================
 * INSTITUTIONAL WEBSITE — Site institutionnel intelligent des écoles
 * ============================================================================
 *
 * Page d'accueil institutionnelle affichée sur {slug}.academiahelm.com.
 * Remplace l'ancien SchoolPortalSelector (qui n'affichait que 4 boutons).
 *
 * Sections :
 *   1. Header (logo + navigation + bouton portails)
 *   2. Hero Banner (image + titre + slogan + CTA)
 *   3. Chiffres clés
 *   4. Mot du Promoteur / Directeur
 *   5. Présentation
 *   6. Actualités (3 dernières)
 *   7. Agenda (3 prochains événements)
 *   8. Galerie (6 dernières photos)
 *   9. Témoignages
 *   10. Accès portails (4 boutons)
 *   11. Footer (contact + réseaux + copyright)
 *
 * Toutes les données proviennent du CMS Tenant (TenantWebsite + collections).
 * Si le CMS n'est pas encore configuré, fallback vers les données de branding.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Loader2, MapPin, Phone, Mail, ChevronRight, Calendar,
  Image as ImageIcon, Quote, Menu, X, ExternalLink,
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

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

interface SchoolPortalInfo {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
}

interface WebsiteData {
  website: any;
  newsArticles: any[];
  events: any[];
  galleryItems: any[];
  testimonials: any[];
  faqItems: any[];
}

interface InstitutionalWebsiteProps {
  schoolInfo?: SchoolPortalInfo | null;
  subdomain?: string | null;
}

const PORTAL_DEFS = [
  { type: 'SCHOOL' as PortalType, title: 'Portail École', subtitle: 'Direction & administration', icon: Building2, color: '#f5b335' },
  { type: 'TEACHER' as PortalType, title: 'Portail Enseignant', subtitle: 'Pédagogie & suivi', icon: GraduationCap, color: '#34d399' },
  { type: 'PARENT' as PortalType, title: 'Portail Parent / Élève', subtitle: 'Suivi & communication', icon: Users, color: '#60a5fa' },
  { type: 'PUBLIC' as PortalType, title: 'Portail Public', subtitle: 'Pré-inscription & infos', icon: Globe, color: '#c084fc' },
];

export default function InstitutionalWebsite({ schoolInfo, subdomain }: InstitutionalWebsiteProps) {
  const [schoolData, setSchoolData] = useState<SchoolPortalInfo | null>(schoolInfo || null);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [isLoading, setIsLoading] = useState(!schoolInfo);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPortals, setShowPortals] = useState(false);

  const slug = subdomain || extractTenantSlug(typeof window !== 'undefined' ? window.location.hostname : '') || schoolInfo?.slug || '';

  useEffect(() => {
    if (!schoolInfo && slug) {
      loadSchoolData();
    }
    if (slug) {
      loadWebsiteData();
    }
  }, [slug]);

  const loadSchoolData = async () => {
    try {
      const res = await fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchoolData(data);
      }
    } catch (e) {
      console.error('Error loading school data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWebsiteData = async () => {
    try {
      const res = await fetch(`/api/tenant-website/public/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWebsiteData(data);
      }
    } catch (e) {
      console.error('Error loading website data:', e);
    }
  };

  const handlePortalClick = (type: PortalType) => {
    if (type === 'PUBLIC') {
      window.location.href = `/public/pre-enrollment?school=${slug}`;
    } else {
      window.location.href = `/login?portal=${type}&tenant=${slug}&school_name=${encodeURIComponent(schoolData?.name || '')}`;
    }
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

  // Hero data
  const heroTitle = website?.heroTitle || schoolName;
  const heroSubtitle = website?.heroSubtitle || schoolSlogan || 'Excellence éducative et accompagnement personnalisé';
  const heroImage = website?.heroImageUrl;
  const heroCtaText = website?.heroCtaText || 'Pré-inscription';
  const heroCtaUrl = website?.heroCtaUrl || '/public/pre-enrollment';

  // Key figures
  const keyFigures = Array.isArray(website?.keyFigures) ? website.keyFigures : [];

  // Navigation
  const navLinks = [
    { label: 'Accueil', href: '#hero' },
    { label: 'Présentation', href: '#presentation' },
    { label: 'Actualités', href: '#actualites' },
    { label: 'Agenda', href: '#agenda' },
    { label: 'Galerie', href: '#galerie' },
    { label: 'Contact', href: '#contact' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ═══ HEADER ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo + Nom */}
            <div className="flex items-center gap-3">
              <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={40} />
              <div>
                <h1 className="text-sm md:text-base font-bold text-slate-900 leading-tight">{schoolName}</h1>
                {schoolSlogan && <p className="text-[10px] md:text-xs text-slate-500 leading-tight hidden sm:block">{schoolSlogan}</p>}
              </div>
            </div>

            {/* Navigation desktop */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPortals(true)}
                className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-all shadow-sm"
                style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
              >
                <ArrowRight size={16} /> Portails
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-700"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden border-t border-slate-100 overflow-hidden bg-white"
            >
              <div className="px-4 py-3 space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
                  >
                    {link.label}
                  </a>
                ))}
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowPortals(true); }}
                  className="block w-full text-left px-3 py-2 text-sm font-bold text-white rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  Accès portails
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ═══ HERO BANNER ═══ */}
      <section id="hero" className="relative min-h-[600px] md:min-h-[700px] flex items-center justify-center pt-16 md:pt-20 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={schoolName}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }} />
          )}
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Particules */}
        <FloatingEduParticles count={20} opacityMultiplier={1.5} variant="light" />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4">
              {heroTitle}
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              {heroSubtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => handlePortalClick('PUBLIC')}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #e09e1f)` }}
              >
                {heroCtaText} <ChevronRight size={16} />
              </button>
              <a
                href="#contact"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white border-2 border-white/30 hover:bg-white/10 transition-all"
              >
                Nous contacter
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ CHIFFRES CLÉS ═══ */}
      {keyFigures.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {keyFigures.map((fig: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="text-3xl md:text-4xl font-black mb-1" style={{ color: NAVY }}>
                    {fig.value}
                  </div>
                  <div className="text-sm text-slate-600 font-medium">{fig.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ MOT DU PROMOTEUR / DIRECTEUR ═══ */}
      {(website?.promoterIsActive || website?.directorIsActive) && (website?.promoterWord || website?.directorWord) && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8">
              {website?.promoterIsActive && website?.promoterWord && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100"
                >
                  <Quote className="h-8 w-8 mb-4" style={{ color: GOLD }} />
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Mot du Promoteur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-6">{website.promoterWord}</p>
                  <div className="flex items-center gap-3">
                    {website.promoterPhotoUrl && (
                      <img src={website.promoterPhotoUrl} alt={website.promoterName || 'Promoteur'} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{website.promoterName || 'Promoteur'}</p>
                      <p className="text-xs text-slate-500">Promoteur</p>
                    </div>
                  </div>
                </motion.div>
              )}
              {website?.directorIsActive && website?.directorWord && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100"
                >
                  <Quote className="h-8 w-8 mb-4" style={{ color: BLUE }} />
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Mot du Directeur</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-6">{website.directorWord}</p>
                  <div className="flex items-center gap-3">
                    {website.directorPhotoUrl && (
                      <img src={website.directorPhotoUrl} alt={website.directorName || 'Directeur'} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{website.directorName || 'Directeur'}</p>
                      <p className="text-xs text-slate-500">Directeur</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ PRÉSENTATION ═══ */}
      {website?.presentationIsActive && website?.presentationContent && (
        <section id="presentation" className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
                {website.presentationTitle || 'Présentation'}
              </h2>
              <div className="w-20 h-1 mx-auto rounded-full" style={{ background: `linear-gradient(90deg, ${NAVY}, ${GOLD})` }} />
            </div>
            {website.presentationImageUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
                <img src={website.presentationImageUrl} alt="Présentation" className="w-full h-64 md:h-80 object-cover" />
              </div>
            )}
            <p className="text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{website.presentationContent}</p>
          </div>
        </section>
      )}

      {/* ═══ ACTUALITÉS ═══ */}
      {websiteData?.newsArticles && websiteData.newsArticles.length > 0 && (
        <section id="actualites" className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900">Actualités</h2>
              <span className="text-sm text-slate-500">{websiteData.newsArticles.length} article(s)</span>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {websiteData.newsArticles.slice(0, 3).map((article: any) => (
                <motion.article
                  key={article.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-all"
                >
                  {article.coverImageUrl && (
                    <div className="h-48 overflow-hidden">
                      <img src={article.coverImageUrl} alt={article.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    {article.category && (
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2" style={{ background: `${NAVY}15`, color: NAVY }}>
                        {article.category}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900 mb-2 line-clamp-2">{article.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{article.excerpt || article.content}</p>
                    {article.publishedAt && (
                      <p className="text-xs text-slate-400">{new Date(article.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    )}
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ AGENDA ═══ */}
      {websiteData?.events && websiteData.events.length > 0 && (
        <section id="agenda" className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8">Agenda</h2>
            <div className="space-y-4">
              {websiteData.events.slice(0, 5).map((event: any) => (
                <div key={event.id} className="flex items-start gap-4 p-5 rounded-xl border border-slate-100 hover:shadow-sm transition-all">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}>
                    <span className="text-lg font-black leading-none">{new Date(event.startDate).getDate()}</span>
                    <span className="text-[10px] uppercase leading-none mt-0.5">{new Date(event.startDate).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{event.title}</h3>
                    {event.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{event.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      {event.location && <span className="flex items-center gap-1"><MapPin size={12} /> {event.location}</span>}
                      <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(event.startDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
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
        <section id="galerie" className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8">Galerie</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {websiteData.galleryItems.slice(0, 8).map((item: any) => (
                <div key={item.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <img src={item.imageUrl} alt={item.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  {item.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ TÉMOIGNAGES ═══ */}
      {websiteData?.testimonials && websiteData.testimonials.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-8 text-center">Témoignages</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {websiteData.testimonials.slice(0, 6).map((testimonial: any) => (
                <div key={testimonial.id} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="flex gap-1 mb-3">
                    {Array.from({ length: testimonial.rating || 5 }).map((_, i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed mb-4 italic">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    {testimonial.authorPhotoUrl && (
                      <img src={testimonial.authorPhotoUrl} alt={testimonial.authorName} className="w-10 h-10 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{testimonial.authorName}</p>
                      {testimonial.authorRole && <p className="text-xs text-slate-500">{testimonial.authorRole}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ ACCÈS PORTAILS ═══ */}
      <section className="py-16 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
        <FloatingEduParticles count={15} opacityMultiplier={1.5} variant="light" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Accédez à votre espace</h2>
          <p className="text-white/70 mb-8 max-w-2xl mx-auto">Choisissez le portail correspondant à votre profil pour vous connecter.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PORTAL_DEFS.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.type}
                  onClick={() => handlePortalClick(portal.type)}
                  className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: portal.color }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{portal.title}</p>
                    <p className="text-xs text-white/60">{portal.subtitle}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer id="contact" className="bg-slate-900 text-slate-400 pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* About */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={36} />
                <h3 className="text-white font-bold">{schoolName}</h3>
              </div>
              {website?.footerAboutText ? (
                <p className="text-sm leading-relaxed">{website.footerAboutText}</p>
              ) : schoolData?.slogan ? (
                <p className="text-sm leading-relaxed">{schoolData.slogan}</p>
              ) : null}
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                {schoolData?.address && (
                  <li className="flex items-start gap-2"><MapPin size={16} className="shrink-0 mt-0.5" /> {schoolData.address}</li>
                )}
                {(website?.contactPhone || schoolData?.phone) && (
                  <li className="flex items-center gap-2"><Phone size={16} className="shrink-0" /> {website?.contactPhone || schoolData.phone}</li>
                )}
                {website?.contactEmail && (
                  <li className="flex items-center gap-2"><Mail size={16} className="shrink-0" /> {website.contactEmail}</li>
                )}
              </ul>
            </div>

            {/* Réseaux sociaux */}
            {website?.socialLinks && Object.keys(website.socialLinks).length > 0 && (
              <div>
                <h4 className="text-white font-bold mb-4">Suivez-nous</h4>
                <div className="flex gap-3">
                  {Object.entries(website.socialLinks).map(([platform, url]) => (
                    url ? (
                      <a
                        key={platform}
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                        title={platform}
                      >
                        <ExternalLink size={16} />
                      </a>
                    ) : null
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Copyright */}
          <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs">
              {website?.footerCopyrightText || `© ${new Date().getFullYear()} ${schoolName}. Tous droits réservés.`}
            </p>
            <p className="text-xs flex items-center gap-1">
              Propulsé par <span className="font-bold text-white">Academia Helm</span>
            </p>
          </div>
        </div>
      </footer>

      {/* ═══ ASSISTANT IA ═══ */}
      {website?.aiEnabled && (
        <TenantAiChatbot
          tenantSlug={slug}
          welcomeMessage={website.aiWelcomeMessage || undefined}
          faqItems={websiteData?.faqItems || []}
        />
      )}
    </div>
  );
}
