'use client';

/**
 * ============================================================================
 * TENANT RECRUITMENT BANNER — Bande recrutement spécifique à l'école
 * ============================================================================
 *
 * Affiche les offres d'emploi publiées par l'école (pas toutes les écoles).
 * Bande défilante horizontale avec les postes ouverts.
 *
 * Données : /api/hr/recruitment/jobs?tenantId=<tenantId>&status=PUBLIÉE
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Megaphone, MapPin, Briefcase } from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchJobs() {
      try {
        const res = await fetch(`/api/hr/recruitment/jobs?tenantId=${tenantId}`, { cache: 'no-store' });
        if (!res.ok) { setIsLoading(false); return; }
        const data = await res.json();
        if (Array.isArray(data) && !cancelled) {
          const published = data.filter((j: any) => j.status === 'PUBLIÉE');
          setJobs(published);
        }
      } catch { /* non-critical */ } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchJobs();
    return () => { cancelled = true; };
  }, [tenantId]);

  if (isLoading) {
    return (
      <div className="overflow-hidden relative shadow-sm select-none">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
        <div className="flex items-center gap-3 relative z-10 py-2 px-4">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f5b335] shadow-sm">
            <Megaphone className="h-3 w-3 text-[#0b2f73]" />
          </div>
          <span className="text-white/60 text-xs font-medium">Chargement des offres…</span>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) return null;

  const jobLinks = tenantSlug
    ? jobs.map(j => `/jobs/${tenantSlug}/${j.slug}`)
    : jobs.map(j => `/jobs?job=${j.slug}`);

  const bannerItems = jobs.map((job, i) => (
    <Link
      key={job.id}
      href={jobLinks[i]}
      className="flex items-center gap-2 bg-white/90 hover:bg-white rounded-full px-3 py-1.5 transition-all duration-200 border border-[#f5b335]/30 hover:border-[#f5b335]/70 hover:scale-[1.02] shadow-sm hover:shadow-md shrink-0 group"
    >
      <Briefcase className="h-3 w-3 text-[#0b2f73] shrink-0" />
      <span className="text-[#0b2f73] text-xs font-semibold whitespace-nowrap group-hover:underline">{job.title}</span>
      {job.loc && <span className="text-[#1d4fa5]/50 text-[10px] whitespace-nowrap hidden sm:inline">• {job.loc}</span>}
      {job.contractType && (
        <span className="inline-flex items-center justify-center bg-[#0b2f73] text-[#f5b335] text-[9px] font-bold rounded-full px-1.5 py-0.5">
          {job.contractType}
        </span>
      )}
    </Link>
  ));

  const duplicatedItems = [...bannerItems, ...bannerItems];

  return (
    <div className="overflow-hidden relative shadow-sm select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => { setTimeout(() => setIsPaused(false), 2500); }}>
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b2f73] via-[#103e91] to-[#1d4fa5]" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#f5b335] to-transparent" />

      {/* Header fixe à gauche */}
      <div className="hidden sm:flex absolute left-0 top-0 bottom-0 z-20 items-center bg-gradient-to-r from-[#0b2f73] via-[#0b2f73] to-transparent pr-6 pl-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#f5b335] shadow-sm">
            <Megaphone className="h-3.5 w-3.5 text-[#0b2f73]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[#f5b335] text-[9px] font-bold uppercase tracking-wider leading-tight">Recrutement</span>
            <span className="text-white text-[11px] font-semibold leading-tight">
              {jobs.length} poste{jobs.length > 1 ? 's' : ''} ouvert{jobs.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex sm:hidden absolute left-2 top-0 bottom-0 z-20 items-center">
        <div className="flex items-center gap-1 bg-[#f5b335] rounded-full px-2 py-0.5">
          <Megaphone className="h-3 w-3 text-[#0b2f73]" />
          <span className="text-[#0b2f73] text-[10px] font-bold">{jobs.length}</span>
        </div>
      </div>

      {/* Zone défilante */}
      <div className="flex items-center gap-3 relative z-10 py-2 pl-24 sm:pl-52"
        style={{
          animation: 'bannerScroll 40s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
          width: 'max-content',
        }}>
        {duplicatedItems.map((item, i) => (
          <div key={`item-${i}`} className="flex items-center gap-3 shrink-0">
            {item}
            <span className="text-[#f5b335]/30 text-sm">|</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes bannerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
}
