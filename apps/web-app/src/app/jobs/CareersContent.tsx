'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Header } from '@/components/ui/header-1';
import { JobCardSkeleton } from '@/components/loading/Skeleton';
import { JobCardSkeletonMobile } from '@/components/loading/SkeletonMobile';
import { compressImageFileToDataUrl } from '@/lib/media';
import RichContent from '@/components/ui/RichContent';


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
  /** Atouts / Bonus points (séparés par virgules) */
  assets?: string;
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

  // Track whether the school was auto-selected from URL to prevent
  // handleSelectSchool from re-running on every URL change
  const [schoolAutoSelected, setSchoolAutoSelected] = useState(false);

  // Multi-Step Form States
  const [isApplying, setIsApplying] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Track job IDs the user has already applied to (prevents duplicate applications)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  
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

  // Step 2 (simplified): Motivation pitch only.
  // experiences/education/skills state is retained for backend backward-compat
  // (always submitted as empty arrays since the collection UI was removed).
  const [experiences, setExperiences] = useState<WorkExperience[]>([]);
  const [education, setEducation] = useState<EducationItem[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [pitch, setPitch] = useState('');

  // Step 3: Document Uploads
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [applicationLetterFile, setApplicationLetterFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [recoFile, setRecoFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  /** Validate current step before allowing progression */
  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return !!(firstName.trim() && lastName.trim() && email.trim());
      case 3:
        return !!(cvFile && applicationLetterFile);
      default:
        return true;
    }
  };

  /** Reset all form fields to initial values */
  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCountry('Bénin');
    setCity('');
    setGender('M');
    setLinkedinUrl('');
    setExperiences([]);
    setEducation([]);
    setSkills([]);
    setPitch('');
    setCvFile(null);
    setApplicationLetterFile(null);
    setCoverFile(null);
    setRecoFile(null);
    setCurrentStep(1);
    setSubmitResult(null);
    setApplicationSubmitted(false);
  };

  // Auto-scroll ref for job list when > 5 cards
  const jobListRef = useRef<HTMLDivElement>(null);
  const scrollAnimRef = useRef<number | null>(null);
  const isHoveredRef = useRef(false);
  // Ref for scrolling to job detail on mobile
  const jobDetailRef = useRef<HTMLDivElement>(null);

  // Infinite auto-scroll animation — seamless loop, pauses on hover/touch
  // Cards are duplicated in JSX when > 5, so scrollHeight = 2 × singleSetHeight.
  // When scrollTop passes one full set, we seamlessly reset by subtracting singleSetHeight.
  useEffect(() => {
    const container = jobListRef.current;
    if (!container || jobs.length <= 5) return;

    const speed = 0.8; // px per frame — visible smooth scrolling

    function animate() {
      if (!container) return;

      // Pause on hover or touch
      if (isHoveredRef.current) {
        scrollAnimRef.current = requestAnimationFrame(animate);
        return;
      }

      container.scrollTop += speed;

      // Seamless reset: when scrollTop passes one full set of cards,
      // jump back by one set height (duplicated cards make this invisible)
      const singleSetHeight = container.scrollHeight / 2;
      if (singleSetHeight > 0 && container.scrollTop >= singleSetHeight) {
        container.scrollTop -= singleSetHeight;
      }

      scrollAnimRef.current = requestAnimationFrame(animate);
    }

    scrollAnimRef.current = requestAnimationFrame(animate);

    return () => {
      if (scrollAnimRef.current) cancelAnimationFrame(scrollAnimRef.current);
    };
  }, [jobs.length]);

  // On mobile, scroll to job detail panel when a job is selected
  useEffect(() => {
    if (!selectedJob || !jobDetailRef.current) return;
    // Only auto-scroll on small screens (mobile)
    if (window.innerWidth < 1024) {
      setTimeout(() => {
        jobDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [selectedJob?.id]);

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
        // Timeout augmenté — le backend peut avoir un cold start Neon DB
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000);
        const res = await fetch('/api/public/schools/with-jobs', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSchools(data);
            return;
          }
        }
        // Fallback vers /list si /with-jobs échoue
        try {
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackController.abort(), 30000);
          const fallbackRes = await fetch('/api/public/schools/list', { signal: fallbackController.signal });
          clearTimeout(fallbackTimeout);
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
        const errorBody = await res.json().catch(() => null);
        const errorMsg = res.status === 504
          ? 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.'
          : 'Impossible de charger les établissements. Vérifiez votre connexion et réessayez.';
        setLoadError(errorBody?.message || errorMsg);
      } catch (err: any) {
        console.error('Failed to load schools:', err);
        if (err.name === 'AbortError') {
          setLoadError('Le serveur met trop de temps à répondre. Réessayez dans quelques instants.');
        } else {
          setLoadError('Erreur réseau. Vérifiez votre connexion et réessayez.');
        }
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
  // Uses schoolAutoSelected guard to prevent re-running when URL changes
  // (e.g. when clicking a job card pushes /jobs/school/job-slug)
  // CRITICAL: If forcedJobSlug is set, the deep-link useEffect handles
  // both school AND job selection — this useEffect must NOT interfere,
  // otherwise it calls handleSelectSchool() which resets selectedJob to null.
  useEffect(() => {
    if (forcedJobSlug) return; // Deep-link will handle everything
    if (initialSchool) return;
    if (schoolAutoSelected) return; // Already auto-selected, don't re-run
    if (schools.length > 0 && schoolParam && !selectedSchool) {
      const match = schools.find(s => s.slug === schoolParam);
      if (match) {
        setSchoolAutoSelected(true);
        handleSelectSchool(match);
      }
    }
  }, [schools, schoolParam, forcedJobSlug, selectedSchool, initialSchool, schoolAutoSelected]);

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

  // Soumission de candidature simplifiée
  const handleSubmitApplication = async () => {
    if (!selectedSchool || !selectedJob) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      // ─── Pattern data URL (identique au logo école + photo profil) ───────
      // Convertir chaque fichier en data URL côté navigateur :
      // - Images : compression (1600px, JPEG 0.85)
      // - PDF et autres : lecture directe en base64
      const fileToDataUrl = async (file: File | null): Promise<{ fileName: string; fileDataUrl: string; mimeType: string; fileSize: number } | null> => {
        if (!file) return null;
        const isImage = file.type.startsWith('image/');
        let fileDataUrl: string;
        if (isImage) {
          fileDataUrl = await compressImageFileToDataUrl(file, { maxEdge: 1600, quality: 0.85, mimeType: 'image/jpeg' });
        } else {
          fileDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
            reader.readAsDataURL(file);
          });
        }
        return {
          fileName: file.name,
          fileDataUrl,
          mimeType: file.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
          fileSize: file.size,
        };
      };

      const cvData = await fileToDataUrl(cvFile);
      const applicationLetterData = await fileToDataUrl(applicationLetterFile);
      const coverData = await fileToDataUrl(coverFile);
      const recoData = await fileToDataUrl(recoFile);

      const payload: any = {
        tenantId: selectedSchool.tenantId || selectedSchool.id,
        jobId: selectedJob.id,
        firstName,
        lastName,
        email,
        phone,
        address,
        country,
        city,
        gender,
        linkedinUrl,
        experiences,
        education,
        skills,
        pitch,
      };
      if (cvData) payload.cv = cvData;
      if (applicationLetterData) payload.applicationLetter = applicationLetterData;
      if (coverData) payload.coverLetter = coverData;
      if (recoData) payload.recommendationLetter = recoData;

      // Race the fetch against a hard 25s timeout. If the backend is too slow
      // (AI analysis blocking, etc.), we optimistically show a success message.
      const FETCH_TIMEOUT_MS = 25_000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let res: Response;
      let data: any;
      let timedOut = false;
      try {
        res = await fetch('/api/hr/recruitment/upload-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        data = await res.json();
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr?.name === 'AbortError') {
          // Timeout — assume the request reached the backend but the response
          // is too slow. The candidate was likely created (the backend writes
          // the record synchronously with heuristic scores before scheduling
          // the AI analysis). Show a success message and let the user know
          // they may be contacted.
          timedOut = true;
          res = { ok: true, status: 200 } as Response;
          data = { candidate: { id: 'pending' }, application: { id: 'pending' }, documents: [] };
        } else {
          throw fetchErr;
        }
      }

      if (res.ok && data) {
        setSubmitResult({
          success: true,
          message: timedOut
            ? 'Candidature reçue ! Notre système a enregistré votre dossier. Sarah, notre Assistante RH, récupère et analyse automatiquement votre CV, votre lettre de demande d\'emploi et vos pièces jointes pour évaluer votre adéquation au poste. Notre équipe RH reviendra vers vous prochainement.'
            : 'Candidature transmise avec succès ! Sarah, notre Assistante RH, récupère et analyse automatiquement votre CV, votre lettre de demande d\'emploi et vos pièces jointes pour évaluer votre adéquation au poste. Notre équipe RH reviendra vers vous prochainement.'
        });
        setApplicationSubmitted(true);
        // Mark this job as applied to prevent re-application
        if (selectedJob) {
          setAppliedJobIds(prev => new Set(prev).add(selectedJob.id));
        }
      } else {
        // Check for duplicate application error (HTTP 409 Conflict)
        const isDuplicate = res.status === 409;
        const serverMsg = data?.message || data?.error || '';
        const detail = data?.detail || '';
        const fullMsg = [serverMsg, detail].filter(Boolean).join(' — ');
        setSubmitResult({
          success: false,
          message: isDuplicate
            ? (fullMsg || 'Vous avez déjà soumis une candidature pour cette offre.')
            : fullMsg
              ? `Erreur : ${fullMsg}`
              : `Erreur serveur (${res.status}). Veuillez réessayer.`
        });
        // If duplicate detected, mark job as applied
        if (isDuplicate && selectedJob) {
          setAppliedJobIds(prev => new Set(prev).add(selectedJob.id));
        }
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
   * Format salary with F CFA suffix if not already present.
   * Examples: "52000" → "52 000 F CFA", "52000 F CFA" → "52 000 F CFA"
   */
  const formatSalary = (salary: string) => {
    const trimmed = salary.trim();
    // Already has currency suffix
    if (/\s*(F\s*CFA|CFA|FCFA|XOF)\s*$/i.test(trimmed)) {
      return trimmed;
    }
    // Add space as thousands separator if it's a plain number
    const withSpaces = trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${withSpaces} F CFA`;
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
      <Header />

      {/* ═══════════════════════════════════════════════════════
          HERO — Premium navy gradient with golden accents
          ═══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b2f73] via-[#103e91] to-[#1d4fa5] pt-24 pb-12 md:pt-28 md:pb-20">
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
            <div className="mt-6 md:mt-8 flex flex-wrap justify-center gap-4 md:gap-10">
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

      <main className="flex-grow pb-12 md:pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">

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
                const retryController = new AbortController();
                const retryTimeout = setTimeout(() => retryController.abort(), 35000);
                fetch('/api/public/schools/with-jobs', { signal: retryController.signal })
                  .then(res => { clearTimeout(retryTimeout); return res.ok ? res.json() : Promise.reject('API error'); })
                  .then(data => { if (Array.isArray(data)) setSchools(data); })
                  .catch((err) => {
                    if (err?.name === 'AbortError') {
                      setLoadError('Le serveur met trop de temps à répondre. Réessayez dans quelques instants.');
                    } else {
                      setLoadError('Impossible de charger les établissements. Vérifiez votre connexion et réessayez.');
                    }
                  })
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
                <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                  {filteredSchools.map((school) => (
                    <motion.div
                      key={school.id}
                      onClick={() => handleSelectSchool(school)}
                      whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(11,47,115,0.12)' }}
                      whileTap={{ scale: 0.98 }}
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
                    if (isApplying || applicationSubmitted) {
                      // Exit application form / success screen → back to school's job listing
                      setIsApplying(false);
                      resetForm();
                    } else {
                      // Exit school's job listing → back to all schools
                      window.location.href = '/jobs';
                    }
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#0b2f73] transition-colors group"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  {(isApplying || applicationSubmitted) ? 'Retour aux offres' : 'Retour aux établissements'}
                </button>

                {/* School header card with full contact info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
                  <div className="flex items-start gap-3 md:gap-4">
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
                      <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-1.5 mt-2 text-xs text-slate-500">
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

                {applicationSubmitted && submitResult?.success ? (
                  /* ─── Success Confirmation Screen ─── */
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div className="p-6 md:p-10 flex flex-col items-center text-center">
                      {/* Animated checkmark */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                        className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6"
                      >
                        <CheckCircle className="w-12 h-12 text-emerald-600" />
                      </motion.div>

                      <h3 className="text-lg md:text-xl font-extrabold text-slate-900 mb-2">
                        Candidature transmise !
                      </h3>
                      <p className="text-sm text-slate-500 mb-6 max-w-md">
                        Votre candidature pour le poste de <span className="font-bold text-slate-800">{selectedJob?.title}</span> a été envoyée avec succès. Notre IA procède à l'extraction sémantique et à la validation des diplômes/certifications.
                      </p>

                      {/* Summary card */}
                      <div className="w-full max-w-sm bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-left space-y-2">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <User className="h-4 w-4 text-[#0b2f73]" />
                          <span className="font-semibold">{firstName} {lastName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Mail className="h-4 w-4 text-[#0b2f73]" />
                          <span>{email}</span>
                        </div>
                        {phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            <Phone className="h-4 w-4 text-[#0b2f73]" />
                            <span>{phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Building2 className="h-4 w-4 text-[#f5b335]" />
                          <span>{selectedSchool?.schoolName || selectedSchool?.tenantName}</span>
                        </div>
                      </div>

                      {/* AI Processing notice */}
                      <div className="w-full max-w-sm p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex gap-2 text-[11px] text-slate-600 mb-6">
                        <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                        <p>Le système analyse la cohérence de vos diplômes et rédigera une note de synthèse pour la direction.</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                        <button
                          onClick={() => {
                            setIsApplying(false);
                            resetForm();
                          }}
                          className="flex-1 px-5 py-3 bg-[#0b2f73] text-white rounded-xl text-xs font-bold hover:bg-[#1521a0] transition-colors flex items-center justify-center gap-2"
                        >
                          <Briefcase className="h-4 w-4" />
                          Voir les autres offres
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : !isApplying ? (
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
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {/* Left: Job list — Premium Academia Helm design */}
                    <div className="lg:col-span-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-bold text-[#0b2f73] uppercase tracking-wider flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-[#f5b335]" />
                          Postes ouverts
                        </h3>
                        <span className="text-[10px] font-bold text-white bg-gradient-to-r from-[#0b2f73] to-[#1d4fa5] rounded-full px-3 py-1 shadow-sm shadow-[#0b2f73]/20">{jobs.length}</span>
                      </div>
                      <div
                        ref={jobListRef}
                        className={`space-y-3 ${jobs.length > 5 ? 'max-h-[340px] md:max-h-[420px] hide-scrollbar' : ''}`}
                        onMouseEnter={() => { if (jobs.length > 5) isHoveredRef.current = true; }}
                        onMouseLeave={() => { if (jobs.length > 5) isHoveredRef.current = false; }}
                        onTouchStart={() => { if (jobs.length > 5) isHoveredRef.current = true; }}
                        onTouchEnd={() => { if (jobs.length > 5) setTimeout(() => { isHoveredRef.current = false; }, 3000); }}
                        style={jobs.length > 5 ? {
                          overflowY: 'scroll',
                          maskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 96%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 4%, black 96%, transparent 100%)',
                        } : undefined}
                      >
                      {(jobs.length > 5 ? [...jobs, ...jobs] : jobs).map((job, index) => (
                        <motion.div
                          key={jobs.length > 5 ? `${job.id}-${index}` : job.id}
                          onClick={() => {
                            setSelectedJob(job);
                            if (selectedSchool?.slug && job.slug) {
                              // Use history.pushState to update URL without triggering
                              // Next.js page navigation (which would unmount CareersContent
                              // and remount from scratch, causing the school header flash).
                              // A full page refresh will correctly resolve via the
                              // [schoolSlug]/[jobSlug]/page.tsx server component.
                              window.history.pushState(null, '', `/jobs/${selectedSchool.slug}/${job.slug}`);
                            }
                          }}
                          whileHover={{ x: 4 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                          className={`group relative p-4 rounded-xl border cursor-pointer transition-all overflow-hidden ${
                            selectedJob?.id === job.id
                              ? 'border-[#f5b335]/60 bg-gradient-to-br from-[#f5b335]/10 via-white to-[#0b2f73]/5 shadow-lg shadow-[#f5b335]/15 ring-1 ring-[#f5b335]/20'
                              : 'border-slate-200/80 bg-white hover:border-[#0b2f73]/25 hover:shadow-lg hover:shadow-[#0b2f73]/8'
                          }`}
                        >
                          {/* Animated gold accent left bar when selected */}
                          {selectedJob?.id === job.id ? (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#f5b335] via-[#ffd166] to-[#f5b335] rounded-r" />
                          ) : (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0b2f73]/0 group-hover:bg-[#0b2f73]/40 rounded-r transition-colors duration-300" />
                          )}

                          {/* Top row: title + applied badge + bookmark */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-bold text-sm leading-snug transition-colors ${selectedJob?.id === job.id ? 'text-[#0b2f73]' : 'text-slate-800 group-hover:text-[#0b2f73]'}`}>
                              {job.title}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {appliedJobIds.has(job.id) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                  <CheckCircle className="h-2.5 w-2.5" />Postulé
                                </span>
                              )}
                              <Bookmark className={`h-4 w-4 shrink-0 transition-all ${selectedJob?.id === job.id ? 'text-[#f5b335] fill-[#f5b335]/30' : 'text-slate-200 group-hover:text-[#1d4fa5]/40'}`} />
                            </div>
                          </div>

                          {/* Department badge */}
                          {job.dept && (
                            <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded-md text-[10px] font-bold ${
                              selectedJob?.id === job.id
                                ? 'bg-[#0b2f73]/10 text-[#0b2f73]'
                                : 'bg-[#1d4fa5]/8 text-[#1d4fa5]/80 group-hover:bg-[#0b2f73]/8 group-hover:text-[#0b2f73]'
                            } transition-colors`}>
                              <Building2 className="h-2.5 w-2.5" />{job.dept}
                            </span>
                          )}

                          {/* Contract type + Location */}
                          <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            {job.contractType && (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                selectedJob?.id === job.id
                                  ? 'bg-[#f5b335]/15 text-[#0b2f73] ring-1 ring-[#f5b335]/20'
                                  : 'bg-[#0b2f73]/6 text-[#0b2f73]/70 group-hover:bg-[#0b2f73]/10'
                              } transition-colors`}>
                                <Clock className="h-2.5 w-2.5" />{job.contractType}
                              </span>
                            )}
                            {job.loc && (
                              <span className="flex items-center gap-1 text-[10px] text-slate-400 group-hover:text-slate-500 transition-colors">
                                <MapPin className="h-2.5 w-2.5" />{job.loc}
                              </span>
                            )}
                          </div>

                          {/* Salary — gold highlighted */}
                          {job.salary && (
                            <div className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 w-fit ${
                              selectedJob?.id === job.id
                                ? 'bg-gradient-to-r from-[#f5b335]/15 to-[#f5b335]/5'
                                : 'bg-[#f5b335]/8 group-hover:bg-[#f5b335]/12'
                            } transition-colors`}>
                              <DollarSign className="h-3.5 w-3.5 text-[#f5b335]" />
                              <span className="text-[11px] font-extrabold text-[#0b2f73]">{formatSalary(job.salary)}</span>
                            </div>
                          )}

                          {/* Chevron indicator */}
                          <div className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-all ${selectedJob?.id === job.id ? 'opacity-100 text-[#f5b335]' : 'opacity-0 group-hover:opacity-50 text-[#1d4fa5]'}`}>
                            <ChevronRight className="h-4 w-4" />
                          </div>
                        </motion.div>
                      ))}
                      </div>
                    </div>

                    {/* Right: Job detail OR recruitment portrait placeholder */}
                    <div className="lg:col-span-2" ref={jobDetailRef}>
                      {selectedJob ? (
                        <motion.div
                          key={selectedJob.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                          {/* Job detail header */}
                          <div className="p-4 md:p-6 border-b border-slate-100 bg-gradient-to-r from-[#0b2f73]/[0.03] to-white">
                            <h2 className="text-lg md:text-xl font-extrabold text-[#0b2f73]">{selectedJob.title}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 md:gap-x-4 gap-y-2 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{selectedJob.dept}</span>
                              {selectedJob.loc && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedJob.loc}</span>}
                              {selectedJob.contractType && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0b2f73]/5 text-[#0b2f73] font-semibold">{selectedJob.contractType}</span>}
                              {selectedJob.salary && <span className="flex items-center gap-1 font-bold text-[#0b2f73]"><DollarSign className="h-3.5 w-3.5 text-[#f5b335]" />{formatSalary(selectedJob.salary)}</span>}
                              {selectedJob.academicLevel && <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{selectedJob.academicLevel}</span>}
                              {selectedJob.experience && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{selectedJob.experience}</span>}
                            </div>
                          </div>

                          <div className="p-4 md:p-6 space-y-5">
                            {selectedJob.description && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Description</h4>
                                <RichContent html={selectedJob.description} />
                              </div>
                            )}
                            {selectedJob.missions && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Missions</h4>
                                <RichContent html={selectedJob.missions} />
                              </div>
                            )}
                            {selectedJob.responsibilities && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Responsabilités</h4>
                                <RichContent html={selectedJob.responsibilities} />
                              </div>
                            )}
                            {selectedJob.skillsRequired && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Compétences recherchées</h4>
                                <RichContent html={selectedJob.skillsRequired} />
                              </div>
                            )}
                            {selectedJob.assets && (
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2 uppercase tracking-wider">Atouts (bonus points)</h4>
                                <RichContent html={selectedJob.assets} />
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

                            {/* Bouton Postuler / Déjà postulé */}
                            {appliedJobIds.has(selectedJob?.id || '') ? (
                              <button
                                disabled
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                              >
                                <CheckCircle className="h-4 w-4" /> Déjà postulé
                              </button>
                            ) : (
                              <button
                                onClick={() => { setIsApplying(true); setCurrentStep(1); setSubmitResult(null); setApplicationSubmitted(false); }}
                                className="w-full py-3 bg-[#0b2f73] text-white rounded-xl font-bold text-sm hover:bg-[#1521a0] transition-colors flex items-center justify-center gap-2"
                              >
                                <Send className="h-4 w-4" /> Postuler
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ) : (
                        /* Recruitment portal portrait — shown when no job is selected yet */
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.4 }}
                          className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0b2f73]/[0.04] via-white to-[#1d4fa5]/[0.06]"
                        >
                          <Image
                            src="/images/AcademiaHelm_RecruitmentPortal_Portrait.jpeg"
                            alt="Portail de recrutement Academia Helm"
                            width={896}
                            height={1200}
                            className="w-full h-auto rounded-2xl shadow-lg"
                            style={{ objectFit: 'contain' }}
                            priority
                            sizes="(max-width: 1024px) 100vw, 66vw"
                          />
                          <div className="py-4 text-center">
                            <p className="text-xs font-semibold text-[#0b2f73]/70 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 inline-flex items-center gap-2 shadow-sm">
                              <Briefcase className="h-3.5 w-3.5 text-[#f5b335]" />
                              Sélectionnez un poste pour voir les détails
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                  )
                ) : (
                  /* ─── Application Form ─── */
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 md:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                      <h3 className="text-sm md:text-base font-extrabold text-slate-900">Candidature — {selectedJob?.title}</h3>
                      <p className="text-[11px] text-slate-500 mt-1">Étape {currentStep} sur 3</p>
                      {/* Progress bar */}
                      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#0b2f73] to-[#f5b335] rounded-full transition-all duration-500" style={{ width: `${(currentStep / 3) * 100}%` }} />
                      </div>
                    </div>

                    <div className="p-4 md:p-6 space-y-5">
                      {/* Submission error — success is handled by the confirmation screen */}
                      {submitResult && !submitResult.success && (
                        <div className="p-4 rounded-xl flex gap-3 text-sm bg-red-50 text-red-800 border border-red-100">
                          <XCircle className="h-5 w-5 shrink-0" />
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
                              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="Prénom" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Nom *</label>
                              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="Nom de famille" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Email *</label>
                              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="votre@email.com" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Téléphone</label>
                              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="+229 90 00 00 00" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Adresse</label>
                              <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="Adresse" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Pays</label>
                              <input type="text" value={country} onChange={e => setCountry(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Ville</label>
                              <input type="text" value={city} onChange={e => setCity(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="Ville" />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">Genre</label>
                              <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs">
                                <option value="M">Masculin</option>
                                <option value="F">Féminin</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">LinkedIn</label>
                              <input type="url" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs" placeholder="https://linkedin.com/in/votrenom" />
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 2: Motivation */}
                      {currentStep === 2 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            <Award className="h-4 w-4 text-blue-600" /> Motivation
                          </h4>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">
                              Pourquoi vous ? (1-2 paragraphes)
                            </label>
                            <textarea
                              value={pitch}
                              onChange={(e) => setPitch(e.target.value)}
                              placeholder="Présentez brièvement vos atouts pour ce poste..."
                              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 md:py-2 text-xs h-28"
                            />
                          </div>
                        </motion.div>
                      )}

                      {/* STEP 3: Document Uploads */}
                      {currentStep === 3 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /> Fichiers & Justificatifs</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* CV */}
                            <div className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer ${cvFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className={`h-6 w-6 mb-2 ${cvFile ? 'text-emerald-600' : 'text-[#0b2f73]'}`} />
                              <span className="text-[10px] font-bold text-slate-700">Curriculum Vitae *</span>
                              <span className={`text-[10px] mt-1 ${cvFile ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>{cvFile ? cvFile.name : 'PDF, DOCX — obligatoire'}</span>
                            </div>

                            {/* Lettre de demande d'emploi (required) */}
                            <div className={`border border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer ${applicationLetterFile ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'}`}>
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setApplicationLetterFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className={`h-6 w-6 mb-2 ${applicationLetterFile ? 'text-emerald-600' : 'text-[#0b2f73]'}`} />
                              <span className="text-[10px] font-bold text-slate-700">Lettre de demande d&apos;emploi *</span>
                              <span className={`text-[10px] mt-1 ${applicationLetterFile ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>{applicationLetterFile ? applicationLetterFile.name : 'PDF, DOCX — obligatoire'}</span>
                            </div>

                            {/* Lettre de motivation (optional) */}
                            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className="h-6 w-6 text-[#0b2f73] mb-2" />
                              <span className="text-[10px] font-bold text-slate-700">Lettre de motivation</span>
                              <span className="text-[10px] text-slate-400 mt-1">{coverFile ? coverFile.name : 'PDF, DOCX — optionnel'}</span>
                            </div>

                            {/* Lettre de recommandation (optional) */}
                            <div className="border border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center relative hover:bg-slate-50 transition cursor-pointer">
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setRecoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                              <Upload className="h-6 w-6 text-[#0b2f73] mb-2" />
                              <span className="text-[10px] font-bold text-slate-700">Lettre de recommandation académique</span>
                              <span className="text-[10px] text-slate-400 mt-1">{recoFile ? recoFile.name : 'PDF, DOCX — optionnel'}</span>
                            </div>
                          </div>

                          {/* AI Processing notice */}
                          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg flex gap-2 text-[10px] text-slate-600">
                            <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                            <p>En transmettant votre dossier (CV + lettre de demande d&apos;emploi + pièces jointes), <span className="font-semibold text-indigo-700">Sarah</span>, notre Assistante RH, récupère et analyse automatiquement vos documents : extraction des compétences, évaluation de l&apos;adéquation au poste, score de matching et détection d&apos;anomalies. Les résultats sont mis à la disposition de l&apos;équipe RH pour instruction.</p>
                          </div>
                        </motion.div>
                      )}

                      {/* Navigation buttons */}
                      <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={currentStep === 1 || submitting}
                          onClick={() => setCurrentStep(prev => prev - 1)}
                          className="px-4 py-2.5 md:py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-40"
                        >
                          Précédent
                        </button>

                        {currentStep < 3 ? (
                          <button
                            type="button"
                            disabled={!canProceed()}
                            onClick={() => canProceed() && setCurrentStep(prev => prev + 1)}
                            className="px-5 py-2.5 md:py-2 text-white rounded-lg text-xs font-bold transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: PRIMARY }}
                          >
                            Continuer
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSubmitApplication}
                            disabled={submitting || !cvFile || !applicationLetterFile}
                            className="px-5 py-2.5 md:py-2 text-white rounded-lg text-xs font-bold transition hover:opacity-90 flex items-center gap-1 bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? 'Transmission...' : (!cvFile || !applicationLetterFile) ? 'CV + lettre de demande requis' : 'Soumettre le dossier'}
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

      {/* Simple copyright footer */}
      <footer className="bg-[#0b2f73] text-white/60 py-6 border-t border-[#1d4fa5]/30 text-center text-xs">
        <p>© {new Date().getFullYear()} Academia Helm. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
