'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Briefcase,
  Search,
  MapPin,
  GraduationCap,
  ChevronRight,
  ArrowLeft,
  Upload,
  CheckCircle,
  XCircle,
  FileText,
  User,
  Plus,
  Trash2,
  BookOpen,
  Award,
  Sparkles,
  Send,
  Linkedin,
  Users,
  Globe,
  Map,
  Mail,
  Phone
} from 'lucide-react';
import PremiumHeader from '@/components/layout/PremiumHeader';


const PRIMARY = '#1A2BA6';

interface School {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  tenantName: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  primaryPhone?: string;
  primaryEmail?: string;
  address?: string;
  activeJobsCount?: number;
}

interface Job {
  id: string;
  ref: string;
  slug: string;
  title: string;
  dept: string;
  loc: string;
  status: string;
  description?: string;
  missions?: string;
  responsibilities?: string;
  academicLevel?: string;
  experience?: string;
  skillsRequired?: string;
  salary?: string;
  contractType?: string;
  _count?: { applications: number };
}

interface JobStats {
  jobId: string;
  totalApplicants: number;
  countries: { name: string; count: number }[];
  cities: { name: string; count: number }[];
}

interface WorkExperience {
  title: string;
  company: string;
  years: string;
  description: string;
}

interface EducationItem {
  degree: string;
  school: string;
  year: string;
}

export interface CareersContentProps {
  forcedSchoolSlug?: string;
  forcedJobSlug?: string;
  /** Pre-fetched schools from Server Component — skips client-side fetch */
  initialSchools?: any[];
  /** Pre-fetched selected school from Server Component */
  initialSchool?: School | null;
  /** Pre-fetched jobs for the selected school from Server Component */
  initialJobs?: Job[];
}

