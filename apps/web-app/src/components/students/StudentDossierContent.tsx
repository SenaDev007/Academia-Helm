'use client';

/**
 * ============================================================================
 * STUDENT DOSSIER CONTENT — DOSSIER NUMÉRIQUE DE L'ÉLÈVE (⭐ 1.0.10)
 * ============================================================================
 * Refonte demandée par le promoteur (16/11/2026) : l'ancien onglet « Dossiers
 * Élèves » présentait les informations en 10 petits onglets dispersés
 * (identité à part, administration à part, responsables à part…). Ce
 * composant le remplace par UN dossier scolaire structuré à la manière des
 * dossiers européens/us : toutes les informations de l'élève et de son
 * parcours, centralisées et traçables année par année — y compris le cursus
 * dans l'école d'origine — avec impression du DOSSIER COMPLET en PDF généré
 * par le backend (GET /students/:id/academic-dossier).
 *
 * 7 sections :
 *   I.   Identité & situation administrative
 *   II.  Responsables légaux
 *   III. Parcours scolaire (année par année + école d'origine)
 *   IV.  Résultats & bulletins (par année / période)
 *   V.   Frais & paiements (résumé)
 *   VI.  Assiduité & discipline
 *   VII. Documents & carte scolaire
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  User, Users, Mail, Phone, FileCheck, AlertCircle, Loader2, Download,
  FileText, History, GraduationCap, Calendar, MapPin, Hash, ArrowLeft,
  Activity, RotateCw, ClipboardList, School, Wallet,
  BookOpen, ChevronLeft, ChevronRight, Eye, Printer, Building2,
} from 'lucide-react';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { apiFetch, apiClient } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import DocumentPreviewModal from './DocumentPreviewModal';
import IdCardVisual, { type TenantInfo } from './IdCardVisual';

// ─── Types ───

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  globalMatricule?: string;
  studentCode?: string;
  npi?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  address?: string;
  status: string;
  isActive: boolean;
  photoUrl?: string;
  regimeType?: string;
  studentGuardians?: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    guardian: { id: string; firstName: string; lastName: string; phone?: string; email?: string; address?: string; };
  }>;
  studentEnrollments?: Array<{
    id: string;
    status: string;
    enrollmentDate?: string;
    class?: { id: string; name: string };
    academicYear?: { id: string; name: string };
  }>;
}

interface DossierData {
  identity: any;
  studentEnrollments?: any[];
  originatingAdmission?: {
    admissionNumber?: string;
    applicationDate?: string;
    previousSchool?: string;
    previousLevel?: string;
    changeReason?: string;
    isNewStudent?: boolean;
  } | null;
  reportCards?: any[];
  academicRecords?: any[];
  disciplinarySummaries?: any[];
  recentAbsences?: any[];
  recentDisciplinaryActions?: any[];
  guardians?: any[];
  documents?: any[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PRE_REGISTERED: { label: 'Pré-inscrit', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ADMITTED: { label: 'Admis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  EXCLUDED: { label: 'Exclu', color: 'bg-red-50 text-red-700 border-red-200' },
  INACTIVE: { label: 'Inactif', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  PENDING: { label: 'En attente', color: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const ENROLLMENT_STATUS: Record<string, string> = {
  ACTIVE: 'Actif', PENDING: 'En attente', ADMITTED: 'Admis',
  PRE_REGISTERED: 'Pré-inscrit', COMPLETED: 'Terminé', WITHDRAWN: 'Retiré',
  ARCHIVED: 'Archivé', TRANSFERRED: 'Transféré', GRADUATED: 'Diplômé',
};

const ENROLLMENT_TYPE: Record<string, string> = {
  NEW: 'Nouvel élève', REPEAT: 'Ancien élève (réinscription)',
};

const RC_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Projet', color: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Publié', color: 'bg-emerald-50 text-emerald-700' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700' },
  DIRECTOR_SIGNED: { label: 'Signé (direction)', color: 'bg-indigo-50 text-indigo-700' },
  TEACHER_DISTRIBUTED: { label: 'Distribué', color: 'bg-blue-50 text-blue-700' },
  TEACHER_SIGNED: { label: 'Signé (enseignant)', color: 'bg-indigo-50 text-indigo-700' },
  PARENT_SENT: { label: 'Envoyé aux parents', color: 'bg-teal-50 text-teal-700' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  BIRTH_CERTIFICATE: 'Acte de naissance', NPI_CARD: 'Carte NPI', SCHOOL_CERTIFICATE: 'Certificat de scolarité',
  PHOTO: 'Photo d\'identité', PREVIOUS_REPORT_CARD: 'Bulletin précédent', MEDICAL_RECORD: 'Fiche médicale',
  PARENTAL_AUTHORIZATION: 'Autorisation parentale', TRANSFER_CERTIFICATE: 'Certificat de transfert', OTHER: 'Autre document',
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CHANGE_CLASS: { label: 'Changement de classe', color: 'text-blue-600' },
  WITHDRAW: { label: 'Abandon / Départ', color: 'text-rose-600' },
  EXCLUDE: { label: 'Exclusion administrative', color: 'text-red-600' },
  EXIT: { label: 'Sortie fin d\'année', color: 'text-amber-600' },
  REINTEGRATE: { label: 'Réintégration', color: 'text-emerald-600' },
  TRANSFER: { label: 'Transfert', color: 'text-indigo-600' },
  ARCHIVE: { label: 'Archivage', color: 'text-slate-600' },
  PRE_REGISTER: { label: 'Pré-inscription', color: 'text-cyan-600' },
  ADMIT: { label: 'Admission', color: 'text-teal-600' },
  RE_ENROLL: { label: 'Réinscription', color: 'text-purple-600' },
  PROMOTE: { label: 'Promotion', color: 'text-green-600' },
};

const REGIME_LABELS: Record<string, string> = {
  TEACHER_CHILD: 'Enfant enseignant', SCHOLARSHIP: 'Boursier', SPECIAL: 'Spécial',
};

const SECTIONS = [
  { id: 'sec-identite', num: 'I', label: 'Identité & administration', icon: User },
  { id: 'sec-responsables', num: 'II', label: 'Responsables légaux', icon: Users },
  { id: 'sec-parcours', num: 'III', label: 'Parcours scolaire', icon: School },
  { id: 'sec-resultats', num: 'IV', label: 'Résultats & bulletins', icon: BookOpen },
  { id: 'sec-frais', num: 'V', label: 'Frais & paiements', icon: Wallet },
  { id: 'sec-assiduite', num: 'VI', label: 'Assiduité & discipline', icon: Activity },
  { id: 'sec-documents', num: 'VII', label: 'Documents & carte scolaire', icon: FileText },
];

// ─── Helpers ───

const formatDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const formatMoney = (v: any) => {
  const n = Number(v ?? 0);
  return `${n.toLocaleString('fr-FR')} FCFA`;
};

const getInitials = (s: StudentIdentity) => `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase();

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-slate-400">
      <Icon className="w-7 h-7 mb-2 opacity-25" />
      <p className="text-xs">{text}</p>
    </div>
  );
}

function Row({ label, value, mono, color }: { label: string; value: any; mono?: boolean; color?: string }) {
  const display = value == null || value === '' ? '—' : String(value);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-dashed border-slate-100 last:border-0">
      <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{label}</span>
      <span className={cn('text-xs font-medium text-right', mono && 'font-mono', color || 'text-slate-700')}>{display}</span>
    </div>
  );
}

function SectionCard({ id, num, title, icon: Icon, children, actions }: {
  id: string; num: string; title: string; icon: any; children: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200">
        <span className="w-8 h-8 rounded-lg bg-[#0d1f6e] text-white flex items-center justify-center text-[11px] font-bold">{num}</span>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#0d1f6e]" /> {title}
        </h3>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ─── Composant principal ───

export default function StudentDossierContent({ student, academicYear, onBack, currentIndex, totalStudents, onNavigate }: {
  student: StudentIdentity; academicYear: any; onBack: () => void;
  currentIndex: number; totalStudents: number; onNavigate: (newIndex: number) => void;
}) {
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [movementHistory, setMovementHistory] = useState<any[]>([]);
  const [studentCard, setStudentCard] = useState<any>(null);
  const [financeAccount, setFinanceAccount] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [feeProfile, setFeeProfile] = useState<any>(null);
  const [cardFace, setCardFace] = useState<'recto' | 'verso'>('recto');
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [identity, setIdentity] = useState<TenantInfo | null>(null);

  // Identité du tenant (pour IdCardVisual)
  useEffect(() => {
    fetch('/api/settings/identity', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const p = Array.isArray(data) ? data[0] : data;
          setIdentity({
            schoolName: p?.schoolName || p?.name || 'Établissement Scolaire',
            slogan: p?.slogan || 'Excellence • Discipline • Travail',
            address: p?.address || '', city: p?.city || '',
            phonePrimary: p?.phonePrimary || p?.phone || '', email: p?.email || '', website: p?.website || '',
            logoUrl: p?.logoUrl || '',
            cardPrimaryColor: p?.cardPrimaryColor || '#17348f',
            cardSecondaryColor: p?.cardSecondaryColor || '#29c2e8',
            cardShowQRCode: p?.cardShowQRCode ?? true, cardShowPhoto: p?.cardShowPhoto ?? true,
            cardShowGuardian: p?.cardShowGuardian ?? true, cardShowEmergencyCall: p?.cardShowEmergencyCall ?? true,
            cardShowSchoolAddress: p?.cardShowSchoolAddress ?? true, cardConditionsText: p?.cardConditionsText || '',
          } as TenantInfo);
        }
      }).catch(() => {});
  }, []);

  useEffect(() => { loadDetail(student.id); }, [student.id]);

  const loadDetail = async (studentId: string) => {
    setIsLoadingDetail(true);
    try {
      // ⭐ 1.0.10 — le DOSSIER AGRÉGÉ du backend est la source pivot :
      //    parcours année par année, école d'origine, bulletins, discipline,
      //    responsables enrichis (GET /api/students/:id/dossier).
      const [docsRes, historyRes, cardRes, dossierRes] = await Promise.allSettled([
        apiFetch(`/students/${studentId}/documents`),
        apiFetch(`/students/movement-history?studentId=${studentId}&limit=50`),
        apiFetch(`/students/id-cards/${studentId}?academicYearId=${academicYear?.id}`),
        apiFetch(`/students/${studentId}/dossier`),
      ]);
      setDocuments(docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) ? docsRes.value : []);
      setMovementHistory(historyRes.status === 'fulfilled' && Array.isArray(historyRes.value) ? historyRes.value : []);
      setStudentCard(cardRes.status === 'fulfilled' ? cardRes.value : null);
      setDossier(dossierRes.status === 'fulfilled' ? dossierRes.value : null);

      // Compte financier + transactions + régime tarifaire (comme auparavant)
      try {
        const accounts = await financeService.getStudentAccounts({ studentId, academicYearId: academicYear?.id });
        const account = Array.isArray(accounts) ? accounts[0] : (accounts?.data?.[0] || accounts);
        setFinanceAccount(account);
        if (account?.id) {
          try {
            const transactions = await financeService.getTransactions({ studentAccountId: account.id, limit: '10' });
            setPayments(Array.isArray(transactions) ? transactions : (transactions?.data || []));
          } catch { setPayments([]); }
        }
      } catch { setFinanceAccount(null); setPayments([]); }
      try {
        const profiles = await financeService.createStudentFeeProfile({
          studentId, academicYearId: academicYear?.id, feeRegimeId: '',
        });
        setFeeProfile(profiles);
      } catch {
        setFeeProfile(financeAccount?.feeRegime || null);
      }
    } catch (e) { console.warn('loadDetail error:', e); }
    finally { setIsLoadingDetail(false); }
  };

  // ⭐ 1.0.10 — DOSSIER COMPLET PDF (généré backend, 7 sections)
  const handleDownloadDossierPdf = async () => {
    setIsPdfLoading(true);
    try {
      const url = `/students/${encodeURIComponent(student.id)}/academic-dossier${academicYear?.id ? `?academicYearId=${encodeURIComponent(academicYear.id)}` : ''}`;
      const response = await apiClient.get(url, { responseType: 'blob', timeout: 120000 });
      const blobUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `dossier-${student.lastName}-${student.firstName}-${student.matricule || 'eleve'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast({ title: 'Dossier complet téléchargé', description: 'Dossier scolaire complet (PDF) — prêt à imprimer ou transférer.', variant: 'success' });
    } catch (e: any) {
      toast({
        title: 'Impossible de générer le dossier PDF',
        description: e?.response?.status === 403
          ? 'Votre rôle ne permet pas de générer le dossier complet. Contactez la direction.'
          : (e?.message || 'Erreur réseau — réessayez.'),
        variant: 'destructive',
      });
    } finally { setIsPdfLoading(false); }
  };

  // ─── Données dérivées (dossier backend en priorité, fallback liste) ───
  const guardians = (dossier?.guardians?.length ? dossier.guardians : (student.studentGuardians || [])) as any[];
  const enrollments = (dossier?.studentEnrollments?.length ? dossier.studentEnrollments : (student.studentEnrollments || [])) as any[];
  const reportCards = (dossier?.reportCards || []) as any[];
  const academicRecords = (dossier?.academicRecords || []) as any[];
  const disciplinarySummaries = (dossier?.disciplinarySummaries || []) as any[];
  const recentAbsences = (dossier?.recentAbsences || []) as any[];
  const recentIncidents = (dossier?.recentDisciplinaryActions || []) as any[];
  const originatingAdmission = dossier?.originatingAdmission || null;

  // Bulletins groupés par année (desc) puis période
  const reportCardsByYear = reportCards
    .slice()
    .sort((a: any, b: any) =>
      (b.academicYear?.startDate || '').localeCompare(a.academicYear?.startDate || '') ||
      (b.periodOrder || 0) - (a.periodOrder || 0),
    )
    .reduce((acc: any[], rc: any) => {
      const y = rc.academicYear?.name || rc.academicYear?.label || 'Année inconnue';
      const existing = acc.find(g => g.year === y);
      if (existing) existing.cards.push(rc); else acc.push({ year: y, startDate: rc.academicYear?.startDate, cards: [rc] });
      return acc;
    }, [])
    .sort((a: any, b: any) => (b.startDate || '').localeCompare(a.startDate || ''));

  const st = (STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE);

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      {/* ═══ EN-TÊTE DU DOSSIER ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gradient-to-r from-[#0d1f6e] to-[#1e3a8a] text-white">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-100 bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Retour
            </button>
            {totalStudents > 1 && (
              <div className="flex items-center gap-1.5">
                <button onClick={() => onNavigate(currentIndex - 1)} disabled={currentIndex <= 0}
                  className="inline-flex items-center px-2 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed" title="Élève précédent">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-white/70 px-1">{currentIndex + 1} / {totalStudents}</span>
                <button onClick={() => onNavigate(currentIndex + 1)} disabled={currentIndex >= totalStudents - 1}
                  className="inline-flex items-center px-2 py-1 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-lg border border-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed" title="Élève suivant">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-white/40 flex items-center justify-center text-xl font-bold text-[#0d1f6e] shrink-0">
              {student.photoUrl ? <img src={student.photoUrl} alt="" className="w-full h-full object-cover" /> : getInitials(student)}
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide">{student.lastName.toUpperCase()} {student.firstName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-mono bg-white/10 px-2 py-0.5 rounded-full">{student.matricule || 'Sans matricule'}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-[#0d1f6e] border border-white/50">DOSSIER NUMÉRIQUE DE L'ÉLÈVE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ⭐ 1.0.10 — impression du dossier complet (backend) */}
            <button onClick={handleDownloadDossierPdf} disabled={isPdfLoading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-white text-[#0d1f6e] hover:bg-slate-100 rounded-lg border border-white/60 shadow-sm transition disabled:opacity-50">
              {isPdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Télécharger le dossier complet (PDF)
            </button>
          </div>
        </div>

        {/* Bandeau d'information clé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-px bg-slate-100">
          <KeyInfo icon={ClipboardList} label="Statut" value={st.label} />
          <KeyInfo icon={GraduationCap} label="Classe actuelle" value={enrollments[0]?.academicClass?.name || enrollments[0]?.class?.name || student.studentEnrollments?.[0]?.class?.name || 'Non affectée'} />
          <KeyInfo icon={Calendar} label="Année" value={academicYear?.name || enrollments[0]?.academicYear?.name || '—'} />
          <KeyInfo icon={Hash} label="NPI" value={student.npi || 'Non renseigné'} warn={!student.npi} />
          <KeyInfo icon={Wallet} label="Régime" value={REGIME_LABELS[student.regimeType || ''] || 'Normal'} />
          <KeyInfo icon={Users} label="Responsables" value={`${guardians.length}`} warn={guardians.length === 0} />
        </div>

        {/* Sommaire */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-slate-100 overflow-x-auto bg-white sticky top-0 z-10">
          <span className="text-[9px] font-bold text-slate-400 uppercase mr-1">Sommaire</span>
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-600 hover:bg-slate-100 whitespace-nowrap transition">
              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[8px] font-bold">{s.num}</span>
              {s.label}
            </a>
          ))}
        </div>
      </div>

      {isLoadingDetail && !dossier ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-7 h-7 text-[#0d1f6e] animate-spin" />
        </div>
      ) : (
        <>
          {/* ═══ I. IDENTITÉ & SITUATION ADMINISTRATIVE ═══ */}
          <SectionCard id="sec-identite" num="I" title="Identité & situation administrative" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
              <div>
                <p className="text-[9px] font-bold text-slate-300 uppercase mb-1 flex items-center gap-1"><User className="w-3 h-3" /> État civil</p>
                <Row label="Nom / Prénom" value={`${student.lastName} ${student.firstName}`} />
                <Row label="Date de naissance" value={formatDate(student.dateOfBirth)} />
                <Row label="Lieu de naissance" value={student.placeOfBirth || '—'} />
                <Row label="Sexe" value={student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : '—'} />
                <Row label="Nationalité" value={student.nationality || '—'} />
                <Row label="Adresse" value={student.address || guardians[0]?.guardian?.address || '—'} />
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-300 uppercase mb-1 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Administration</p>
                <Row label="Matricule" value={student.matricule || student.studentCode || '—'} mono />
                <Row label="N° de dossier" value={student.studentCode || student.matricule || 'N/A'} mono />
                <Row label="NPI" value={student.npi || 'Non renseigné'} mono color={student.npi ? 'text-emerald-600' : 'text-amber-600'} />
                <Row label="Statut administratif" value={st.label} />
                <Row label="Régime scolaire" value={REGIME_LABELS[student.regimeType || ''] || 'Normal'} />
                <Row label="Source du dossier" value={student.matricule ? 'Admission / Inscription' : 'Création directe'} />
              </div>
            </div>
          </SectionCard>

          {/* ═══ II. RESPONSABLES LÉGAUX ═══ */}
          <SectionCard id="sec-responsables" num="II" title="Responsables légaux" icon={Users}>
            {guardians.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {guardians.map((sg: any, i: number) => {
                  const g = sg.guardian || sg;
                  return (
                    <div key={sg.id || i} className={cn('p-4 rounded-xl border', sg.isPrimary ? 'bg-blue-50/60 border-blue-200' : 'bg-slate-50 border-slate-100')}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                          {g.firstName?.[0]}{g.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800">{g.firstName} {g.lastName}</p>
                            {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}
                          </div>
                          <p className="text-[10px] text-slate-400 uppercase">{sg.relationship || 'Responsable'}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                            {g.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {g.phone}</span>}
                            {g.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {g.email}</span>}
                            {g.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {g.address}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">
                  <b>Aucun responsable légal enregistré</b> — ajoutez-le depuis Élèves &amp; Scolarité → Familles → Responsables
                  (le compte portail parent est créé en même temps).
                </p>
              </div>
            )}
          </SectionCard>

          {/* ═══ III. PARCOURS SCOLAIRE ═══ */}
          <SectionCard id="sec-parcours" num="III" title="Parcours scolaire — année par année" icon={School}>
            {/* École d'origine */}
            {originatingAdmission && (originatingAdmission.previousSchool || originatingAdmission.previousLevel) && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-[10px] font-bold text-indigo-700 uppercase mb-2 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> École d'origine (avant l'entrée dans l'établissement)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div><p className="text-[10px] text-slate-400">Établissement précédent</p><p className="font-semibold text-slate-700">{originatingAdmission.previousSchool || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400">Niveau précédent</p><p className="font-semibold text-slate-700">{originatingAdmission.previousLevel || '—'}</p></div>
                  <div><p className="text-[10px] text-slate-400">Motif du changement</p><p className="font-semibold text-slate-700">{originatingAdmission.changeReason || '—'}</p></div>
                </div>
              </div>
            )}

            {enrollments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Année scolaire</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Niveau</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Classe</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Inscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrollments.map((e: any, i: number) => (
                      <tr key={e.id || i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-slate-700">{e.academicYear?.name || e.academicYear?.label || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{e.schoolLevel?.name || e.schoolLevel?.label || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{e.academicClass?.name || e.class?.name || <span className="text-amber-600 italic">Non affectée</span>}</td>
                        <td className="px-3 py-2 text-slate-600">{ENROLLMENT_TYPE[e.enrollmentType] || e.enrollmentType || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('px-2 py-0.5 text-[10px] font-bold rounded-full border',
                            e.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200')}>
                            {ENROLLMENT_STATUS[e.status] || e.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(e.enrollmentDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={GraduationCap} text="Aucune inscription enregistrée" />}

            {/* Historique des mouvements (chronologie condensée) */}
            {movementHistory.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><History className="w-3 h-3" /> Chronologie des mouvements</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {movementHistory.slice(0, 12).map((item: any) => {
                    const info = ACTION_LABELS[item.action] || { label: item.action, color: 'text-slate-600' };
                    return (
                      <div key={item.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                        <span className={cn('font-medium', info.color)}>{info.label}</span>
                        <span className="ml-auto text-slate-400">{new Date(item.date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ═══ IV. RÉSULTATS & BULLETINS ═══ */}
          <SectionCard id="sec-resultats" num="IV" title="Résultats & bulletins — traçabilité année par année" icon={BookOpen}>
            {reportCardsByYear.length > 0 ? (
              <div className="space-y-4">
                {reportCardsByYear.map((group: any) => (
                  <div key={group.year}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-1.5 h-4 bg-[#0d1f6e] rounded-full" />
                      <p className="text-xs font-bold text-slate-700 uppercase">{group.year}</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.cards.map((rc: any, i: number) => {
                        const s = RC_STATUS[rc.status] || { label: rc.status || '—', color: 'bg-slate-100 text-slate-600' };
                        return (
                          <div key={rc.id || i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-700">{rc.periodName || rc.type || 'Période'}</p>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', s.color)}>{s.label}</span>
                          </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-slate-400">Moyenne</span>
                              <span className="font-bold text-[#0d1f6e]">{rc.overallAverage != null ? Number(rc.overallAverage).toFixed(2) : '—'}/20</span>
                              {rc.rank != null && <><span className="text-slate-400">Rang</span><span className="font-bold text-slate-700">{rc.rank}</span></>}
                            </div>
                            {/* ⭐ 1.0.10 — notes par matière (issues du bulletin) */}
                            {rc.items?.length > 0 && (
                              <div className="mt-1 pt-1.5 border-t border-slate-200/70">
                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Notes par matière</p>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                                  {rc.items.slice(0, 10).map((it: any, k: number) => (
                                    <div key={it.id || k} className="flex items-baseline justify-between gap-1 text-[10px]">
                                      <span className="text-slate-500 truncate">{it.subject?.name || '—'}</span>
                                      <span className="font-semibold text-slate-700 shrink-0">{it.average != null ? Number(it.average).toFixed(2) : '—'}</span>
                                    </div>
                                  ))}
                                </div>
                                {rc.items.length > 10 && (
                                  <p className="text-[9px] text-slate-400 mt-1">+{rc.items.length - 10} autres matières — détail complet dans le dossier PDF</p>
                                )}
                              </div>
                            )}
                            {rc.filePath ? (
                              <a href={rc.filePath} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 mt-0.5">
                                <Download className="w-3 h-3" /> Bulletin (PDF)
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">PDF non généré</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4 text-center">
                <BookOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">Aucun bulletin enregistré pour cet élève</p>
                <p className="text-[10px] text-slate-400 mt-1">Les bulletins apparaissent ici dès qu'ils sont générés dans le module « Examens, Notes &amp; Bulletins » — moyenne, rang et PDF téléchargeable par année et période.</p>
              </div>
            )}

            {/* Synthèses annuelles (StudentAcademicRecord) */}
            {academicRecords.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Synthèse annuelle enregistrée</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Année</th>
                        <th className="px-3 py-2 text-left font-bold text-slate-500 uppercase">Classe</th>
                        <th className="px-3 py-2 text-center font-bold text-slate-500 uppercase">Moyenne</th>
                        <th className="px-3 py-2 text-center font-bold text-slate-500 uppercase">Rang</th>
                        <th className="px-3 py-2 text-center font-bold text-slate-500 uppercase">Absences</th>
                        <th className="px-3 py-2 text-center font-bold text-slate-500 uppercase">Incidents</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {academicRecords.map((r: any, i: number) => (
                        <tr key={r.id || i} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-semibold text-slate-700">{r.academicYear?.name || r.academicYear?.label || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{r.class?.name || r.schoolLevel?.name || '—'}</td>
                          <td className="px-3 py-2 text-center font-bold text-[#0d1f6e]">{r.averageScore != null ? Number(r.averageScore).toFixed(2) : '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{r.rank ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{r.totalAbsences ?? 0}</td>
                          <td className="px-3 py-2 text-center text-slate-600">{r.totalIncidents ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ═══ V. FRAIS & PAIEMENTS ═══ */}
          <SectionCard id="sec-frais" num="V" title="Frais & paiements — résumé" icon={Wallet}>
            {feeProfile && (
              <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2 text-xs">
                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-blue-700 font-bold">Régime tarifaire :</span>
                <span className="text-slate-700">{feeProfile.feeRegime?.label || feeProfile.feeRegime?.code || 'Standard'}</span>
              </div>
            )}
            {financeAccount ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MiniStat label="Total dû" value={formatMoney(financeAccount.totalDue)} color="text-slate-800" />
                  <MiniStat label="Payé" value={formatMoney(financeAccount.totalPaid)} color="text-emerald-600" />
                  <MiniStat label="Arriérés" value={formatMoney(financeAccount.arrearsAmount)} color="text-rose-600" />
                  <MiniStat label="Solde" value={formatMoney(financeAccount.balance)} color={financeAccount.balance > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                </div>
                {payments.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dernières transactions</p>
                    <div className="space-y-1">
                      {payments.slice(0, 5).map((pay: any) => (
                        <div key={pay.id} className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg text-xs">
                          <span className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center"><Wallet className="w-3 h-3 text-emerald-600" /></span>
                          <span className="font-semibold text-slate-700">{formatMoney(pay.amount)}</span>
                          <span className="text-slate-400">{new Date(pay.transactionDate || pay.createdAt).toLocaleDateString('fr-FR')} · {pay.paymentMethod || '—'}</span>
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{pay.status || 'COMPLETED'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <EmptyState icon={Wallet} text="Aucun compte financier trouvé pour cette année" />}
          </SectionCard>

          {/* ═══ VI. ASSIDUITÉ & DISCIPLINE ═══ */}
          <SectionCard id="sec-assiduite" num="VI" title="Assiduité & discipline" icon={Activity}>
            {disciplinarySummaries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                {disciplinarySummaries.map((s: any, i: number) => (
                  <div key={s.id || i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">{s.academicYear?.name || s.academicYear?.label || '—'}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                      <Stat label="Absences" value={s.absencesCount ?? 0} warn={(s.absencesCount ?? 0) > 10} />
                      <Stat label="Non justifiées" value={s.unjustifiedAbsences ?? 0} warn={(s.unjustifiedAbsences ?? 0) > 5} />
                      <Stat label="Incidents" value={s.incidentsCount ?? 0} warn={(s.incidentsCount ?? 0) > 3} />
                      <Stat label="Sanctions" value={s.sanctionsCount ?? 0} warn={(s.sanctionsCount ?? 0) > 0} />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentAbsences.length === 0 && recentIncidents.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600" />
                <p className="text-xs text-emerald-800">Aucun événement d'assiduité ou de discipline enregistré — dossier propre.</p>
              </div>
            ) : null}

            {recentAbsences.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Dernières absences ({recentAbsences.length})</p>
                <div className="space-y-1">
                  {recentAbsences.slice(0, 6).map((a: any, i: number) => (
                    <div key={a.id || i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-xs">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', a.isJustified ? 'bg-emerald-400' : 'bg-rose-400')} />
                      <span className="text-slate-600">{new Date(a.date).toLocaleDateString('fr-FR')}</span>
                      <span className="text-slate-400">{a.absenceType || a.type || 'Absence'}</span>
                      <span className={cn('ml-auto text-[10px] font-bold', a.isJustified ? 'text-emerald-600' : 'text-rose-600')}>{a.isJustified ? 'Justifiée' : 'Non justifiée'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentIncidents.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Derniers incidents ({recentIncidents.length})</p>
                <div className="space-y-1">
                  {recentIncidents.slice(0, 6).map((inc: any, i: number) => (
                    <div key={inc.id || i} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-slate-600">{new Date(inc.actionDate).toLocaleDateString('fr-FR')}</span>
                      <span className="text-slate-400">{inc.actionType || 'Incident'}</span>
                      {inc.reason && <span className="text-slate-500 truncate">{inc.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* ═══ VII. DOCUMENTS & CARTE SCOLAIRE ═══ */}
          <SectionCard id="sec-documents" num="VII" title="Documents & carte scolaire" icon={FileText}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><FileCheck className="w-3 h-3" /> Pièces du dossier</p>
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition">
                        <div className="p-1.5 bg-white rounded border border-slate-200"><FileText className="w-4 h-4 text-slate-500" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate">{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</p>
                          <p className="text-[10px] text-slate-400 truncate">{doc.fileName} · {formatDate(doc.createdAt)}</p>
                        </div>
                        {doc.filePath && (
                          <>
                            <button onClick={() => setPreviewDoc({ filePath: doc.filePath, fileName: doc.fileName, mimeType: doc.mimeType || 'application/pdf' })}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200" title="Visualiser">
                              <Eye className="w-3 h-3" /> Voir
                            </button>
                            <a href={doc.filePath} download={doc.fileName} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200" title="Télécharger">
                              <Download className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <EmptyState icon={FileText} text="Aucun document dans le dossier" />}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><ClipboardList className="w-3 h-3" /> Carte scolaire</p>
                {studentCard ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="bg-slate-100 p-4 rounded-xl relative w-full max-w-sm">
                      <IdCardVisual
                        card={{
                          cardNumber: studentCard.cardNumber,
                          qrPayload: studentCard.qrPayload,
                          qrHash: studentCard.qrHash,
                          generatedAt: studentCard.generatedAt,
                          validUntil: studentCard.validUntil,
                          student: {
                            firstName: student.firstName,
                            lastName: student.lastName,
                            matricule: student.matricule,
                            studentCode: student.studentCode,
                            photoUrl: student.photoUrl,
                            dateOfBirth: student.dateOfBirth,
                            gender: student.gender,
                          },
                          guardian: guardians[0]?.guardian ? {
                            firstName: guardians[0].guardian?.firstName || '',
                            lastName: guardians[0].guardian?.lastName || '',
                            phone: guardians[0].guardian?.phone || '',
                            address: guardians[0].guardian?.address || '',
                          } : null,
                          className: enrollments[0]?.academicClass?.name || enrollments[0]?.class?.name || student.studentEnrollments?.[0]?.class?.name || '',
                          levelName: enrollments[0]?.schoolLevel?.name || '',
                          levelCode: (enrollments[0]?.schoolLevel?.code as any) || '',
                        }}
                        face={cardFace}
                        identity={identity}
                      />
                      <button onClick={() => setCardFace(cardFace === 'recto' ? 'verso' : 'recto')}
                        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg shadow-sm">
                        <RotateCw className="w-2.5 h-2.5" />{cardFace === 'recto' ? 'Verso' : 'Recto'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={async () => {
                        try {
                          const blob = await studentsService.downloadIdCardPdf(studentCard.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = `carte-${student.lastName}.pdf`;
                          document.body.appendChild(a); a.click(); document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); }
                      }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200">
                        <Download className="w-3.5 h-3.5" /> PDF carte
                      </button>
                      <span className="text-xs text-slate-400">N° {studentCard.cardNumber}</span>
                    </div>
                  </div>
                ) : <EmptyState icon={ClipboardList} text="Aucune carte scolaire générée pour cette année" />}
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {previewDoc && <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </div>
  );
}

// ─── Petits composants d'affichage ───

function KeyInfo({ icon: Icon, label, value, warn }: { icon: any; label: string; value: any; warn?: boolean }) {
  return (
    <div className="bg-white px-3 py-2.5 flex items-center gap-2 min-w-0">
      <Icon className={cn('w-3.5 h-3.5 shrink-0', warn ? 'text-amber-500' : 'text-slate-400')} />
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{label}</p>
        <p className={cn('text-xs font-semibold truncate', warn ? 'text-amber-600' : 'text-slate-700')}>{value ?? '—'}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className={cn('text-sm font-bold', color)}>{value}</p>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={cn('font-bold', warn ? 'text-amber-600' : 'text-slate-700')}>{value}</span>
    </div>
  );
}
