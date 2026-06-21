'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase,
  Users,
  Calendar,
  ClipboardList,
  UserCheck,
  Award,
  Plus,
  Search,
  Filter,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  DollarSign,
  MapPin,
  GraduationCap,
  FileText,
  Bookmark,
  Edit2,
  CalendarDays,
  UserPlus,
  Star,
  Linkedin,
  BookOpen,
  HelpCircle,
  ChevronLeft,
  ChevronDown,
  Compass,
  Eye,
  MessageSquare,
  PenTool,
  HeartHandshake,
  ShieldCheck,
  PowerOff,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import RichTextEditor from '@/components/ui/RichTextEditor';
import RichContent from '@/components/ui/RichContent';

const PRIMARY = '#1A2BA6';

interface Job {
  id: string;
  ref: string;
  title: string;
  dept: string;
  loc: string;
  date: string;
  candidates: number;
  status: string;
  publishedAt?: string;
  description?: string;
  missions?: string;
  responsibilities?: string;
  academicLevel?: string;
  experience?: string;
  skillsRequired?: string;
  assets?: string;
  salary?: string;
  contractType?: string;
}

interface CandidateDocument {
  id: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  category: string;
  createdAt: string;
}

interface Candidate {
  id: string;
  applicationId?: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  gender: string;
  job: string;
  score: number;
  scoreCV: number;
  scoreLetter: number;
  scoreMatching: number;
  /** AI/heuristic document analysis score (same as `score`) */
  docScore: number;
  /** Average of all interview scores, or null if none */
  interviewScore: number | null;
  /** Average of all test result scores, or null if none */
  testScore: number | null;
  /** Weighted composite score used for hiring decisions */
  finalScore: number;
  /** Human-readable breakdown of the finalScore */
  scoreBreakdown: string;
  category: string;
  matchDetail: string;
  risks: string;
  riskDetail?: string;
  date: string;
  status: string;
  history: Array<{ action: string; date: string; user: string }>;
  academicProfile?: {
    teachingLevel?: string;
    subjects?: string[];
    pedagogicalExperience?: string;
  };
  documents?: CandidateDocument[];
  /** Toutes les candidatures du candidat (multi-postulation) */
  applications?: Array<{
    id: string;
    jobId: string;
    jobTitle?: string;
    status: string;
    score: number;
    scoreCV: number;
    scoreLetter: number;
    scoreMatching: number;
    staffId?: string | null;
    createdAt?: string;
    matchDetail?: string;
  }>;
  /** ÉLIGIBLE workflow: contract info linked to the candidate's primary application
   *  (only present if the candidate was declared ÉLIGIBLE and a DRAFT/PENDING
   *  contract was auto-created). Used by the Embauches tab to:
   *    - show a "Préparer le contrat" link → /app/hr/contracts/{contractId}
   *    - enable/disable the "Embaucher" button based on employer signature */
  contract?: {
    id: string;
    status: string;        // 'DRAFT' | 'PENDING' | 'ACTIVE'
    isEmployerSigned: boolean;
    startDate?: string;
    contractType?: string;
  } | null;
}

interface Interview {
  id: string;
  candidateId: string;
  candidate?: { firstName: string; lastName: string };
  type: string;
  date: string;
  time: string;
  format: string;
  evaluator: string;
  score: number;
  comments?: string;
  status?: string;
  result?: string;
  feedback?: string;
}

interface Test {
  id: string;
  name: string;
  type: string;
  description?: string;
  duration?: number;
  instructions?: string;
  maxScore: number;
  passingScore: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  results?: Array<{
    id: string;
    testId: string;
    candidateId: string;
    candidate: { firstName: string; lastName: string };
    score: number;
    result: string;
    notes?: string;
    evaluatedAt?: string;
    createdAt: string;
  }>;
}

interface TalentPool {
  id: string;
  candidateId: string;
  candidate: { firstName: string; lastName: string; email: string; phone: string };
  category: string;
  status: string;
  createdAt: string;
}

