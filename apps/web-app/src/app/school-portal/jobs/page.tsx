'use client';

/**
 * ============================================================================
 * TENANT CAREERS PAGE — Page recrutement spécifique à l'école tenante
 * ============================================================================
 *
 * Réutilise le même header et footer que le site institutionnel.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Briefcase, MapPin, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';
import TenantRecruitmentBanner from '@/components/portal/TenantRecruitmentBanner';
import TenantHeader from '@/components/portal/TenantHeader';
import TenantFooter from '@/components/ui/footer-column';
import { extractTenantSlug } from '@/lib/tenant/constants';
import { resolveTenantColors, HELM_DEFAULT } from '@/lib/tenant/use-tenant-colors';

interface SchoolInfo {
  name: string;
  schoolAcronym?: string | null;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  slogan: string | null;
  tenantId?: string;
  slug?: string;
}

interface Job {
  id: string;
  title: string;
  slug: string;
  dept?: string;
  loc?: string;
  contractType?: string;
  description?: string;
  missions?: string;
  responsibilities?: string;
  academicLevel?: string;
  experience?: string;
  skillsRequired?: string;
  salary?: string;
  _count?: { applications: number };
}

export default function TenantCareersPage() {
  const [slug, setSlug] = useState<string>('');
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    const s = extractTenantSlug(window.location.hostname);
    setSlug(s || '');
  }, []);

  const loadSchool = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSchool(data);
      }
    } catch (e) { console.error(e); }
  }, [slug]);

  const loadJobs = useCallback(async () => {
    if (!slug) return;
    try {
      setLoading(true);
      let tid = school?.tenantId || school?.id;
      if (!tid) {
        const schoolRes = await fetch(`/api/public/schools/by-subdomain/${slug}`, { cache: 'no-store' });
        if (schoolRes.ok) {
          const schoolData = await schoolRes.json();
          setSchool(schoolData);
          tid = schoolData.tenantId || schoolData.id;
        }
      }
      if (!tid) { setLoading(false); return; }

      const res = await fetch(`/api/hr/recruitment/jobs?tenantId=${tid}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const published = (Array.isArray(data) ? data : []).filter((j: any) => j.status === 'PUBLIÉE');
        setJobs(published);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [slug, school]);

  useEffect(() => { if (slug) loadSchool(); }, [slug, loadSchool]);
  useEffect(() => { if (slug) loadJobs(); }, [slug, loadJobs]);

  const schoolName = school?.schoolAcronym || school?.name || 'Établissement';
  const schoolLogo = school?.logoUrl;
  const tenantId = school?.tenantId || school?.id || '';
  const colors = resolveTenantColors(null); // Pas de customColors pour l'instant sur /jobs
  const NAVY = colors.primary;
  const BLUE = colors.secondary;
  const GOLD = colors.accent;

  const navLinks = [
    { label: 'Accueil', href: '/' },
    { label: 'Présentation', href: '/#presentation' },
    { label: 'Actualités', href: '/#actualites' },
    { label: 'Agenda', href: '/#agenda' },
    { label: 'Recrutement', href: '/jobs' },
    { label: 'Contact', href: '/#contact' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <TenantHeader
        schoolName={school?.name || schoolName}
        schoolAcronym={school?.schoolAcronym}
        schoolLogo={schoolLogo || undefined}
        schoolSlogan={school?.slogan || undefined}
        colors={colors}
        activeNav="Recrutement"
      />

      {/* Bande recrutement */}
      <div className="pt-14 md:pt-16">
        <TenantRecruitmentBanner tenantId={tenantId || undefined} tenantSlug={slug} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden pt-12 pb-10 md:pt-16 md:pb-14"
        style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 50%, ${colors.dark} 100%)` }}>
        <FloatingEduParticles count={12} opacityMultiplier={1.0} variant="light" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-block mb-3 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <Briefcase size={12} /> Recrutement
            </span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-3 drop-shadow-lg">
            Rejoignez l'équipe de <span style={{ color: GOLD }}>{schoolName}</span>
          </h1>
          <p className="text-sm md:text-base text-blue-50/80 max-w-2xl mx-auto">
            {jobs.length > 0
              ? `${jobs.length} poste${jobs.length > 1 ? 's' : ''} ouvert${jobs.length > 1 ? 's' : ''} — Postulez instantanément avec notre parcours de candidature simplifié.`
              : 'Aucune offre ouverte pour le moment. Revenez bientôt ou contactez-nous directement.'}
          </p>
          {jobs.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-4 md:gap-8">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white">{jobs.length}</p>
                <p className="text-[10px] text-blue-200/60 uppercase tracking-wider">Postes ouverts</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-extrabold" style={{ color: GOLD }}>
                  {jobs.reduce((sum, j) => sum + (j._count?.applications || 0), 0)}
                </p>
                <p className="text-[10px] text-blue-200/60 uppercase tracking-wider">Candidatures</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Liste des offres */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: NAVY }} />
            <span className="ml-2 text-slate-600 text-sm">Chargement des offres…</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <img
              src="/images/AcademiaHelm_NoRecruitment.webp"
              alt="Aucune offre d'emploi"
              className="w-full max-w-md rounded-2xl shadow-lg mb-6"
            />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Aucune offre d'emploi pour le moment</h3>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-md">
              {schoolName} n'a pas d'offre d'emploi active actuellement. Revenez bientôt ou contactez directement l'établissement.
            </p>
            <Link href="/#contact" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: NAVY }}>
              Nous contacter <ChevronRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden"
              >
                <button
                  onClick={() => setSelectedJob(selectedJob?.id === job.id ? null : job)}
                  className="w-full text-left p-5 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {job.contractType && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: `${NAVY}15`, color: NAVY }}>
                          {job.contractType}
                        </span>
                      )}
                      {job.dept && (
                        <span className="text-[10px] font-medium text-slate-400">{job.dept}</span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">{job.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {job.loc && <span className="flex items-center gap-1"><MapPin size={11} /> {job.loc}</span>}
                      {job._count?.applications !== undefined && (
                        <span>{job._count.applications} candidature{job._count.applications > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform shrink-0 ${selectedJob?.id === job.id ? 'rotate-90' : ''}`} />
                </button>

                {selectedJob?.id === job.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    className="border-t border-slate-100 p-5 bg-slate-50/50">
                    {job.description && (
                      <div className="text-sm text-slate-700 mb-3 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mb-1" dangerouslySetInnerHTML={{ __html: job.description }} />
                    )}
                    {job.missions && (
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-slate-900 uppercase mb-1">Missions</h4>
                        <div className="text-sm text-slate-600 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4" dangerouslySetInnerHTML={{ __html: job.missions }} />
                      </div>
                    )}
                    {job.responsibilities && (
                      <div className="mb-3">
                        <h4 className="text-xs font-bold text-slate-900 uppercase mb-1">Responsabilités</h4>
                        <div className="text-sm text-slate-600 [&_p]:mb-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:ml-4" dangerouslySetInnerHTML={{ __html: job.responsibilities }} />
                      </div>
                    )}
                    {job.academicLevel && (
                      <div className="mb-3"><h4 className="text-xs font-bold text-slate-900 uppercase mb-1">Profil requis</h4><p className="text-sm text-slate-600">{job.academicLevel}{job.experience ? ` — ${job.experience}` : ''}</p></div>
                    )}
                    {job.skillsRequired && (
                      <div className="mb-3"><h4 className="text-xs font-bold text-slate-900 uppercase mb-1">Compétences</h4><div className="text-sm text-slate-600 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:ml-4" dangerouslySetInnerHTML={{ __html: job.skillsRequired }} /></div>
                    )}
                    {job.salary && <p className="text-sm font-semibold mb-3" style={{ color: NAVY }}>Rémunération : {job.salary}</p>}
                    <a
                      href={`/jobs/${slug}/${job.slug}`}
                      className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
                      style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                    >
                      Postuler maintenant <ChevronRight size={14} />
                    </a>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <TenantFooter
        schoolName={school?.name || schoolName}
        schoolLogo={schoolLogo || undefined}
        schoolAcronym={school?.schoolAcronym || undefined}
        schoolSlogan={school?.slogan || undefined}
        schoolAddress={school?.address || undefined}
        schoolCity={school?.city || undefined}
        schoolPhone={school?.phone || undefined}
        navLinks={navLinks}
      />
    </div>
  );
}
