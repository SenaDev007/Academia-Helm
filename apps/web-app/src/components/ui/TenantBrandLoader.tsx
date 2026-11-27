'use client';

/**
 * ============================================================================
 * TENANT BRAND LOADER — Écran de chargement aux COULEURS + au LOGO de l'école
 * ============================================================================
 *
 * ⭐ 2026-11-27 — Demande promoteur : « lorsque on est sur la page depuis le
 *    site institutionnel, que la page de loading également soit adaptée en
 *    fonction de la palette de couleurs de l'école et que ça soit le logo de
 *    l'école qui soit récupéré sur la page de loading. »
 *
 * Résolution (instantanée quand c'est possible, sinon arrière-plan) :
 *   1. sessionStorage « academia_portal_school » — posé par le site
 *      institutionnel / la page de sélection du portail AVANT la redirection
 *      vers /login : logo + palette disponibles dès le premier paint (zéro
 *      flash, zéro fetch), même sur le domaine principal.
 *   2. Sinon : sous-domaine courant ou ?tenant= de l'URL → fetch BFF
 *      (/api/public/schools/by-subdomain + /api/public/brand-theme) — le
 *      rendu Helm par défaut s'affiche le temps de la résolution, puis
 *      bascule aux couleurs de l'école.
 *   3. Aucune école / aucune palette → charte Academia Helm (rendu inchangé).
 *
 * Utilisé par /school-portal/loading.tsx et /(auth)/login/loading.tsx —
 * les deux écrans du flux site institutionnel → portail.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import { extractTenantSlug } from '@/lib/tenant/constants';
import {
  readPortalSchoolBrand,
  fetchPublicBrandColors,
} from '@/lib/tenant/public-brand';
import type { TenantColors } from '@/lib/tenant/tenant-colors-core';
import FloatingEduParticles from './FloatingEduParticles';

/** Charte Helm — repli quand l'école n'a pas de palette. */
const HELM_LOADER: TenantColors = {
  primary: '#1A237E',
  secondary: '#3F51B5',
  accent: '#f5b335',
  dark: '#10154a',
};

interface ResolvedBrand {
  name: string | null;
  logoUrl: string | null;
  colors: TenantColors;
}

export default function TenantBrandLoader() {
  // 1er rendu : cache sessionStorage s'il existe (instantané, zéro flash).
  const [brand, setBrand] = useState<ResolvedBrand | null>(() => {
    if (typeof window === 'undefined') return null;
    const cached = readPortalSchoolBrand();
    if (cached && (cached.logoUrl || cached.brandColors)) {
      return {
        name: cached.name || null,
        logoUrl: cached.logoUrl || null,
        colors: cached.brandColors || HELM_LOADER,
      };
    }
    return null;
  });

  useEffect(() => {
    // Le cache a déjà tout → rien à résoudre.
    if (brand?.logoUrl && brand?.colors !== HELM_LOADER) return;

    let cancelled = false;
    (async () => {
      // Slug : ?tenant= de l'URL, sinon sous-domaine courant.
      let slug: string | null = null;
      try {
        slug = new URLSearchParams(window.location.search).get('tenant');
      } catch {
        /* ignore */
      }
      if (!slug) slug = extractTenantSlug(window.location.hostname);

      if (!slug) return;

      const [colors, schoolRes] = await Promise.all([
        fetchPublicBrandColors(slug),
        fetch(`/api/public/schools/by-subdomain/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);

      if (cancelled) return;
      const school = schoolRes && typeof schoolRes === 'object' ? schoolRes : null;
      if (colors || school?.logoUrl || school?.name) {
        setBrand({
          name: school?.name || null,
          logoUrl: school?.logoUrl || null,
          colors: colors || HELM_LOADER,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const colors = brand?.colors || HELM_LOADER;
  const logoUrl = brand?.logoUrl || null;
  const displayName = brand?.name || BRAND.name;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: `linear-gradient(160deg, ${colors.primary} 0%, ${colors.dark} 100%)`,
      }}
    >
      {/* Particules éducatives flottantes (même ambiance que l'App) */}
      <FloatingEduParticles count={26} opacityMultiplier={2.0} />

      {/* Anneau de chargement — accent de l'école */}
      <div className="relative academia-loader-container" style={{ zIndex: 10 }}>
        <div
          className="academia-loader-ring"
          style={{ borderColor: `${colors.accent}55`, borderTopColor: colors.accent }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              width={56}
              height={56}
              className="rounded-full object-cover bg-white academia-loader-logo-circle"
              priority
            />
          ) : (
            <Image
              src={BRAND.logoPath}
              alt={BRAND.name}
              width={56}
              height={56}
              className="rounded-full academia-loader-logo-circle"
              priority
            />
          )}
        </div>
      </div>

      {/* Nom de l'école (ou Academia Helm par défaut) */}
      <div className="mt-7 text-center academia-loader-text relative" style={{ zIndex: 10 }}>
        <h1 className="text-2xl font-bold text-white tracking-tight">{displayName}</h1>
        <p
          className="text-[10px] tracking-[0.25em] uppercase font-medium mt-1"
          style={{ color: `${colors.accent}dd` }}
        >
          Chargement
        </p>
      </div>

      {/* Barre indéterminée — dégradé secondary → accent de l'école */}
      <div className="mt-6 w-56 relative overflow-hidden rounded-full" style={{ zIndex: 10 }}>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="academia-loader-bar h-full w-1/3 rounded-full" style={{ background: `linear-gradient(90deg, ${colors.secondary}, ${colors.accent})` }} />
        </div>
      </div>

      {/* Points animés */}
      <div className="flex items-center space-x-2.5 mt-6 relative" style={{ zIndex: 10 }}>
        <div className="h-1.5 w-1.5 rounded-full academia-loader-dot" style={{ background: `${colors.secondary}b3`, animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full academia-loader-dot" style={{ background: colors.secondary, animationDelay: '120ms' }} />
        <div className="h-1.5 w-1.5 rounded-full academia-loader-dot" style={{ background: colors.accent, animationDelay: '240ms' }} />
      </div>
    </div>
  );
}