export function RecruitmentWorkspace() {
  const { tenant } = useModuleContext();
  const confirmDialog = useConfirmDialog();
  const router = useRouter();

  // Valid status transitions (mirrors backend VALID_TRANSITIONS)
  // Two-phase hiring workflow:
  //   ENTRETIEN/TEST → ÉLIGIBLE (creates Staff + DRAFT contract, NO email)
  //   ÉLIGIBLE → EMBAUCHÉ     (sends hire email — requires employer signature)
  const VALID_TRANSITIONS: Record<string, string[]> = {
    'NOUVEAU':     ['EN_COURS', 'REJETÉ'],
    'EN_COURS':    ['ENTRETIEN', 'TEST', 'REJETÉ'],
    'ENTRETIEN':   ['TEST', 'ÉLIGIBLE', 'REJETÉ'],
    'TEST':        ['ÉLIGIBLE', 'REJETÉ'],
    'ÉLIGIBLE':    ['EMBAUCHÉ', 'REJETÉ'],
    'EMBAUCHÉ':    [],
    'REJETÉ':      [],
  };
  const STATUS_LABELS: Record<string, string> = {
    'NOUVEAU': 'Nouveau',
    'EN_COURS': 'En cours',
    'ENTRETIEN': 'Entretien',
    'TEST': 'Test',
    'ÉLIGIBLE': 'Éligible',
    'EMBAUCHÉ': 'Embauché',
    'REJETÉ': 'Rejeté',
  };

  const [activeTab, setActiveTab] = useState<'jobs' | 'candidates' | 'interviews' | 'tests' | 'embauches' | 'talent_pool'>('jobs');
  const [loading, setLoading] = useState(false);

  // Core data states
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [talentPool, setTalentPool] = useState<TalentPool[]>([]);

  // Detailed Modal/Form states
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activeCandidateTab, setActiveCandidateTab] = useState<'identity' | 'profile' | 'documents' | 'ia' | 'history' | 'applications'>('profile');
  const [recruiterRating, setRecruiterRating] = useState<number>(0);
  const [recruiterComment, setRecruiterComment] = useState<string>('');


  // Add/Edit Job Form State
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: '', dept: '', loc: '', status: 'PUBLIÉE', contractType: 'CDI', salary: '', academicLevel: '', experience: '', skillsRequired: '', assets: '', description: '', missions: '', responsibilities: '',
  });

  // Department list (fetched from /api/departments) for the job modal selector
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);

  // Tenant identity (for auto-filling job location)
  const [tenantAddress, setTenantAddress] = useState<string>('');

  // RecruiterProfile (fetched from /api/hr/recruitment/recruiter-profile)
  // Used to pre-fill interview format, evaluator, and default delay
  const [recruiterProfile, setRecruiterProfile] = useState<{
    fullName?: string;
    defaultInterviewFormat?: string;
    defaultInterviewDelayHr?: number;
  } | null>(null);

  // Staff list (for the interview evaluator selector)
  const [staffList, setStaffList] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    position?: string | null;
  }>>([]);

  // Hire Confirmation State
  const [hireCandidate, setHireCandidate] = useState<Candidate | null>(null);
  const [hiring, setHiring] = useState(false);

  // Add Candidate Form State
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', gender: 'M', jobId: '', status: 'NOUVEAU'
  });

  // Onboarding Guide State
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideExpanded, setGuideExpanded] = useState<number | null>(null);

  // Pipeline steps data for the onboarding guide
  const PIPELINE_STEPS = [
    {
      id: 'candidature',
      title: 'Candidature',
      subtitle: 'Réception & Analyse IA',
      icon: Users,
      color: 'bg-blue-500',
      colorLight: 'bg-blue-50 border-blue-100',
      textColor: 'text-blue-700',
      tab: 'candidates',
      description: 'Le processus commence par la réception d\'une candidature. Le candidat peut postuler via la page publique d\'offres d\'emploi ou être enregistré manuellement par le recruteur.',
      details: [
        { label: 'Soumission', text: 'Le candidat soumet son CV, sa lettre de motivation et sa lettre de recommandation via le formulaire de candidature en ligne ou le recruteur crée le dossier manuellement.' },
        { label: 'Analyse IA (HTIP)', text: 'Notre système d\'intelligence artificielle analyse automatiquement les documents soumis. Il génère un score global composé de : Score CV (40%), Score Lettre de Motivation (10%), Score d\'Adéquation (50%). Ce score reflète la correspondance entre le profil du candidat et les exigences du poste.' },
        { label: 'Détection des risques (HDIE)', text: 'L\'IA détecte les incohérences potentielles : chevauchement de dates, informations contradictoires, ou signaux d\'alerte dans le parcours du candidat. Ces alertes aident le recruteur à prendre une décision éclairée.' },
        { label: 'Statut initial', text: 'La candidature démarre au statut NOUVEAU. Le recruteur peut ensuite la faire avancer dans le pipeline en changeant le statut via le menu déroulant.' },
      ],
    },
    {
      id: 'en-cours',
      title: 'En cours',
      subtitle: 'Examen du dossier',
      icon: Eye,
      color: 'bg-amber-500',
      colorLight: 'bg-amber-50 border-amber-100',
      textColor: 'text-amber-700',
      tab: 'candidates',
      description: 'L\'étape "En cours" indique que le dossier du candidat est en cours d\'examen par l\'équipe de recrutement. C\'est une étape de transition avant l\'entretien.',
      details: [
        { label: 'Examen du dossier', text: 'Le recruteur consulte les documents du candidat, vérifie les critères d\'éligibilité, et évalue la pertinence du profil par rapport au poste à pourvoir.' },
        { label: 'Décision', text: 'À cette étape, le recruteur décide soit de convoquer le candidat à un entretien, soit de lui faire passer un test technique, soit de rejeter la candidature si le profil ne correspond pas.' },
        { label: 'Transition automatique', text: 'Lorsqu\'un entretien est planifié pour un candidat, son statut passe automatiquement à "Entretien". De même, si un test est programmé, le statut avance en conséquence.' },
      ],
    },
    {
      id: 'entretien',
      title: 'Entretien',
      subtitle: 'Évaluation humaine & comportementale',
      icon: MessageSquare,
      color: 'bg-violet-500',
      colorLight: 'bg-violet-50 border-violet-100',
      textColor: 'text-violet-700',
      tab: 'interviews',
      description: 'L\'entretien est l\'étape clé où le recruteur (ou l\'équipe de direction) rencontre le candidat pour évaluer sa personnalité, sa motivation, son fit culturel et ses compétences communicationnelles.',
      details: [
        { label: 'Types d\'entretien', text: 'Le système supporte plusieurs types : RH (évaluation générale et motivation), Technique (compétences spécifiques au poste), et Direction (validation finale par la direction de l\'établissement).' },
        { label: 'Formats', text: 'L\'entretien peut se dérouler en Présentiel, en Visioconférence ou par Téléphone. Le format est choisi lors de la planification et affiché sur la carte de l\'entretien.' },
        { label: 'Planification', text: 'L\'entretien est planifié avec une date, une heure, un évaluateur désigné et un format. Il commence au statut PLANIFIÉ, passe à EN_COURS le jour J, puis est validé avec un résultat.' },
        { label: 'Validation', text: 'Après l\'entretien, le recruteur saisit le résultat (Réussi, Échoué ou En attente), un score sur 100, et un feedback détaillé. Si le résultat est "Réussi", la candidature avance automatiquement à l\'étape Entretien dans le pipeline.' },
        { label: 'Filtrage', text: 'Les entretiens sont organisés par statut : Planifiés, En cours, Terminés. Vous pouvez facilement filtrer pour voir uniquement les entretiens à venir ou ceux déjà complétés.' },
      ],
    },
    {
      id: 'test',
      title: 'Test',
      subtitle: 'Évaluation technique & pratique (optionnel)',
      icon: PenTool,
      color: 'bg-orange-500',
      colorLight: 'bg-orange-50 border-orange-100',
      textColor: 'text-orange-700',
      tab: 'tests',
      description: 'Le test est une étape OPTIONNELLE qui permet d\'évaluer les compétences techniques et pratiques du candidat. Il n\'est pas obligatoire pour embaucher — un candidat peut passer directement de l\'entretien à l\'embauche.',
      details: [
        { label: 'Quand utiliser le test ?', text: 'Le test est particulièrement recommandé pour les postes d\'enseignants (démonstration pédagogique, leçon test), les postes techniques (exercices pratiques), ou lorsque l\'établissement souhaite une évaluation complémentaire après l\'entretien.' },
        { label: 'Types de tests', text: 'Le système supporte les tests Techniques (compétences spécifiques), Pédagogiques (démonstration de cours), Psychométriques (évaluation cognitive), et tous autres types personnalisés.' },
        { label: 'Résultats', text: 'Chaque test reçoit un score et un résultat (Réussi/Échoué). Si le test est réussi, la candidature avance automatiquement au statut TEST dans le pipeline, rendant le candidat éligible à l\'embauche.' },
        { label: 'Optionnel', text: 'Important : le test N\'EST PAS obligatoire. Depuis le statut ENTRETIEN, un candidat peut être embauché directement sans passer par un test. Le recruteur choisit selon les besoins du poste.' },
      ],
    },
    {
      id: 'embauche',
      title: 'Embauche',
      subtitle: 'Validation finale & Contrat',
      icon: HeartHandshake,
      color: 'bg-emerald-500',
      colorLight: 'bg-emerald-50 border-emerald-100',
      textColor: 'text-emerald-700',
      tab: 'embauches',
      description: 'L\'embauche est l\'étape finale du processus. Elle se fait en deux temps : déclaration d\'éligibilité (crée la fiche Personnel + contrat brouillon), préparation et signature du contrat par le recruteur, puis embauche finale (envoie l\'email au candidat + crée ses identifiants de connexion).',
      details: [
        { label: 'Étape 1 — Déclarer éligible', text: 'Le recruteur clique sur "Déclarer éligible" pour les candidats ayant réussi l\'entretien (ou le test). Le système crée alors : une fiche Personnel (Staff) avec matricule et statut PENDING_HIRE, et un contrat brouillon (DRAFT). Aucun email n\'est envoyé au candidat à ce stade.' },
        { label: 'Étape 2 — Préparer le contrat', text: 'Le recruteur ouvre le contrat DRAFT depuis l\'onglet Embauches, complète les clauses (articles, conditions, etc.), puis signe électroniquement le contrat en tant qu\'employeur. Tant que le contrat n\'est pas signé par le recruteur, le bouton "Embaucher" reste désactivé.' },
        { label: 'Étape 3 — Embaucher', text: 'Une fois le contrat signé par le recruteur, le bouton "Embaucher" devient actif. Le recruteur clique dessus pour finaliser l\'embauche : le système active la fiche Personnel (PENDING_HIRE → ACTIVE), génère un token de signature, envoie l\'email d\'embauche au candidat avec le lien de signature du contrat, et crée automatiquement ses identifiants de connexion.' },
        { label: 'Statut final', text: 'Après embauche, le statut de la candidature passe à EMBAUCHÉ (état terminal). Le candidat ne peut plus revenir en arrière dans le pipeline. Il apparaît dans la section "Embauchés" de l\'onglet Embauches.' },
      ],
    },
    {
      id: 'base-talents',
      title: 'Base de talents',
      subtitle: 'Candidats non retenus mais prometteurs',
      icon: ShieldCheck,
      color: 'bg-slate-500',
      colorLight: 'bg-slate-50 border-slate-200',
      textColor: 'text-slate-700',
      tab: 'talent_pool',
      description: 'La base de talents permet de conserver les profils des candidats non retenus lors d\'un processus, mais qui pourraient correspondre à de futures offres d\'emploi.',
      details: [
        { label: 'Ajout automatique', text: 'Lorsqu\'un candidat est rejeté, le système propose automatiquement de l\'ajouter à la base de talents plutôt que de simplement le supprimer. Cela permet de capitaliser sur les profils intéressants.' },
        { label: 'Catégorisation', text: 'Les candidats dans la base de talents peuvent être catégorisés par domaine (Informatique, Administration, Enseignement...) et marqués comme Disponibles, En veille ou Contactés.' },
        { label: 'Réactivation', text: 'Lorsqu\'une nouvelle offre correspond au profil d\'un candidat dans la base de talents, le recruteur peut le réactiver rapidement sans repasser par tout le processus de candidature.' },
      ],
    },
  ];

  // Add/Edit Interview Form State
  const [isAddInterviewOpen, setIsAddInterviewOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [newInterview, setNewInterview] = useState({
    candidateId: '', type: 'RH', date: '', time: '', format: 'Visioconférence', evaluator: '', score: '0', comments: '',
    status: '', result: '', feedback: '', meetingLink: '', phoneNumber: '',
  });

  // Interview Filter State
  const [interviewFilter, setInterviewFilter] = useState<'PLANIFIÉ' | 'EN_COURS' | 'TERMINÉ' | 'TOUS'>('TOUS');

  // Validate Interview Form State
  const [validatingInterview, setValidatingInterview] = useState<Interview | null>(null);
  const [interviewValidation, setInterviewValidation] = useState({
    result: 'RÉUSSI', score: '0', feedback: ''
  });

  // Add Test Form State
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [newTest, setNewTest] = useState({
    name: '', type: 'Technique', description: '', duration: '', instructions: '', maxScore: '100', passingScore: '50', status: 'ACTIF'
  });

  // Log Test Result Form State
  const [isAddTestResultOpen, setIsAddTestResultOpen] = useState(false);
  const [editingTestResult, setEditingTestResult] = useState<{ id: string; testId: string; candidateId: string; score: string; result: string; notes: string; evaluatedAt: string } | null>(null);
  const [newTestResult, setNewTestResult] = useState({
    testId: '', candidateId: '', score: '50', result: 'RÉUSSI', notes: '', evaluatedAt: new Date().toISOString().split('T')[0]
  });

  // Test Filter State
  const [testFilter, setTestFilter] = useState<'TOUS' | 'Technique' | 'RH / Psychotechnique' | 'Anglais' | 'Compétences transverses' | 'Pédagogique'>('TOUS');
  const [testSearch, setTestSearch] = useState('');

  // Add to Talent Pool Form State
  const [isAddTalentOpen, setIsAddTalentOpen] = useState(false);
  const [newTalent, setNewTalent] = useState({
    candidateId: '', category: 'Développement', status: 'Disponible'
  });

  // Load all datasets — each fetch is independent so one failure doesn't block the others
  const loadData = async () => {
    if (!tenant?.id) return;
    setLoading(true);

    // Fetch Jobs
    try {
      const fetchedJobs = await hrFetch<any[]>(hrUrl('recruitment/jobs', { tenantId: tenant.id }));
      if (fetchedJobs) {
        setJobs(fetchedJobs.map(j => ({
          ...j,
          date: j.createdAt ? j.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          publishedAt: j.publishedAt || null,
          candidates: j._count?.applications || 0,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch recruitment jobs:', err);
    }

    // Fetch Candidates
    try {
      const fetchedCandidates = await hrFetch<any[]>(hrUrl('recruitment/candidates', { tenantId: tenant.id }));
      if (fetchedCandidates) {
        setCandidates(fetchedCandidates.map(c => {
          // Find the primary (first) application with its job data
          const primaryApp = c.applications?.[0] || c.application;
          const jobTitle = primaryApp?.job?.title || primaryApp?.jobTitle || c.jobTitle || '';
          const docScore = primaryApp?.score || 0;
          const finalScore = c._finalScore ?? docScore;
          const interviewScore = c._avgInterviewScore ?? null;
          const testScore = c._avgTestScore ?? null;
          const scoreBreakdown = c._scoreBreakdown || `Documents: ${docScore}%`;
          // ─── ÉLIGIBLE workflow: extract contract info from the primary app's staff ───
          // The backend now includes `staff.contracts[0]` (DRAFT/PENDING/ACTIVE) on
          // each application — we surface it as a top-level `contract` field so the
          // Embauches tab can show a "Préparer le contrat" link and gate the
          // "Embaucher" button on the employer signature.
          const staffContract = primaryApp?.staff?.contracts?.[0] || null;
          const contract = staffContract
            ? {
                id: staffContract.id,
                status: staffContract.status,
                isEmployerSigned: !!(staffContract.terms as any)?.employerSignedAt,
                startDate: staffContract.startDate,
                contractType: staffContract.contractType,
              }
            : null;
          return {
            id: c.id,
            applicationId: primaryApp?.id || c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            name: `${c.firstName} ${c.lastName}`,
            email: c.email,
            phone: c.phone || '',
            address: c.address || '',
            gender: c.gender || 'M',
            job: jobTitle || 'Aucun poste',
            score: docScore,
            scoreCV: primaryApp?.scoreCV || 0,
            scoreLetter: primaryApp?.scoreLetter || 0,
            scoreMatching: primaryApp?.scoreMatching || 0,
            docScore,
            interviewScore,
            testScore,
            finalScore,
            scoreBreakdown,
            category: finalScore >= 80 ? 'Excellent' : finalScore >= 50 ? 'Bon' : 'Insuffisant',
            matchDetail: primaryApp?.matchDetail || '',
            risks: primaryApp?.risks || 'Aucun',
            riskDetail: primaryApp?.riskDetail || '',
            date: c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            status: primaryApp?.status || 'NOUVEAU',
            history: primaryApp?.history || [{ action: 'Profil créé', date: new Date().toISOString().replace('T', ' ').slice(0, 16), user: 'Système' }],
            academicProfile: c.academicProfile || null,
            documents: c.documents || [],
            contract,
            applications: (c.applications || []).map((app: any) => ({
              id: app.id,
              jobId: app.jobId,
              jobTitle: app.job?.title || '',
              status: app.status || 'NOUVEAU',
              score: app.score || 0,
              scoreCV: app.scoreCV || 0,
              scoreLetter: app.scoreLetter || 0,
              scoreMatching: app.scoreMatching || 0,
              staffId: app.staffId || null,
              createdAt: app.createdAt,
              matchDetail: app.matchDetail || '',
            })),
          };
        }));
      }
    } catch (err) {
      console.error('Failed to fetch recruitment candidates:', err);
    }

    // Fetch Interviews
    try {
      const fetchedInterviews = await hrFetch<any[]>(hrUrl('recruitment/interviews', { tenantId: tenant.id }));
      if (fetchedInterviews) {
        setInterviews(fetchedInterviews.map(i => ({
          ...i,
          date: i.date ? i.date.split('T')[0] : '',
        })));
      }
    } catch (err) {
      console.error('Failed to fetch recruitment interviews:', err);
    }

    // Fetch Tests
    try {
      const fetchedTests = await hrFetch<any[]>(hrUrl('recruitment/tests', { tenantId: tenant.id }));
      if (fetchedTests) {
        setTests(fetchedTests);
      }
    } catch (err) {
      console.error('Failed to fetch recruitment tests:', err);
    }

    // Fetch Talent Pool
    try {
      const fetchedTalent = await hrFetch<any[]>(hrUrl('recruitment/talent-pool', { tenantId: tenant.id }));
      if (fetchedTalent) {
        setTalentPool(fetchedTalent);
      }
    } catch (err) {
      console.error('Failed to fetch recruitment talent pool:', err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // Load departments list (for the job modal selector)
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/departments?tenantId=${encodeURIComponent(tenant.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setDepartments(list.map((d: any) => ({ id: d.id, name: d.name })));
      })
      .catch(() => setDepartments([]));
  }, [tenant?.id]);

  // Load tenant identity profile (for auto-filling the job location field)
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/settings/identity?tenantId=${encodeURIComponent(tenant.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        // Build a readable address from the available fields
        const parts = [
          data.address,
          data.city,
          data.department,
          data.country === 'BJ' ? 'Bénin' : data.country,
        ].filter(Boolean);
        if (parts.length > 0) {
          setTenantAddress(parts.join(', '));
        }
      })
      .catch(() => {/* non-critical */});
  }, [tenant?.id]);

  // Load recruiter profile (for pre-filling interview form: format, evaluator, delay)
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/hr/recruitment/recruiter-profile?tenantId=${encodeURIComponent(tenant.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.isActive) {
          setRecruiterProfile({
            fullName: data.fullName,
            defaultInterviewFormat: data.defaultInterviewFormat,
            defaultInterviewDelayHr: data.defaultInterviewDelayHr,
          });
        }
      })
      .catch(() => {/* non-critical */});
  }, [tenant?.id]);

  // Load staff list (for the interview evaluator selector)
  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`/api/hr/staff?tenantId=${encodeURIComponent(tenant.id)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setStaffList(list.map((s: any) => ({
          id: s.id,
          firstName: s.firstName || '',
          lastName: s.lastName || '',
          position: s.position || null,
        })));
      })
      .catch(() => setStaffList([]));
  }, [tenant?.id]);

  // Create or Update Job
  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      toast({ variant: 'error', title: 'Erreur', description: 'Aucun établissement sélectionné. Veuillez rafraîchir la page ou sélectionner un établissement.' });
      return;
    }
    try {
      if (editingJob) {
        // Update existing job
        await hrFetch(hrUrl(`recruitment/jobs/${editingJob.id}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: newJob,
        });
        toast({ variant: 'success', title: 'Offre d\'emploi modifiée avec succès !' });
      } else {
        // Create new job
        await hrFetch(hrUrl('recruitment/jobs', { tenantId: tenant.id }), {
          method: 'POST',
          body: newJob,
        });
        toast({ variant: 'success', title: 'Offre d\'emploi créée avec succès !' });
      }
      setIsAddJobOpen(false);
      setEditingJob(null);
      setNewJob({ title: '', dept: '', loc: '', status: 'PUBLIÉE', contractType: 'CDI', salary: '', academicLevel: '', experience: '', skillsRequired: '', assets: '', description: '', missions: '', responsibilities: '' });
      loadData();
    } catch (err) {
      console.error('Failed to save job:', err);
      toast({ variant: 'error', title: editingJob ? 'Erreur lors de la modification de l\'offre.' : 'Erreur lors de la création de l\'offre d\'emploi.' });
    }
  };

  // Open edit job modal
  const openEditJob = (job: Job) => {
    setEditingJob(job);
    setNewJob({
      title: job.title, dept: job.dept, loc: job.loc, status: job.status,
      contractType: job.contractType || 'CDI', salary: job.salary || '',
      academicLevel: job.academicLevel || '', experience: job.experience || '',
      skillsRequired: job.skillsRequired || '', assets: job.assets || '',
      description: job.description || '', missions: job.missions || '',
      responsibilities: job.responsibilities || '',
    });
    setIsAddJobOpen(true);
  };

  // Create Candidate and Application
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      toast({ variant: 'error', title: 'Erreur', description: 'Aucun établissement sélectionné. Veuillez rafraîchir la page ou sélectionner un établissement.' });
      return;
    }
    try {
      // 1. Create Candidate
      const createdCandidate = await hrFetch<any>(hrUrl('recruitment/candidates', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          firstName: newCandidate.firstName,
          lastName: newCandidate.lastName,
          email: newCandidate.email,
          phone: newCandidate.phone,
          address: newCandidate.address,
          gender: newCandidate.gender,
        }
      });

      // 2. Create associated application if Job is selected
      if (newCandidate.jobId && createdCandidate?.id) {
        await hrFetch(hrUrl('recruitment/applications', { tenantId: tenant.id }), {
          method: 'POST',
          body: {
            jobId: newCandidate.jobId,
            candidateId: createdCandidate.id,
            status: newCandidate.status,
          }
        });
      }

      toast({ variant: 'success', title: 'Candidat enregistré avec succès !' });
      setIsAddCandidateOpen(false);
      setNewCandidate({ firstName: '', lastName: '', email: '', phone: '', address: '', gender: 'M', jobId: '', status: 'NOUVEAU' });
      loadData();
    } catch (err) {
      console.error('Failed to create candidate/application:', err);
      toast({ variant: 'error', title: 'Erreur lors de l\'enregistrement du candidat.' });
    }
  };

  // Delete Job Offer
  const handleDeleteJob = async (id: string) => {
    const ok = await confirmDialog.danger(
      'Cette offre et toutes ses candidatures seront définitivement supprimées.',
      'Supprimer cette offre ?',
      'Les candidats associés ne seront pas supprimés, mais leurs candidatures le seront.'
    );
    if (!ok) return;
    const previousJobs = jobs;
    setJobs(prev => prev.filter(j => j.id !== id));
    try {
      await hrFetch(hrUrl(`recruitment/jobs/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Offre supprimée', description: 'L\'offre d\'emploi et ses candidatures ont été supprimées.' });
      // Ne PAS appeler loadData() ici : l'optimistic update a déjà retiré l'élément.
      // loadData() pourrait réinjecter l'élément supprimé si le cache Cloudflare
      // retourne une réponse périmée. Le rechargement se fera au prochain changement d'onglet.
    } catch (err) {
      setJobs(previousJobs);
      console.error('Failed to delete job:', err);
      toast({ variant: 'error', title: 'Erreur de suppression', description: 'Impossible de supprimer cette offre. Veuillez réessayer.' });
    }
  };

  // Deactivate Job Offer (soft action — does NOT delete the job or its applications)
  const handleDeactivateJob = async (id: string) => {
    const ok = await confirmDialog.warning(
      'L\'offre sera désactivée et ne sera plus visible publiquement. Les candidatures existantes seront conservées.',
      'Désactiver cette offre ?'
    );
    if (!ok) return;
    try {
      await hrFetch(hrUrl(`recruitment/jobs/${id}/deactivate`, { tenantId: tenant.id }), { method: 'PUT' });
      // Optimistic update: change status locally
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'DÉSACTIVÉE' } : j));
      toast({ variant: 'success', title: 'Offre désactivée', description: 'L\'offre n\'est plus visible publiquement. Vous pouvez la republier à tout moment.' });
    } catch (err: any) {
      console.error('Failed to deactivate job:', err);
      const msg = err?.message || 'Impossible de désactiver cette offre. Veuillez réessayer.';
      toast({ variant: 'error', title: 'Erreur', description: msg });
    }
  };

  // Republish a deactivated Job Offer (updates publishedAt automatically on backend)
  const handleRepublishJob = async (id: string) => {
    const ok = await confirmDialog.warning(
      'L\'offre sera republiée et redeviendra visible publiquement. La date de publication sera mise à jour.',
      'Republicaliser cette offre ?'
    );
    if (!ok) return;
    try {
      const updated = await hrFetch<any>(hrUrl(`recruitment/jobs/${id}/republish`, { tenantId: tenant.id }), { method: 'PUT' });
      // Optimistic update: change status and publishedAt locally
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'PUBLIÉE', publishedAt: updated?.publishedAt || new Date().toISOString() } : j));
      toast({ variant: 'success', title: 'Offre republiée', description: 'L\'offre est à nouveau visible publiquement avec une nouvelle date de publication.' });
    } catch (err: any) {
      console.error('Failed to republish job:', err);
      const msg = err?.message || 'Impossible de republier cette offre. Veuillez réessayer.';
      toast({ variant: 'error', title: 'Erreur', description: msg });
    }
  };

  // Delete Candidate
  const handleDeleteCandidate = async (id: string) => {
    const ok = await confirmDialog.danger(
      'Ce candidat, ses candidatures, entretiens et résultats de tests seront définitivement supprimés.',
      'Supprimer ce candidat ?',
      'Cette action est irréversible et ne peut pas être annulée.'
    );
    if (!ok) return;

    // Optimistic update : retirer immédiatement le candidat de l'UI
    const previousCandidates = candidates;
    setCandidates(prev => prev.filter(c => c.id !== id));

    try {
      await hrFetch(hrUrl(`recruitment/candidates/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Candidat supprimé', description: 'Le candidat et toutes ses données associées ont été supprimés.' });
      // Ne PAS appeler loadData() ici : l'optimistic update a déjà retiré le candidat.
      // loadData() pourrait réinjecter le candidat supprimé si le cache Cloudflare
      // retourne une réponse périmée. Le rechargement se fera au prochain changement d'onglet.
    } catch (err: any) {
      // Restaurer l'état précédent en cas d'erreur
      setCandidates(previousCandidates);
      console.error('Failed to delete candidate:', err);
      const backendMsg = err?.message || err?.toString() || '';
      toast({ variant: 'error', title: 'Erreur de suppression', description: backendMsg || 'Impossible de supprimer ce candidat. Veuillez réessayer.' });
    }
  };

  // Schedule or Update Interview
  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      toast({ variant: 'error', title: 'Erreur', description: 'Aucun établissement sélectionné. Veuillez rafraîchir la page ou sélectionner un établissement.' });
      return;
    }
    try {
      if (editingInterview) {
        // Update existing interview — include status/result/feedback
        const updateBody: any = { ...newInterview, score: Number(newInterview.score) || 0 };
        // Remove empty optional fields to avoid validation errors
        if (!newInterview.status) delete updateBody.status;
        if (!newInterview.result) delete updateBody.result;
        if (!newInterview.feedback) delete updateBody.feedback;
        await hrFetch(hrUrl(`recruitment/interviews/${editingInterview.id}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: updateBody,
        });
        toast({ variant: 'success', title: 'Entretien modifié avec succès !' });
      } else {
        // Create new interview — exclude status/result/feedback (not in CreateInterviewDto)
        const { status: _s, result: _r, feedback: _f, ...createBody } = newInterview as any;
        createBody.score = Number(createBody.score) || 0;
        await hrFetch(hrUrl('recruitment/interviews', { tenantId: tenant.id }), {
          method: 'POST',
          body: createBody,
        });
        toast({ variant: 'success', title: 'Entretien programmé avec succès !' });
      }
      setIsAddInterviewOpen(false);
      setEditingInterview(null);
      setNewInterview({ candidateId: '', type: 'RH', date: '', time: '', format: 'Visioconférence', evaluator: '', score: '0', comments: '', status: '', result: '', feedback: '' });
      loadData();
    } catch (err: any) {
      console.error('Failed to save interview:', err);
      const backendMsg = err?.message || err?.toString() || '';
      toast({ variant: 'error', title: editingInterview ? 'Erreur lors de la modification de l\'entretien.' : 'Erreur lors de la programmation de l\'entretien.', description: backendMsg || 'Veuillez vérifier les données saisies et réessayer.' });
    }
  };

  // Open edit interview modal
  const openEditInterview = (int: Interview) => {
    setEditingInterview(int);
    setNewInterview({
      candidateId: int.candidateId,
      type: int.type,
      date: int.date,
      time: int.time,
      format: int.format,
      evaluator: int.evaluator,
      score: String(int.score || 0),
      comments: int.comments || '',
      status: int.status || '',
      result: int.result || '',
      feedback: int.feedback || '',
      meetingLink: (int as any).meetingLink || '',
      phoneNumber: (int as any).phoneNumber || '',
    });
    setIsAddInterviewOpen(true);
  };

  /**
   * Opens the interview scheduling modal with smart defaults from RecruiterProfile:
   * - Format: recruiterProfile.defaultInterviewFormat (fallback: Visioconférence)
   * - Évaluateur: recruiterProfile.fullName (fallback: empty)
   * - Date: today + recruiterProfile.defaultInterviewDelayHr hours (fallback: today)
   * - Heure: 10:00 (business hour default)
   * - Candidate: optional pre-selected candidateId (when opening from candidate card)
   */
  const openNewInterview = (preselectedCandidateId?: string) => {
    setEditingInterview(null);

    // Calculate default date: today + delay hours
    const delayHr = recruiterProfile?.defaultInterviewDelayHr ?? 48;
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + delayHr);
    const dateStr = defaultDate.toISOString().split('T')[0]; // YYYY-MM-DD

    setNewInterview({
      candidateId: preselectedCandidateId || '',
      type: 'RH',
      date: dateStr,
      time: '10:00',
      format: recruiterProfile?.defaultInterviewFormat || 'Visioconférence',
      evaluator: recruiterProfile?.fullName || '',
      score: '0',
      comments: '',
      status: '',
      result: '',
      feedback: '',
      meetingLink: '',
      phoneNumber: recruiterProfile?.phoneNumber || tenantAddress ? (recruiterProfile?.phoneNumber || '') : '',
    });
    setIsAddInterviewOpen(true);
  };

  // Delete Interview
  const handleDeleteInterview = async (id: string) => {
    const ok = await confirmDialog.warning(
      'Cet entretien sera définitivement annulé et supprimé.',
      'Annuler cet entretien ?'
    );
    if (!ok) return;
    const previousInterviews = interviews;
    setInterviews(prev => prev.filter(i => i.id !== id));
    try {
      await hrFetch(hrUrl(`recruitment/interviews/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Entretien annulé', description: 'L\'entretien a été supprimé du calendrier.' });
    } catch (err) {
      setInterviews(previousInterviews);
      console.error('Failed to delete interview:', err);
      toast({ variant: 'error', title: 'Erreur d\'annulation', description: 'Impossible d\'annuler cet entretien. Veuillez réessayer.' });
    }
  };

  // Validate Interview (mark as completed with result)
  const handleValidateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatingInterview) return;
    try {
      await hrFetch(hrUrl(`recruitment/interviews/${validatingInterview.id}/validate`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: {
          status: 'TERMINÉ',
          result: interviewValidation.result,
          score: Number(interviewValidation.score),
          feedback: interviewValidation.feedback,
        },
      });
      toast({ variant: 'success', title: 'Entretien validé !', description: interviewValidation.result === 'RÉUSSI' ? 'Le candidat a été automatiquement avancé à l\'étape Entretien.' : 'L\'entretien a été marqué comme échoué.' });
      setValidatingInterview(null);
      setInterviewValidation({ result: 'RÉUSSI', score: '0', feedback: '' });
      loadData();
    } catch (err: any) {
      console.error('Failed to validate interview:', err);
      const msg = err?.message || 'Erreur lors de la validation de l\'entretien.';
      toast({ variant: 'error', title: msg });
    }
  };

  // Create or Update Test
  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) {
      toast({ variant: 'error', title: 'Erreur', description: 'Aucun établissement sélectionné. Veuillez rafraîchir la page ou sélectionner un établissement.' });
      return;
    }
    try {
      const body = {
        name: newTest.name,
        type: newTest.type,
        description: newTest.description || undefined,
        duration: newTest.duration ? Number(newTest.duration) : undefined,
        instructions: newTest.instructions || undefined,
        maxScore: Number(newTest.maxScore) || 100,
        passingScore: Number(newTest.passingScore) || 50,
        status: newTest.status || 'ACTIF',
      };
      if (editingTest) {
        await hrFetch(hrUrl(`recruitment/tests/${editingTest.id}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body,
        });
        toast({ variant: 'success', title: 'Test modifié avec succès !' });
      } else {
        await hrFetch(hrUrl('recruitment/tests', { tenantId: tenant.id }), {
          method: 'POST',
          body,
        });
        toast({ variant: 'success', title: 'Test d\'évaluation créé avec succès !' });
      }
      setIsAddTestOpen(false);
      setEditingTest(null);
      setNewTest({ name: '', type: 'Technique', description: '', duration: '', instructions: '', maxScore: '100', passingScore: '50', status: 'ACTIF' });
      loadData();
    } catch (err: any) {
      console.error('Failed to save test:', err);
      const msg = err?.message || 'Erreur lors de l\'enregistrement du test.';
      toast({ variant: 'error', title: msg });
    }
  };

  // Open edit test modal
  const openEditTest = (test: Test) => {
    setEditingTest(test);
    setNewTest({
      name: test.name,
      type: test.type,
      description: test.description || '',
      duration: test.duration ? String(test.duration) : '',
      instructions: test.instructions || '',
      maxScore: String(test.maxScore || 100),
      passingScore: String(test.passingScore || 50),
      status: test.status || 'ACTIF',
    });
    setIsAddTestOpen(true);
  };

  // Delete Test
  const handleDeleteTest = async (id: string) => {
    const ok = await confirmDialog.danger(
      'Ce test et tous ses résultats seront définitivement supprimés.',
      'Supprimer ce test ?'
    );
    if (!ok) return;
    const previousTests = tests;
    setTests(prev => prev.filter(t => t.id !== id));
    try {
      await hrFetch(hrUrl(`recruitment/tests/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Test supprimé', description: 'Le test et ses résultats ont été supprimés.' });
    } catch (err) {
      setTests(previousTests);
      console.error('Failed to delete test:', err);
      toast({ variant: 'error', title: 'Erreur de suppression', description: 'Impossible de supprimer ce test. Veuillez réessayer.' });
    }
  };

  // Create or Update Test Result
  const handleSaveTestResult = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        testId: newTestResult.testId,
        candidateId: newTestResult.candidateId,
        score: Number(newTestResult.score),
        result: newTestResult.result,
        notes: newTestResult.notes || undefined,
        evaluatedAt: newTestResult.evaluatedAt || new Date().toISOString().split('T')[0],
      };
      if (editingTestResult) {
        await hrFetch(hrUrl(`recruitment/test-results/${editingTestResult.id}`, { tenantId: tenant.id }), {
          method: 'PUT',
          body: {
            score: body.score,
            result: body.result,
            notes: body.notes,
            evaluatedAt: body.evaluatedAt,
          },
        });
        toast({ variant: 'success', title: 'Résultat de test modifié !' });
      } else {
        await hrFetch(hrUrl('recruitment/test-results', { tenantId: tenant.id }), {
          method: 'POST',
          body,
        });
        toast({ variant: 'success', title: 'Résultat de test enregistré !', description: newTestResult.result === 'RÉUSSI' ? 'Le candidat a été automatiquement avancé au statut Test.' : 'Le résultat a été enregistré.' });
      }
      setIsAddTestResultOpen(false);
      setEditingTestResult(null);
      setNewTestResult({ testId: '', candidateId: '', score: '50', result: 'RÉUSSI', notes: '', evaluatedAt: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (err: any) {
      console.error('Failed to save test result:', err);
      const msg = err?.message || 'Erreur lors de l\'enregistrement du résultat.';
      toast({ variant: 'error', title: msg });
    }
  };

  // Open edit test result modal
  const openEditTestResult = (result: { id: string; testId: string; candidateId: string; score: number; result: string; notes?: string; evaluatedAt?: string }, testId: string) => {
    setEditingTestResult({
      id: result.id,
      testId: testId,
      candidateId: result.candidateId,
      score: String(result.score),
      result: result.result,
      notes: result.notes || '',
      evaluatedAt: result.evaluatedAt ? result.evaluatedAt.split('T')[0] : '',
    });
    setNewTestResult({
      testId: testId,
      candidateId: result.candidateId,
      score: String(result.score),
      result: result.result,
      notes: result.notes || '',
      evaluatedAt: result.evaluatedAt ? result.evaluatedAt.split('T')[0] : '',
    });
    setIsAddTestResultOpen(true);
  };

  // Remove Test Result
  const handleDeleteTestResult = async (id: string) => {
    const ok = await confirmDialog.danger(
      'Ce résultat de test sera définitivement supprimé.',
      'Supprimer ce résultat ?'
    );
    if (!ok) return;
    const previousTests = tests;
    setTests(prev => prev.map(t => ({
      ...t,
      results: t.results?.filter(r => r.id !== id) || [],
    })));
    try {
      await hrFetch(hrUrl(`recruitment/test-results/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Résultat supprimé', description: 'Le résultat du test a été supprimé.' });
    } catch (err) {
      setTests(previousTests);
      console.error('Failed to delete test result:', err);
      toast({ variant: 'error', title: 'Erreur de suppression', description: 'Impossible de supprimer ce résultat. Veuillez réessayer.' });
    }
  };

  // Add candidate to Talent Pool
  const handleAddToTalentPool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrFetch(hrUrl(`recruitment/talent-pool/${newTalent.candidateId}`, { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          category: newTalent.category,
          status: newTalent.status,
        }
      });
      toast({ variant: 'success', title: 'Profil ajouté à la base de talents.' });
      setIsAddTalentOpen(false);
      setNewTalent({ candidateId: '', category: 'Développement', status: 'Disponible' });
      loadData();
    } catch (err) {
      console.error('Failed to register to talent pool:', err);
      toast({ variant: 'error', title: 'Erreur lors de l\'ajout à la base de talents.' });
    }
  };

  // Remove candidate from Talent Pool
  const handleRemoveFromTalent = async (id: string) => {
    const ok = await confirmDialog.warning(
      'Ce profil sera retiré de la base de talents, mais le candidat ne sera pas supprimé.',
      'Retirer de la base de talents ?'
    );
    if (!ok) return;
    const previousTalentPool = talentPool;
    setTalentPool(prev => prev.filter(t => t.id !== id));
    try {
      await hrFetch(hrUrl(`recruitment/talent-pool/${id}`, { tenantId: tenant.id }), { method: 'DELETE' });
      toast({ variant: 'success', title: 'Profil retiré', description: 'Le profil a été retiré de la base de talents.' });
      // Ne PAS appeler loadData() : l'optimistic update a déjà retiré l'élément.
    } catch (err) {
      setTalentPool(previousTalentPool);
      console.error('Failed to remove from talent pool:', err);
      toast({ variant: 'error', title: 'Erreur de retrait', description: 'Impossible de retirer ce profil. Veuillez réessayer.' });
    }
  };

  // Move candidate application status
  const handleMoveCandidate = async (candidateId: string, toStatus: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    const applicationId = candidate.applicationId || candidate.id;
    try {
      await hrFetch(hrUrl(`recruitment/applications/${applicationId}/status`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: toStatus },
      });
      toast({ variant: 'success', title: 'Statut du candidat mis à jour !' });
      loadData();
    } catch (err) {
      console.error('Failed to change status:', err);
      toast({ variant: 'error', title: 'Erreur lors du changement de statut.' });
    }
  };

  // Reject candidate with optional talent pool suggestion
  const handleRejectCandidate = async (candidateId: string) => {
    const confirmed = await confirmDialog.warning(
      'Ce candidat sera marqué comme rejeté. Vous pourrez l\'ajouter à la base de talents par la suite.',
      'Rejeter ce candidat ?'
    );
    if (!confirmed) return;
    await handleMoveCandidate(candidateId, 'REJETÉ');
  };

  // ─── Declare candidate ÉLIGIBLE (Phase 1 of two-phase hiring) ──────────
  // Triggers the backend to create the Staff record (PENDING_HIRE) and a
  // DRAFT contract. NO email is sent — the recruiter must prepare & sign
  // the contract before triggering the EMBAUCHÉ transition.
  const handleDeclareEligible = async (candidate: Candidate) => {
    const confirmed = await confirmDialog.warning(
      `${candidate.name} sera déclaré ÉLIGIBLE. Une fiche Personnel et un contrat brouillon (DRAFT) seront créés automatiquement. Aucun email ne sera envoyé au candidat à ce stade. Vous devrez préparer et signer le contrat avant de finaliser l'embauche.`,
      'Déclarer éligible ?'
    );
    if (!confirmed) return;
    const applicationId = candidate.applicationId || candidate.id;
    try {
      setHiring(true);
      await hrFetch(hrUrl(`recruitment/applications/${applicationId}/status`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: 'ÉLIGIBLE' },
      });
      toast({
        variant: 'success',
        title: 'Candidat déclaré éligible !',
        description: 'La fiche personnel et un contrat brouillon ont été créés. Préparez et signez le contrat avant de finaliser l\'embauche.',
      });
      loadData();
    } catch (err: any) {
      const backendMsg = err?.message || err?.toString() || '';
      toast({
        variant: 'error',
        title: 'Erreur lors de la déclaration d\'éligibilité',
        description: backendMsg || 'Veuillez vérifier que le candidat a passé au moins l\'étape Entretien ou Test.',
      });
    } finally {
      setHiring(false);
    }
  };

  // Navigate to the contract preparation page for an ÉLIGIBLE candidate
  const handlePrepareContract = (candidate: Candidate) => {
    if (!candidate.contract?.id) {
      toast({
        variant: 'error',
        title: 'Contrat introuvable',
        description: 'Aucun contrat n\'est associé à ce candidat. Veuillez rafraîchir la page et réessayer.',
      });
      return;
    }
    router.push(`/app/hr/contracts/${candidate.contract.id}`);
  };

  // ─── Hire candidate (Phase 2 of two-phase hiring) ─────────────────────
  // Sends the EMBAUCHÉ status. The backend will:
  //   1. Verify the contract has been signed by the employer (terms.employerSignedAt)
  //   2. If signed → activate staff, update contract to PENDING,
  //      generate sign token, send hire email, create user credentials
  //   3. If NOT signed → throw a 400 BadRequest with an explanatory message
  // The frontend gates the button on `contract.isEmployerSigned` to give
  // immediate feedback before the request is made.
  const handleHireCandidate = async () => {
    if (!hireCandidate) return;
    // Defensive: double-check the contract is signed by the employer
    if (!hireCandidate.contract?.isEmployerSigned) {
      toast({
        variant: 'error',
        title: 'Contrat non signé',
        description: 'Veuillez préparer et signer le contrat d\'abord avant de finaliser l\'embauche.',
      });
      return;
    }
    setHiring(true);
    try {
      const applicationId = hireCandidate.applicationId || hireCandidate.id;
      await hrFetch(hrUrl(`recruitment/applications/${applicationId}/status`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: 'EMBAUCHÉ' },
      });
      toast({
        variant: 'success',
        title: 'Candidat embauché !',
        description: 'Un email avec le lien de signature du contrat a été envoyé au candidat. Ses identifiants de connexion seront créés automatiquement.',
      });
      setHireCandidate(null);
      loadData();
    } catch (err: any) {
      const backendMsg = err?.message || err?.toString() || '';
      toast({
        variant: 'error',
        title: 'Erreur lors de l\'embauche',
        description: backendMsg || 'Le contrat doit être signé par le recruteur avant l\'embauche.',
      });
    } finally {
      setHiring(false);
    }
  };

  // Filter candidates for the Embauches tab
  const hiredCandidates = candidates.filter(c => c.status === 'EMBAUCHÉ');

  // Minimum score threshold for hire eligibility (configurable)
  const MIN_HIRE_SCORE = 50;

  // Candidates with ENTRETIEN or TEST status AND a minimum finalScore are
  // eligible to be DECLARED ÉLIGIBLE (Phase 1). This is the new "ready for hire"
  // pool — they no longer go directly to EMBAUCHÉ.
  // finalScore = weighted composite of document analysis + interview + test scores
  const readyForHire = candidates.filter(c =>
    (c.status === 'ENTRETIEN' || c.status === 'TEST') && c.finalScore >= MIN_HIRE_SCORE
  );

  // Candidates who reached ENTRETIEN/TEST but have a below-threshold finalScore — shown separately as "not recommended"
  const notRecommendedForHire = candidates.filter(c =>
    (c.status === 'ENTRETIEN' || c.status === 'TEST') && c.finalScore < MIN_HIRE_SCORE
  );

  // ÉLIGIBLE candidates (Phase 1 done, awaiting contract preparation/signature
  // before they can be moved to EMBAUCHÉ).
  const eligibleCandidates = candidates.filter(c => c.status === 'ÉLIGIBLE');

  // KPI calculations for dashboard cards (Tome 2 & 3)
  const totalJobs = jobs.filter(j => j.status === 'PUBLIÉE').length;
  const totalApplications = candidates.length;
  const totalInterviews = interviews.filter(i => i.status === 'PLANIFIÉ').length;
  const totalInterviewsInProgress = interviews.filter(i => i.status === 'EN_COURS').length;
  const totalInterviewsCompleted = interviews.filter(i => i.status === 'TERMINÉ').length;
  const avgFinalScore = candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.finalScore, 0) / candidates.length) : 0;
  const fraudAlerts = candidates.filter(c => c.risks && c.risks !== 'Aucun').length;
  const totalHired = candidates.filter(c => c.status === 'EMBAUCHÉ').length;

  return (
    <>
    <div className="space-y-6 pb-12">
      {/* Cockpit Analytics HTIP (Tome 2 & 3) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Offres Actives', value: totalJobs, sub: 'Recrutement ouvert', bg: 'bg-indigo-50/50 border-indigo-100/50' },
          { label: 'Candidatures', value: totalApplications, sub: 'Dossiers reçus', bg: 'bg-indigo-50/50 border-indigo-100/50' },
          { label: 'Entretiens', value: totalInterviews, sub: `${totalInterviewsInProgress} en cours · ${totalInterviewsCompleted} terminés`, bg: 'bg-indigo-50/50 border-indigo-100/50' },
          { label: 'Score Moyen', value: `${avgFinalScore}%`, sub: 'Score final composite', bg: 'bg-amber-50/50 border-amber-100/50' },
          { label: 'Alertes Risque', value: fraudAlerts, sub: 'Détections HDIE', bg: 'bg-rose-50/50 border-rose-100/50' },
          { label: 'Recrutements', value: totalHired, sub: 'Candidats embauchés', bg: 'bg-emerald-50/50 border-emerald-100/50' }
        ].map((card, i) => (
          <div key={i} className={`border rounded-xl p-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${card.bg}`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
            <div className="flex items-baseline gap-1.5 mt-2">
              <span className="text-xl font-extrabold text-slate-900">{card.value}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 font-medium">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* Sub tabs header navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'jobs', label: "Offres d'emploi", icon: Briefcase },
            { id: 'candidates', label: 'Candidatures', icon: Users },
            { id: 'interviews', label: 'Entretiens', icon: Calendar },
            { id: 'tests', label: 'Tests', icon: ClipboardList },
            { id: 'embauches', label: 'Embauches', icon: UserCheck },
          { id: 'talent_pool', label: 'Base de talents', icon: Award }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                isActive ? 'bg-[#1A2BA6] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
        </div>
        <button
          onClick={() => { setIsGuideOpen(true); setGuideStep(0); setGuideExpanded(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 hover:shadow-sm transition-all"
          title="Guide du processus de recrutement"
        >
          <Compass className="h-4 w-4" />
          Guide du processus
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl" />)}</div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB: JOBS */}
          {activeTab === 'jobs' && (
            <motion.div key="jobs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Offres d'emploi actives</h3>
                <button
                  onClick={() => { setEditingJob(null); setNewJob({ title: '', dept: '', loc: tenantAddress || '', status: 'PUBLIÉE', contractType: 'CDI', salary: '', academicLevel: '', experience: '', skillsRequired: '', assets: '', description: '', missions: '', responsibilities: '' }); setIsAddJobOpen(true); }}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Plus className="h-4 w-4" /> Créer une offre
                </button>
              </div>

              {jobs.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Aucune offre d'emploi enregistrée.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {jobs.map((job) => (
                    <div key={job.id} className={cn(
                      'bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between',
                      job.status === 'DÉSACTIVÉE' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
                    )}>
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{job.ref}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border',
                              job.status === 'PUBLIÉE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              job.status === 'DÉSACTIVÉE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              job.status === 'FERMÉE' ? 'bg-red-50 text-red-600 border-red-200' :
                              job.status === 'ARCHIVÉE' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                              'bg-slate-50 text-slate-500 border-slate-200'
                            )}>
                              {job.status === 'DÉSACTIVÉE' ? 'Désactivée' :
                               job.status === 'PUBLIÉE' ? 'Publiée' :
                               job.status === 'FERMÉE' ? 'Fermée' :
                               job.status === 'ARCHIVÉE' ? 'Archivée' :
                               job.status === 'BROUILLON' ? 'Brouillon' : job.status}
                            </span>
                            <button onClick={() => openEditJob(job)} className="text-slate-400 hover:text-blue-600 transition" title="Modifier">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {job.status === 'PUBLIÉE' && (
                              <button onClick={() => handleDeactivateJob(job.id)} className="text-slate-400 hover:text-amber-600 transition" title="Désactiver l'offre">
                                <PowerOff className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {job.status === 'DÉSACTIVÉE' && (
                              <button onClick={() => handleRepublishJob(job.id)} className="text-emerald-500 hover:text-emerald-600 transition" title="Republicaliser l'offre">
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button onClick={() => handleDeleteJob(job.id)} className="text-slate-400 hover:text-red-600 transition" title="Supprimer définitivement">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-slate-900 mt-2 text-sm">{job.title}</h4>
                        <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-500 border-t border-slate-50 pt-3">
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {job.loc} · {job.contractType || 'CDI'}</span>
                          {job.salary && <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> {job.salary}</span>}
                          {job.academicLevel && <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> {job.academicLevel}</span>}
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-[#1A2BA6]">{job.candidates} Candidats</span>
                        <div className="flex flex-col items-end gap-0.5">
                          {job.publishedAt && (
                            <span className="text-[10px] text-emerald-600 font-medium">Publiée le {job.publishedAt.split('T')[0]}</span>
                          )}
                          <span className="text-[10px] text-slate-400">Créé le {job.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Job Modal */}
              {isAddJobOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl border border-slate-100 my-8">
                    <h3 className="font-bold text-slate-900 text-base mb-4">{editingJob ? 'Modifier l\'offre d\'emploi' : 'Créer une offre d\'emploi détaillée'}</h3>
                    <form onSubmit={handleSaveJob} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Intitulé du poste</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Département</label>
                          {departments.length > 0 ? (
                            <select
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                              value={newJob.dept}
                              onChange={(e) => setNewJob({ ...newJob, dept: e.target.value })}
                              required
                            >
                              <option value="">— Sélectionner —</option>
                              {departments.map((d) => (
                                <option key={d.id} value={d.name}>{d.name}</option>
                              ))}
                              {/* Allow "Other" — falls back to free text below */}
                              {newJob.dept && !departments.some((d) => d.name === newJob.dept) && (
                                <option value={newJob.dept}>{newJob.dept} (personnalisé)</option>
                              )}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              value={newJob.dept}
                              onChange={(e) => setNewJob({ ...newJob, dept: e.target.value })}
                              placeholder="Aucun département configuré — saisissez librement"
                              required
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Localisation</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.loc} onChange={(e) => setNewJob({ ...newJob, loc: e.target.value })} placeholder="Adresse de l'école" required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type de Contrat</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.contractType} onChange={(e) => setNewJob({ ...newJob, contractType: e.target.value })}>
                            <option value="CDI">CDI</option>
                            <option value="CDD">CDD</option>
                            <option value="Prestataire">Prestataire</option>
                            <option value="Stage">Stage</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Salaire / Échelle</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.salary} onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })} placeholder="Ex: 400k - 500k XOF" />
                        </div>
                      </div>

                      {editingJob && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut de l'offre</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.status} onChange={(e) => setNewJob({ ...newJob, status: e.target.value })}>
                            <option value="BROUILLON">Brouillon</option>
                            <option value="PUBLIÉE">Publiée</option>
                            <option value="DÉSACTIVÉE">Désactivée</option>
                            <option value="FERMÉE">Fermée</option>
                            <option value="ARCHIVÉE">Archivée</option>
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Niveau académique requis</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.academicLevel} onChange={(e) => setNewJob({ ...newJob, academicLevel: e.target.value })} placeholder="Ex: Master" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expérience exigée</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.experience} onChange={(e) => setNewJob({ ...newJob, experience: e.target.value })} placeholder="Ex: 3 ans" />
                        </div>
                      </div>

                      {/* Rich text editors for description, missions, responsibilities */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description générale</label>
                        <RichTextEditor
                          value={newJob.description || ''}
                          onChange={(html) => setNewJob({ ...newJob, description: html })}
                          placeholder="Présentez le poste, le contexte, les enjeux... Utilisez les puces pour structurer."
                          minHeight={100}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Missions clés</label>
                          <RichTextEditor
                            value={newJob.missions || ''}
                            onChange={(html) => setNewJob({ ...newJob, missions: html })}
                            placeholder="Listez les missions principales (utilisez la liste à puces)."
                            minHeight={100}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsabilités</label>
                          <RichTextEditor
                            value={newJob.responsibilities || ''}
                            onChange={(html) => setNewJob({ ...newJob, responsibilities: html })}
                            placeholder="Décrivez les responsabilités du poste (utilisez la liste à puces)."
                            minHeight={100}
                          />
                        </div>
                      </div>

                      {/* Rich text editors for skills and assets */}
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Compétences recherchées</label>
                          <RichTextEditor
                            value={newJob.skillsRequired || ''}
                            onChange={(html) => setNewJob({ ...newJob, skillsRequired: html })}
                            placeholder="Listez les compétences recherchées (utilisez la liste à puces)."
                            minHeight={100}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Atouts (bonus points)</label>
                          <RichTextEditor
                            value={newJob.assets || ''}
                            onChange={(html) => setNewJob({ ...newJob, assets: html })}
                            placeholder="Listez les atouts souhaités (utilisez la liste à puces)."
                            minHeight={100}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => { setIsAddJobOpen(false); setEditingJob(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>{editingJob ? 'Enregistrer les modifications' : 'Enregistrer l\'offre'}</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: CANDIDATES */}
          {activeTab === 'candidates' && (
            <motion.div key="candidates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Candidatures reçues</h3>
                <button
                  onClick={() => setIsAddCandidateOpen(true)}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <UserPlus className="h-4 w-4" /> Enregistrer un candidat
                </button>
              </div>

              {candidates.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Aucun candidat enregistré.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full border-collapse text-left text-xs text-slate-600">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="p-4">Candidat</th>
                        <th className="p-4">Poste ciblé</th>
                        <th className="p-4 text-center">Score global</th>
                        <th className="p-4">Risques</th>
                        <th className="p-4">Statut</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {candidates.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-4 font-bold text-slate-950">{c.name}</td>
                          <td className="p-4 text-slate-600">{c.job}</td>
                          <td className="p-4 text-center">
                            <span className={cn('font-bold px-2 py-0.5 rounded-full border', c.finalScore >= 50 ? 'text-[#1A2BA6] bg-indigo-50 border-indigo-100' : 'text-red-600 bg-red-50 border-red-100')}>{c.finalScore}%</span>
                          </td>
                          <td className="p-4">
                            <span className={cn('inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px]', c.risks === 'Aucun' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100')}>
                              {c.risks}
                            </span>
                          </td>
                          <td className="p-4">
                            <select
                              value={c.status}
                              onChange={(e) => {
                                const newStatus = e.target.value;
                                if (newStatus === 'EMBAUCHÉ') {
                                  // EMBAUCHÉ requires the contract to be signed by the
                                  // employer first — redirect to the Embauches tab so
                                  // the recruiter uses the proper flow.
                                  setActiveTab('embauches');
                                  return;
                                }
                                if (newStatus === 'ÉLIGIBLE') {
                                  // ÉLIGIBLE creates the Staff + DRAFT contract — use
                                  // the confirmation flow rather than a silent PUT.
                                  handleDeclareEligible(c);
                                  return;
                                }
                                if (newStatus === 'REJETÉ') {
                                  handleRejectCandidate(c.id);
                                  return;
                                }
                                handleMoveCandidate(c.id, newStatus);
                              }}
                              className="bg-slate-50 border border-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 uppercase"
                            >
                              <option value={c.status}>{STATUS_LABELS[c.status] || c.status}</option>
                              {(VALID_TRANSITIONS[c.status] || []).map(s => (
                                <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-3 items-center">
                            <button
                              onClick={() => { setSelectedCandidate(c); setActiveCandidateTab('identity'); }}
                              className="text-xs font-bold text-[#1A2BA6] hover:underline"
                            >
                              Détails fiche →
                            </button>
                            <button onClick={() => handleDeleteCandidate(c.id)} className="text-slate-400 hover:text-red-600 transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {/* Add Candidate Form Modal */}
              {isAddCandidateOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Enregistrer une candidature</h3>
                    <form onSubmit={handleCreateCandidate} className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Prénom</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.firstName} onChange={(e) => setNewCandidate({ ...newCandidate, firstName: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.lastName} onChange={(e) => setNewCandidate({ ...newCandidate, lastName: e.target.value })} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</label>
                          <input type="email" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Téléphone</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.phone} onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Adresse</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.address} onChange={(e) => setNewCandidate({ ...newCandidate, address: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Genre</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.gender} onChange={(e) => setNewCandidate({ ...newCandidate, gender: e.target.value })}>
                            <option value="M">Masculin</option>
                            <option value="F">Féminin</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Associer à l'offre</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.jobId} onChange={(e) => setNewCandidate({ ...newCandidate, jobId: e.target.value })} required>
                            <option value="">-- Choisir une offre d'emploi --</option>
                            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut initial</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newCandidate.status} onChange={(e) => setNewCandidate({ ...newCandidate, status: e.target.value })}>
                            <option value="NOUVEAU">Nouveau</option>
                            <option value="PRÉSÉLECTIONNÉ">Présélectionné</option>
                            <option value="ENTRETIEN RH">Entretien RH</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddCandidateOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Enregistrer</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Candidate Detail Modal */}
              {selectedCandidate && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{selectedCandidate.name}</h3>
                        <p className="text-xs text-slate-500">Candidature pour : {selectedCandidate.job}</p>
                      </div>
                      <button onClick={() => setSelectedCandidate(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold">✕</button>
                    </div>

                    {/* Tabs header */}
                    <div className="flex gap-4 border-b border-slate-100 pb-2 mb-4">
                      {[
                        { id: 'profile', label: 'Profil Carrière' },
                        { id: 'applications', label: 'Candidatures' },
                        { id: 'identity', label: 'Contact' },
                        { id: 'documents', label: 'Documents' },
                        { id: 'ia', label: 'Analyse IA' },
                        { id: 'history', label: 'Historique' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setActiveCandidateTab(t.id as any)}
                          className={cn('text-xs font-bold pb-1.5 transition', activeCandidateTab === t.id ? 'border-b-2 border-[#1A2BA6] text-[#1A2BA6]' : 'text-slate-400 hover:text-slate-600')}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab contents */}
                    <div className="min-h-[280px] text-xs">
                      {activeCandidateTab === 'profile' && (() => {
                        let parsedProfile: any = {};
                        try {
                          if (selectedCandidate.academicProfile?.pedagogicalExperience) {
                            parsedProfile = JSON.parse(selectedCandidate.academicProfile.pedagogicalExperience);
                          }
                        } catch (e) {}
                        const experiencesList = parsedProfile.experiences || [];
                        const educationList = parsedProfile.education || [];
                        const candidatePitch = parsedProfile.pitch || "";
                        const candidateLinkedin = parsedProfile.linkedinUrl || "";
                        const candidateSkills = selectedCandidate.academicProfile?.subjects || [];

                        return (
                          <div className="space-y-5 overflow-y-auto max-h-[55vh] pr-2">
                            {/* Profile Header */}
                            <div className="bg-gradient-to-r from-[#1A2BA6] to-indigo-700 rounded-xl p-4 text-white flex justify-between items-center shadow-sm">
                              <div>
                                <h4 className="font-extrabold text-sm">{selectedCandidate.name}</h4>
                                <p className="text-[10px] text-indigo-100 font-medium">Postulant : {selectedCandidate.job}</p>
                              </div>
                              {candidateLinkedin && (
                                <a
                                  href={candidateLinkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 bg-white text-[#0A66C2] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition"
                                >
                                  <Linkedin className="h-3.5 w-3.5 fill-[#0A66C2]" /> Voir Profil
                                </a>
                              )}
                            </div>

                            {/* Pitch / A propos */}
                            {candidatePitch && (
                              <div className="space-y-1">
                                <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6]">À propos</h5>
                                <p className="text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed whitespace-pre-line">{candidatePitch}</p>
                              </div>
                            )}

                            {/* Recruiter Evaluation Widget */}
                            <div className="border-t border-slate-100 pt-4 space-y-3">
                              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6]">Évaluation Recruteur</h5>
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 space-y-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500 font-semibold">Note (1-5 étoiles) :</span>
                                  <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <button
                                        type="button"
                                        key={star}
                                        onClick={() => setRecruiterRating(star)}
                                        className="text-slate-300 hover:scale-110 transition"
                                      >
                                        <Star className={cn('h-4 w-4', recruiterRating >= star ? 'text-amber-500 fill-amber-500' : 'text-slate-300')} />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <textarea
                                    value={recruiterComment}
                                    onChange={(e) => setRecruiterComment(e.target.value)}
                                    placeholder="Écrire un avis de recrutement..."
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] h-12 focus:outline-none focus:border-[#1A2BA6]"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!selectedCandidate) return;
                                      try {
                                        await hrFetch(hrUrl(`recruitment/applications/${selectedCandidate.id}/status`, { tenantId: tenant.id }), {
                                          method: 'PUT',
                                          body: {
                                            status: selectedCandidate.status,
                                            review: `Évaluation: ${recruiterRating}/5. Note: ${recruiterComment}`
                                          }
                                        });
                                        toast({ variant: 'success', title: 'Avis enregistré !' });
                                        setRecruiterComment('');
                                        setRecruiterRating(0);
                                        loadData();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-[#1A2BA6] text-white rounded-lg text-[9px] font-bold hover:opacity-90 transition"
                                  >
                                    Enregistrer l'évaluation
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {activeCandidateTab === 'applications' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6]">Toutes les candidatures ({selectedCandidate.applications?.length || 0})</h5>
                          </div>
                          {selectedCandidate.applications && selectedCandidate.applications.length > 0 ? (
                            <div className="space-y-2">
                              {selectedCandidate.applications.map((app, i) => (
                                <div key={app.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-bold text-slate-800 text-xs">{app.jobTitle || 'Poste non spécifié'}</p>
                                      <p className="text-[10px] text-slate-500 mt-1">
                                        Statut: <span className="font-bold">{app.status}</span> · Score: {app.score}%
                                      </p>
                                      {app.createdAt && (
                                        <p className="text-[9px] text-slate-400 mt-1">
                                          Postulé le {new Date(app.createdAt).toLocaleDateString('fr-FR')}
                                        </p>
                                      )}
                                      {app.matchDetail && (
                                        <p className="text-[10px] text-slate-500 mt-1 italic">{app.matchDetail.substring(0, 200)}</p>
                                      )}
                                    </div>
                                    {app.status === 'EMBAUCHÉ' && (
                                      <button
                                        onClick={() => {
                                          const newJobId = prompt('ID du nouveau poste (jobId) pour la réaffectation :');
                                          if (newJobId) {
                                            fetch(`/api/hr/recruitment/applications/${app.id}/reassign?tenantId=${tenant?.id || ''}`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({ newJobId }),
                                            })
                                              .then((r) => r.json())
                                              .then((data) => {
                                                if (data?.message) {
                                                  alert(data.message);
                                                  loadData();
                                                } else {
                                                  alert('Erreur: ' + (data?.message || 'réaffectation échouée'));
                                                }
                                              })
                                              .catch((err) => alert('Erreur réseau: ' + err.message));
                                          }
                                        }}
                                        className="px-3 py-1 rounded-lg text-[10px] font-bold text-white bg-[#1A2BA6] hover:opacity-90 transition"
                                      >
                                        🔄 Réaffecter
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-[10px]">Aucune candidature enregistrée.</p>
                          )}
                          <p className="text-[10px] text-slate-400 mt-3">
                            💡 Un candidat peut postuler à plusieurs postes. Chaque candidature suit son propre flux d'entretien/test.
                            La réaffectation permet d'attribuer un nouveau poste à un staff déjà embauché (multi-postes).
                          </p>
                        </div>
                      )}
                      {activeCandidateTab === 'identity' && (
                        <div className="space-y-3">
                          {(() => {
                            let parsedProfile: any = {};
                            try {
                              if (selectedCandidate.academicProfile?.pedagogicalExperience) {
                                parsedProfile = JSON.parse(selectedCandidate.academicProfile.pedagogicalExperience);
                              }
                            } catch (e) {}
                            const candidateLinkedin = parsedProfile.linkedinUrl || "";
                            return (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nom complet</p>
                                    <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedCandidate.name}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Genre</p>
                                    <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedCandidate.gender === 'F' ? 'Féminin' : 'Masculin'}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                                    <p className="text-slate-700 text-xs mt-0.5">{selectedCandidate.email}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Téléphone</p>
                                    <p className="text-slate-700 text-xs mt-0.5">{selectedCandidate.phone || 'Non renseigné'}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Adresse</p>
                                    <p className="text-slate-700 text-xs mt-0.5">{selectedCandidate.address || 'Non renseignée'}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Poste visé</p>
                                    <p className="text-slate-700 text-xs mt-0.5">{selectedCandidate.job || 'Aucun poste'}</p>
                                  </div>
                                </div>
                                {candidateLinkedin && (
                                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-center gap-2">
                                    <Linkedin className="h-4 w-4 text-[#0A66C2] fill-[#0A66C2]" />
                                    <a href={candidateLinkedin} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] text-xs font-bold hover:underline">Profil LinkedIn</a>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date de dépôt</p>
                                    <p className="text-slate-700 text-xs mt-0.5">{selectedCandidate.date}</p>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Statut</p>
                                    <span className={cn('inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px]', 
                                      selectedCandidate.status === 'EMBAUCHÉ' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                      selectedCandidate.status === 'ÉLIGIBLE' ? 'bg-violet-50 text-violet-600 border border-violet-100' :
                                      selectedCandidate.status === 'REJETÉ' ? 'bg-red-50 text-red-600 border border-red-100' :
                                      'bg-amber-50 text-amber-600 border border-amber-100'
                                    )}>{selectedCandidate.status}</span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      {activeCandidateTab === 'documents' && (
                        <div className="space-y-3">
                          {selectedCandidate.documents && selectedCandidate.documents.length > 0 ? (
                            selectedCandidate.documents.map((doc) => {
                              const typeLabel: Record<string, string> = {
                                CV: 'Curriculum Vitae',
                                APPLICATION_LETTER: 'Lettre de demande d\'emploi',
                                COVER_LETTER: 'Lettre de Motivation',
                                RECOMMENDATION: 'Lettre de Recommandation',
                                DIPLOMA: 'Diplôme',
                                CERTIFICATE: 'Certificat',
                                OTHER: 'Autre document',
                              };
                              const typeIcon: Record<string, string> = {
                                CV: '📄',
                                APPLICATION_LETTER: '✉️',
                                COVER_LETTER: '✉️',
                                RECOMMENDATION: '🏅',
                                DIPLOMA: '🎓',
                                CERTIFICATE: '📋',
                                OTHER: '📎',
                              };
                              const fileSizeStr = doc.fileSize
                                ? doc.fileSize > 1024 * 1024
                                  ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} Mo`
                                  : `${(doc.fileSize / 1024).toFixed(0)} Ko`
                                : '';
                              return (
                                <div key={doc.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                                  <span className="text-lg">{typeIcon[doc.documentType] || '📎'}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-800 text-xs truncate">{typeLabel[doc.documentType] || doc.documentType}</p>
                                    <p className="text-[10px] text-slate-500 truncate">{doc.fileName} {fileSizeStr && `· ${fileSizeStr}`}</p>
                                  </div>
                                  <a
                                    href={doc.filePath?.startsWith('https://')
                                      ? doc.filePath
                                      : hrUrl(`recruitment/candidates/${selectedCandidate.id}/documents/${doc.id}/download`)
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[#1A2BA6] hover:underline text-[10px] font-bold whitespace-nowrap"
                                  >
                                    Ouvrir →
                                  </a>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center py-6">
                              <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                              <p className="text-[10px] text-slate-400 italic">Aucun document téléchargé pour ce candidat.</p>
                            </div>
                          )}
                        </div>
                      )}
                      {activeCandidateTab === 'ia' && (
                        <div className="space-y-4">
                          {/* Final Score - Most prominent */}
                          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[10px] text-indigo-500 font-bold uppercase">Score Final (Composite)</p>
                                <p className={cn('text-2xl font-extrabold mt-1', selectedCandidate.finalScore >= 50 ? 'text-[#1A2BA6]' : 'text-red-600')}>{selectedCandidate.finalScore}%</p>
                              </div>
                              <div className="text-[10px] text-indigo-400 max-w-[200px]">{selectedCandidate.scoreBreakdown}</div>
                            </div>
                          </div>
                          {/* Score breakdown: Documents, Interview, Test */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Score Documents</p>
                              <p className="text-sm font-bold text-slate-900 mt-1">{selectedCandidate.docScore}%</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">CV / Lettre / Matching</p>
                            </div>
                            <div className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                              <p className="text-[10px] text-violet-400 font-bold uppercase">Score Entretien</p>
                              <p className="text-sm font-bold text-violet-700 mt-1">{selectedCandidate.interviewScore !== null ? `${selectedCandidate.interviewScore}%` : '—'}</p>
                              <p className="text-[9px] text-violet-300 mt-0.5">Note réelle</p>
                            </div>
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <p className="text-[10px] text-amber-400 font-bold uppercase">Score Test</p>
                              <p className="text-sm font-bold text-amber-700 mt-1">{selectedCandidate.testScore !== null ? `${selectedCandidate.testScore}%` : '—'}</p>
                              <p className="text-[9px] text-amber-300 mt-0.5">Note réelle</p>
                            </div>
                          </div>
                          {/* Document analysis sub-scores */}
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Score CV</p>
                              <p className="text-sm font-bold text-slate-900 mt-1">{selectedCandidate.scoreCV}%</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Score Lettre</p>
                              <p className="text-sm font-bold text-slate-900 mt-1">{selectedCandidate.scoreLetter}%</p>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Matching</p>
                              <p className="text-sm font-bold text-[#1A2BA6] mt-1">{selectedCandidate.scoreMatching}%</p>
                            </div>
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">Détail du matching :</p>
                            <p className="text-slate-600 mt-1">{selectedCandidate.matchDetail || "En attente d'évaluation IA."}</p>
                          </div>
                          {selectedCandidate.risks !== 'Aucun' && (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 flex gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold">Risques détectés : {selectedCandidate.risks}</p>
                                {selectedCandidate.riskDetail && <p className="text-[10px] mt-0.5">{selectedCandidate.riskDetail}</p>}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {activeCandidateTab === 'history' && (
                        <div className="space-y-3">
                          {selectedCandidate.history.map((h, i) => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-50 pb-2">
                              <div>
                                <p className="font-semibold text-slate-800">{h.action}</p>
                                <p className="text-[10px] text-slate-400">Par {h.user}</p>
                              </div>
                              <span className="text-[10px] text-slate-400">{h.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: INTERVIEWS */}
          {activeTab === 'interviews' && (
            <motion.div key="interviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Calendrier des Entretiens</h3>
                <button
                  onClick={() => openNewInterview()}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <CalendarDays className="h-4 w-4" /> Programmer un entretien
                </button>
              </div>

              {/* Interview Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
                {[
                  { key: 'TOUS', label: 'Tous', count: interviews.length },
                  { key: 'PLANIFIÉ', label: 'Planifiés', count: totalInterviews },
                  { key: 'EN_COURS', label: 'En cours', count: totalInterviewsInProgress },
                  { key: 'TERMINÉ', label: 'Terminés', count: totalInterviewsCompleted },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setInterviewFilter(tab.key as typeof interviewFilter)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition',
                      interviewFilter === tab.key
                        ? 'bg-white text-[#1A2BA6] shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {tab.label} <span className="ml-0.5 text-[9px] font-normal">({tab.count})</span>
                  </button>
                ))}
              </div>

              {interviews.filter(int => interviewFilter === 'TOUS' || int.status === interviewFilter).length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">
                    {interviewFilter === 'PLANIFIÉ' ? 'Aucun entretien planifié.' : interviewFilter === 'EN_COURS' ? 'Aucun entretien en cours.' : interviewFilter === 'TERMINÉ' ? 'Aucun entretien terminé.' : 'Aucun entretien programmé.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {interviews.filter(int => interviewFilter === 'TOUS' || int.status === interviewFilter).map((int) => (
                    <div key={int.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">{int.type}</span>
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                              int.status === 'TERMINÉ'
                                ? int.result === 'RÉUSSI'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : int.result === 'ÉCHOUÉ'
                                    ? 'bg-red-50 text-red-700 border border-red-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                                : int.status === 'EN_COURS'
                                  ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                  : 'bg-slate-50 text-slate-600 border border-slate-200'
                            )}>
                              {int.status === 'TERMINÉ'
                                ? (int.result === 'RÉUSSI' ? 'Réussi' : int.result === 'ÉCHOUÉ' ? 'Échoué' : 'En attente')
                                : int.status === 'EN_COURS' ? 'En cours' : 'Planifié'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openEditInterview(int)} className="text-slate-400 hover:text-blue-600 transition">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDeleteInterview(int.id)} className="text-slate-400 hover:text-red-600 transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <h4 className="font-bold text-slate-900 mt-3 text-xs">
                          {int.candidate ? `${int.candidate.firstName} ${int.candidate.lastName}` : 'Candidat inconnu'}
                        </h4>
                        <div className="mt-4 flex flex-col gap-1.5 text-xs text-slate-500 border-t border-slate-50 pt-3">
                          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {int.date} à {int.time}</span>
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Format : {int.format}</span>
                          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Évaluateur : {int.evaluator}</span>
                        </div>
                        {int.comments && (
                          <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[10px] text-slate-600">
                            {int.comments}
                          </div>
                        )}
                        {int.feedback && (
                          <div className="mt-2 bg-blue-50 p-2.5 rounded-lg border border-blue-100 text-[10px] text-blue-700">
                            <span className="font-bold">Retour : </span>{int.feedback}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-slate-400">Note :</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{int.score}/100</span>
                          {int.status !== 'TERMINÉ' ? (
                            <button
                              onClick={() => {
                                setValidatingInterview(int);
                                setInterviewValidation({ result: 'RÉUSSI', score: String(int.score || 0), feedback: '' });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-white rounded-lg text-[10px] font-bold shadow-sm hover:opacity-90 transition bg-emerald-600"
                            >
                              <CheckCircle className="h-3 w-3" /> Valider
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setValidatingInterview(int);
                                setInterviewValidation({ result: int.result || 'RÉUSSI', score: String(int.score || 0), feedback: int.feedback || '' });
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-200 hover:bg-slate-50 transition"
                            >
                              <Edit2 className="h-3 w-3" /> Modifier résultat
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule Interview Modal */}
              {isAddInterviewOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">{editingInterview ? 'Modifier l\'entretien' : 'Programmer un entretien'}</h3>
                    <form onSubmit={handleSaveInterview} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Candidat</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.candidateId} onChange={(e) => setNewInterview({ ...newInterview, candidateId: e.target.value })} required>
                          <option value="">-- Choisir un candidat --</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type d'entretien</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.type} onChange={(e) => setNewInterview({ ...newInterview, type: e.target.value })}>
                            <option value="RH">Entretien RH</option>
                            <option value="TECHNIQUE">Entretien Technique</option>
                            <option value="DIRECTION">Entretien de Direction</option>
                            <option value="PEDAGOGIQUE">Entretien Pédagogique</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Format</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.format} onChange={(e) => setNewInterview({ ...newInterview, format: e.target.value })}>
                            <option value="Visioconférence">Visioconférence</option>
                            <option value="Présentiel">Présentiel</option>
                            <option value="Téléphone">Téléphone</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date</label>
                          <input type="date" min={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.date} onChange={(e) => setNewInterview({ ...newInterview, date: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Heure</label>
                          <input type="time" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.time} onChange={(e) => setNewInterview({ ...newInterview, time: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Score (RH/Tech)</label>
                          <input type="number" min="0" max="100" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.score} onChange={(e) => setNewInterview({ ...newInterview, score: e.target.value })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Évaluateur (RH/Manager)
                            {recruiterProfile?.fullName && !editingInterview && (
                              <span className="ml-1 text-[9px] text-emerald-600 normal-case font-medium">⚡ depuis Profil Recruteur</span>
                            )}
                          </label>
                          {staffList.length > 0 ? (
                            <select
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white"
                              value={newInterview.evaluator}
                              onChange={(e) => setNewInterview({ ...newInterview, evaluator: e.target.value })}
                              required
                            >
                              <option value="">— Sélectionner un évaluateur —</option>
                              {recruiterProfile?.fullName && (
                                <option value={recruiterProfile.fullName}>{recruiterProfile.fullName} (Recruteur par défaut)</option>
                              )}
                              {staffList.map((s) => (
                                <option key={s.id} value={`${s.firstName} ${s.lastName}`}>
                                  {s.firstName} {s.lastName}{s.position ? ` (${s.position})` : ''}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.evaluator} onChange={(e) => setNewInterview({ ...newInterview, evaluator: e.target.value })} required placeholder="Nom de l'évaluateur" />
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Commentaires</label>
                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" value={newInterview.comments} onChange={(e) => setNewInterview({ ...newInterview, comments: e.target.value })} />
                      </div>

                      {/* Dynamic fields based on format */}
                      {newInterview.format === 'Visioconférence' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            🔗 Lien de la réunion (Google Meet / Zoom)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="url"
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
                              value={newInterview.meetingLink}
                              onChange={(e) => setNewInterview({ ...newInterview, meetingLink: e.target.value })}
                              placeholder="https://meet.google.com/xxx-xxxx-xxx"
                            />
                            <button
                              type="button"
                              onClick={() => window.open('https://meet.google.com/new', '_blank')}
                              className="px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 whitespace-nowrap"
                            >
                              🔗 Générer Meet
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1">Cliquez sur "Générer Meet" pour créer un lien Google Meet, puis copiez-le dans le champ.</p>
                        </div>
                      )}

                      {newInterview.format === 'Téléphone' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">📞 Numéro de téléphone</label>
                          <input
                            type="tel"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                            value={newInterview.phoneNumber}
                            onChange={(e) => setNewInterview({ ...newInterview, phoneNumber: e.target.value })}
                            placeholder="+229 ..."
                          />
                        </div>
                      )}

                      {newInterview.format === 'Présentiel' && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <p className="text-[10px] text-slate-500">
                            📍 L'adresse de l'établissement ({tenantAddress || 'non configurée'}) sera automatiquement incluse dans l'email envoyé au candidat.
                          </p>
                        </div>
                      )}

                      {/* Status / Result / Feedback — only shown when editing an existing interview */}
                      {editingInterview && (
                        <>
                          <div className="border-t border-slate-100 pt-4">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Statut & Résultat</span>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut</label>
                                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.status} onChange={(e) => setNewInterview({ ...newInterview, status: e.target.value })}>
                                  <option value="">-- Changer le statut --</option>
                                  <option value="PLANIFIÉ">Planifié</option>
                                  <option value="EN_COURS">En cours</option>
                                  <option value="TERMINÉ">Terminé</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Résultat</label>
                                <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.result} onChange={(e) => setNewInterview({ ...newInterview, result: e.target.value })}>
                                  <option value="">-- Changer le résultat --</option>
                                  <option value="RÉUSSI">Réussi / Validé</option>
                                  <option value="ÉCHOUÉ">Échoué / Non retenu</option>
                                  <option value="EN_ATTENTE">En attente</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Retour / Feedback</label>
                            <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" placeholder="Commentaires sur l'entretien, points forts, points à améliorer..." value={newInterview.feedback} onChange={(e) => setNewInterview({ ...newInterview, feedback: e.target.value })} />
                          </div>
                        </>
                      )}

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => { setIsAddInterviewOpen(false); setEditingInterview(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>{editingInterview ? 'Enregistrer' : 'Programmer'}</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Validate Interview Modal */}
              {validatingInterview && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
                    <div className={cn("-mx-6 -mt-6 px-6 py-4 rounded-t-2xl mb-4", validatingInterview.status === 'TERMINÉ' ? "bg-blue-600" : "bg-emerald-600")}>
                      <h3 className="font-bold text-white text-sm">{validatingInterview.status === 'TERMINÉ' ? 'Modifier le résultat' : 'Valider l\'entretien'}</h3>
                      <p className="text-emerald-100 text-[10px] mt-0.5">
                        {validatingInterview.candidate ? `${validatingInterview.candidate.firstName} ${validatingInterview.candidate.lastName}` : 'Candidat'} — {validatingInterview.type}
                      </p>
                    </div>
                    <form onSubmit={handleValidateInterview} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Résultat de l'entretien</label>
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                          value={interviewValidation.result}
                          onChange={(e) => setInterviewValidation({ ...interviewValidation, result: e.target.value })}
                        >
                          <option value="RÉUSSI">Réussi / Validé</option>
                          <option value="ÉCHOUÉ">Échoué / Non retenu</option>
                          <option value="EN_ATTENTE">En attente</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Score (/100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                          value={interviewValidation.score}
                          onChange={(e) => setInterviewValidation({ ...interviewValidation, score: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Retour / Commentaires</label>
                        <textarea
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-20"
                          placeholder="Commentaires sur l'entretien, points forts, points à améliorer..."
                          value={interviewValidation.feedback}
                          onChange={(e) => setInterviewValidation({ ...interviewValidation, feedback: e.target.value })}
                        />
                      </div>

                      {interviewValidation.result === 'RÉUSSI' && validatingInterview.status !== 'TERMINÉ' && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                          <p className="text-[10px] text-blue-700 font-medium">
                            Le statut de la candidature sera automatiquement avancé à <strong>Entretien</strong>, rendant le candidat éligible pour l'embauche.
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => { setValidatingInterview(null); setInterviewValidation({ result: 'RÉUSSI', score: '0', feedback: '' }); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold bg-emerald-600 hover:opacity-90 transition">{validatingInterview.status === 'TERMINÉ' ? 'Enregistrer les modifications' : 'Valider l\'entretien'}</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: TESTS */}
          {activeTab === 'tests' && (
            <motion.div key="tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Épreuves et Tests d'évaluation</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Créez et gérez les tests d'évaluation. Saisissez les résultats des candidats.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setEditingTestResult(null); setNewTestResult({ testId: '', candidateId: '', score: '50', result: 'RÉUSSI', notes: '', evaluatedAt: new Date().toISOString().split('T')[0] }); setIsAddTestResultOpen(true); }}
                    className="flex items-center gap-2 border border-[#1A2BA6] text-[#1A2BA6] rounded-xl px-4 py-2.5 text-xs font-bold transition hover:bg-indigo-50"
                  >
                    <PenTool className="h-3.5 w-3.5" /> Saisir un résultat
                  </button>
                  <button
                    onClick={() => { setEditingTest(null); setNewTest({ name: '', type: 'Technique', description: '', duration: '', instructions: '', maxScore: '100', passingScore: '50', status: 'ACTIF' }); setIsAddTestOpen(true); }}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Plus className="h-4 w-4" /> Créer un test
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Tests', value: tests.filter(t => t.status !== 'ARCHIVÉ').length, sub: 'Tests actifs', icon: ClipboardList, bg: 'bg-blue-50/50 border-blue-100/50', color: 'text-blue-600' },
                  { label: 'Résultats', value: tests.reduce((sum, t) => sum + (t.results?.length || 0), 0), sub: `${tests.reduce((sum, t) => sum + (t.results?.filter(r => r.result === 'RÉUSSI').length || 0), 0)} réussis`, icon: CheckCircle, bg: 'bg-emerald-50/50 border-emerald-100/50', color: 'text-emerald-600' },
                  { label: 'Taux Réussite', value: (() => { const all = tests.reduce((sum, t) => sum + (t.results?.length || 0), 0); const pass = tests.reduce((sum, t) => sum + (t.results?.filter(r => r.result === 'RÉUSSI').length || 0), 0); return all > 0 ? `${Math.round(pass / all * 100)}%` : '—'; })(), sub: 'Tests validés', icon: Star, bg: 'bg-amber-50/50 border-amber-100/50', color: 'text-amber-600' },
                  { label: 'Score Moyen', value: (() => { const allResults = tests.flatMap(t => t.results || []); return allResults.length > 0 ? `${Math.round(allResults.reduce((s, r) => s + r.score, 0) / allResults.length)}` : '—'; })(), sub: 'Moyenne générale', icon: Sparkles, bg: 'bg-violet-50/50 border-violet-100/50', color: 'text-violet-600' },
                ].map((card, i) => (
                  <div key={i} className={`border rounded-xl p-3.5 shadow-sm flex items-center gap-3 ${card.bg}`}>
                    <div className={`p-2 rounded-lg bg-white/80 ${card.color}`}>
                      <card.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-lg font-extrabold text-slate-900">{card.value}</span>
                      <span className="text-[9px] text-slate-500 block font-medium">{card.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'TOUS' as const, label: 'Tous' },
                    { id: 'Technique' as const, label: 'Technique' },
                    { id: 'RH / Psychotechnique' as const, label: 'RH / Psycho' },
                    { id: 'Anglais' as const, label: 'Anglais' },
                    { id: 'Compétences transverses' as const, label: 'Comp. transverses' },
                    { id: 'Pédagogique' as const, label: 'Pédagogique' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTestFilter(f.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[10px] font-bold transition border',
                        testFilter === f.id
                          ? 'bg-[#1A2BA6] text-white border-[#1A2BA6]'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 max-w-xs ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un test..."
                    value={testSearch}
                    onChange={e => setTestSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                  />
                </div>
              </div>

              {/* Test List */}
              {(() => {
                const filtered = tests
                  .filter(t => testFilter === 'TOUS' || t.type === testFilter)
                  .filter(t => !testSearch || t.name.toLowerCase().includes(testSearch.toLowerCase()) || (t.description || '').toLowerCase().includes(testSearch.toLowerCase()));

                if (tests.length === 0) {
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                      <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-xs text-slate-500 font-semibold">Aucun test d'évaluation enregistré.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Cliquez sur "Créer un test" pour commencer.</p>
                    </div>
                  );
                }
                if (filtered.length === 0) {
                  return (
                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                      <Filter className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500 font-semibold">Aucun test trouvé pour ce filtre.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {filtered.map((test) => {
                      const passCount = test.results?.filter(r => r.result === 'RÉUSSI').length || 0;
                      const failCount = test.results?.filter(r => r.result === 'ÉCHOUÉ').length || 0;
                      const pendingCount = test.results?.filter(r => r.result === 'EN_ATTENTE').length || 0;
                      const avgScore = (test.results && test.results.length > 0) ? Math.round(test.results.reduce((s, r) => s + r.score, 0) / test.results.length) : null;
                      const passRate = (test.results && test.results.length > 0) ? Math.round(passCount / test.results.length * 100) : null;

                      return (
                        <div key={test.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                          {/* Test Header */}
                          <div className="p-5">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn(
                                    'px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border',
                                    test.type === 'Technique' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                    test.type === 'RH / Psychotechnique' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                    test.type === 'Anglais' ? 'bg-cyan-50 text-cyan-700 border-cyan-100' :
                                    test.type === 'Pédagogique' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                    'bg-orange-50 text-orange-700 border-orange-100'
                                  )}>
                                    {test.type}
                                  </span>
                                  <span className={cn(
                                    'px-2 py-0.5 rounded-full text-[8px] font-bold uppercase',
                                    test.status === 'ACTIF' ? 'bg-emerald-50 text-emerald-600' :
                                    test.status === 'BROUILLON' ? 'bg-slate-100 text-slate-500' :
                                    'bg-red-50 text-red-500'
                                  )}>
                                    {test.status === 'ACTIF' ? 'Actif' : test.status === 'BROUILLON' ? 'Brouillon' : 'Archivé'}
                                  </span>
                                  {test.duration && (
                                    <span className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                                      <Clock className="h-3 w-3" /> {test.duration} min
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-bold text-slate-900 mt-2 text-sm">{test.name}</h4>
                                {test.description && <div className="text-xs text-slate-500 mt-1 leading-relaxed"><RichContent html={test.description} /></div>}
                                {test.instructions && (
                                  <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Consignes</span>
                                    <div className="text-[11px] text-slate-600 mt-0.5"><RichContent html={test.instructions} /></div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-4">
                                <button onClick={() => openEditTest(test)} className="p-1.5 text-slate-400 hover:text-[#1A2BA6] hover:bg-indigo-50 rounded-lg transition">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => handleDeleteTest(test.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Score Config */}
                            <div className="flex items-center gap-4 mt-3 text-[10px]">
                              <span className="flex items-center gap-1 text-slate-500">
                                <Star className="h-3 w-3 text-amber-400" /> Score max: <b className="text-slate-700">{test.maxScore || 100}</b>
                              </span>
                              <span className="flex items-center gap-1 text-slate-500">
                                <CheckCircle className="h-3 w-3 text-emerald-400" /> Score réussite: <b className="text-slate-700">{test.passingScore || 50}</b>
                              </span>
                            </div>

                            {/* Stats bar */}
                            {(test.results && test.results.length > 0) && (
                              <div className="mt-3 flex items-center gap-4 text-[10px]">
                                <div className="flex items-center gap-2 flex-1">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${passRate || 0}%` }} />
                                  </div>
                                  <span className="font-bold text-slate-600">{passRate}% réussite</span>
                                </div>
                                <span className="text-emerald-600 font-bold">{passCount} réussi{passCount > 1 ? 's' : ''}</span>
                                <span className="text-red-500 font-bold">{failCount} échoué{failCount > 1 ? 's' : ''}</span>
                                {pendingCount > 0 && <span className="text-amber-500 font-bold">{pendingCount} en attente</span>}
                                <span className="text-slate-400">Score moyen: <b className="text-slate-600">{avgScore}/{test.maxScore || 100}</b></span>
                              </div>
                            )}
                          </div>

                          {/* Results Section */}
                          <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Candidats ayant passé ce test ({test.results?.length || 0})
                              </span>
                              <button
                                onClick={() => { setEditingTestResult(null); setNewTestResult({ testId: test.id, candidateId: '', score: '50', result: 'RÉUSSI', notes: '', evaluatedAt: new Date().toISOString().split('T')[0] }); setIsAddTestResultOpen(true); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#1A2BA6] hover:underline"
                              >
                                <Plus className="h-3 w-3" /> Ajouter un résultat
                              </button>
                            </div>
                            {(!test.results || test.results.length === 0) ? (
                              <span className="text-xs text-slate-400 italic">Aucun résultat enregistré pour le moment.</span>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {test.results.map((res) => (
                                  <div key={res.id} className={cn(
                                    'bg-white border rounded-lg p-3.5 shadow-sm',
                                    res.result === 'RÉUSSI' ? 'border-emerald-100' :
                                    res.result === 'ÉCHOUÉ' ? 'border-red-100' :
                                    'border-amber-100'
                                  )}>
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2">
                                        <div className={cn(
                                          'w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold',
                                          res.result === 'RÉUSSI' ? 'bg-emerald-500' :
                                          res.result === 'ÉCHOUÉ' ? 'bg-red-500' :
                                          'bg-amber-500'
                                        )}>
                                          {res.candidate ? `${res.candidate.firstName[0]}${res.candidate.lastName[0]}` : '??'}
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-800 text-xs">{res.candidate ? `${res.candidate.firstName} ${res.candidate.lastName}` : 'Inconnu'}</p>
                                          <p className="text-[9px] text-slate-400">{res.evaluatedAt ? new Date(res.evaluatedAt).toLocaleDateString('fr-FR') : '—'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button onClick={() => openEditTestResult(res, test.id)} className="p-1 text-slate-300 hover:text-[#1A2BA6] transition">
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                        <button onClick={() => handleDeleteTestResult(res.id)} className="p-1 text-slate-300 hover:text-red-500 transition">
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={cn(
                                          'px-2 py-0.5 rounded-full text-[9px] font-bold',
                                          res.result === 'RÉUSSI' ? 'bg-emerald-50 text-emerald-700' :
                                          res.result === 'ÉCHOUÉ' ? 'bg-red-50 text-red-700' :
                                          'bg-amber-50 text-amber-700'
                                        )}>
                                          {res.result === 'RÉUSSI' ? 'Réussi' : res.result === 'ÉCHOUÉ' ? 'Échoué' : 'En attente'}
                                        </span>
                                        <span className={cn(
                                          'font-bold text-xs',
                                          res.score >= (test.passingScore || 50) ? 'text-[#1A2BA6]' : 'text-red-600'
                                        )}>
                                          {res.score}/{test.maxScore || 100}
                                        </span>
                                      </div>
                                      {/* Score bar */}
                                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={cn(
                                          'h-full rounded-full',
                                          res.score >= (test.passingScore || 50) ? 'bg-emerald-500' : 'bg-red-400'
                                        )} style={{ width: `${Math.min(100, (res.score / (test.maxScore || 100)) * 100)}%` }} />
                                      </div>
                                    </div>
                                    {res.notes && (
                                      <p className="text-[10px] text-slate-500 mt-2 border-t border-slate-50 pt-1.5 italic">{res.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Create/Edit Test Modal */}
              {isAddTestOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-slate-900 text-base mb-1">{editingTest ? 'Modifier l\'épreuve / test' : 'Créer une épreuve / test'}</h3>
                    <p className="text-[11px] text-slate-500 mb-4">Définissez les paramètres du test d'évaluation. Les candidats pourront ensuite y être affectés.</p>
                    <form onSubmit={handleSaveTest} className="space-y-4">
                      {/* Row 1: Name + Type */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom de l'épreuve *</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} placeholder="Ex: Test Python Avancé" required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type de test *</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.type} onChange={(e) => setNewTest({ ...newTest, type: e.target.value })}>
                            <option value="Technique">Technique</option>
                            <option value="RH / Psychotechnique">RH / Psychotechnique</option>
                            <option value="Anglais">Langue / Anglais</option>
                            <option value="Pédagogique">Pédagogique</option>
                            <option value="Compétences transverses">Compétences transverses</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Description */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description / Objectifs</label>
                        <RichTextEditor
                          value={newTest.description}
                          onChange={(html) => setNewTest({ ...newTest, description: html })}
                          placeholder="Décrivez les objectifs et le contenu du test... (utilisez les puces pour structurer)"
                          minHeight={80}
                        />
                      </div>

                      {/* Row 3: Instructions */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Consignes / Instructions</label>
                        <RichTextEditor
                          value={newTest.instructions}
                          onChange={(html) => setNewTest({ ...newTest, instructions: html })}
                          placeholder="Instructions spécifiques pour les candidats (durée, documents autorisés, etc.)... (utilisez les puces)"
                          minHeight={80}
                        />
                      </div>

                      {/* Row 4: Duration + Status */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Durée (minutes)</label>
                          <input type="number" min="1" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.duration} onChange={(e) => setNewTest({ ...newTest, duration: e.target.value })} placeholder="Ex: 60" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.status} onChange={(e) => setNewTest({ ...newTest, status: e.target.value })}>
                            <option value="ACTIF">Actif</option>
                            <option value="BROUILLON">Brouillon</option>
                            <option value="ARCHIVÉ">Archivé</option>
                          </select>
                        </div>
                      </div>

                      {/* Row 5: Max Score + Passing Score */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Score maximum</label>
                          <input type="number" min="1" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.maxScore} onChange={(e) => setNewTest({ ...newTest, maxScore: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Score de réussite</label>
                          <input type="number" min="1" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" value={newTest.passingScore} onChange={(e) => setNewTest({ ...newTest, passingScore: e.target.value })} />
                          <p className="text-[9px] text-slate-400 mt-0.5">Score minimum pour valider le test</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsAddTestOpen(false); setEditingTest(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition" style={{ backgroundColor: PRIMARY }}>
                          {editingTest ? 'Mettre à jour' : 'Créer le test'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Create/Edit Test Result Modal */}
              {isAddTestResultOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
                    <h3 className="font-bold text-slate-900 text-base mb-1">{editingTestResult ? 'Modifier le résultat' : 'Saisir un résultat de test'}</h3>
                    <p className="text-[11px] text-slate-500 mb-4">
                      {editingTestResult
                        ? 'Modifiez le score, le résultat ou les commentaires du candidat.'
                        : 'Enregistrez le score d\'un candidat pour un test. Si le test est réussi, le candidat sera automatiquement avancé au statut Test dans le pipeline.'}
                    </p>
                    <form onSubmit={handleSaveTestResult} className="space-y-4">
                      {/* Test Selector */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Épreuve / Test *</label>
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                          value={newTestResult.testId}
                          onChange={(e) => setNewTestResult({ ...newTestResult, testId: e.target.value })}
                          required
                          disabled={!!editingTestResult}
                        >
                          <option value="">-- Choisir le test --</option>
                          {tests.filter(t => t.status === 'ACTIF').map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.type})</option>
                          ))}
                        </select>
                        {newTestResult.testId && (() => {
                          const selectedTest = tests.find(t => t.id === newTestResult.testId);
                          if (selectedTest) {
                            return (
                              <div className="mt-1.5 flex items-center gap-3 text-[9px] text-slate-400">
                                <span>Score max: <b className="text-slate-600">{selectedTest.maxScore || 100}</b></span>
                                <span>Réussite: <b className="text-slate-600">{selectedTest.passingScore || 50}</b></span>
                                {selectedTest.duration && <span>Durée: <b className="text-slate-600">{selectedTest.duration} min</b></span>}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Candidate Selector */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Candidat *</label>
                        <select
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                          value={newTestResult.candidateId}
                          onChange={(e) => setNewTestResult({ ...newTestResult, candidateId: e.target.value })}
                          required
                          disabled={!!editingTestResult}
                        >
                          <option value="">-- Choisir le candidat --</option>
                          {candidates.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.job !== 'Aucun poste' ? `— ${c.job}` : ''} ({STATUS_LABELS[c.status] || c.status})
                            </option>
                          ))}
                        </select>
                        {newTestResult.candidateId && (() => {
                          const cand = candidates.find(c => c.id === newTestResult.candidateId);
                          if (cand) {
                            return (
                              <div className="mt-1.5 flex items-center gap-2 text-[9px] text-slate-400">
                                <span>Statut actuel: <span className={cn(
                                  'font-bold',
                                  cand.status === 'EMBAUCHÉ' ? 'text-emerald-600' :
                                  cand.status === 'ÉLIGIBLE' ? 'text-violet-600' :
                                  cand.status === 'REJETÉ' ? 'text-red-500' :
                                  'text-slate-600'
                                )}>{STATUS_LABELS[cand.status] || cand.status}</span></span>
                                <span>·</span>
                                <span>Poste: {cand.job}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Score + Result */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Score obtenu /{newTestResult.testId ? (tests.find(t => t.id === newTestResult.testId)?.maxScore || 100) : 100}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={newTestResult.testId ? (tests.find(t => t.id === newTestResult.testId)?.maxScore || 100) : 100}
                            className={cn(
                              'w-full rounded-lg border px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20',
                              newTestResult.testId && Number(newTestResult.score) >= (tests.find(t => t.id === newTestResult.testId)?.passingScore || 50)
                                ? 'border-emerald-200 focus:border-emerald-500'
                                : Number(newTestResult.score) > 0 ? 'border-red-200 focus:border-red-500'
                                : 'border-slate-200 focus:border-[#1A2BA6]'
                            )}
                            value={newTestResult.score}
                            onChange={(e) => setNewTestResult({ ...newTestResult, score: e.target.value })}
                            required
                          />
                          {newTestResult.testId && (
                            <p className={cn(
                              'text-[9px] mt-0.5 font-medium',
                              Number(newTestResult.score) >= (tests.find(t => t.id === newTestResult.testId)?.passingScore || 50)
                                ? 'text-emerald-600' : 'text-red-500'
                            )}>
                              {Number(newTestResult.score) >= (tests.find(t => t.id === newTestResult.testId)?.passingScore || 50)
                                ? 'Au-dessus du score de réussite' : 'En dessous du score de réussite'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Résultat final</label>
                          <select
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                            value={newTestResult.result}
                            onChange={(e) => setNewTestResult({ ...newTestResult, result: e.target.value })}
                          >
                            <option value="RÉUSSI">Réussi / Validé</option>
                            <option value="ÉCHOUÉ">Échoué / Non retenu</option>
                            <option value="EN_ATTENTE">En attente</option>
                          </select>
                        </div>
                      </div>

                      {/* Date d'évaluation */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Date d'évaluation</label>
                        <input
                          type="date"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]"
                          value={newTestResult.evaluatedAt}
                          onChange={(e) => setNewTestResult({ ...newTestResult, evaluatedAt: e.target.value })}
                        />
                      </div>

                      {/* Notes / Commentaires */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Commentaires / Observations</label>
                        <RichTextEditor
                          value={newTestResult.notes}
                          onChange={(html) => setNewTestResult({ ...newTestResult, notes: html })}
                          placeholder="Observations sur la performance du candidat, points forts, axes d'amélioration... (utilisez les puces)"
                          minHeight={80}
                        />
                      </div>

                      {/* Info box */}
                      {!editingTestResult && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                          <p className="text-[10px] text-blue-700 font-medium flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>Si le résultat est <b>Réussi</b>, le statut du candidat sera automatiquement avancé à <b>Test</b> dans le pipeline de recrutement. Le test est une étape optionnelle : un candidat peut être embauché directement après l'entretien.</span>
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end mt-6 pt-4 border-t border-slate-100">
                        <button type="button" onClick={() => { setIsAddTestResultOpen(false); setEditingTestResult(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-50 transition">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold hover:opacity-90 transition" style={{ backgroundColor: PRIMARY }}>
                          {editingTestResult ? 'Mettre à jour' : 'Enregistrer le résultat'}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: EMBAUCHES */}
          {activeTab === 'embauches' && (
            <motion.div key="embauches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Embauches et Contrats</h3>
                <p className="text-xs text-slate-500">
                  Workflow en deux étapes : <strong>1)</strong> Déclarer éligible (crée la fiche personnel + contrat brouillon),
                  &nbsp;<strong>2)</strong> préparer & signer le contrat, puis <strong>3)</strong> embaucher (envoie l'email au candidat).
                </p>
              </div>

              {/* ─── Section: ÉLIGIBLES — En préparation de contrat (NEW) ──────── */}
              {eligibleCandidates.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-violet-50 text-violet-700 border border-violet-100">
                      {eligibleCandidates.length} éligible{eligibleCandidates.length !== 1 ? 's' : ''} en préparation
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Contrat à préparer et signer par le recruteur avant l'embauche</span>
                  </div>

                  <div className="bg-white border border-violet-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-collapse text-left text-xs text-slate-600">
                      <thead>
                        <tr className="bg-violet-50/50 border-b border-violet-100 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Candidat</th>
                          <th className="p-4">Poste</th>
                          <th className="p-4">Statut contrat</th>
                          <th className="p-4">Signature recruteur</th>
                          <th className="p-4">Score Final</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eligibleCandidates.map((c) => {
                          const contractSigned = !!c.contract?.isEmployerSigned;
                          const contractStatus = c.contract?.status || 'DRAFT';
                          return (
                            <tr key={c.id} className="hover:bg-violet-50/30 transition">
                              <td className="p-4 font-bold text-slate-950">{c.name}</td>
                              <td className="p-4 text-slate-600">{c.job}</td>
                              <td className="p-4">
                                <span className={cn(
                                  'uppercase text-[9px] font-bold px-2 py-0.5 rounded-full border',
                                  contractStatus === 'DRAFT'
                                    ? 'bg-slate-50 text-slate-600 border-slate-200'
                                    : contractStatus === 'PENDING'
                                    ? 'bg-amber-50 text-amber-700 border-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                )}>
                                  {contractStatus === 'DRAFT' ? 'Brouillon' : contractStatus === 'PENDING' ? 'En attente' : contractStatus}
                                </span>
                              </td>
                              <td className="p-4">
                                {contractSigned ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                                    <CheckCircle className="h-3 w-3" /> Signée
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                                    <Clock className="h-3 w-3" /> En attente
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{c.finalScore}%</span>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handlePrepareContract(c)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-[#1A2BA6] rounded-lg text-xs font-bold border border-[#1A2BA6]/20 hover:bg-[#1A2BA6]/5 transition"
                                    title="Ouvrir la page du contrat pour le préparer et le signer"
                                  >
                                    <FileText className="h-3.5 w-3.5" /> Préparer le contrat
                                  </button>
                                  {contractSigned ? (
                                    <button
                                      onClick={() => setHireCandidate(c)}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition bg-emerald-600"
                                      title="Finaliser l'embauche — envoie l'email au candidat"
                                    >
                                      <UserCheck className="h-3.5 w-3.5" /> Embaucher
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-slate-400 rounded-lg text-xs font-bold border border-slate-200 cursor-not-allowed"
                                      title="Veuillez préparer et signer le contrat d'abord"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5" /> Embaucher
                                    </button>
                                  )}
                                </div>
                                {!contractSigned && (
                                  <p className="text-[9px] text-amber-700 mt-1.5 font-medium">
                                    ⚠ Veuillez préparer et signer le contrat d'abord.
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Section: Prêts à déclarer éligibles ─────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                    {readyForHire.length} candidat{readyForHire.length !== 1 ? 's' : ''} à déclarer éligible{readyForHire.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Prêts à déclarer éligibles (score final ≥ {MIN_HIRE_SCORE}%)</span>
                </div>

                {readyForHire.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-semibold">Aucun candidat à déclarer éligible pour le moment.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Les candidats doivent avoir un score final ≥ {MIN_HIRE_SCORE}% et avoir passé les étapes Entretien ou Test.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-collapse text-left text-xs text-slate-600">
                      <thead>
                        <tr className="bg-blue-50/50 border-b border-blue-100 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Candidat</th>
                          <th className="p-4">Poste</th>
                          <th className="p-4">Étape actuelle</th>
                          <th className="p-4">Score Final</th>
                          <th className="p-4">Détail Scores</th>
                          <th className="p-4">Risque</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {readyForHire.map((c) => (
                          <tr key={c.id} className="hover:bg-blue-50/30 transition">
                            <td className="p-4 font-bold text-slate-950">{c.name}</td>
                            <td className="p-4 text-slate-600">{c.job}</td>
                            <td className="p-4">
                              <span className={cn(
                                'uppercase text-[9px] font-bold px-2 py-0.5 rounded-full',
                                c.status === 'ENTRETIEN' ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              )}>
                                {c.status === 'ENTRETIEN' ? 'Entretien' : 'Test'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={cn(
                                'font-semibold px-2 py-0.5 rounded-full border',
                                c.finalScore >= 50
                                  ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                  : 'text-red-600 bg-red-50 border-red-100'
                              )}>
                                {c.finalScore}%
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="space-y-0.5 text-[10px]">
                                <div className="text-slate-500">Docs: <span className="font-semibold text-slate-700">{c.docScore}%</span></div>
                                {c.interviewScore !== null && <div className="text-slate-500">Entretien: <span className="font-semibold text-violet-700">{c.interviewScore}%</span></div>}
                                {c.testScore !== null && <div className="text-slate-500">Test: <span className="font-semibold text-amber-700">{c.testScore}%</span></div>}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={cn('inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px]', c.risks === 'Aucun' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100')}>
                                {c.risks}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeclareEligible(c)}
                                disabled={hiring}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition bg-[#1A2BA6] disabled:opacity-50"
                              >
                                <Award className="h-3.5 w-3.5" /> Déclarer éligible
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Section: Score insuffisant (non recommandés) ──────────── */}
              {notRecommendedForHire.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100">
                      {notRecommendedForHire.length} score insuffisant
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Score final &lt; {MIN_HIRE_SCORE}% — déclaration d'éligibilité non recommandée</span>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-collapse text-left text-xs text-slate-600">
                      <thead>
                        <tr className="bg-amber-50/50 border-b border-amber-100 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Candidat</th>
                          <th className="p-4">Poste</th>
                          <th className="p-4">Étape actuelle</th>
                          <th className="p-4">Score Final</th>
                          <th className="p-4">Détail Scores</th>
                          <th className="p-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {notRecommendedForHire.map((c) => (
                          <tr key={c.id} className="hover:bg-amber-50/30 transition opacity-75">
                            <td className="p-4 font-bold text-slate-950">{c.name}</td>
                            <td className="p-4 text-slate-600">{c.job}</td>
                            <td className="p-4">
                              <span className={cn(
                                'uppercase text-[9px] font-bold px-2 py-0.5 rounded-full',
                                c.status === 'ENTRETIEN' ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              )}>
                                {c.status === 'ENTRETIEN' ? 'Entretien' : 'Test'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{c.finalScore}%</span>
                            </td>
                            <td className="p-4">
                              <div className="space-y-0.5 text-[10px]">
                                <div className="text-slate-500">Docs: <span className="font-semibold text-slate-700">{c.docScore}%</span></div>
                                {c.interviewScore !== null && <div className="text-slate-500">Entretien: <span className="font-semibold text-violet-700">{c.interviewScore}%</span></div>}
                                {c.testScore !== null && <div className="text-slate-500">Test: <span className="font-semibold text-amber-700">{c.testScore}%</span></div>}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeclareEligible(c)}
                                disabled={hiring}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-amber-700 rounded-lg text-xs font-medium border border-amber-200 hover:bg-amber-50 transition disabled:opacity-50"
                                title="Déclaration d'éligibilité non recommandée — score final insuffisant"
                              >
                                <AlertTriangle className="h-3 w-3" /> Forcer
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Section: Déjà embauchés ──────────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {hiredCandidates.length} embauché{hiredCandidates.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Candidats déjà recrutés</span>
                </div>

                {hiredCandidates.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-semibold">Aucun recrutement validé pour le moment.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full border-collapse text-left text-xs text-slate-600">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="p-4">Candidat</th>
                          <th className="p-4">Poste</th>
                          <th className="p-4">Score final</th>
                          <th className="p-4">Date</th>
                          <th className="p-4">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {hiredCandidates.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition">
                            <td className="p-4 font-bold text-slate-950">{c.name}</td>
                            <td className="p-4 text-slate-600">{c.job}</td>
                            <td className="p-4">
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{c.finalScore}%</span>
                              <div className="text-[10px] text-slate-400 mt-0.5">{c.scoreBreakdown}</div>
                            </td>
                            <td className="p-4 text-slate-500">{c.date}</td>
                            <td className="p-4">
                              <span className="uppercase text-[9px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                                Recruté
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Modal: Confirmation d'embauche ───────────────────────── */}
              {hireCandidate && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !hiring && setHireCandidate(null)}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-emerald-600 px-6 py-4">
                      <h4 className="text-white font-bold text-sm">Confirmer l'embauche</h4>
                      <p className="text-emerald-100 text-xs mt-0.5">
                        Le contrat a été signé par le recruteur. Cette action active le personnel, envoie l'email d'embauche au candidat et crée ses identifiants de connexion.
                      </p>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Candidat</span>
                            <p className="font-bold text-slate-900 mt-0.5">{hireCandidate.name}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Poste</span>
                            <p className="font-bold text-slate-900 mt-0.5">{hireCandidate.job}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Score Final</span>
                            <p className={cn('font-bold mt-0.5', hireCandidate.finalScore >= MIN_HIRE_SCORE ? 'text-emerald-600' : 'text-red-600')}>{hireCandidate.finalScore}%</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Contrat</span>
                            <p className="font-bold text-emerald-600 mt-0.5 flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> Signé par le recruteur
                            </p>
                          </div>
                        </div>
                        {/* Score breakdown */}
                        <div className="border-t border-slate-200 pt-2 mt-2">
                          <span className="text-slate-400 font-bold text-[10px] uppercase">Détail des scores</span>
                          <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs">
                            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                              <div className="text-[10px] text-slate-400 font-medium">Documents</div>
                              <div className="font-bold text-slate-700">{hireCandidate.docScore}%</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                              <div className="text-[10px] text-slate-400 font-medium">Entretien</div>
                              <div className="font-bold text-violet-700">{hireCandidate.interviewScore ?? '—'}</div>
                            </div>
                            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
                              <div className="text-[10px] text-slate-400 font-medium">Test</div>
                              <div className="font-bold text-amber-700">{hireCandidate.testScore ?? '—'}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-[10px] text-blue-700 font-medium">
                          En confirmant, le système va : <strong>1)</strong> activer la fiche Personnel (PENDING_HIRE → ACTIVE),
                          &nbsp;<strong>2)</strong> passer le contrat en attente de signature du candidat (DRAFT/PENDING),
                          &nbsp;<strong>3)</strong> générer un lien de signature et envoyer l'email d'embauche au candidat,
                          &nbsp;<strong>4)</strong> créer automatiquement ses identifiants de connexion.
                        </p>
                      </div>

                      {hireCandidate.finalScore < MIN_HIRE_SCORE && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-amber-800 font-bold">Score final insuffisant</p>
                            <p className="text-[10px] text-amber-700">
                              Le score final de ce candidat ({hireCandidate.finalScore}%) est inférieur au seuil recommandé ({MIN_HIRE_SCORE}%).
                              L&apos;embauche n&apos;est pas recommandée. Voulez-vous vraiment continuer ?
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => setHireCandidate(null)}
                          disabled={hiring}
                          className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={handleHireCandidate}
                          disabled={hiring}
                          className={cn(
                            "inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition disabled:opacity-50",
                            hireCandidate.finalScore < MIN_HIRE_SCORE ? "bg-amber-600" : "bg-emerald-600"
                          )}
                        >
                          {hiring ? (
                            <><span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" /> Traitement...</>
                          ) : (
                            <><UserCheck className="h-3.5 w-3.5" /> Confirmer l'embauche</>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: TALENT POOL */}
          {activeTab === 'talent_pool' && (
            <motion.div key="talent_pool" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Base de talents</h3>
                <button
                  onClick={() => setIsAddTalentOpen(true)}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Award className="h-4 w-4" /> Ajouter à la base
                </button>
              </div>

              {talentPool.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <Award className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Aucun profil enregistré dans la base de talents.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {talentPool.map((tp) => (
                    <div key={tp.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100">{tp.category}</span>
                          <button onClick={() => handleRemoveFromTalent(tp.id)} className="text-slate-400 hover:text-red-600 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <h4 className="font-bold text-slate-900 mt-3 text-xs">
                          {tp.candidate ? `${tp.candidate.firstName} ${tp.candidate.lastName}` : 'Profil'}
                        </h4>
                        {tp.candidate && (
                          <div className="mt-3 text-xs text-slate-500 space-y-1">
                            <p><strong>Email:</strong> {tp.candidate.email}</p>
                            <p><strong>Tél:</strong> {tp.candidate.phone}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] text-slate-400">Statut :</span>
                        <span className="text-xs font-bold text-[#1A2BA6]">{tp.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add to Talent Pool Modal */}
              {isAddTalentOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Ajouter un candidat à la base de talents</h3>
                    <form onSubmit={handleAddToTalentPool} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Candidat</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTalent.candidateId} onChange={(e) => setNewTalent({ ...newTalent, candidateId: e.target.value })} required>
                          <option value="">-- Choisir le candidat --</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Catégorie technique/métier</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTalent.category} onChange={(e) => setNewTalent({ ...newTalent, category: e.target.value })} required placeholder="Ex: Informatique, Admin" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Statut du profil</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTalent.status} onChange={(e) => setNewTalent({ ...newTalent, status: e.target.value })} required placeholder="Ex: Disponible, En poste" />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddTalentOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Ajouter</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
    {confirmDialog.dialog}

    {/* ═══ Onboarding Guide Modal ═══ */}
    {isGuideOpen && (
      <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsGuideOpen(false)}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-100 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1A2BA6] to-[#2D3FE0] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2.5 rounded-xl">
                  <Compass className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Guide du Processus de Recrutement</h2>
                  <p className="text-white/70 text-xs mt-0.5">Comprenez chaque étape du pipeline de recrutement HTIP</p>
                </div>
              </div>
              <button onClick={() => setIsGuideOpen(false)} className="text-white/60 hover:text-white transition p-1">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            {/* Pipeline visual bar */}
            <div className="mt-5 flex items-center gap-1">
              {PIPELINE_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === guideStep;
                const isPast = i < guideStep;
                return (
                  <button
                    key={step.id}
                    onClick={() => setGuideStep(i)}
                    className="flex-1 flex flex-col items-center gap-1 cursor-pointer group"
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300',
                      isActive ? 'bg-white text-[#1A2BA6] shadow-lg scale-110' : isPast ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50 group-hover:bg-white/20'
                    )}>
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      'text-[9px] font-bold uppercase tracking-wider transition',
                      isActive ? 'text-white' : isPast ? 'text-white/70' : 'text-white/40'
                    )}>{step.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {PIPELINE_STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isActive = i === guideStep;
              const isExpanded = guideExpanded === i;

              return (
                <div
                  key={step.id}
                  className={cn(
                    'mb-3 rounded-xl border transition-all duration-300 cursor-pointer',
                    isActive ? `${step.colorLight} shadow-sm` : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                  )}
                  onClick={() => {
                    setGuideStep(i);
                    setGuideExpanded(isExpanded ? null : i);
                  }}
                >
                  {/* Step Header */}
                  <div className="flex items-center gap-3 p-4">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0', step.color)}>
                      <StepIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Étape {i + 1}</span>
                        {i === 3 && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-[8px] font-bold rounded-full uppercase">Optionnel</span>
                        )}
                        {i === 4 && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-bold rounded-full uppercase">Final</span>
                        )}
                      </div>
                      <h3 className={cn('text-sm font-bold', isActive ? step.textColor : 'text-slate-700')}>{step.title}</h3>
                      <p className="text-[10px] text-slate-500 font-medium">{step.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveTab(step.tab as any); setIsGuideOpen(false); }}
                          className={cn('px-2.5 py-1 rounded-lg text-[9px] font-bold border transition hover:shadow-sm', step.colorLight, step.textColor)}
                        >
                          Aller à l'onglet
                        </button>
                      )}
                      <ChevronDown className={cn(
                        'h-4 w-4 text-slate-400 transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )} />
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="border-t border-slate-100 pt-3">
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">{step.description}</p>
                            <div className="space-y-2.5">
                              {step.details.map((detail, j) => (
                                <div key={j} className="flex gap-2.5">
                                  <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', step.color)} />
                                  <div>
                                    <span className="text-[10px] font-bold text-slate-700">{detail.label}</span>
                                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">{detail.text}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Pipeline flow summary */}
            <div className="mt-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Flux du pipeline</h4>
              <div className="flex items-center gap-1 flex-wrap">
                {['NOUVEAU', 'EN_COURS', 'ENTRETIEN', 'TEST', 'ÉLIGIBLE', 'EMBAUCHÉ'].map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[9px] font-bold',
                      s === 'TEST' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                      s === 'ÉLIGIBLE' ? 'bg-violet-50 text-violet-600 border border-violet-100' :
                      s === 'EMBAUCHÉ' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                      'bg-slate-100 text-slate-600'
                    )}>{s}</span>
                    {i < 5 && <ChevronRight className="h-3 w-3 text-slate-300" />}
                  </div>
                ))}
                <span className="text-[9px] text-slate-400 ml-2">ou</span>
                <div className="flex items-center gap-1 ml-1">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-100">ENTRETIEN</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-100">ÉLIGIBLE</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">EMBAUCHÉ</span>
                  <span className="text-[9px] text-orange-500 font-bold ml-1">(sans test)</span>
                </div>
              </div>
              <p className="text-[9px] text-slate-500 mt-2 italic">
                L'étape <strong>ÉLIGIBLE</strong> crée la fiche Personnel et un contrat brouillon (DRAFT) sans envoyer d'email.
                Le recruteur doit préparer et signer le contrat avant de finaliser l'<strong>EMBAUCHÉ</strong> (qui envoie l'email au candidat).
              </p>
            </div>
          </div>

          {/* Footer navigation */}
          <div className="border-t border-slate-100 p-4 flex items-center justify-between bg-slate-50/50">
            <button
              onClick={() => { setGuideStep(Math.max(0, guideStep - 1)); setGuideExpanded(guideStep - 1 >= 0 ? guideStep - 1 : null); }}
              disabled={guideStep === 0}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition', guideStep === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100')}
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </button>
            <div className="flex items-center gap-1.5">
              {PIPELINE_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setGuideStep(i); setGuideExpanded(i); }}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i === guideStep ? 'bg-[#1A2BA6] scale-125' : 'bg-slate-300 hover:bg-slate-400'
                  )}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (guideStep < PIPELINE_STEPS.length - 1) {
                  setGuideStep(guideStep + 1);
                  setGuideExpanded(guideStep + 1);
                } else {
                  setIsGuideOpen(false);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1A2BA6] text-white hover:bg-[#1521A0] transition shadow-sm"
            >
              {guideStep < PIPELINE_STEPS.length - 1 ? 'Suivant' : 'Compris !'} <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
}
