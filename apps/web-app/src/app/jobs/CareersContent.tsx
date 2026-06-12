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
  Phone,
  ExternalLink,
  Clock,
  DollarSign,
  Bookmark,
} from 'lucide-react';
import PremiumHeader from '@/components/layout/PremiumHeader';
import InstitutionalFooter from '@/components/public/InstitutionalFooter';
import { JobCardSkeleton } from '@/components/loading/Skeleton';
import { JobCardSkeletonMobile } from '@/components/loading/SkeletonMobile';


const PRIMARY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/**
 * School interface — enriched with ALL identity profile fields from the
 * latest versioned TenantIdentityProfile (source of truth).
 * The backend listSchoolsWithJobs() already resolves:
 *   TenantIdentityProfile (active) → School (legacy) → Tenant.name
 */
interface School {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  schoolAcronym?: string;
  tenantName: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  city?: string;
  department?: string;
  postalCode?: string;
  country?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  primaryEmail?: string;
  website?: string;
  schoolType?: string;
  slogan?: string;
  identityVersion?: number;
  activeJobsCount?: number;
  /** Nested school object from API — school-level contact info takes priority over tenant-level */
  school?: {
    primaryPhone?: string;
    primaryEmail?: string;
    city?: string;
    country?: string;
    logo?: string;
  };
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
  const [deepLinkResolved, setDeepLinkResolved] = useState(false);

