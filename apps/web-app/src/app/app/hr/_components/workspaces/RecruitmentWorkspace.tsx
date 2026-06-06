'use client';

import { useState, useEffect } from 'react';
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
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';

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
  description?: string;
  missions?: string;
  responsibilities?: string;
  academicLevel?: string;
  experience?: string;
  skillsRequired?: string;
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
}

interface Test {
  id: string;
  name: string;
  type: string;
  description?: string;
  results?: Array<{
    id: string;
    candidateId: string;
    candidate: { firstName: string; lastName: string };
    score: number;
    result: string;
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
  const [activeCandidateTab, setActiveCandidateTab] = useState<'identity' | 'profile' | 'documents' | 'ia' | 'history'>('profile');
  const [recruiterRating, setRecruiterRating] = useState<number>(0);
  const [recruiterComment, setRecruiterComment] = useState<string>('');


  // Add Job Form State
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [newJob, setNewJob] = useState<Partial<Job>>({
    title: '', dept: '', loc: '', status: 'PUBLIÉE', contractType: 'CDI', salary: '', academicLevel: '', experience: '', skillsRequired: '', description: '', missions: '', responsibilities: '',
  });

  // Hire Confirmation State
  const [hireCandidate, setHireCandidate] = useState<Candidate | null>(null);
  const [hiring, setHiring] = useState(false);

  // Add Candidate Form State
  const [isAddCandidateOpen, setIsAddCandidateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', gender: 'M', jobId: '', status: 'NOUVEAU'
  });

  // Add Interview Form State
  const [isAddInterviewOpen, setIsAddInterviewOpen] = useState(false);
  const [newInterview, setNewInterview] = useState({
    candidateId: '', type: 'RH', date: '', time: '', format: 'Visioconférence', evaluator: '', score: '0', comments: ''
  });

  // Add Test Form State
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [newTest, setNewTest] = useState({
    name: '', type: 'Technique', description: ''
  });

