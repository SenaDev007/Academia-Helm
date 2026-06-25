'use client';

/**
 * ============================================================================
 * TENANT SCHOOL LOADER — Écran de chargement personnalisé par école
 * ============================================================================
 *
 * Reproduit exactement le design de AcademiaLoader (fullscreen mode) mais
 * avec le logo et le nom de l'école tenante au lieu d'Academia Helm.
 *
 * Le logo et le nom sont récupérés côté client via /api/public/schools/by-subdomain.
 * Pendant que les données chargent, un skeleton est affiché.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Image from 'next/image';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { BRAND } from '@/lib/brand';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const ROYAL_BLUE = '#1A237E';

export default function TenantSchoolLoader() {
  const [schoolData, setSchoolData] = useState<{ name: string; logoUrl: string | null; schoolAcronym?: string | null } | null>(null);

  useEffect(() => {
    const slug = extractTenantSlug(window.location.hostname);
    if (!slug) return;

    fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSchoolData(data); })
      .catch(() => {});
  }, []);

  const displayName = schoolData?.schoolAcronym || schoolData?.name || '';
  const logoUrl = schoolData?.logoUrl || null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: ROYAL_BLUE }}>
      {/* Particules éducatives */}
      <FloatingEduParticles count={30} opacityMultiplier={2.0} variant="light" />

      {/* Ambiance subtile */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-10 w-48 h-48 bg-[#f5b335]/5 rounded-full blur-[90px]" style={{ animation: 'academiaPulse 6s ease-in-out infinite' }} />
        <div className="absolute -bottom-24 -right-12 w-56 h-56 bg-[#3F51B5]/8 rounded-full blur-[100px]" style={{ animation: 'academiaPulse 8s ease-in-out infinite reverse' }} />
      </div>

      <div className="text-center relative z-10 px-6">
        {/* Logo circulaire avec anneaux */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            {/* Halo */}
            <div className="absolute inset-0 -m-4 rounded-full bg-[#f5b335]/6 blur-lg" style={{ animation: 'academiaPulse 3s ease-in-out infinite' }} />
            {/* Anneau intérieur */}
            <div className="absolute inset-0 -m-2 rounded-full border-2 border-white/10 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            {/* Conteneur logo */}
            <div className="relative z-10 w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName || 'École'}
                  className="w-full h-full object-cover"
                  style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
                />
              ) : (
                <div className="w-5 h-5 border-2 border-white/30 border-t-[#f5b335] rounded-full animate-spin" />
              )}
            </div>
          </div>
        </div>

        {/* Nom de l'école */}
        {displayName ? (
          <h2 className="text-base font-medium text-white/90 mb-0.5">
            {displayName}
          </h2>
        ) : (
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse mx-auto mb-1" />
        )}
        {schoolData?.schoolAcronym && schoolData?.name && (
          <p className="text-xs text-blue-200/45 truncate max-w-xs mx-auto">
            {schoolData.name}
          </p>
        )}
        <p className="text-xs text-blue-200/45 mt-1">Chargement en cours…</p>

        {/* Barre de progression */}
        <div className="mt-6">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden w-48 mx-auto">
            <div
              className="h-full rounded-full"
              style={{
                width: '100%',
                background: 'linear-gradient(90deg, #3F51B5, #f5b335)',
                animation: 'loaderBar 2s ease-in-out infinite',
              }}
            />
          </div>
        </div>

        {/* Dots animés */}
        <div className="flex justify-center items-center space-x-2 mt-6">
          <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.7s' }} />
          <div className="h-2 w-2 rounded-full bg-[#3F51B5] animate-bounce" style={{ animationDelay: '120ms', animationDuration: '0.7s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] animate-bounce" style={{ animationDelay: '240ms', animationDuration: '0.7s' }} />
        </div>
      </div>

      <style>{`
        @keyframes loaderBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
