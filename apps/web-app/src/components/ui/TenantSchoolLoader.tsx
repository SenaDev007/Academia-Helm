'use client';

/**
 * ============================================================================
 * TENANT SCHOOL LOADER — Écran de chargement personnalisé par école
 * ============================================================================
 *
 * Affiche le logo et le nom de l'école (pas Academia Helm) pendant
 * le chargement des pages sur les sous-domaines d'écoles.
 *
 * Durée minimale d'affichage : 2 secondes (comme le site principal)
 * pour éviter le flash trop rapide.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import { extractTenantSlug } from '@/lib/tenant/constants';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const MIN_DISPLAY_MS = 2000;

export default function TenantSchoolLoader() {
  const [schoolData, setSchoolData] = useState<{ name: string; logoUrl: string | null; schoolAcronym?: string | null; slogan?: string | null } | null>(null);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    // Timer pour la durée minimale d'affichage
    const timer = setTimeout(() => setMinElapsed(true), MIN_DISPLAY_MS);

    const slug = extractTenantSlug(window.location.hostname);
    if (!slug) { setMinElapsed(true); return; }

    fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSchoolData(data); })
      .catch(() => {});

    return () => clearTimeout(timer);
  }, []);

  const displayName = schoolData?.schoolAcronym || schoolData?.name || 'Établissement';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}>
      <FloatingEduParticles count={20} opacityMultiplier={2.0} variant="light" />

      <div className="relative z-10 text-center px-6">
        {/* Logo de l'école */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 -m-3 rounded-full blur-lg" style={{ background: `${GOLD}20`, animation: 'academiaPulse 3s ease-in-out infinite' }} />
            <div className="absolute inset-0 -m-1.5 rounded-full border-2 border-white/10 border-t-[#f5b335]" style={{ animation: 'academiaOrbit 1.2s linear infinite' }} />
            <div className="relative z-10 w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm overflow-hidden">
              {schoolData?.logoUrl ? (
                <img
                  src={schoolData.logoUrl}
                  alt={displayName}
                  className="w-full h-full object-contain"
                  style={{ animation: 'academiaPulse 3s ease-in-out infinite' }}
                />
              ) : (
                <span className="text-xl font-bold" style={{ color: GOLD }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Nom de l'école */}
        <h2 className="text-base font-bold text-white/90 mb-0.5">{displayName}</h2>
        {schoolData?.schoolAcronym && schoolData?.name && (
          <p className="text-xs text-blue-200/50 truncate max-w-xs mx-auto">{schoolData.name}</p>
        )}
        <p className="text-[10px] text-blue-200/40 mt-1">Chargement en cours…</p>

        {/* Dots animés */}
        <div className="flex justify-center items-center space-x-2 mt-5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.7s' }} />
          <div className="h-2 w-2 rounded-full bg-[#3F51B5] animate-bounce" style={{ animationDelay: '120ms', animationDuration: '0.7s' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] animate-bounce" style={{ animationDelay: '240ms', animationDuration: '0.7s' }} />
        </div>

        {/* Indicateur de progression (minimum 2s) */}
        {!minElapsed && (
          <div className="mt-6 w-32 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${GOLD}, ${BLUE})`,
                animation: 'loaderProgress 2s ease-in-out forwards',
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes loaderProgress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