  // Log Test Result Form State
  const [isAddTestResultOpen, setIsAddTestResultOpen] = useState(false);
  const [newTestResult, setNewTestResult] = useState({
    testId: '', candidateId: '', score: '50', result: 'ADMIS'
  });

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
            score: primaryApp?.score || 0,
            scoreCV: primaryApp?.scoreCV || 0,
            scoreLetter: primaryApp?.scoreLetter || 0,
            scoreMatching: primaryApp?.scoreMatching || 0,
            category: primaryApp?.score >= 90 ? 'Excellent' : 'Bon',
            matchDetail: primaryApp?.matchDetail || '',
            risks: primaryApp?.risks || 'Aucun',
            riskDetail: primaryApp?.riskDetail || '',
            date: c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
            status: primaryApp?.status || 'NOUVEAU',
            history: primaryApp?.history || [{ action: 'Profil créé', date: new Date().toISOString().replace('T', ' ').slice(0, 16), user: 'Système' }],
            academicProfile: c.academicProfile || null,
            documents: c.documents || [],
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
  }, [tenant?.id, activeTab]);

  // Create Job
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl('recruitment/jobs', { tenantId: tenant.id }), {
        method: 'POST',
        body: newJob,
      });
      toast({ variant: 'success', title: 'Offre d\'emploi créée avec succès !' });
      setIsAddJobOpen(false);
      setNewJob({ title: '', dept: '', loc: '', status: 'PUBLIÉE', contractType: 'CDI', salary: '', academicLevel: '', experience: '', skillsRequired: '', description: '', missions: '', responsibilities: '' });
      loadData();
    } catch (err) {
      console.error('Failed to create job:', err);
      toast({ variant: 'error', title: 'Erreur lors de la création de l\'offre d\'emploi.' });
    }
  };

  // Create Candidate and Application
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
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

  // Schedule Interview
  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl('recruitment/interviews', { tenantId: tenant.id }), {
        method: 'POST',
        body: newInterview,
      });
      toast({ variant: 'success', title: 'Entretien programmé avec succès !' });
      setIsAddInterviewOpen(false);
      setNewInterview({ candidateId: '', type: 'RH', date: '', time: '', format: 'Visioconférence', evaluator: '', score: '0', comments: '' });
      loadData();
    } catch (err: any) {
      console.error('Failed to schedule interview:', err);
      const backendMsg = err?.message || err?.toString() || '';
      toast({ variant: 'error', title: 'Erreur lors de la programmation de l\'entretien.', description: backendMsg || 'Veuillez vérifier les données saisies et réessayer.' });
    }
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
      // Ne PAS appeler loadData() : l'optimistic update a déjà retiré l'élément.
    } catch (err) {
      setInterviews(previousInterviews);
      console.error('Failed to delete interview:', err);
      toast({ variant: 'error', title: 'Erreur d\'annulation', description: 'Impossible d\'annuler cet entretien. Veuillez réessayer.' });
    }
  };

  // Create Test
  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    try {
      await hrFetch(hrUrl('recruitment/tests', { tenantId: tenant.id }), {
        method: 'POST',
        body: newTest,
      });
      toast({ variant: 'success', title: 'Test d\'évaluation créé avec succès !' });
      setIsAddTestOpen(false);
      setNewTest({ name: '', type: 'Technique', description: '' });
      loadData();
    } catch (err) {
      console.error('Failed to create test:', err);
      toast({ variant: 'error', title: 'Erreur lors de la création du test.' });
    }
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
      // Ne PAS appeler loadData() : l'optimistic update a déjà retiré l'élément.
    } catch (err) {
      setTests(previousTests);
      console.error('Failed to delete test:', err);
      toast({ variant: 'error', title: 'Erreur de suppression', description: 'Impossible de supprimer ce test. Veuillez réessayer.' });
    }
  };

  // Saisir un Résultat de Test
  const handleCreateTestResult = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hrFetch(hrUrl('recruitment/test-results', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          testId: newTestResult.testId,
          candidateId: newTestResult.candidateId,
          score: Number(newTestResult.score),
          result: newTestResult.result,
        },
      });
      toast({ variant: 'success', title: 'Résultat de test enregistré !' });
      setIsAddTestResultOpen(false);
      setNewTestResult({ testId: '', candidateId: '', score: '50', result: 'ADMIS' });
      loadData();
    } catch (err: any) {
      console.error('Failed to save test result:', err);
      const msg = err?.message || 'Erreur lors de l\'enregistrement du résultat.';
      toast({ variant: 'error', title: msg });
    }
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
      // Ne PAS appeler loadData() : l'optimistic update a déjà retiré l'élément.
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

  // Hire candidate with confirmation dialog — triggers Staff + Contract creation
  const handleHireCandidate = async () => {
    if (!hireCandidate) return;
    setHiring(true);
    try {
      const applicationId = hireCandidate.applicationId || hireCandidate.id;
      await hrFetch(hrUrl(`recruitment/applications/${applicationId}/status`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: 'EMBAUCHÉ' },
      });
      toast({ variant: 'success', title: 'Candidat embauché !', description: 'Un contrat brouillon a été automatiquement créé. Rendez-vous dans l\'onglet Contrats pour le valider.' });
      setHireCandidate(null);
      loadData();
    } catch (err: any) {
      const backendMsg = err?.message || err?.toString() || '';
      toast({ variant: 'error', title: 'Erreur lors de l\'embauche', description: backendMsg || 'Veuillez vérifier que le candidat a passé au moins l\'étape Entretien ou Test.' });
    } finally {
      setHiring(false);
    }
  };

  // Filter candidates for the Embauches tab
  const hiredCandidates = candidates.filter(c => c.status === 'EMBAUCHÉ');
  const readyForHire = candidates.filter(c => c.status === 'ENTRETIEN' || c.status === 'TEST');

  // KPI calculations for dashboard cards (Tome 2 & 3)
  const totalJobs = jobs.filter(j => j.status === 'PUBLIÉE').length;
  const totalApplications = candidates.length;
  const totalInterviews = interviews.length;
  const avgIaScore = candidates.length > 0 ? Math.round(candidates.reduce((sum, c) => sum + c.score, 0) / candidates.length) : 0;
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
          { label: 'Entretiens', value: totalInterviews, sub: 'Planifiés', bg: 'bg-indigo-50/50 border-indigo-100/50' },
          { label: 'Score IA Moyen', value: `${avgIaScore}%`, sub: 'Adéquation HTIP', bg: 'bg-amber-50/50 border-amber-100/50' },
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
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
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
                  onClick={() => setIsAddJobOpen(true)}
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
                    <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{job.ref}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn('px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border', job.status === 'PUBLIÉE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>{job.status}</span>
                            <button onClick={() => handleDeleteJob(job.id)} className="text-slate-400 hover:text-red-600 transition">
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
                        <span className="text-[10px] text-slate-400">Créé le {job.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Job Modal */}
              {isAddJobOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-100 my-8">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Créer une offre d'emploi détaillée</h3>
                    <form onSubmit={handleCreateJob} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Intitulé du poste</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Département</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.dept} onChange={(e) => setNewJob({ ...newJob, dept: e.target.value })} required />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Localisation</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newJob.loc} onChange={(e) => setNewJob({ ...newJob, loc: e.target.value })} required />
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

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description générale</label>
                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Missions clés</label>
                          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" value={newJob.missions} onChange={(e) => setNewJob({ ...newJob, missions: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Responsabilités</label>
                          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" value={newJob.responsibilities} onChange={(e) => setNewJob({ ...newJob, responsibilities: e.target.value })} />
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddJobOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Enregistrer l'offre</button>
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
                            <span className="font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{c.score}%</span>
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
                                  // Redirect to Embauches tab instead of direct hire
                                  setActiveTab('embauches');
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
                              <option value="NOUVEAU">Nouveau</option>
                              <option value="EN_COURS">En cours</option>
                              <option value="ENTRETIEN">Entretien</option>
                              <option value="TEST">Test</option>
                              <option value="EMBAUCHÉ" disabled>Embauché → Onglet Embauches</option>
                              <option value="REJETÉ">Rejeté</option>
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

                            {/* Work Experience */}
                            <div className="space-y-2">
                              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6] flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5" /> Expérience Professionnelle
                              </h5>
                              {experiencesList.length === 0 ? (
                                <p className="text-slate-400 italic text-[10px]">Aucune expérience saisie.</p>
                              ) : (
                                <div className="border-l border-slate-200 pl-3 ml-1.5 space-y-3">
                                  {experiencesList.map((exp: any, i: number) => (
                                    <div key={i} className="relative">
                                      <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-[#1A2BA6] ring-4 ring-white" />
                                      <p className="font-bold text-slate-800 text-[11px]">{exp.title}</p>
                                      <p className="text-[9px] text-slate-500">{exp.company} · {exp.years}</p>
                                      {exp.description && <p className="text-[10px] text-slate-600 mt-1 italic leading-relaxed">{exp.description}</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Education */}
                            <div className="space-y-2">
                              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6] flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5" /> Formation
                              </h5>
                              {educationList.length === 0 ? (
                                <p className="text-slate-400 italic text-[10px]">Aucun diplôme saisi.</p>
                              ) : (
                                <div className="space-y-2">
                                  {educationList.map((edu: any, i: number) => (
                                    <div key={i} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                      <p className="font-bold text-slate-800">{edu.degree}</p>
                                      <p className="text-[10px] text-slate-500">{edu.school} · {edu.year}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Skills */}
                            <div className="space-y-2">
                              <h5 className="font-bold text-slate-800 uppercase tracking-wider text-[9px] text-[#1A2BA6] flex items-center gap-1">
                                <Award className="h-3.5 w-3.5" /> Compétences normalisées
                              </h5>
                              {candidateSkills.length === 0 ? (
                                <p className="text-slate-400 italic text-[10px]">Aucune compétence répertoriée.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {candidateSkills.map((s: string) => (
                                    <span key={s} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-[#1A2BA6] rounded font-semibold text-[9px]">{s}</span>
                                  ))}
                                </div>
                              )}
                            </div>

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
                                COVER_LETTER: 'Lettre de Motivation',
                                RECOMMENDATION: 'Lettre de Recommandation',
                                DIPLOMA: 'Diplôme',
                                CERTIFICATE: 'Certificat',
                                OTHER: 'Autre document',
                              };
                              const typeIcon: Record<string, string> = {
                                CV: '📄',
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
                  onClick={() => setIsAddInterviewOpen(true)}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <CalendarDays className="h-4 w-4" /> Programmer un entretien
                </button>
              </div>

              {interviews.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Aucun entretien programmé.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {interviews.map((int) => (
                    <div key={int.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">{int.type}</span>
                          <button onClick={() => handleDeleteInterview(int.id)} className="text-slate-400 hover:text-red-600 transition">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[10px] font-semibold text-slate-400">Note technique :</span>
                        <span className="font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{int.score}/100</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Schedule Interview Modal */}
              {isAddInterviewOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Programmer un entretien</h3>
                    <form onSubmit={handleCreateInterview} className="space-y-4">
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
                          <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.date} onChange={(e) => setNewInterview({ ...newInterview, date: e.target.value })} required />
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
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Évaluateur (RH/Manager)</label>
                          <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newInterview.evaluator} onChange={(e) => setNewInterview({ ...newInterview, evaluator: e.target.value })} required placeholder="Sarah G. / Dev Lead" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Commentaires</label>
                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-16" value={newInterview.comments} onChange={(e) => setNewInterview({ ...newInterview, comments: e.target.value })} />
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddInterviewOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Programmer</button>
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
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-900">Épreuves et Tests d'évaluation</h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsAddTestResultOpen(true)}
                    className="flex items-center gap-2 border border-[#1A2BA6] text-[#1A2BA6] rounded-xl px-4 py-2.5 text-xs font-bold transition hover:bg-indigo-50"
                  >
                    Saisir un résultat
                  </button>
                  <button
                    onClick={() => setIsAddTestOpen(true)}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    <Plus className="h-4 w-4" /> Créer un test
                  </button>
                </div>
              </div>

              {tests.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                  <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs text-slate-500 font-semibold">Aucun test d'évaluation enregistré.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {tests.map((test) => (
                    <div key={test.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                        <div>
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-100">{test.type}</span>
                          <h4 className="font-bold text-slate-900 mt-2 text-sm">{test.name}</h4>
                          {test.description && <p className="text-xs text-slate-500 mt-1">{test.description}</p>}
                        </div>
                        <button onClick={() => handleDeleteTest(test.id)} className="text-slate-400 hover:text-red-600 transition">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Candidats ayant passé ce test</span>
                        {(!test.results || test.results.length === 0) ? (
                          <span className="text-xs text-slate-400 italic">Aucun résultat enregistré pour le moment.</span>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {test.results.map((res) => (
                              <div key={res.id} className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex justify-between items-center text-xs">
                                <div>
                                  <p className="font-bold text-slate-800">{res.candidate ? `${res.candidate.firstName} ${res.candidate.lastName}` : 'Inconnu'}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">Statut: {res.result}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-[#1A2BA6] bg-white border border-slate-200 rounded-full px-2 py-0.5">{res.score}/100</span>
                                  <button onClick={() => handleDeleteTestResult(res.id)} className="text-slate-400 hover:text-red-500 transition">
                                    ✕
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Test Modal */}
              {isAddTestOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Créer une épreuve / test</h3>
                    <form onSubmit={handleCreateTest} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Nom de l'épreuve</label>
                        <input type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Type de test</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTest.type} onChange={(e) => setNewTest({ ...newTest, type: e.target.value })}>
                          <option value="Technique">Technique</option>
                          <option value="RH / Psychotechnique">RH / Psychotechnique</option>
                          <option value="Anglais">Langue / Anglais</option>
                          <option value="Compétences transverses">Compétences transverses</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description / Objectifs</label>
                        <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs h-20" value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} />
                      </div>
                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddTestOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Enregistrer</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}

              {/* Log Test Result Modal */}
              {isAddTestResultOpen && (
                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
                    <h3 className="font-bold text-slate-900 text-base mb-4">Saisir le score d'un candidat</h3>
                    <form onSubmit={handleCreateTestResult} className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sélectionner l'épreuve</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTestResult.testId} onChange={(e) => setNewTestResult({ ...newTestResult, testId: e.target.value })} required>
                          <option value="">-- Choisir le test --</option>
                          {tests.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Candidat</label>
                        <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTestResult.candidateId} onChange={(e) => setNewTestResult({ ...newTestResult, candidateId: e.target.value })} required>
                          <option value="">-- Choisir le candidat --</option>
                          {candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Score obtenu (/100)</label>
                          <input type="number" min="0" max="100" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTestResult.score} onChange={(e) => setNewTestResult({ ...newTestResult, score: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Résultat final</label>
                          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" value={newTestResult.result} onChange={(e) => setNewTestResult({ ...newTestResult, result: e.target.value })}>
                            <option value="ADMIS">Admis / Validé</option>
                            <option value="REJETÉ">Échec / Non retenu</option>
                            <option value="RÉSERVE">Liste d'attente</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mt-6">
                        <button type="button" onClick={() => setIsAddTestResultOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs">Annuler</button>
                        <button type="submit" className="px-4 py-2 text-white rounded-lg text-xs font-semibold" style={{ backgroundColor: PRIMARY }}>Enregistrer</button>
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
                <p className="text-xs text-slate-500">Embauchez les candidats validés. Un contrat brouillon sera automatiquement créé.</p>
              </div>

              {/* ─── Section: Prêts à embaucher ──────────────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-100">
                    {readyForHire.length} candidat{readyForHire.length !== 1 ? 's' : ''} éligible{readyForHire.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Prêts à embaucher (ayant passé Entretien ou Test)</span>
                </div>

                {readyForHire.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
                    <UserCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-semibold">Aucun candidat éligible pour le moment.</p>
                    <p className="text-[10px] text-slate-400 mt-1">Les candidats doivent passer par les étapes Entretien ou Test avant de pouvoir être embauchés.</p>
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
                          <th className="p-4">Score IA</th>
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
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{c.score}%</span>
                            </td>
                            <td className="p-4">
                              <span className={cn('inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px]', c.risks === 'Aucun' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100')}>
                                {c.risks}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => setHireCandidate(c)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-white rounded-lg text-xs font-bold shadow-sm hover:opacity-90 transition bg-emerald-600"
                              >
                                <UserCheck className="h-3.5 w-3.5" /> Embaucher
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
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">{c.score}%</span>
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
                      <p className="text-emerald-100 text-xs mt-0.5">Cette action créera automatiquement un profil Employé et un contrat brouillon.</p>
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
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Score IA</span>
                            <p className="font-bold text-emerald-600 mt-0.5">{hireCandidate.score}%</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold text-[10px] uppercase">Étape</span>
                            <p className="font-bold text-slate-900 mt-0.5">{hireCandidate.status === 'ENTRETIEN' ? 'Entretien' : 'Test'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <p className="text-[10px] text-blue-700 font-medium">
                          Un profil Employé sera créé avec les informations du candidat, et un contrat brouillon sera généré automatiquement.
                          Rendez-vous ensuite dans l'onglet <strong>Contrats</strong> pour compléter et signer le contrat.
                        </p>
                      </div>

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
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition bg-emerald-600 disabled:opacity-50"
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
    </>
  );
}