export function CareersContent({
  forcedSchoolSlug,
  forcedJobSlug,
  initialSchools,
  initialSchool = null,
  initialJobs,
}: CareersContentProps) {
  const [schools, setSchools] = useState<any[]>(initialSchools ?? []);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(initialSchool);
  const [jobs, setJobs] = useState<Job[]>(initialJobs ?? []);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  // When no pre-fetched data is provided, start in loading state so the skeleton
  // is visible immediately instead of a flash of empty grid.
  const [loading, setLoading] = useState(!initialSchools || initialSchools.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolParam = forcedSchoolSlug || searchParams.get('school');

  // Multi-Step Form States
  const [isApplying, setIsApplying] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Contact & Identity
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('Bénin');
  const [city, setCity] = useState('');
  const [gender, setGender] = useState('M');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [jobStats, setJobStats] = useState<JobStats | null>(null);

  // Step 2: Work Experience List
  const [experiences, setExperiences] = useState<WorkExperience[]>([]);
  const [expTitle, setExpTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expYears, setExpYears] = useState('');
  const [expDesc, setExpDesc] = useState('');

  // Step 3: Education List
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [eduDegree, setEduDegree] = useState('');
  const [eduSchool, setEduSchool] = useState('');
  const [eduYear, setEduYear] = useState('');

  // Step 4: Skills & Pitch
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [pitch, setPitch] = useState('');

  // Step 5: Document Uploads
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [recoFile, setRecoFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  // When forcedJobSlug is provided, directly deep-link to the specific job via API.
  // This avoids the fragile multi-step chain (load schools → match slug → load jobs → match slug)
  // and works reliably for social sharing links.
  const [deepLinkResolved, setDeepLinkResolved] = useState(false);

  useEffect(() => {
    if (!forcedJobSlug || deepLinkResolved) return;
    let cancelled = false;

    async function resolveDeepLink() {
      try {
        setLoading(true);
        // Call the public getJobBySlug API — returns job with tenant info
        const res = await fetch(`/api/hr/recruitment/jobs/by-slug/${encodeURIComponent(forcedJobSlug!)}`);
        if (!res.ok) {
          console.warn('Deep-link: job not found for slug', forcedJobSlug);
          setDeepLinkResolved(true);
          return;
        }
        const jobData = await res.json();
        if (cancelled || !jobData?.tenant) return;

        // Build a synthetic school object from the job's tenant info
        const tenantInfo = jobData.tenant;
        const syntheticSchool: School = {
          id: tenantInfo.id,
          tenantId: tenantInfo.id,
          name: tenantInfo.name,
          schoolName: tenantInfo.schoolName || tenantInfo.name,
          tenantName: tenantInfo.name,
          slug: tenantInfo.slug,
          logoUrl: tenantInfo.logoUrl || tenantInfo.school?.logo || undefined,
          city: tenantInfo.city || tenantInfo.school?.city || undefined,
          country: tenantInfo.country || tenantInfo.school?.country || undefined,
          primaryPhone: tenantInfo.primaryPhone || tenantInfo.school?.primaryPhone || undefined,
          primaryEmail: tenantInfo.primaryEmail || tenantInfo.school?.primaryEmail || undefined,
          address: tenantInfo.address || tenantInfo.school?.address || undefined,
        };

        // Set school and job directly
        setSelectedSchool(syntheticSchool);
        setSelectedJob(jobData);

        // Also load the full jobs list for this school (for sidebar navigation)
        try {
          const jobsRes = await fetch(`/api/hr/recruitment/jobs?tenantId=${tenantInfo.id}`);
          const jobsData = await jobsRes.json();
          if (Array.isArray(jobsData) && !cancelled) {
            setJobs(jobsData.filter((j: any) => j.status === 'PUBLIÉE'));
          }
        } catch (e) {
          console.warn('Deep-link: could not load full jobs list', e);
        }

        setDeepLinkResolved(true);
      } catch (err) {
        console.error('Deep-link resolution failed:', err);
        setDeepLinkResolved(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolveDeepLink();
    return () => { cancelled = true; };
  }, [forcedJobSlug, deepLinkResolved]);

  // Fetch available schools on mount — skip if data was pre-fetched by Server Component
  useEffect(() => {
    // If Server Component already provided schools, skip the client-side fetch entirely
    if (initialSchools && initialSchools.length > 0) return;

    async function loadSchools() {
      try {
        setLoading(true);
        setLoadError(null);
        // Use the optimized endpoint that returns schools with active job counts
        // and includes logo, contact info, etc.
        const res = await fetch('/api/public/schools/with-jobs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSchools(data);
            return; // Success — no need for fallback
          }
        }
        // Fallback to the basic list endpoint
        try {
          const fallbackRes = await fetch('/api/public/schools/list');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (Array.isArray(fallbackData)) {
              setSchools(fallbackData);
              return;
            }
          }
        } catch {
          // Fallback also failed
        }
        // Both endpoints failed
        setLoadError('Impossible de charger les établissements. Vérifiez votre connexion et réessayez.');
      } catch (err) {
        console.error('Failed to load schools:', err);
        setLoadError('Erreur réseau. Vérifiez votre connexion et réessayez.');
      } finally {
        setLoading(false);
      }
    }
    loadSchools();
  }, [initialSchools]);

  // Fetch jobs for the selected school
  const handleSelectSchool = async (school: School) => {
    setSelectedSchool(school);
    setSelectedJob(null);
    setIsApplying(false);
    setSubmitResult(null);
    setJobStats(null);
    setCurrentStep(1);
    
    // Update path dynamically (personalized tenant URL)
    // Preserve the jobSlug if we're coming from a direct link (/jobs/{school}/{job})
    // so that the auto-select job useEffect can still trigger
    const jobSlugSegment = forcedJobSlug ? `/${forcedJobSlug}` : '';
    router.push(`/jobs/${school.slug}${jobSlugSegment}`);

    try {
      setLoading(true);
      // Use BFF proxy (not apiFetch) for public job listings.
      // apiFetch sends X-Tenant-ID from the auth cookie, which overrides
      // the query param tenantId in NestJS — causing wrong-tenant jobs.
      const res = await fetch(`/api/hr/recruitment/jobs?tenantId=${school.tenantId || school.id}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data.filter((j: any) => j.status === 'PUBLIÉE') : []);
      } else {
        console.error('Failed to load jobs:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats when a job is selected
  useEffect(() => {
    if (!selectedJob) {
      setJobStats(null);
      return;
    }
    async function loadStats() {
      try {
        const jobId = selectedJob!.id;
        // Route through BFF proxy to avoid CORS issues on mobile devices
        const res = await fetch(`/api/hr/recruitment/jobs/${jobId}/stats`);
        if (res.ok) {
          const data = await res.json();
          setJobStats(data);
        }
      } catch (err) {
        console.error('Failed to load job stats:', err);
      }
    }
    loadStats();
  }, [selectedJob?.id]);

  // Auto-select school if query parameter matches (only if deep-link hasn't already resolved)
  // Skip if Server Component already provided initialSchool (already selected)
  useEffect(() => {
    if (deepLinkResolved && forcedJobSlug) return; // Deep-link already set the school
    if (initialSchool) return; // Server Component already selected the school
    if (schools.length > 0 && schoolParam && !selectedSchool) {
      const match = schools.find(s => s.slug === schoolParam);
      if (match) {
        handleSelectSchool(match);
      }
    }
  }, [schools, schoolParam, deepLinkResolved, forcedJobSlug, selectedSchool, initialSchool]);

  // Select a specific job from the jobs list by slug
  const handleSelectJobBySlug = (jobSlug: string) => {
    const match = jobs.find(j => j.slug === jobSlug);
    if (match) {
      setSelectedJob(match);
    }
  };

  // Auto-select job if forcedJobSlug is provided and jobs are loaded
  // (fallback for when deep-link resolution didn't set the job directly)
  useEffect(() => {
    if (forcedJobSlug && jobs.length > 0 && selectedSchool && !selectedJob) {
      handleSelectJobBySlug(forcedJobSlug);
    }
  }, [forcedJobSlug, jobs, selectedSchool, selectedJob]);

  // Form helpers
  const addExperience = () => {
    if (!expTitle || !expCompany) return;
    setExperiences([...experiences, { title: expTitle, company: expCompany, years: expYears, description: expDesc }]);
    setExpTitle('');
    setExpCompany('');
    setExpYears('');
    setExpDesc('');
  };

  const removeExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  const addEducation = () => {
    if (!eduDegree || !eduSchool) return;
    setEducation([...education, { degree: eduDegree, school: eduSchool, year: eduYear }]);
    setEduDegree('');
    setEduSchool('');
    setEduYear('');
  };

  const removeEducation = (index: number) => {
    setEducation(education.filter((_, i) => i !== index));
  };

  const addSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      if (!skills.includes(skillInput.trim())) {
        setSkills([...skills, skillInput.trim()]);
      }
      setSkillInput('');
    }
  };

  const removeSkill = (tag: string) => {
    setSkills(skills.filter(s => s !== tag));
  };

  // Easy Apply submission
  const handleSubmitApplication = async () => {
    if (!selectedSchool || !selectedJob) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const formData = new FormData();
      formData.append('tenantId', selectedSchool.tenantId || selectedSchool.id);
      formData.append('jobId', selectedJob.id);
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('address', address);
      formData.append('country', country);
      formData.append('city', city);
      formData.append('gender', gender);
      formData.append('linkedinUrl', linkedinUrl);
      
      // Structured profile fields serialized
      formData.append('experiences', JSON.stringify(experiences));
      formData.append('education', JSON.stringify(education));
      formData.append('skills', JSON.stringify(skills));
      formData.append('pitch', pitch);

      if (cvFile) formData.append('cv', cvFile);
      if (coverFile) formData.append('coverLetter', coverFile);
      if (recoFile) formData.append('recommendationLetter', recoFile);

      // NOTE: Route through the BFF proxy (/api/hr/recruitment/apply) instead of
      // making a direct cross-origin call to the NestJS API. This avoids CORS issues,
      // works reliably on mobile devices, and ensures the multipart/form-data body
      // is forwarded correctly with authentication headers.
      //
      // Do NOT set Content-Type header manually — the browser must auto-set
      // "multipart/form-data; boundary=..." so the server can parse the body.
      const res = await fetch('/api/hr/recruitment/apply', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data) {
        setSubmitResult({
          success: true,
          message: 'Candidature Easy Apply transmise ! Notre IA procède à l\'extraction sémantique et à la validation des diplômes/certifications.'
        });
      } else {
        // Extract error details from various response formats
        const serverMsg = data?.message || data?.error || '';
        const detail = data?.detail || '';
        const fullMsg = [serverMsg, detail].filter(Boolean).join(' — ');
        setSubmitResult({
          success: false,
          message: fullMsg
            ? `Erreur : ${fullMsg}`
            : `Erreur serveur (${res.status}). Veuillez réessayer.`
        });
      }
    } catch (err: any) {
      console.error('Submission failed:', err);
      const errMsg = err?.message || '';
      setSubmitResult({
        success: false,
        message: errMsg
          ? `Erreur réseau : ${errMsg}`
          : 'Une erreur réseau est survenue. Veuillez vérifier votre connexion et soumettre à nouveau.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSchools = schools.filter(s => 
    (s.schoolName || s.tenantName || s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <PremiumHeader />

      <main className="flex-grow pt-28 pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">
        {/* Banner Section */}
        <div className="text-center mb-10">
          <span className="px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider bg-indigo-50 border-indigo-200 text-[#1A2BA6] mb-4 inline-block">
            Portail Talent Academia
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">
            Espace Candidat Augmenté
          </h1>
          <p className="text-sm md:text-base text-slate-500 mt-2 max-w-xl mx-auto">
            Postulez instantanément grâce à notre parcours de candidature simplifiée intégrant l&apos;analyse IA.
          </p>
        </div>

        {loading && (
          <div className="space-y-4 py-12 max-w-md mx-auto">
            {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white animate-pulse rounded-xl border border-slate-200" />)}
          </div>
        )}

        {!loading && loadError && (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Erreur de chargement</h3>
            <p className="text-sm text-slate-500 mb-6">{loadError}</p>
            <button
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                fetch('/api/public/schools/with-jobs')
                  .then(res => res.ok ? res.json() : Promise.reject('API error'))
                  .then(data => { if (Array.isArray(data)) setSchools(data); })
                  .catch(() => setLoadError('Impossible de charger les établissements. Vérifiez votre connexion et réessayez.'))
                  .finally(() => setLoading(false));
              }}
              className="px-6 py-2.5 bg-[#1A2BA6] text-white text-sm font-semibold rounded-xl hover:bg-[#1521a0] transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}

        {!loading && !loadError && !selectedSchool && schools.length === 0 && (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="h-16 w-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Aucun établissement trouvé</h3>
            <p className="text-sm text-slate-500">Aucun établissement ne recrute actuellement. Revenez bientôt !</p>
          </div>
        )}

        {!loading && !loadError && (
          <AnimatePresence mode="wait">
            {/* STEP 1: Select Institution */}
            {!selectedSchool && (
              <motion.div key="step-schools" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                <div className="max-w-md mx-auto relative">
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un établissement..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-xs shadow-sm focus:outline-none focus:border-[#1A2BA6] transition"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSchools.map((school) => (
                    <div
                      key={school.id}
                      onClick={() => handleSelectSchool(school)}
                      className="group cursor-pointer bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between relative overflow-hidden"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          {school.logoUrl ? (
                            <Image
                              src={school.logoUrl}
                              alt={school.schoolName || school.tenantName || school.name}
                              width={48}
                              height={48}
                              className="h-12 w-12 rounded-xl object-contain border border-slate-100 bg-white p-0.5"
                              loading="lazy"
                              sizes="48px"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1A2BA6]">
                              <Building2 className="h-6 w-6" />
                            </div>
                          )}
                          {school.activeJobsCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm relative">
                              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              {school.activeJobsCount} {school.activeJobsCount > 1 ? 'recrutements' : 'recrutement'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-100">
                              Pas d'offre
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-[#1A2BA6] transition-colors">
                          {school.schoolName || school.tenantName || school.name}
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">{school.slug}</p>
                        {(school.city || school.country) && (
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {[school.city, school.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold text-[#1A2BA6]">
                        <span>Découvrir les offres</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Job Board or Application */}
            {selectedSchool && (
              <motion.div key="step-jobs" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                <button
                  onClick={() => {
                    setSelectedSchool(null);
                    setSelectedJob(null);
                    setIsApplying(false);
                    router.push('/jobs');
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour aux établissements
                </button>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    {selectedSchool.logoUrl ? (
                      <Image
                        src={selectedSchool.logoUrl}
                        alt={selectedSchool.schoolName || selectedSchool.tenantName || selectedSchool.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-xl object-contain border border-slate-100 bg-white p-0.5"
                        sizes="56px"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1A2BA6]">
                        <Building2 className="h-7 w-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-extrabold text-slate-900 text-lg truncate">
                        {selectedSchool.schoolName || selectedSchool.tenantName || selectedSchool.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                        {(selectedSchool.city || selectedSchool.country) && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[selectedSchool.city, selectedSchool.country].filter(Boolean).join(', ')}</span>
                        )}
                        {selectedSchool.primaryPhone && (
                          <a href={`tel:${selectedSchool.primaryPhone}`} className="flex items-center gap-1 hover:text-[#1A2BA6] transition-colors"><Phone className="h-3 w-3" /> {selectedSchool.primaryPhone}</a>
                        )}
                        {selectedSchool.primaryEmail && (
                          <a href={`mailto:${selectedSchool.primaryEmail}`} className="flex items-center gap-1 hover:text-[#1A2BA6] transition-colors"><Mail className="h-3 w-3" /> {selectedSchool.primaryEmail}</a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!isApplying ? (
                  jobs.length === 0 ? (
                    /* ─── No open positions — show illustration ─── */
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="relative w-full max-w-lg">
                        <Image
                          src="/images/AcademiaHelm_NoRecruitment.jpeg"
                          alt="Aucune offre de recrutement pour le moment"
                          width={512}
                          height={360}
                          className="rounded-2xl shadow-sm w-full h-auto object-contain"
                          priority
                          sizes="(max-width: 768px) 100vw, 512px"
                        />
                      </div>
                      <p className="mt-5 text-sm font-semibold text-slate-700">Aucune offre de recrutement pour le moment</p>
                      <p className="mt-1 text-xs text-slate-400">Les nouvelles opportunités apparaîtront ici dès leur publication.</p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Job list */}
                    <div className="lg:col-span-1 space-y-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Postes ouverts</h3>
                      {jobs.map((job) => (
                        <div
                          key={job.id}
                          onClick={() => {
                            setSelectedJob(job);
                            if (selectedSchool?.slug && job.slug) {
                              router.push(`/jobs/${selectedSchool.slug}/${job.slug}`, { scroll: false });
                            }
                          }}
                          className={`cursor-pointer border p-4 rounded-xl transition-all ${
                            selectedJob?.id === job.id 
                              ? 'bg-indigo-50/50 border-[#1A2BA6] shadow-sm' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{job.ref}</span>
                          <h4 className="font-bold text-slate-900 text-xs mt-1">{job.title}</h4>
                          <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.loc}</span>
                            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {job.contractType || 'CDI'}</span>
                            {(job._count?.applications ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-blue-600 font-semibold"><Users className="h-3 w-3" /> {job._count?.applications ?? 0} candidat{(job._count?.applications ?? 0) > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right: Job details */}
                    <div className="lg:col-span-2">
                      {selectedJob ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedJob.ref}</span>
                              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">{selectedJob.contractType || 'CDI'}</span>
                            </div>
                            <h3 className="font-extrabold text-slate-900 text-base mt-2">{selectedJob.title}</h3>
                            <p className="text-xs text-slate-500 mt-1">{selectedJob.dept} · {selectedJob.loc}</p>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-y border-slate-100 py-4 text-xs">
                            {selectedJob.salary && (
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Salaire</span>
                                <p className="font-semibold text-slate-900 mt-0.5">{selectedJob.salary}</p>
                              </div>
                            )}
                            {selectedJob.academicLevel && (
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Niveau d'études</span>
                                <p className="font-semibold text-slate-900 mt-0.5">{selectedJob.academicLevel}</p>
                              </div>
                            )}
                            {selectedJob.experience && (
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Expérience</span>
                                <p className="font-semibold text-slate-900 mt-0.5">{selectedJob.experience}</p>
                              </div>
                            )}
                            {/* Applicant count stat */}
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Candidats</span>
                              <p className="font-semibold text-[#1A2BA6] mt-0.5 flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {selectedJob._count?.applications ?? 0} candidat{((selectedJob._count?.applications ?? 0) > 1) ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          {/* LinkedIn-style applicant stats */}
                          {jobStats && jobStats.totalApplicants > 0 && (
                            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-200 rounded-xl p-4 space-y-3">
                              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Users className="h-4 w-4 text-[#1A2BA6]" />
                                Statistiques des candidats
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* By country */}
                                {jobStats.countries.length > 0 && (
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><Globe className="h-3 w-3" /> Par pays</span>
                                    <div className="mt-1.5 space-y-1">
                                      {jobStats.countries.map((c) => (
                                        <div key={c.name} className="flex items-center gap-2">
                                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                            <div
                                              className="bg-[#1A2BA6] h-full rounded-full transition-all duration-500"
                                              style={{ width: `${Math.round((c.count / jobStats.totalApplicants) * 100)}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-slate-700 font-medium whitespace-nowrap min-w-[70px]">{c.name}</span>
                                          <span className="text-[10px] text-slate-400 font-bold">{c.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* By city */}
                                {jobStats.cities.length > 0 && jobStats.cities.some(c => c.name !== 'Non spécifié') && (
                                  <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><Map className="h-3 w-3" /> Par ville</span>
                                    <div className="mt-1.5 space-y-1">
                                      {jobStats.cities.filter(c => c.name !== 'Non spécifié').map((c) => (
                                        <div key={c.name} className="flex items-center gap-2">
                                          <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                            <div
                                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                              style={{ width: `${Math.round((c.count / jobStats.totalApplicants) * 100)}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] text-slate-700 font-medium whitespace-nowrap min-w-[70px]">{c.name}</span>
                                          <span className="text-[10px] text-slate-400 font-bold">{c.count}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {selectedJob.description && (
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs mb-1.5">Description du poste</h4>
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{selectedJob.description}</p>
                            </div>
                          )}

                          {selectedJob.missions && (
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs mb-1.5">Missions clés</h4>
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{selectedJob.missions}</p>
                            </div>
                          )}

                          {selectedJob.responsibilities && (
                            <div>
                              <h4 className="font-bold text-slate-900 text-xs mb-1.5">Responsabilités</h4>
                              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{selectedJob.responsibilities}</p>
                            </div>
                          )}

                          <button
                            onClick={() => setIsApplying(true)}
                            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-white transition hover:opacity-90 shadow-md bg-blue-600"
                          >
                            <Sparkles className="h-4 w-4 text-white fill-white" /> Postuler instantanément
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-xs text-slate-400 italic">Veuillez sélectionner un poste dans la liste pour afficher les détails.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                ) : (
                  /* Form: Easy Apply multi-step */
                  <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden">
                    {/* Top step progress bar */}
                    <div className="w-full bg-slate-100 h-1.5 absolute top-0 left-0">
                      <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(currentStep / 5) * 100}%` }} />
                    </div>

                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6 mt-2">
                      <div>
                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">Étape {currentStep} sur 5</span>
                        <h3 className="font-extrabold text-slate-900 text-sm">Candidature Simplifiée : {selectedJob?.title}</h3>
                      </div>
                      <button
                        onClick={() => setIsApplying(false)}
                        className="text-xs text-slate-500 font-semibold hover:underline"
                      >
                        Annuler
                      </button>
                    </div>

                    {submitResult ? (
                      <div className="text-center py-8 space-y-4">
                        {submitResult.success ? (
                          <>
                            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
                            <h4 className="font-bold text-slate-900 text-base">Candidature Transmise avec Succès</h4>
                            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">{submitResult.message}</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-12 w-12 text-red-500 mx-auto" />
                            <h4 className="font-bold text-slate-900 text-base">Échec de la soumission</h4>
                            <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">{submitResult.message}</p>
                          </>
                        )}
                        <button
                          onClick={() => { setSelectedSchool(null); setSelectedJob(null); setIsApplying(false); }}
                          className="mt-6 rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Retourner à l'accueil
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* STEP 1: Contact Information */}
                        {currentStep === 1 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Informations de contact</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Prénom</label>
                                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Nom de famille</label>
                                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Adresse email</label>
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Téléphone</label>
                                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Ex: +229 90000000" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Adresse résidentielle</label>
                                <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Genre</label>
                                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
                                  <option value="M">Masculin</option>
                                  <option value="F">Féminin</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Pays</label>
                                <select value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
                                  <option value="Bénin">Bénin</option>
                                  <option value="Togo">Togo</option>
                                  <option value="Niger">Niger</option>
                                  <option value="Nigéria">Nigéria</option>
                                  <option value="Côte d'Ivoire">Côte d'Ivoire</option>
                                  <option value="Sénégal">Sénégal</option>
                                  <option value="Mali">Mali</option>
                                  <option value="Burkina Faso">Burkina Faso</option>
                                  <option value="Guinée">Guinée</option>
                                  <option value="Cameroun">Cameroun</option>
                                  <option value="Gabon">Gabon</option>
                                  <option value="Congo">Congo</option>
                                  <option value="RDC">RDC</option>
                                  <option value="France">France</option>
                                  <option value="Autre">Autre</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Ville / Commune</label>
                                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Ex: Cotonou, Parakou..." />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1"><Linkedin className="h-3.5 w-3.5 text-[#0A66C2] fill-[#0A66C2]" /> Profil LinkedIn (optionnel)</label>
                              <input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="https://linkedin.com/in/nom-d-utilisateur" />
                            </div>
                          </motion.div>
                        )}

                        {/* STEP 2: Work Experience */}
                        {currentStep === 2 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> Expériences professionnelles</h4>
                            
                            {/* Experience list */}
                            <div className="space-y-2">
                              {experiences.map((exp, i) => (
                                <div key={i} className="flex justify-between items-start bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                                  <div>
                                    <p className="font-bold text-slate-900">{exp.title}</p>
                                    <p className="text-[10px] text-slate-500">{exp.company} · {exp.years}</p>
                                    {exp.description && <p className="text-[10px] text-slate-600 mt-1 italic">{exp.description}</p>}
                                  </div>
                                  <button onClick={() => removeExperience(i)} className="text-red-500 hover:text-red-700 transition">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Add Experience sub-form */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ajouter une expérience</span>
                              <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Intitulé du poste (ex: Enseignant)" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                                <input type="text" placeholder="Établissement / École" value={expCompany} onChange={(e) => setExpCompany(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <input type="text" placeholder="Durée (ex: 2022 - 2025)" value={expYears} onChange={(e) => setExpYears(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs col-span-1" />
                                <input type="text" placeholder="Brève description des responsabilités" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs col-span-2" />
                              </div>
                              <button type="button" onClick={addExperience} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-semibold hover:opacity-90 transition">
                                <Plus className="h-3.5 w-3.5" /> Enregistrer le poste
                              </button>
                            </div>
                          </motion.div>
                        )}

                        {/* STEP 3: Education */}
                        {currentStep === 3 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-600" /> Études et Formations</h4>
                            
                            {/* Education list */}
                            <div className="space-y-2">
                              {education.map((edu, i) => (
                                <div key={i} className="flex justify-between items-start bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                                  <div>
                                    <p className="font-bold text-slate-900">{edu.degree}</p>
                                    <p className="text-[10px] text-slate-500">{edu.school} · {edu.year}</p>
                                  </div>
                                  <button onClick={() => removeEducation(i)} className="text-red-500 hover:text-red-700 transition">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Add Education sub-form */}
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ajouter un diplôme</span>
                              <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Diplôme (ex: Master Mathématiques)" value={eduDegree} onChange={(e) => setEduDegree(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                                <input type="text" placeholder="Université / École" value={eduSchool} onChange={(e) => setEduSchool(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              </div>
                              <div className="flex gap-3">
                                <input type="text" placeholder="Année d'obtention" value={eduYear} onChange={(e) => setEduYear(e.target.value)} className="w-1/3 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                                <button type="button" onClick={addEducation} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-semibold hover:opacity-90 transition">
                                  <Plus className="h-3.5 w-3.5" /> Enregistrer le diplôme
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* STEP 4: Skills & Pitch */}
                        {currentStep === 4 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><Award className="h-4 w-4 text-blue-600" /> Compétences & Présentation</h4>
                            
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Compétences clés (Appuyez sur Entrée)</label>
                              <input
                                type="text"
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyDown={addSkill}
                                placeholder="Ajouter une compétence... (ex: Didactique, Python)"
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              />
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {skills.map(s => (
                                  <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-full text-slate-700 text-[10px] font-semibold">
                                    {s}
                                    <button type="button" onClick={() => removeSkill(s)} className="text-slate-400 hover:text-slate-600">✕</button>
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Pourquoi vous ? Pitch de motivation (1-2 paragraphes)</label>
                              <textarea
                                value={pitch}
                                onChange={(e) => setPitch(e.target.value)}
                                placeholder="Présentez brièvement vos atouts pour ce poste scolaire..."
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-28"
                              />
                            </div>
                          </motion.div>
                        )}

                        {/* STEP 5: Document Uploads */}
                        {currentStep === 5 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /> Fichiers & Justificatifs</h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* CV */}
                              <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0] || null)} required className="absolute inset-0 opacity-0 cursor-pointer" />
                                <Upload className="h-6 w-6 text-[#1A2BA6] mb-2" />
                                <span className="text-[10px] font-bold text-slate-700">Curriculum Vitae *</span>
                                <span className="text-[9px] text-slate-400 mt-1">{cvFile ? cvFile.name : 'PDF, DOCX'}</span>
                              </div>

                              {/* Letter */}
                              <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                <Upload className="h-6 w-6 text-[#1A2BA6] mb-2" />
                                <span className="text-[10px] font-bold text-slate-700">Lettre de motivation</span>
                                <span className="text-[9px] text-slate-400 mt-1">{coverFile ? coverFile.name : 'PDF, DOCX'}</span>
                              </div>
                            </div>

                            {/* Recommendation */}
                            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setRecoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className="h-6 w-6 text-[#1A2BA6] mb-2" />
                              <span className="text-[10px] font-bold text-slate-700">Lettre de recommandation académique</span>
                              <span className="text-[9px] text-slate-400 mt-1">{recoFile ? recoFile.name : 'PDF, DOCX'}</span>
                            </div>

                            {/* AI Processing notice */}
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex gap-2 text-[10px] text-slate-600">
                              <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                              <p>En transmettant vos documents, le système **HDIE Engine** analysera la cohérence de vos diplômes et rédigera une note de synthèse pour la direction.</p>
                            </div>
                          </motion.div>
                        )}

                        {/* Navigation buttons */}
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                          <button
                            type="button"
                            disabled={currentStep === 1 || submitting}
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40"
                          >
                            Précédent
                          </button>

                          {currentStep < 5 ? (
                            <button
                              type="button"
                              onClick={() => setCurrentStep(prev => prev + 1)}
                              className="px-5 py-2 text-white rounded-lg text-xs font-bold transition hover:opacity-90"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              Continuer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleSubmitApplication}
                              disabled={submitting}
                              className="px-5 py-2 text-white rounded-lg text-xs font-bold transition hover:opacity-90 flex items-center gap-1 bg-blue-600"
                            >
                              {submitting ? 'Transmission...' : 'Soumettre le dossier'}
                              <Send className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <footer className="bg-slate-900 text-slate-500 py-8 border-t border-slate-800 text-center text-xs">
        <p>© 2026 Academia Helm. Tous droits réservés. Propulsé par HDIE Engine.</p>
      </footer>
    </div>
  );
}
