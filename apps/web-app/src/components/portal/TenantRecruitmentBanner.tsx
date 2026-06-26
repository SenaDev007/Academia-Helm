'use client';

/**
 * ============================================================================
 * TENANT RECRUITMENT BANNER — Bande recrutement spécifique à l'école
 * ============================================================================
 *
 * Affiche les offres d'emploi publiées par l'école (pas toutes les écoles).
 * Bande défilante horizontale avec les postes ouverts.
 *
 * Design aligné sur la RecruitmentBanner du site principal (PremiumLandingPage).
 *
 * Données : /api/hr/recruitment/jobs?tenantId=<tenantId>
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Megaphone, Briefcase } from 'lucide-react';

interface Job {
  id: string;
  title: string;
  slug: string;
  dept?: string;
  loc?: string;
  contractType?: string;
  _count?: { applications: number };
}

interface Props {
  tenantId?: string;
  tenantSlug?: string;
}

export default function TenantRecruitmentBanner({ tenantId, tenantSlug }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Ne pas re-fetcher si on a déjà fetché pour ce tenantId
    if (!tenantId || fetchedRef.current === tenantId) return;
    fetchedRef.current = tenantId;

    let cancelled = false;
    setIsLoading(true);

    async function fetchJobs() {
      try {
        const res = await fetch(`/api/hr/recruitment/jobs?tenantId=${tenantId}`, { cache: 'no-store' });
        if (!res.ok) { if (!cancelled) { setIsLoading(false); setHasFetched(true); } return; }
        const data = await res.json();
        if (Array.isArray(data) && !cancelled) {
          const published = data.filter((j: any) => j.status === 'PUBLIÉE');
          setJobs(published);
        }
      } catch { /* non-critical */ } finally {
        if (!cancelled) { setIsLoading(false); setHasFetched(true); }
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [tenantId]);

  // Loading state — même design que le site principal
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
          <span className="text-white/70 text-sm font-medium">Chargement des offres…</span>
        </div>
      </div>
    );
  }

  // Pas de jobs → ne rien afficher
  if (hasFetched && jobs.length === 0) return null;

  // Pas encore fetché (tenantId pas encore résolu) → ne rien afficher
  if (!hasFetched) return null;

  const totalJobs = jobs.length;

  const jobLinks = tenantSlug
    ? jobs.map(j => `/jobs/${tenantSlug}/${j.slug}`)
    : jobs.map(j => `/jobs?job=${j.slug}`);

  const bannerItems = jobs.map((job, i) => (
    <Link
      key={job.id}
      href={jobLinks[i]}
      className="flex items-center gap-2.5 bg-white/90 hover:bg-white rounded-full px-4 py-1.5 transition-all duration-200 border border-[#f5b335]/30 hover:border-[#f5b335]/70 hover:scale-[1.03] shadow-sm hover:shadow-md shrink-0 group"
    >
      <Briefcase className="h-3.5 w-3.5 text-[#0b2f73] shrink-0" />
      <span className="text-[#0b2f73] text-sm font-semibold whitespace-nowrap group-hover:underline">
        {job.title}
      </span>
      {job.loc && (
        <span className="text-[#1d4fa5]/60 text-xs whitespace-nowrap hidden sm:inline">
          • {job.loc}
        </span>
      )}
      {job.contractType && (
        <span className="inline-flex items-center justify-center bg-[#0b2f73] text-[#f5b335] text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1.5">
          {job.contractType}
        </span>
      )}
      <span className="text-[#0b2f73]/70 text-xs whitespace-nowrap">
        offre
      </span>
    </Link>
  ));

  const duplicatedItems = [...bannerItems, ...bannerItems];

  return (
    <div className="overflow-hidden relative shadow-lg select-none z-[40]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => { setTimeout(() => setIsPaused(false), 2500); }}>
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
      <div className="absolute inset-0 opacity-[0.04] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]" />
      <div className="absolute inset-0 opacity-10 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          style={{ animation: 'bannerShimmer 4s ease-in-out infinite' }} />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />

      {/* Desktop header (fixed left) */}
      <div className="hidden md:flex absolute left-0 top-0 bottom-0 z-20 items-center bg-gradient-to-r from-[#0b2f73] via-[#0b2f73] to-transparent pr-8 pl-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f5b335] shadow-md">
            <Megaphone className="h-4 w-4 text-[#0b2f73]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[#f5b335] text-[10px] font-bold uppercase tracking-wider leading-tight">Recrutement</span>
            <span className="text-white text-xs font-semibold leading-tight">
              {totalJobs} offre{totalJobs > 1 ? 's' : ''} ouverte{totalJobs > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile summary */}
      <div className="flex md:hidden absolute left-2 top-0 bottom-0 z-20 items-center">
        <div className="flex items-center gap-1.5 bg-[#f5b335] rounded-full px-2 py-0.5">
          <Megaphone className="h-3 w-3 text-[#0b2f73]" />
          <span className="text-[#0b2f73] text-[10px] font-bold">{totalJobs}</span>
        </div>
      </div>

      {/* Scrolling zone */}
      <div className="flex items-center gap-4 relative z-10 py-2.5 pl-16 md:pl-52"
        style={{
          animation: 'bannerScroll 60s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
          width: 'max-content',
        }}>
        {duplicatedItems.map((item, i) => (
          <div key={`item-${i}`} className="flex items-center gap-4 shrink-0">
            {item}
            <span className="text-[#f5b335]/40 text-lg">|</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bannerShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
        @keyframes bannerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}
