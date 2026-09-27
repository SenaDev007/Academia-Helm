/**
 * Landing Page Publique d'un Patronat — /patronat-portal
 * ============================================================================
 *
 * Page d'accueil publique propre à chaque patronat, servie sur SON
 * sous-domaine dédié (pattern Helm /school-portal pour les écoles) :
 *
 *   patronatnational.academiahelm.com       → patronat national
 *   patronat{département}.academiahelm.com  → patronat départemental
 *   (ex : patronatatlantique.academiahelm.com)
 *
 * Résolution (pattern school-portal — côté serveur) :
 *   1. Sous-domaine extrait du header Host (ou x-forwarded-host) ;
 *   2. GET /federis/public/patronat-info/{subdomain} (backend NestJS) ;
 *   3. 404 → page « espace introuvable » ; SUCCESS → landing personnalisée.
 *
 * Le middleware réécrit :
 *   {subdomain}.academiahelm.com/  → /patronat-portal (cette page)
 *   {subdomain}.academiahelm.com/login → /federis/login (connexion Federis)
 *   {subdomain}.academiahelm.com/xxx   → /federis/xxx (application)
 */

import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Award,
  Building2,
  CalendarCheck,
  GraduationCap,
  Landmark,
  LogIn,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublicPatronatInfo {
  found: boolean;
  tenantType: string;
  patronat: {
    id: string;
    name: string;
    abbreviation?: string | null;
    orgLevel: string | null;
    scope?: string | null;
    territoryName?: string | null;
    levelLabel?: string | null;
    parentName?: string | null;
    country: { id: string; code: string; name: string } | null;
    subscriptionStatus: string;
    subscriptionPlan: string;
  };
}

/** Extrait le sous-domaine patronat de la requête (pattern school-portal). */
async function extractPatronatSubdomain(): Promise<string | null> {
  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');
    if (parts.length >= 3 && !isReservedSubdomain(parts[0]) && parts[0].startsWith('patronat')) {
      return parts[0];
    }
  } catch {
    // headers() indisponible (contexte imprévu)
  }
  return null;
}

async function fetchPatronatInfo(subdomain: string): Promise<PublicPatronatInfo | null> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `${apiBaseUrl}/federis/public/patronat-info/${encodeURIComponent(subdomain)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.found ? (data as PublicPatronatInfo) : null;
  } catch {
    return null;
  }
}

/**
 * Garde-fou anti-collision : une ÉCOLE dont le slug commence par « patronat »
 * (ex : patronat-les-palmiers) ne doit pas voir la landing patronat — on la
 * renvoie vers son site institutionnel (/school-portal, pattern Helm).
 */
async function isSchoolTenant(subdomain: string): Promise<boolean> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `${apiBaseUrl}/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    if (!response.ok) return false;
    const tenant = await response.json();
    return (tenant as { type?: string })?.type === 'SCHOOL';
  } catch {
    return false;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const subdomain = await extractPatronatSubdomain();
  if (!subdomain) {
    return { title: 'Academia Federis — Espace patronat' };
  }
  const info = await fetchPatronatInfo(subdomain);
  const name = info?.patronat.name ?? 'Patronat';
  const level =
    info?.patronat.orgLevel === 'NATIONAL'
      ? 'Patronat national'
      : info?.patronat.territoryName
        ? `Patronat de ${info.patronat.territoryName}`
        : 'Patronat';
  return {
    title: `${name} — ${level} | Academia Federis`,
    description: `${name} : coordination des écoles membres et organisation des examens privés sur Academia Federis, par Academia Helm.`,
  };
}