  useEffect(() => {
    if (!forcedJobSlug || deepLinkResolved) return;
    let cancelled = false;

    async function resolveDeepLink() {
      try {
        setLoading(true);
        const res = await fetch(`/api/hr/recruitment/jobs/by-slug/${encodeURIComponent(forcedJobSlug!)}`);
        if (!res.ok) {
          console.warn('Deep-link: job not found for slug', forcedJobSlug);
          setDeepLinkResolved(true);
          return;
        }
        const jobData = await res.json();
        if (cancelled || !jobData?.tenant) return;

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
          phonePrimary: tenantInfo.school?.primaryPhone || tenantInfo.primaryPhone || undefined,
          phoneSecondary: tenantInfo.phoneSecondary || undefined,
          primaryEmail: tenantInfo.school?.primaryEmail || tenantInfo.primaryEmail || undefined,
          address: tenantInfo.address || tenantInfo.school?.address || undefined,
          website: tenantInfo.website || undefined,
          schoolAcronym: tenantInfo.schoolAcronym || undefined,
          slogan: tenantInfo.slogan || undefined,
          department: tenantInfo.department || undefined,
        };

        setSelectedSchool(syntheticSchool);
        setSelectedJob(jobData);

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

  // Fetch available schools on mount
  useEffect(() => {
    if (initialSchools && initialSchools.length > 0) return;

    async function loadSchools() {
      try {
        setLoading(true);
        setLoadError(null);
        const res = await fetch('/api/public/schools/with-jobs');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSchools(data);
            return;
          }
        }
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
    
    const jobSlugSegment = forcedJobSlug ? `/${forcedJobSlug}` : '';
    router.push(`/jobs/${school.slug}${jobSlugSegment}`);

    try {
      setLoading(true);
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

  // Auto-select school if query parameter matches
  useEffect(() => {
    if (deepLinkResolved && forcedJobSlug) return;
    if (initialSchool) return;
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
      
      formData.append('experiences', JSON.stringify(experiences));
      formData.append('education', JSON.stringify(education));
      formData.append('skills', JSON.stringify(skills));
      formData.append('pitch', pitch);

      if (cvFile) formData.append('cv', cvFile);
      if (coverFile) formData.append('coverLetter', coverFile);
      if (recoFile) formData.append('recommendationLetter', recoFile);

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

  /**
   * Resolve contact info with school-level priority over tenant-level.
   * The backend already merges TenantIdentityProfile → School → Tenant,
   * so the top-level fields (phonePrimary, primaryEmail, etc.) are the
   * latest versioned identity data.
   */
  const getSchoolEmail = (s: School) => s.school?.primaryEmail || s.primaryEmail;
  const getSchoolPhone = (s: School) => s.school?.primaryPhone || s.phonePrimary;
  const getSchoolPhoneSecondary = (s: School) => s.phoneSecondary;
  const getSchoolWebsite = (s: School) => s.website;
  const getSchoolSlogan = (s: School) => s.slogan;
  const getSchoolAcronym = (s: School) => s.schoolAcronym;
  const getSchoolAddress = (s: School) => s.address;
  const getSchoolDepartment = (s: School) => s.department;

  /** Build a display name: "Full Name (Acronym)" */
  const getSchoolDisplayName = (s: School) => {
    const name = s.schoolName || s.tenantName || s.name;
    const acronym = getSchoolAcronym(s);
    return acronym ? `${name} (${acronym})` : name;
  };

  /**
   * Construit une adresse complète intelligente en évitant les répétitions.
   *
   * Si la ville, le département ou le pays sont déjà mentionnés dans l'adresse
   * complète, ils ne sont pas ajoutés une seconde fois. La comparaison est
   * insensible à la casse et aux accents (diacritiques) pour détecter :
   *   "Cotonou" dans "Rue 5, Cotonou, Bénin"
   *   "Benin" dans "Rue 5, Cotonou, Bénin"  (sans accent)
   *   "Littoral" dans "Rue 5, Cotonou, Littoral"
   *
   * Exemples :
   *   address="Rue 5, Cotonou", city="Cotonou" → "Rue 5, Cotonou"
   *   address="Rue 5", city="Cotonou", country="Bénin" → "Rue 5, Cotonou, Bénin"
   *   address="Rue 5, Cotonou, Littoral, Bénin", city="Cotonou" → "Rue 5, Cotonou, Littoral, Bénin"
   *   address=null, city="Cotonou", department="Littoral", country="Bénin" → "Cotonou, Littoral, Bénin"
   */
  const buildSmartAddress = (s: School): string | null => {
    const address = s.address?.trim();
    const city = s.city?.trim();
    const department = s.department?.trim();
    const country = s.country?.trim();

    if (!address && !city && !department && !country) return null;

    // Normalise pour la comparaison : minuscules, sans accents, sans ponctuation
    const normalizeForCompare = (str: string) =>
      str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
        .replace(/[^a-z0-9]/g, '');     // ne garde que lettres et chiffres

    const addressNorm = address ? normalizeForCompare(address) : '';

    const parts: string[] = [];

    // Toujours commencer par l'adresse si elle existe
    if (address) {
      parts.push(address);
    }

    // Ajoute la ville uniquement si elle n'est pas déjà dans l'adresse
    if (city && !addressNorm.includes(normalizeForCompare(city))) {
      parts.push(city);
    }

    // Ajoute le département uniquement s'il n'est ni dans l'adresse ni identique à la ville
    if (
      department &&
      !addressNorm.includes(normalizeForCompare(department)) &&
      normalizeForCompare(department) !== normalizeForCompare(city || '')
    ) {
      parts.push(department);
    }

    // Ajoute le pays uniquement s'il n'est pas déjà dans l'adresse
    if (country && !addressNorm.includes(normalizeForCompare(country))) {
      parts.push(country);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900 flex flex-col">
      <PremiumHeader />

      {/* ═══════════════════════════════════════════════════════
          HERO — Premium navy gradient with golden accents
          ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5] pt-28 pb-16 md:pb-20">
        {/* Ambient light particles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -left-10 w-72 h-72 bg-[#f5b335]/8 rounded-full blur-[100px]" />
          <div className="absolute -bottom-16 -right-16 w-80 h-80 bg-[#1d4fa5]/15 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-[#f5b335]/5 rounded-full blur-[80px]" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,179,53,0.06)_0%,transparent_50%)]" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-widest bg-[#f5b335]/10 border-[#f5b335]/25 text-[#f5b335] mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            Portail Talent Academia
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-3">
            Espace Candidat <span className="text-[#f5b335]">Augmenté</span>
          </h1>
          <p className="text-sm md:text-base text-blue-100/70 max-w-xl mx-auto">
            Postulez instantanément grâce à notre parcours de candidature simplifiée intégrant l&apos;analyse IA.
          </p>

          {/* Stats strip */}
          {schools.length > 0 && (
            <div className="mt-8 flex flex-wrap justify-center gap-6 md:gap-10">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-white">{schools.length}</p>
                <p className="text-[10px] md:text-xs text-blue-200/60 font-medium uppercase tracking-wider">Établissements</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-[#f5b335]">
                  {schools.reduce((sum: number, s: any) => sum + (s.activeJobsCount || 0), 0)}
                </p>
                <p className="text-[10px] md:text-xs text-blue-200/60 font-medium uppercase tracking-wider">Offres actives</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-extrabold text-white">
                  {schools.filter((s: any) => (s.activeJobsCount || 0) > 0).length}
                </p>
                <p className="text-[10px] md:text-xs text-blue-200/60 font-medium uppercase tracking-wider">Recrutent maintenant</p>
              </div>
            </div>
          )}
        </div>

        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60V30C240 0 480 0 720 30C960 60 1200 60 1440 30V60H0Z" fill="#f8fafc" />
          </svg>
        </div>
      </section>

      <main className="flex-grow pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">

        {loading && (
          <div className="py-12">
            <div className="hidden md:block">
              <JobCardSkeleton count={3} />
            </div>
            <div className="block md:hidden">
              <JobCardSkeletonMobile count={3} />
            </div>
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
              className="px-6 py-2.5 bg-[#0b2f73] text-white text-sm font-semibold rounded-xl hover:bg-[#1521a0] transition-colors"
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
            {/* ═══════════════════════════════════════════════════════
                STEP 1: Select Institution — Dynamically centered cards
                ═══════════════════════════════════════════════════════ */}
            {!selectedSchool && (
              <motion.div key="step-schools" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8">
                {/* Premium search bar */}
                <div className="max-w-lg mx-auto relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#0b2f73]/40" />
                  <input
                    type="text"
                    placeholder="Rechercher un établissement..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-white text-sm shadow-md shadow-slate-200/50 focus:outline-none focus:border-[#f5b335] focus:ring-2 focus:ring-[#f5b335]/20 transition-all"
                  />
                </div>

                {/* Dynamically centered school cards grid */}
                <div className="flex flex-wrap justify-center gap-6">
                  {filteredSchools.map((school) => (
                    <motion.div
                      key={school.id}
                      onClick={() => handleSelectSchool(school)}
                      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(11,47,115,0.12)' }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      className="group cursor-pointer bg-white border border-slate-100 rounded-2xl shadow-md shadow-slate-100/60 hover:border-[#f5b335]/30 transition-colors flex flex-col relative overflow-hidden w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                    >
                      {/* Gold accent bar on top */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#f5b335] via-[#ffd166] to-[#f5b335] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* Card header: Logo + Name + Badge */}
                      <div className="p-5 pb-3">
                        <div className="flex justify-between items-start mb-3">
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
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#0b2f73]/5 to-[#1d4fa5]/10 border border-[#0b2f73]/10 flex items-center justify-center text-[#0b2f73]">
                              <Building2 className="h-6 w-6" />
                            </div>
                          )}
                          {school.activeJobsCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#f5b335]/10 text-[#0b2f73] border border-[#f5b335]/20 shadow-sm relative">
                              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f5b335] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f5b335]"></span>
                              </span>
                              {school.activeJobsCount} {school.activeJobsCount > 1 ? 'recrutements' : 'recrutement'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-50 text-slate-400 border border-slate-100">
                              Pas d&apos;offre
                            </span>
                          )}
                        </div>

                        {/* School name + acronym */}
                        <h3 className="font-bold text-[#0b2f73] text-sm leading-snug group-hover:text-[#1d4fa5] transition-colors">
                          {getSchoolDisplayName(school)}
                        </h3>

                        {/* Slogan */}
                        {getSchoolSlogan(school) && (
                          <p className="text-[10px] text-slate-400 mt-0.5 italic line-clamp-1">
                            {getSchoolSlogan(school)}
                          </p>
                        )}

                        {/* Location — smart deduplication */}
                        {buildSmartAddress(school) && (
                          <p className="text-[11px] text-slate-500 mt-1.5 flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                            <span className="line-clamp-2">{buildSmartAddress(school)}</span>
                          </p>
                        )}
                      </div>

                      {/* Contact info section */}
                      <div className="px-5 pb-3 space-y-1.5">
                        {/* Phone numbers */}
                        {(getSchoolPhone(school) || getSchoolPhoneSecondary(school)) && (
                          <div className="flex flex-col gap-0.5">
                            {getSchoolPhone(school) && (
                              <a
                                href={`tel:${getSchoolPhone(school)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[#0b2f73] transition-colors group/contact"
                              >
                                <Phone className="h-3 w-3 shrink-0 text-[#1d4fa5]/50 group-hover/contact:text-[#1d4fa5]" />
                                <span className="truncate">{getSchoolPhone(school)}</span>
                              </a>
                            )}
                            {getSchoolPhoneSecondary(school) && (
                              <a
                                href={`tel:${getSchoolPhoneSecondary(school)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-[#0b2f73] transition-colors group/contact"
                              >
                                <Phone className="h-3 w-3 shrink-0 text-slate-300 group-hover/contact:text-[#1d4fa5]" />
                                <span className="truncate">{getSchoolPhoneSecondary(school)}</span>
                              </a>
                            )}
                          </div>
                        )}

                        {/* Email */}
                        {getSchoolEmail(school) && (
                          <a
                            href={`mailto:${getSchoolEmail(school)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[#0b2f73] transition-colors group/contact"
                          >
                            <Mail className="h-3 w-3 shrink-0 text-[#1d4fa5]/50 group-hover/contact:text-[#1d4fa5]" />
                            <span className="truncate">{getSchoolEmail(school)}</span>
                          </a>
                        )}

                        {/* Website */}
                        {getSchoolWebsite(school) && (
                          <a
                            href={getSchoolWebsite(school)!.startsWith('http') ? getSchoolWebsite(school)! : `https://${getSchoolWebsite(school)!}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-[#0b2f73] transition-colors group/contact"
                          >
                            <Globe className="h-3 w-3 shrink-0 text-[#1d4fa5]/50 group-hover/contact:text-[#1d4fa5]" />
                            <span className="truncate">{getSchoolWebsite(school)!.replace(/^https?:\/\//, '')}</span>
                          </a>
                        )}
                      </div>

                      {/* CTA footer */}
                      <div className="mt-auto px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#0b2f73] group-hover:text-[#f5b335] transition-colors">
                        <span>Découvrir les offres</span>
                        <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════════════════
                STEP 2: Job Board or Application
                ═══════════════════════════════════════════════════════ */}
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

                {/* School header card with full contact info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start gap-4">
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
                      <div className="h-14 w-14 rounded-xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#0b2f73]">
                        <Building2 className="h-7 w-7" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-extrabold text-slate-900 text-lg truncate">
                        {getSchoolDisplayName(selectedSchool)}
                      </h2>
                      {getSchoolSlogan(selectedSchool) && (
                        <p className="text-[11px] text-slate-400 italic mt-0.5">{getSchoolSlogan(selectedSchool)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
                        {buildSmartAddress(selectedSchool) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {buildSmartAddress(selectedSchool)}
                          </span>
                        )}
                        {getSchoolPhone(selectedSchool) && (
                          <a href={`tel:${getSchoolPhone(selectedSchool)}`} className="flex items-center gap-1 hover:text-[#0b2f73] transition-colors"><Phone className="h-3 w-3" /> {getSchoolPhone(selectedSchool)}</a>
                        )}
                        {getSchoolPhoneSecondary(selectedSchool) && (
                          <a href={`tel:${getSchoolPhoneSecondary(selectedSchool)}`} className="flex items-center gap-1 hover:text-[#0b2f73] transition-colors"><Phone className="h-3 w-3 text-slate-400" /> {getSchoolPhoneSecondary(selectedSchool)}</a>
                        )}
                        {getSchoolEmail(selectedSchool) && (
                          <a href={`mailto:${getSchoolEmail(selectedSchool)}`} className="flex items-center gap-1 hover:text-[#0b2f73] transition-colors"><Mail className="h-3 w-3" /> {getSchoolEmail(selectedSchool)}</a>
                        )}
                        {getSchoolWebsite(selectedSchool) && (
                          <a
                            href={getSchoolWebsite(selectedSchool)!.startsWith('http') ? getSchoolWebsite(selectedSchool)! : `https://${getSchoolWebsite(selectedSchool)!}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:text-[#0b2f73] transition-colors"
                          >
                            <Globe className="h-3 w-3" />
                            {getSchoolWebsite(selectedSchool)!.replace(/^https?:\/\//, '')}
                          </a>
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
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedJob?.id === job.id
                              ? 'border-[#f5b335]/40 bg-[#f5b335]/5 shadow-sm'
                              : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm text-slate-800 leading-snug">{job.title}</h4>
                            <Bookmark className={`h-4 w-4 shrink-0 ${selectedJob?.id === job.id ? 'text-[#f5b335]' : 'text-slate-300'}`} />
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">{job.dept}</p>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                            {job.contractType && (
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{job.contractType}</span>
                            )}
                            {job.loc && (
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.loc}</span>
                            )}
                          </div>
                          {job.salary && (
                            <p className="text-[10px] font-semibold text-[#0b2f73] mt-1.5 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />{job.salary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Right: Job detail */}
                    <div className="lg:col-span-2">
                      {selectedJob ? (
                        <motion.div
                          key={selectedJob.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                          {/* Job detail header */}
                          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                            <h2 className="text-xl font-extrabold text-slate-900">{selectedJob.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{selectedJob.dept}</span>
                              {selectedJob.loc && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedJob.loc}</span>}
                              {selectedJob.contractType && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#0b2f73]/5 text-[#0b2f73] font-semibold">{selectedJob.contractType}</span>}
                              {selectedJob.salary && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{selectedJob.salary}</span>}
                              {selectedJob.academicLevel && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{selectedJob.academicLevel}</span>}
                              {selectedJob.experience && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{selectedJob.experience}</span>}
                            </div>
                          </div>

                          <div className="p-6 space-y-5">
                            {selectedJob.description && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Description</h4>
                                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{selectedJob.description}</p>
                              </div>
                            )}
                            {selectedJob.missions && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Missions</h4>
                                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{selectedJob.missions}</p>
                              </div>
                            )}
                            {selectedJob.responsibilities && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Responsabilités</h4>
                                <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{selectedJob.responsibilities}</p>
                              </div>
                            )}
                            {selectedJob.skillsRequired && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Compétences requises</h4>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {selectedJob.skillsRequired.split(',').map((skill, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-[#0b2f73]/5 text-[#0b2f73] text-[10px] font-semibold rounded-lg">{skill.trim()}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Stats */}
                            {jobStats && (
                              <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
                                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{jobStats.totalApplicants} candidat{jobStats.totalApplicants !== 1 ? 's' : ''}</span>
                                {jobStats.countries.length > 0 && (
                                  <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{jobStats.countries.length} pays</span>
                                )}
                              </div>
                            )}

                            {/* Easy Apply CTA */}
                            <button
                              onClick={() => { setIsApplying(true); setCurrentStep(1); setSubmitResult(null); }}
                              className="w-full py-3 bg-[#0b2f73] text-white rounded-xl font-bold text-sm hover:bg-[#1521a0] transition-colors flex items-center justify-center gap-2"
                            >
                              <Send className="h-4 w-4" /> Easy Apply
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                          <Briefcase className="h-12 w-12 mb-3 text-slate-200" />
                          <p className="text-sm font-medium">Sélectionnez un poste pour voir les détails</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )
                ) : (
                  /* ─── Application Form ─── */
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                      <h3 className="text-base font-extrabold text-slate-900">Candidature — {selectedJob?.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Étape {currentStep} sur 5</p>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#0b2f73] to-[#f5b335] rounded-full transition-all duration-500" style={{ width: `${(currentStep / 5) * 100}%` }} />
                      </div>
                    </div>

                    <div className="p-6 space-y-5">
                      {/* Submission result */}
                      {submitResult && (
                        <div className={`p-4 rounded-xl flex gap-3 text-sm ${submitResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                          {submitResult.success ? <CheckCircle className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
                          <p>{submitResult.message}</p>
                        </div>
                      )}

                      {/* STEP 1: Contact & Identity */}
                      {currentStep === 1 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><User className="h-4 w-4 text-blue-600" /> Identité & Contact</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Prénom *</label>
                              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Prénom" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Nom *</label>
                              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Nom de famille" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Email *</label>
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="votre@email.com" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Téléphone</label>
                              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="+229 90 00 00 00" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Adresse</label>
                              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Adresse" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Pays</label>
                              <input type="text" value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Ville</label>
                              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="Ville" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Genre</label>
                              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs">
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">LinkedIn</label>
                              <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" placeholder="https://linkedin.com/in/votrenom" />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 2: Work Experience */}
                      {currentStep === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><Briefcase className="h-4 w-4 text-blue-600" /> Expérience professionnelle</h4>
                          
                          {experiences.length > 0 && (
                            <div className="space-y-2">
                              {experiences.map((exp, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-slate-800">{exp.title} — {exp.company}</p>
                                    <p className="text-slate-500">{exp.years}</p>
                                    {exp.description && <p className="text-slate-500 mt-1">{exp.description}</p>}
                                  </div>
                                  <button type="button" onClick={() => removeExperience(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border border-dashed border-slate-200 rounded-xl">
                            <input type="text" value={expTitle} onChange={e => setExpTitle(e.target.value)} placeholder="Poste occupé" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <input type="text" value={expCompany} onChange={e => setExpCompany(e.target.value)} placeholder="Établissement / Entreprise" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <input type="text" value={expYears} onChange={e => setExpYears(e.target.value)} placeholder="Période (ex: 2020-2023)" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <div className="flex gap-2">
                              <input type="text" value={expDesc} onChange={e => setExpDesc(e.target.value)} placeholder="Description (optionnel)" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              <button type="button" onClick={addExperience} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition"><Plus className="h-4 w-4 text-slate-600" /></button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3: Education */}
                      {currentStep === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><BookOpen className="h-4 w-4 text-blue-600" /> Formation</h4>

                          {education.length > 0 && (
                            <div className="space-y-2">
                              {education.map((edu, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-slate-800">{edu.degree} — {edu.school}</p>
                                    <p className="text-slate-500">{edu.year}</p>
                                  </div>
                                  <button type="button" onClick={() => removeEducation(i)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 border border-dashed border-slate-200 rounded-xl">
                            <input type="text" value={eduDegree} onChange={e => setEduDegree(e.target.value)} placeholder="Diplôme" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <input type="text" value={eduSchool} onChange={e => setEduSchool(e.target.value)} placeholder="Établissement" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                            <div className="flex gap-2">
                              <input type="text" value={eduYear} onChange={e => setEduYear(e.target.value)} placeholder="Année" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                              <button type="button" onClick={addEducation} className="px-3 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition"><Plus className="h-4 w-4 text-slate-600" /></button>
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
                              <Upload className="h-6 w-6 text-[#0b2f73] mb-2" />
                              <span className="text-[10px] font-bold text-slate-700">Curriculum Vitae *</span>
                              <span className="text-[9px] text-slate-400 mt-1">{cvFile ? cvFile.name : 'PDF, DOCX'}</span>
                            </div>

                            {/* Letter */}
                            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className="h-6 w-6 text-[#0b2f73] mb-2" />
                              <span className="text-[10px] font-bold text-slate-700">Lettre de motivation</span>
                              <span className="text-[9px] text-slate-400 mt-1">{coverFile ? coverFile.name : 'PDF, DOCX'}</span>
                            </div>
                          </div>

                          {/* Recommendation */}
                          <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setRecoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                            <Upload className="h-6 w-6 text-[#0b2f73] mb-2" />
                            <span className="text-[10px] font-bold text-slate-700">Lettre de recommandation académique</span>
                            <span className="text-[9px] text-slate-400 mt-1">{recoFile ? recoFile.name : 'PDF, DOCX'}</span>
                          </div>

                          {/* AI Processing notice */}
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex gap-2 text-[10px] text-slate-600">
                            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                            <p>En transmettant vos documents, le système analysERA la cohérence de vos diplômes et rédigera une note de synthèse pour la direction.</p>
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
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* ═══════════════════════════════════════════════════════
          FOOTER — Academia Helm branded, using InstitutionalFooter
          ═══════════════════════════════════════════════════════ */}
      <InstitutionalFooter />
    </div>
  );
}
