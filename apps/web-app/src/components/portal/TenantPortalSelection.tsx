'use client';

/**
 * ============================================================================
 * TENANT PORTAL SELECTION — Page portail du tenant (4 portails)
 * ============================================================================
 *
 * Adaptation tenant-aware de la page /portal (academiahelm.com/portal) :
 *   - Reprend le même design (carte du Bénin + grille de portails)
 *   - Pas de recherche d'école (tenant déjà connu via le sous-domaine)
 *   - 4 boutons : École (Direction, admin), Enseignant (Pédagogie),
 *     Parent/Élève (Suivi), Public (Pré-inscription)
 *   - Chaque bouton renvoie vers /login?portal=SCHOOL|TEACHER|PARENT|PUBLIC
 *     &tenant=<slug>&school_name=<name>
 *
 * Palette Helm : Navy #0B1E4D, Blue #1E4FA3, Gold #F5B700
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Building2, GraduationCap, Users, Globe, ArrowRight, Loader2, MapPin, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import BeninMap from '@/components/portal/BeninMap';
import TenantHeader from '@/components/portal/TenantHeader';
import TenantFooter from '@/components/ui/footer-column';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import LogoCircle from '@/components/ui/LogoCircle';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { resolveTenantColors } from '@/lib/tenant/use-tenant-colors';
import { type DepartmentData } from '@/data/benin-departments';
import { BRAND } from '@/lib/brand';

type PortalType = 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC';

interface SchoolInfo {
  name: string;
  schoolAcronym?: string | null;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  slogan: string | null;
  tenantId?: string | null;
  slug?: string;
}

const PORTAL_DEFINITIONS: Array<{
  type: PortalType;
  title: string;
  description: string;
  Icon: typeof Building2;
}> = [
  {
    type: 'SCHOOL',
    title: 'École',
    description: 'Direction & administration',
    Icon: Building2,
  },
  {
    type: 'TEACHER',
    title: 'Enseignant',
    description: 'Pédagogie & suivi',
    Icon: GraduationCap,
  },
  {
    type: 'PARENT',
    title: 'Parent / Élève',
    description: 'Suivi & communication',
    Icon: Users,
  },
  {
    type: 'PUBLIC',
    title: 'Public',
    description: 'Pré-inscription en ligne',
    Icon: Globe,
  },
];

const NAVY = '#0B1E4D';
const BLUE = '#1E4FA3';
const GOLD = '#F5B700';
const DARK = '#091f4a';

export default function TenantPortalSelection({
  schoolInfo,
  subdomain,
}: {
  schoolInfo: SchoolInfo | null;
  subdomain: string | null;
}) {
  const [slug, setSlug] = useState<string>(subdomain || '');
  const [school, setSchool] = useState<SchoolInfo | null>(schoolInfo);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentData | null>(null);
  const [mapFilter, setMapFilter] = useState<'all' | 'public' | 'private'>('all');
  const [loading, setLoading] = useState(!schoolInfo);

  useEffect(() => {
    if (subdomain && schoolInfo) {
      setSlug(subdomain);
      setSchool(schoolInfo);
      setLoading(false);
      return;
    }
    const s = extractTenantSlug(window.location.hostname);
    if (s) {
      setSlug(s);
      loadSchool(s);
    } else {
      setLoading(false);
    }
  }, [subdomain, schoolInfo]);

  const loadSchool = async (s: string) => {
    try {
      const res = await fetch(`/api/public/schools/by-subdomain/${s}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchool(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const colors = resolveTenantColors(null);
  const schoolName = school?.name || 'Établissement';
  const schoolAcronym = school?.schoolAcronym || null;
  const schoolLogo = school?.logoUrl;
  const schoolSlogan = school?.slogan || '';
  const displayName = schoolAcronym || schoolName;

  const navLinks = [
    { label: 'Accueil', href: '/' },
    { label: 'À propos', href: '/#a-propos' },
    { label: 'Programmes', href: '/#programmes' },
    { label: 'Admissions', href: '/#admissions' },
    { label: 'Vie scolaire', href: '/#vie-scolaire' },
    { label: 'Actualités', href: '/#actualites' },
    { label: 'Contact', href: '/#contact' },
  ];

  const handlePortalClick = (type: PortalType) => {
    if (type === 'PUBLIC') {
      window.location.href = `/public/pre-enrollment?school=${slug}`;
      return;
    }
    const params = new URLSearchParams({
      portal: type.toLowerCase(),
      tenant: slug,
      school_name: schoolName,
    });
    window.location.href = `/login?${params.toString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ═══ NAVBAR (CDC 3.1) — pas de bouton Portail car on est DÉJÀ sur la page portail ═══ */}
      <TenantHeader
        schoolName={schoolName}
        schoolAcronym={schoolAcronym}
        schoolLogo={schoolLogo || undefined}
        schoolSlogan={schoolSlogan || undefined}
        colors={colors}
        activeNav=""
        transparentAtTop={false}
        navLinks={navLinks}
        portalHref={undefined}
      />

      <main className="flex-1 pt-16 md:pt-20 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* ── En-tête : nom école + baseline ── */}
          <div className="text-center mb-6 md:mb-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full"
              style={{ background: `${NAVY}10`, border: `1px solid ${NAVY}20` }}
            >
              <Shield className="w-3.5 h-3.5" style={{ color: NAVY }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                Portail officiel — {displayName}
              </span>
            </motion.div>
            <h1
              className="text-2xl md:text-4xl font-extrabold tracking-tight mb-2"
              style={{ color: NAVY }}
            >
              Accéder à votre espace
            </h1>
            <p className="text-sm md:text-base text-slate-500 max-w-xl mx-auto">
              {schoolSlogan || `Sélectionnez le portail correspondant à votre profil pour vous connecter à l'espace ${displayName}.`}
            </p>
            {/* Liseré or signature */}
            <div className="flex items-center justify-center gap-3 mt-4" aria-hidden>
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-amber-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-amber-400" />
            </div>
          </div>

          {/* ── Layout : BeninMap + grille portails ── */}
          <div className="flex w-full flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
            {/* Colonne gauche : Carte du Bénin */}
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="w-full lg:w-[64%]"
            >
              <div
                className="rounded-xl border bg-white p-3 shadow-lg sm:p-4"
                style={{ borderColor: `${NAVY}18` }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3
                    className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    style={{ color: NAVY }}
                  >
                    <MapPin className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    Carte du Bénin — Réseau {displayName}
                  </h3>
                  <div
                    className="flex overflow-hidden rounded-lg border text-xs sm:text-[10px]"
                    style={{ borderColor: `${NAVY}20` }}
                  >
                    {(['all', 'public', 'private'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setMapFilter(f)}
                        className="min-h-[44px] px-3 py-2 sm:px-2.5 sm:py-1 font-medium transition-colors"
                        style={
                          mapFilter === f
                            ? { background: `linear-gradient(135deg, ${NAVY}, ${BLUE})`, color: '#fff' }
                            : { color: NAVY }
                        }
                      >
                        {f === 'all' ? 'Tous' : f === 'public' ? 'Public' : 'Privé'}
                      </button>
                    ))}
                  </div>
                </div>
                <BeninMap
                  onDepartmentSelect={setSelectedDepartment}
                  selectedDepartment={selectedDepartment}
                  filter={mapFilter}
                />
                {school?.city && (
                  <div
                    className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: `${NAVY}06`, color: NAVY }}
                  >
                    <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
                    <span>
                      <strong>{displayName}</strong> est situé(e) à{' '}
                      <strong>{school.city}</strong>
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Colonne droite : 4 portails tenant */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
              className="w-full lg:w-[36%] flex flex-col gap-3"
            >
              {/* Carte école (identité tenant) */}
              <div
                className="rounded-xl border bg-white p-4 shadow-sm"
                style={{ borderColor: `${NAVY}15` }}
              >
                <div className="flex items-center gap-3">
                  <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={44} />
                  <div className="min-w-0 flex-1">
                    <h2
                      className="text-base font-bold leading-tight truncate"
                      style={{ color: NAVY }}
                    >
                      {displayName}
                    </h2>
                    {schoolAcronym && schoolName !== schoolAcronym && (
                      <p className="text-[11px] text-slate-500 truncate">{schoolName}</p>
                    )}
                    {schoolSlogan && !schoolAcronym && (
                      <p className="text-[11px] text-slate-500 truncate">{schoolSlogan}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Titre compact */}
              <div className="text-center lg:text-left">
                <h3 className="text-base font-extrabold tracking-tight" style={{ color: NAVY }}>
                  Choisissez votre portail
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Redirection vers la page de connexion sécurisée.
                </p>
              </div>

              {/* Grille 4 portails — 1 colonne */}
              <div className="flex flex-col gap-2.5">
                {PORTAL_DEFINITIONS.map((portal, index) => {
                  const Icon = portal.Icon;
                  return (
                    <motion.button
                      key={portal.type}
                      type="button"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + index * 0.05, duration: 0.4 }}
                      whileHover={{ x: 3, boxShadow: `0 6px 16px ${NAVY}18` }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePortalClick(portal.type)}
                      className="group relative flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left outline-none transition-all min-h-[44px]"
                      style={{
                        borderColor: `${NAVY}15`,
                        background: `linear-gradient(135deg, ${NAVY}04, ${BLUE}02)`,
                        boxShadow: `0 1px 2px ${NAVY}06`,
                      }}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: `linear-gradient(135deg, ${NAVY}14, ${BLUE}0c)`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: NAVY }} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-bold leading-tight"
                          style={{ color: NAVY }}
                        >
                          {portal.title}
                        </h4>
                        <p className="mt-0.5 text-xs leading-snug text-slate-500">
                          {portal.description}
                        </p>
                      </div>

                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-amber-500 group-hover:translate-x-0.5 transition-transform"
                      />
                    </motion.button>
                  );
                })}
              </div>

              {/* Bouton retour site institutionnel */}
              <Link
                href="/"
                className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 min-h-[44px] pt-1"
              >
                <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                <span>Retour au site institutionnel</span>
              </Link>

              {/* Footer sécurité compact */}
              <div
                className="mt-auto flex items-center justify-center gap-1.5 rounded-lg border bg-white/80 px-3 py-2 text-[11px] text-slate-500 backdrop-blur-sm lg:justify-start"
                style={{ borderColor: `${NAVY}10` }}
              >
                <Shield className="h-3 w-3" style={{ color: NAVY }} />
                <span>Connexion sécurisée — {displayName}</span>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* ═══ FOOTER (CDC 3.10) ═══ */}
      <TenantFooter
        schoolName={schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAcronym={schoolAcronym || undefined}
        schoolSlogan={schoolSlogan || undefined}
        schoolAddress={school?.address || undefined}
        schoolCity={school?.city || undefined}
        schoolPhone={school?.phone || undefined}
        socialLinks={undefined}
        navLinks={navLinks}
        tenantSlug={slug}
      />
    </div>
  );
}