export default async function PatronatPortalPage() {
  const subdomain = await extractPatronatSubdomain();

  // Accès direct au chemin sans sous-domaine patronat (academiahelm.com/patronat-portal)
  // → renvoyer vers la landing marketing Federis.
  if (!subdomain) {
    redirect('/federis');
  }

  const info = await fetchPatronatInfo(subdomain);

  // Garde-fou anti-collision : école (tenant SCHOOL) dont le sous-domaine
  // commence par « patronat » → renvoyer vers son site institutionnel.
  if (!info && (await isSchoolTenant(subdomain))) {
    redirect('/school-portal');
  }

  // ── Espace introuvable : sous-domaine inconnu ou pas un patronat ──
  if (!info) {
    return (
      <main className="min-h-screen bg-[#071528] flex items-center justify-center px-4">
        <div className="fed-glass-dark rounded-3xl p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center">
            <Landmark className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3 tracking-tight">
            Espace patronat introuvable
          </h1>
          <p className="text-sm text-blue-100/70 leading-relaxed mb-8">
            Aucun espace patronat Academia Federis ne correspond au domaine{' '}
            <span className="font-mono text-amber-300">{subdomain}</span>. Vérifiez l&apos;adresse
            saisie ou contactez le coordinateur de votre patronat.
          </p>
          <Link
            href="https://academiafederis.academiahelm.com"
            className="fed-btn-gold fed-btn-shimmer px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            Découvrir Academia Federis
          </Link>
        </div>
      </main>
    );
  }

  const patronat = info.patronat;
  const isNational = patronat.orgLevel === 'NATIONAL';
  const isPending = patronat.subscriptionStatus === 'PENDING_PAYMENT';
  const levelBadge = isNational
    ? 'Patronat national'
    : patronat.levelLabel
      ? `${patronat.levelLabel}${patronat.territoryName ? ` — ${patronat.territoryName}` : ''}`
      : patronat.territoryName
        ? `Patronat de ${patronat.territoryName}`
        : 'Patronat';

  return (
    <main className="min-h-screen bg-white">
      {/* ── Header : identité patronat + connexion ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-blue-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="fed-logo-beam w-12 h-12 flex items-center justify-center p-1 shadow-md flex-shrink-0">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={40}
                height={40}
                className="h-10 w-10 object-contain rounded-full"
                priority
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-black text-[#0b1d3a] leading-tight truncate">
                {patronat.name}
              </div>
              <div className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-widest truncate">
                Academia Federis · {levelBadge}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isPending ? (
              <Link
                href="/checkout"
                className="hidden sm:inline-flex px-4 py-2.5 rounded-full text-sm font-bold text-[#0b1d3a] border border-blue-200 hover:border-[#1e3a8a]/40 hover:bg-[#eff6ff] transition-all"
              >
                Activer notre abonnement
              </Link>
            ) : null}
            <Link
              href="/login"
              className="fed-btn-navy px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Se connecter
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#071528]">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 rounded-full bg-amber-500/8 blur-[120px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-400/30 rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-black text-amber-300 uppercase tracking-widest">
              {levelBadge}
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white mb-5 tracking-tight leading-tight">
            {patronat.name}
          </h1>
          <p className="max-w-2xl mx-auto text-blue-100/70 text-base sm:text-lg leading-relaxed mb-4">
            Espace officiel d&apos;organisation des examens privés
            {patronat.country ? `, ${patronat.country.name}` : ''} — inscriptions, centres de
            composition, surveillance et publication des résultats.
          </p>
          <p className="text-sm text-blue-100/50 mb-10">
            Plateforme Academia Federis, par Academia Helm
            {patronat.parentName && !isNational ? ` · Rattaché au ${patronat.parentName}` : ''}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isPending ? (
              <>
                <Link
                  href="/checkout"
                  className="fed-btn-gold fed-btn-shimmer px-8 py-4 text-sm font-black"
                >
                  Activer notre abonnement
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3.5 rounded-full text-sm font-bold text-blue-100 border border-blue-400/30 hover:bg-white/5 transition-all"
                >
                  Se connecter à notre espace
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="fed-btn-gold fed-btn-shimmer px-8 py-4 text-sm font-black inline-flex items-center gap-2"
              >
                <LogIn className="h-4 w-4" />
                Accéder à notre espace patronat
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Repères institutionnels ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="fed-card p-6 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#eff6ff] border border-blue-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                Niveau territorial
              </p>
              <p className="text-sm font-bold text-[#0b1d3a] leading-snug">{levelBadge}</p>
            </div>
          </div>
          <div className="fed-card p-6 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#eff6ff] border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                Écoles membres
              </p>
              <p className="text-sm font-bold text-[#0b1d3a] leading-snug">
                Coordination des établissements privés
                {patronat.territoryName && !isNational ? ` — ${patronat.territoryName}` : ''}
              </p>
            </div>
          </div>
          <div className="fed-card p-6 flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#eff6ff] border border-blue-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-5 w-5 text-[#1e3a8a]" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                Examens
              </p>
              <p className="text-sm font-bold text-[#0b1d3a] leading-snug">
                Sessions privées inter-écoles, du CEP au Baccalauréat
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ce que fait le patronat avec Federis ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0b1d3a] tracking-tight mb-3">
            Des examens organisés avec rigueur
          </h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            L&apos;espace patronat centralise toutes les étapes des sessions d&apos;examens privés :
            chaque école membre y inscrit ses candidats, le patronat compose les centres et publie
            les résultats officiels.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: CalendarCheck,
              title: 'Inscriptions & campagnes',
              text: "Chaque école membre soumet ses candidats depuis son application Academia Helm. Le patronat valide, contrôle les quotas et suit les campagnes d'examen en temps réel.",
            },
            {
              icon: Award,
              title: 'Centres, salles & convocations',
              text: "Composition automatique des centres et des salles, numéros de table anonymisés, bordereaux d'émargement officiels et convocations générés pour chaque candidat.",
            },
            {
              icon: ShieldCheck,
              title: 'Délibérations & résultats officiels',
              text: "Saisie des notes sécurisée, délibérations assistées, palmarès et relevés signés — publiés aux familles depuis l'espace patronat, avec archivage officiel.",
            },
          ].map((feature) => (
            <div key={feature.title} className="fed-card p-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] flex items-center justify-center mb-5 shadow-lg shadow-blue-900/20">
                <feature.icon className="h-6 w-6 text-amber-400" />
              </div>
              <h3 className="text-lg font-black text-[#0b1d3a] mb-3">{feature.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="bg-[#071528] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full bg-amber-500/8 blur-[120px] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-4">
            Vous représentez une école membre ?
          </h2>
          <p className="text-blue-100/70 text-sm sm:text-base mb-8 max-w-2xl mx-auto">
            Les inscriptions aux examens du patronat se font directement depuis l&apos;application
            Academia Helm de votre établissement. Contactez le bureau du patronat pour valider le
            rattachement de votre école.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="fed-btn-gold fed-btn-shimmer px-7 py-3.5 text-sm">
              Espace patronat — se connecter
            </Link>
            <a
              href={getAppBaseUrl().replace(/\/$/, '')}
              className="px-6 py-3 rounded-full text-sm font-bold text-blue-100 border border-blue-400/30 hover:bg-white/5 transition-all"
            >
              En savoir plus sur Academia Helm
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-blue-100 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo-Academia Hub.webp"
              alt="Academia Federis"
              width={32}
              height={32}
              className="h-8 w-8 object-contain rounded-full"
            />
            <p className="text-xs text-slate-500">
              <span className="font-bold text-[#0b1d3a]">{patronat.name}</span> — propulsé par
              Academia Federis, par Academia Helm
            </p>
          </div>
          <p className="text-xs text-slate-400">
            {isNational ? 'Patronat national' : levelBadge}
            {patronat.country ? ` · ${patronat.country.name}` : ''}
          </p>
        </div>
      </footer>
    </main>
  );
}
