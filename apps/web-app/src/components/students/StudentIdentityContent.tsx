'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  User, Shield, Users, Mail, Phone, FileCheck, AlertCircle,
  Search, Loader2, Download, Eye, X, CreditCard, FileText,
  History, BookOpen, GraduationCap, Calendar, MapPin, Hash,
  ArrowLeft, HeartPulse, Wallet, Activity, RotateCw,
  ClipboardList, AlertTriangle, ChevronLeft, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import DocumentPreviewModal from './DocumentPreviewModal';
import IdCardVisual, { type TenantInfo } from './IdCardVisual';
// ⭐ 1.0.10 — refonte « dossier numérique de l'élève » : le détail d'un élève
//    est désormais rendu par le dossier unifié 7 sections (au lieu des
//    10 onglets dispersés de l'ancien StudentDashboard).
import StudentDossierContent from './StudentDossierContent';
import { useStudents, useAllClasses } from '@/lib/query/student-queries';
import { useQueryClient } from '@tanstack/react-query';

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  globalMatricule?: string;
  npi?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  address?: string;
  status: string;
  isActive: boolean;
  photoUrl?: string;
  schoolLevelId?: string;
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

interface ClassInfo { id: string; name: string; schoolLevelId: string; schoolLevel?: { id: string; name: string; code?: string }; }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PRE_REGISTERED: { label: 'Pré-inscrit', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ADMITTED: { label: 'Admis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  // ⭐ FIX 2026-11-18 : « Retiré » → « Abandon » (statut d'un élève retiré pour abandon)
  WITHDRAWN: { label: 'Abandon', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  EXCLUDED: { label: 'Exclu', color: 'bg-red-50 text-red-700 border-red-200' },
  INACTIVE: { label: 'Inactif', color: 'bg-slate-50 text-slate-600 border-slate-200' },
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

// ⭐ Tabs : 'observations' et 'audit' SUPPRIMÉS — ils dupliquaient 'scolarite'.
//    La traçabilité des mouvements est désormais visible uniquement dans l'onglet
//    'scolarite' (qui contient déjà l'historique complet : admissions, transferts,
//    changements de classe, etc.).
type DetailTab = 'identite' | 'admin' | 'parents' | 'scolarite' | 'documents' | 'carte' | 'frais' | 'medical' | 'bulletins' | 'orion';

const NAVY = '#0D1F6E';
const LEVEL_ORDER: Record<string, number> = { MATERNELLE: 1, MAT: 1, PRIMAIRE: 2, PRIMARY: 2, SECONDAIRE: 3, SECONDARY: 3 };

// ⭐ Composant Pagination réutilisable (pattern identique à StudentMovementsContent.tsx)
function Pagination({
  currentPage, totalPages, total, limit, onPageChange, isLoading,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  const pages: (number | 'ellipsis')[] = [];
  const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
  add(1);
  if (currentPage - 1 > 2) pages.push('ellipsis');
  for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) {
    add(p);
  }
  if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
  if (totalPages > 1) add(totalPages);

  return (
    <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-slate-500">
        Affichage <strong className="text-slate-700">{start}-{end}</strong> sur <strong className="text-slate-700">{total}</strong> élève(s)
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Précédent
        </button>
        <div className="flex items-center gap-0.5">
          {pages.map((p, i) => {
            if (p === 'ellipsis') {
              return (
                <span key={`e-${i}`} className="px-2 text-slate-400">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </span>
              );
            }
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                disabled={isLoading}
                className={cn(
                  'min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50',
                  p === currentPage
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Suivant
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function getInitials(s: StudentIdentity) { return `${s.lastName?.[0] || ''}${s.firstName?.[0] || ''}`.toUpperCase(); }
function getAge(dob?: string) { if (!dob) return null; return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)); }
function formatDate(d?: string) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
function formatMoney(amount?: number) { if (amount === null || amount === undefined) return '—'; return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'; }

export default function StudentIdentityContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentIdentity[]>([]);
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentIdentity | null>(null);

  // ⭐ PAGE_SIZE = 200 pour afficher tous les élèves d'une classe (Maternelle 2 peut avoir 30+ élèves)
  const PAGE_SIZE = 200;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ⭐ Bug fix : reset currentPage à 1 quand un filtre change.
  useEffect(() => {
    setCurrentPage(1);
  }, [filterLevelId, filterClassId, searchTerm]);

  // ⭐ Bug fix : recharger au changement de page/filtre/recherche (debounce 250ms sur search).
  // ⭐ FIX : utilise React Query (useStudents + useAllClasses) au lieu de fetch manuel.
  //    Les données sont mises en cache et servies instantanément au remontage.
  const studentsQuery = useStudents({
    academicYearId: academicYear?.id,
    page: currentPage,
    limit: PAGE_SIZE,
    schoolLevelId: filterLevelId || undefined,
    classId: filterClassId || undefined,
    search: searchTerm.trim() || undefined,
  });
  const allClassesQuery = useAllClasses(academicYear?.id);
  const queryClient = useQueryClient();

  // Synchronisation React Query → state local
  useEffect(() => {
    if (!academicYear) return;
    const studentsData = studentsQuery.data;
    const allStudents = studentsData?.data || [];
    setStudents(allStudents);
    setTotalStudents(studentsData?.total || allStudents.length);
    setTotalPages(studentsData?.totalPages || 1);
    setAllClasses(allClassesQuery.data || []);
    setIsLoading(studentsQuery.isLoading || allClassesQuery.isLoading);
  }, [studentsQuery.data, allClassesQuery.data, studentsQuery.isLoading, allClassesQuery.isLoading, academicYear]);

  const loadData = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['all-classes', academicYear?.id] });
  };

  // ⭐ Présélection d'un élève si ?studentId=xxx est présent dans l'URL
  useEffect(() => {
    if (typeof window !== 'undefined' && students.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const preselectStudentId = urlParams.get('studentId');
      if (preselectStudentId) {
        const found = students.find((s: any) => s.id === preselectStudentId);
        if (found) {
          setSelectedStudent(found as StudentIdentity);
        }
        urlParams.delete('studentId');
        const newUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [students]);

  const levels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code?: string }>();
    allClasses.forEach(c => {
      if (c.schoolLevelId && !map.has(c.schoolLevelId)) {
        map.set(c.schoolLevelId, { id: c.schoolLevelId, name: c.schoolLevel?.name || 'Niveau', code: c.schoolLevel?.code });
      }
    });
    return Array.from(map.values()).sort((a, b) => (LEVEL_ORDER[a.code?.toUpperCase() || ''] || 99) - (LEVEL_ORDER[b.code?.toUpperCase() || ''] || 99));
  }, [allClasses]);

  const filteredClasses = useMemo(() => {
    if (!filterLevelId) return allClasses;
    return allClasses.filter(c => c.schoolLevelId === filterLevelId);
  }, [allClasses, filterLevelId]);

  // ⭐ Map studentId → { classId, className, levelId } via enrollments
  // Inclut TOUS les statuts d'enrollment (ADMITTED, ACTIVE, etc.)
  const studentClassMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string; levelId: string }>();
    students.forEach(s => {
      // Prendre le premier enrollment avec une classe (peu importe le statut)
      const enr = s.studentEnrollments?.find(e => e.class?.id);
      if (enr?.class?.id) {
        const cls = allClasses.find(c => c.id === enr.class!.id);
        m.set(s.id, { id: enr.class.id, name: enr.class.name, levelId: cls?.schoolLevelId || '' });
      }
    });
    return m;
  }, [students, allClasses]);

  // ⭐ Bug fix : suppression du filtrage client (le backend filtre déjà par
  // schoolLevelId/classId/search). On garde juste la liste telle quelle pour
  // le grouping visuel par niveau/classe.
  const filteredStudents = useMemo(() => {
    return students;
  }, [students]);

  const groupedStudents = useMemo(() => {
    const groups = new Map<string, { levelName: string; classes: Map<string, { className: string; students: StudentIdentity[] }> }>();
    filteredStudents.forEach(s => {
      const sci = studentClassMap.get(s.id);
      const className = sci?.name || 'Non affecté';
      const classId = sci?.id || 'none';
      const levelName = sci?.levelId ? levels.find(l => l.id === sci.levelId)?.name || 'Autre' : 'Non affecté';
      if (!groups.has(levelName)) groups.set(levelName, { levelName, classes: new Map() });
      const group = groups.get(levelName)!;
      if (!group.classes.has(classId)) group.classes.set(classId, { className, students: [] });
      group.classes.get(classId)!.students.push(s);
    });
    return Array.from(groups.values()).map(g => ({ ...g, classes: Array.from(g.classes.values()).sort((a, b) => a.className.localeCompare(b.className)) }));
  }, [filteredStudents, studentClassMap, levels]);

  if (selectedStudent) {
    const currentIndex = filteredStudents.findIndex(s => s.id === selectedStudent.id);
    return (
      <StudentDossierContent
        student={selectedStudent}
        academicYear={academicYear}
        onBack={() => setSelectedStudent(null)}
        currentIndex={currentIndex}
        totalStudents={filteredStudents.length}
        onNavigate={(newIndex: number) => {
          if (newIndex >= 0 && newIndex < filteredStudents.length) {
            setSelectedStudent(filteredStudents[newIndex]);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Shield className="w-5 h-5 text-blue-600" /></div>
          <div><h3 className="font-semibold text-slate-900">Dossiers Élèves</h3><p className="text-xs text-slate-500">{filteredStudents.length} élève(s) affiché(s) sur {totalStudents} · {students.filter(s => s.npi).length} avec NPI</p></div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterLevelId} onChange={(e) => { setFilterLevelId(e.target.value); setFilterClassId(''); }} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="">Tous les niveaux</option>
          {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <select value={filterClassId} onChange={(e) => setFilterClassId(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="">Toutes les classes</option>
          {filteredClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {(filterLevelId || filterClassId || searchTerm) && (
          <button onClick={() => { setFilterLevelId(''); setFilterClassId(''); setSearchTerm(''); }} className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100">✕ Réinitialiser</button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400"><User className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm">Aucun élève trouvé</p></div>
      ) : (
        <div className="space-y-6">
          {groupedStudents.map((lg) => (
            <div key={lg.levelName}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{lg.levelName}</h3>
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600">{lg.classes.reduce((a, c) => a + c.students.length, 0)} élève(s)</span>
              </div>
              <div className="space-y-4">
                {lg.classes.map((cg) => (
                  <div key={cg.className}>
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5"><span className="w-1 h-3 bg-blue-500 rounded-full"></span>{cg.className} · {cg.students.length} élève(s)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cg.students.map((student) => {
                        const si = STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE;
                        const age = getAge(student.dateOfBirth);
                        return (
                          <div key={student.id} onClick={() => setSelectedStudent(student)} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden cursor-pointer group">
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                              <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                                {student.photoUrl ? <img src={student.photoUrl} alt="" className="w-full h-full object-cover" /> : getInitials(student)}
                              </div>
                              <div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition">{student.lastName.toUpperCase()} {student.firstName}</p><p className="text-[10px] font-mono text-slate-400 truncate">{student.matricule || 'Sans matricule'}</p></div>
                              <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0', si.color)}>{si.label}</span>
                            </div>
                            <div className="p-3 space-y-2.5">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {student.dateOfBirth && <div><p className="text-slate-400">Naissance</p><p className="font-medium text-slate-700">{new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}{age ? ` (${age} ans)` : ''}</p></div>}
                                {student.gender && <div><p className="text-slate-400">Sexe</p><p className="font-medium text-slate-700">{student.gender === 'M' ? 'Masculin' : 'Féminin'}</p></div>}
                              </div>
                              <div className="flex items-center justify-between text-xs"><span className="text-slate-500 flex items-center gap-1"><FileCheck className="w-3 h-3" /> NPI</span>{student.npi ? <span className="font-mono font-medium text-emerald-600">{student.npi}</span> : <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Non renseigné</span>}</div>
                              {studentClassMap.get(student.id) && <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Classe</span><span className="font-medium text-slate-700">{studentClassMap.get(student.id)!.name}</span></div>}
                            </div>
                            <div className="p-2 bg-slate-50 border-t border-slate-100"><div className="text-[10px] text-blue-600 font-semibold text-center group-hover:text-blue-700 transition flex items-center justify-center gap-1"><Eye className="w-3 h-3" /> Voir le dossier complet</div></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ⭐ Pagination — déclenche loadData() au changement de page (vraie pagination serveur) */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        total={totalStudents}
        limit={PAGE_SIZE}
        onPageChange={(page) => setCurrentPage(page)}
        isLoading={isLoading}
      />
    </div>
  );
}

// ─── (⭐ 1.0.10) ANCIEN « Dashboard élève plein écran » — REMPLACÉ par
//     StudentDossierContent.tsx (dossier numérique unifié à 7 sections).
//     Le composant historique est conservé ci-dessous uniquement comme
//     référence pendant la transition ; il n'est plus rendu nulle part.

function StudentDashboard({ student, academicYear, onBack, currentIndex, totalStudents, onNavigate }: {
  student: StudentIdentity; academicYear: any; onBack: () => void;
  currentIndex: number; totalStudents: number; onNavigate: (newIndex: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('identite');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [movementHistory, setMovementHistory] = useState<any[]>([]);
  const [studentCard, setStudentCard] = useState<any>(null);
  const [financeAccount, setFinanceAccount] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [feeProfile, setFeeProfile] = useState<any>(null);
  const [cardFace, setCardFace] = useState<'recto' | 'verso'>('recto');
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  // ⭐ Identité du tenant pour IdCardVisual (même composant que l'onglet Cartes Scolaires)
  const [identity, setIdentity] = useState<TenantInfo | null>(null);

  // Charger l'identité du tenant une fois
  useEffect(() => {
    fetch('/api/settings/identity', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const p = Array.isArray(data) ? data[0] : data;
          setIdentity({
            schoolName: p?.schoolName || p?.name || 'Établissement Scolaire',
            slogan: p?.slogan || 'Excellence • Discipline • Travail',
            address: p?.address || '',
            city: p?.city || '',
            phonePrimary: p?.phonePrimary || p?.phone || '',
            email: p?.email || '',
            website: p?.website || '',
            logoUrl: p?.logoUrl || '',
            cardPrimaryColor: p?.cardPrimaryColor || '#17348f',
            cardSecondaryColor: p?.cardSecondaryColor || '#29c2e8',
            cardShowQRCode: p?.cardShowQRCode ?? true,
            cardShowPhoto: p?.cardShowPhoto ?? true,
            cardShowGuardian: p?.cardShowGuardian ?? true,
            cardShowEmergencyCall: p?.cardShowEmergencyCall ?? true,
            cardShowSchoolAddress: p?.cardShowSchoolAddress ?? true,
            cardConditionsText: p?.cardConditionsText || '',
          } as TenantInfo);
        }
      }).catch(() => {});
  }, []);

  useEffect(() => { loadDetail(student.id); }, [student.id]);

  const loadDetail = async (studentId: string) => {
    setIsLoadingDetail(true);
    try {
      const [docsRes, historyRes, cardRes] = await Promise.allSettled([
        apiFetch(`/students/${studentId}/documents`),
        apiFetch(`/students/movement-history?studentId=${studentId}&limit=50`),
        apiFetch(`/students/id-cards/${studentId}?academicYearId=${academicYear?.id}`),
      ]);
      setDocuments(docsRes.status === 'fulfilled' && Array.isArray(docsRes.value) ? docsRes.value : []);
      setMovementHistory(historyRes.status === 'fulfilled' && Array.isArray(historyRes.value) ? historyRes.value : []);
      setStudentCard(cardRes.status === 'fulfilled' ? cardRes.value : null);

      // ⭐ Compte financier + transactions + fee profile (régime) + breakdown personnalisé
      try {
        const accounts = await financeService.getStudentAccounts({ studentId, academicYearId: academicYear?.id });
        const account = Array.isArray(accounts) ? accounts[0] : (accounts?.data?.[0] || accounts);
        setFinanceAccount(account);
        if (account?.id) {
          // ⭐ Charger les DÉTAILS du compte (breakdowns + overrides + feeArrears)
          // pour afficher les montants personnalisés dans l'onglet Frais.
          try {
            const details = await financeService.getStudentAccountDetails(account.id);
            // Fusionner les détails dans l'objet account pour que le rendering
            // ait accès aux breakdowns, overrides et feeArrears.
            if (details && typeof details === 'object') {
              setFinanceAccount({ ...account, ...details });
            }
          } catch (e) {
            console.warn('[StudentDossier] getStudentAccountDetails failed:', e);
          }
          try {
            const transactions = await financeService.getTransactions({ studentAccountId: account.id, limit: '20' });
            setPayments(Array.isArray(transactions) ? transactions : (transactions?.data || []));
          } catch { setPayments([]); }
        }
      } catch { setFinanceAccount(null); setPayments([]); }

      // ⭐ Récupérer le fee profile (régime tarifaire) de l'élève
      try {
        const profiles = await financeService.createStudentFeeProfile({
          studentId,
          academicYearId: academicYear?.id,
          feeRegimeId: '', // juste pour récupérer, ne crée pas si déjà existant
        });
        setFeeProfile(profiles);
      } catch {
        // Si la création échoue (ex: déjà existant), essayer de récupérer via getStudentAccounts
        setFeeProfile(financeAccount?.feeRegime || null);
      }
    } catch (e) { console.warn('loadDetail error:', e); }
    finally { setIsLoadingDetail(false); }
  };

  const tabs: Array<{ id: DetailTab; label: string; icon: any }> = [
    { id: 'identite', label: 'Identité', icon: User },
    { id: 'admin', label: 'Infos Admin', icon: ClipboardList },
    { id: 'parents', label: 'Responsables', icon: Users },
    { id: 'scolarite', label: 'Scolarité', icon: GraduationCap },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'carte', label: 'Carte scolaire', icon: CreditCard },
    { id: 'frais', label: 'Frais & Paiements', icon: Wallet },
    { id: 'medical', label: 'Médical', icon: HeartPulse },
    { id: 'bulletins', label: 'Bulletins', icon: BookOpen },
    { id: 'orion', label: 'Alertes ORION', icon: AlertTriangle },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"><ArrowLeft className="w-3.5 h-3.5" /> Retour</button>
            {/* ⭐ Pagination élève */}
            {totalStudents > 1 && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={() => onNavigate(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-blue-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Élève précédent"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono text-slate-500 px-1">
                  {currentIndex + 1} / {totalStudents}
                </span>
                <button
                  onClick={() => onNavigate(currentIndex + 1)}
                  disabled={currentIndex >= totalStudents - 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-blue-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Élève suivant"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white border-2 border-blue-200 flex items-center justify-center text-lg font-bold text-blue-600 shrink-0">{student.photoUrl ? <img src={student.photoUrl} alt="" className="w-full h-full object-cover" /> : getInitials(student)}</div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{student.lastName.toUpperCase()} {student.firstName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs font-mono text-slate-400">{student.matricule || 'Sans matricule'}</p>
                {student.npi && <span className="text-[10px] font-mono text-emerald-600">NPI: {student.npi}</span>}
                <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border', (STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE).color)}>{(STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE).label}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-4 py-2 border-t border-slate-100 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap', activeTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100')}>
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 min-h-[400px]">
        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : activeTab === 'identite' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCard icon={User} label="Nom" value={student.lastName} />
            <InfoCard icon={User} label="Prénom" value={student.firstName} />
            <InfoCard icon={Calendar} label="Date de naissance" value={formatDate(student.dateOfBirth)} />
            <InfoCard icon={MapPin} label="Lieu de naissance" value={student.placeOfBirth || '—'} />
            <InfoCard icon={User} label="Sexe" value={student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : '—'} />
            <InfoCard icon={MapPin} label="Nationalité" value={student.nationality || '—'} />
            <InfoCard icon={Hash} label="Matricule" value={student.matricule || '—'} mono />
            <InfoCard icon={FileCheck} label="NPI" value={student.npi || 'Non renseigné'} mono color={student.npi ? 'text-emerald-600' : 'text-amber-600'} />
            <InfoCard icon={MapPin} label="Adresse" value={student.address || student.studentGuardians?.[0]?.guardian?.address || '—'} />
          </div>
        ) : activeTab === 'parents' ? (
          <div className="space-y-3">
            {student.studentGuardians && student.studentGuardians.length > 0 ? (
              student.studentGuardians.map(sg => (
                <div key={sg.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">{sg.guardian.firstName?.[0]}{sg.guardian.lastName?.[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><p className="text-sm font-bold text-slate-800">{sg.guardian.firstName} {sg.guardian.lastName}</p>{sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}</div>
                    <p className="text-[10px] text-slate-400 uppercase">{sg.relationship}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-600">{sg.guardian.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sg.guardian.phone}</span>}{sg.guardian.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sg.guardian.email}</span>}</div>
                    {sg.guardian.address && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> {sg.guardian.address}</p>}
                  </div>
                </div>
              ))
            ) : <EmptyState icon={Users} text="Aucun responsable légal renseigné" />}
          </div>
        ) : activeTab === 'scolarite' ? (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Historique des inscriptions</h4>
              {student.studentEnrollments && student.studentEnrollments.length > 0 ? (
                <div className="space-y-2">
                  {student.studentEnrollments.map(enr => (
                    <div key={enr.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="p-2 bg-blue-100 rounded-lg"><GraduationCap className="w-4 h-4 text-blue-600" /></div>
                      <div className="flex-1"><p className="text-sm font-bold text-slate-800">{enr.class?.name || 'Non affecté'}</p><p className="text-xs text-slate-500">{enr.academicYear?.name || '—'}</p></div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200">{enr.status}</span>
                    </div>
                  ))}
                </div>
              ) : <EmptyState icon={GraduationCap} text="Aucune inscription" />}
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Historique des mouvements</h4>
              {movementHistory.length > 0 ? (
                <div className="space-y-1.5">
                  {movementHistory.map(item => {
                    const info = ACTION_LABELS[item.action] || { label: item.action, color: 'text-slate-600' };
                    return (
                      <div key={item.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-50">
                        <History className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="flex-1"><p className={cn('text-xs font-medium', info.color)}>{info.label}</p><p className="text-[10px] text-slate-400">{new Date(item.date).toLocaleString('fr-FR')}</p></div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={History} text="Aucun mouvement enregistré" />}
            </div>
          </div>
        ) : activeTab === 'documents' ? (
          <div className="space-y-3">
            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition">
                    <div className="p-2 bg-white rounded-lg border border-slate-200"><FileText className="w-4 h-4 text-slate-500" /></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-800 truncate">{DOC_TYPE_LABELS[doc.documentType] || doc.documentType}</p><p className="text-[10px] text-slate-400 truncate">{doc.fileName}</p></div>
                    {doc.filePath && (
                      <>
                        <button onClick={() => setPreviewDoc({ filePath: doc.filePath, fileName: doc.fileName, mimeType: doc.mimeType || 'application/pdf' })}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition" title="Visualiser">
                          <Eye className="w-3 h-3" /> Visualiser
                        </button>
                        <a href={doc.filePath} download={doc.fileName} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition" title="Télécharger">
                          <Download className="w-3 h-3" />
                        </a>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={FileText} text="Aucun document dans le dossier" />}
          </div>
        ) : activeTab === 'carte' ? (
          <div className="flex flex-col items-center gap-4">
            {studentCard ? (
              <>
                {/* ⭐ Utilisation d'IdCardVisual (même composant que l'onglet Cartes Scolaires) */}
                <div className="bg-slate-100 p-4 rounded-xl relative w-full max-w-md">
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
                      guardian: student.studentGuardians?.[0] ? {
                        firstName: student.studentGuardians[0].guardian?.firstName || '',
                        lastName: student.studentGuardians[0].guardian?.lastName || '',
                        phone: student.studentGuardians[0].guardian?.phone || '',
                        address: student.studentGuardians[0].guardian?.address || '',
                      } : null,
                      className: student.studentEnrollments?.[0]?.class?.name || '',
                      levelName: '',
                      levelCode: (student as any).schoolLevel?.code || '',
                    }}
                    face={cardFace}
                    identity={identity}
                  />
                  <button onClick={() => setCardFace(cardFace === 'recto' ? 'verso' : 'recto')} className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg shadow-sm">
                    <RotateCw className="w-2.5 h-2.5" />{cardFace === 'recto' ? 'Verso' : 'Recto'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => { try { const blob = await studentsService.downloadIdCardPdf(studentCard.id); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `carte-${student.lastName}.pdf`; document.body.appendChild(a); a.click(); document.body.removeChild(a); } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); } }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"><Download className="w-3.5 h-3.5" /> Télécharger PDF</button>
                  <span className="text-xs text-slate-400">N° {studentCard.cardNumber}</span>
                </div>
              </>
            ) : <EmptyState icon={CreditCard} text="Aucune carte scolaire générée pour cette année" />}
          </div>
        ) : activeTab === 'frais' ? (
          <div className="space-y-4">
            {/* Régime tarifaire */}
            {feeProfile && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Wallet className="w-4 h-4 text-blue-600" /></div>
                <div>
                  <p className="text-[10px] font-bold text-blue-700 uppercase">Régime tarifaire</p>
                  <p className="text-sm font-semibold text-slate-800">{feeProfile.feeRegime?.label || feeProfile.feeRegime?.code || 'Standard'}</p>
                  {feeProfile.justification && <p className="text-[10px] text-slate-500">{feeProfile.justification}</p>}
                </div>
              </div>
            )}
            {financeAccount ? (
              <>
                {/* ⭐ Détail des frais (breakdown) avec montants personnalisés (overrides)
                    Conforme au module Finance > Compte Élève.
                    Affiche chaque ligne de frais avec :
                      - le montant standard (FeeStructure.amount)
                      - le montant personnalisé si un override existe (FeeOverride.customAmount)
                      - un badge "Personnalisé" si override appliqué */}
                {Array.isArray(financeAccount.breakdowns) && financeAccount.breakdowns.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Détail des frais</h4>
                    <div className="space-y-1.5">
                      {financeAccount.breakdowns.map((bd: any, idx: number) => {
                        // ⭐ Chercher s'il existe un override pour ce feeStructure
                        const overrides = Array.isArray(financeAccount.overrides) ? financeAccount.overrides : [];
                        const override = overrides.find((ov: any) =>
                          ov.feeStructureId === bd.feeStructureId || ov.feeStructure?.id === bd.feeStructureId
                        );
                        const standardAmount = Number(bd.feeStructure?.amount ?? bd.amount ?? 0);
                        const personalizedAmount = override ? Number(override.customAmount) : null;
                        const effectiveAmount = personalizedAmount !== null ? personalizedAmount : standardAmount;
                        const hasOverride = override != null;
                        return (
                          <div key={bd.id || idx} className={`flex items-center gap-3 p-2.5 rounded-lg border ${hasOverride ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                            <div className={`p-1.5 rounded ${hasOverride ? 'bg-amber-100' : 'bg-blue-100'}`}>
                              <Wallet className={`w-3.5 h-3.5 ${hasOverride ? 'text-amber-600' : 'text-blue-600'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-800 truncate">
                                {bd.feeStructure?.label || bd.feeStructure?.name || `Frais #${bd.feeStructureId?.slice(0, 8) || idx + 1}`}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {bd.feeStructure?.feeCategory || bd.feeStructure?.category || '—'}
                                {hasOverride && override?.reason && ` · ${override.reason}`}
                              </p>
                            </div>
                            <div className="text-right">
                              {hasOverride && (
                                <p className="text-[10px] text-slate-400 line-through">{formatMoney(standardAmount)}</p>
                              )}
                              <p className={`text-xs font-bold ${hasOverride ? 'text-amber-700' : 'text-slate-700'}`}>
                                {formatMoney(effectiveAmount)}
                              </p>
                            </div>
                            {hasOverride && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 whitespace-nowrap">
                                Personnalisé
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Résumé financier */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <FinanceCard label="Total dû" value={formatMoney(financeAccount.totalDue)} color="text-slate-800" />
                  <FinanceCard label="Payé" value={formatMoney(financeAccount.totalPaid)} color="text-emerald-600" />
                  <FinanceCard label="Arriérés" value={formatMoney(financeAccount.arrearsAmount)} color="text-rose-600" />
                  <FinanceCard label="Solde" value={formatMoney(financeAccount.balance)} color={financeAccount.balance > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                </div>
                {payments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Historique des transactions</h4>
                    <div className="space-y-1.5">
                      {payments.map(pay => (
                        <div key={pay.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                          <div className="p-1.5 bg-emerald-100 rounded"><Wallet className="w-3.5 h-3.5 text-emerald-600" /></div>
                          <div className="flex-1"><p className="text-xs font-medium text-slate-700">{formatMoney(pay.amount)}</p><p className="text-[10px] text-slate-400">{new Date(pay.transactionDate || pay.createdAt).toLocaleDateString('fr-FR')} · {pay.paymentMethod || '—'}</p></div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{pay.status || 'COMPLETED'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <EmptyState icon={Wallet} text="Aucun compte financier trouvé pour cette année" />}
          </div>
        ) : activeTab === 'medical' ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <HeartPulse className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div><p className="text-sm font-bold text-amber-800">Dossier médical — En cours d'implémentation</p><p className="text-xs text-amber-700 mt-1">Cette section affichera les informations médicales : allergies, vaccinations, contact médecin, traitement en cours, régime alimentaire.</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center"><HeartPulse className="w-6 h-6 text-slate-300 mx-auto mb-2" /><p className="text-xs font-semibold text-slate-500">Allergies</p><p className="text-[10px] text-slate-400 mt-1">Bientôt disponible</p></div>
              <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center"><Activity className="w-6 h-6 text-slate-300 mx-auto mb-2" /><p className="text-xs font-semibold text-slate-500">Vaccinations</p><p className="text-[10px] text-slate-400 mt-1">Bientôt disponible</p></div>
            </div>
          </div>
        ) : activeTab === 'bulletins' ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div><p className="text-sm font-bold text-amber-800">Module Bulletins & Notes — En cours d'implémentation</p><p className="text-xs text-amber-700 mt-1">Cette section affichera les bulletins par année et trimestre.</p></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map(t => (
                <div key={t} className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center"><BookOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" /><p className="text-xs font-semibold text-slate-500">{t} {academicYear?.name || ''}</p><p className="text-[10px] text-slate-400 mt-1">Bientôt disponible</p></div>
              ))}
            </div>
          </div>
        ) : activeTab === 'admin' ? (
          /* ⭐ Onglet Informations administratives (MODULE ELEVES.md §9) */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informations administratives</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Numéro de dossier</p>
                <p className="text-sm text-slate-800 font-mono">{student.studentCode || student.matricule || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Statut administratif</p>
                <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border', (STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE).color)}>{(STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE).label}</span>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Régime scolaire</p>
                <p className="text-sm text-slate-800">{student.regimeType === 'TEACHER_CHILD' ? 'Enfant enseignant' : student.regimeType === 'SCHOLARSHIP' ? 'Boursier' : student.regimeType === 'SPECIAL' ? 'Spécial' : 'Normal'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Boursier</p>
                <p className="text-sm text-slate-800">{student.regimeType === 'SCHOLARSHIP' ? 'Oui' : 'Non'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">NPI</p>
                <p className="text-sm text-slate-800 font-mono">{student.npi || 'Non renseigné'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Source du dossier</p>
                <p className="text-sm text-slate-800">{student.matricule ? 'Admission' : 'Création directe'}</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'orion' ? (
          /* ⭐ Onglet Alertes ORION — en cours d'implémentation.
           *    Le composant OrionAlertsTab est conservé en arrière-plan
           *    (commenté) pour pouvoir le réactiver plus tard.
           */
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-blue-50 rounded-full mb-3">
              <AlertTriangle className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 mb-1">En cours d'implémentation</h3>
            <p className="text-xs text-slate-500 max-w-md">
              Les alertes ORION pour ce dossier élève seront bientôt disponibles.
              Cette fonctionnalité est en cours de développement.
            </p>
          </div>
          /* OrionAlertsTab conservé pour réactivation future :
          <OrionAlertsTab studentId={student.id} academicYearId={academicYear?.id} />
          */
        ) : null}
      </div>

      {/* ⭐ Modal de visualisation de document */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}

// ─── Carte scolaire (rendu React, pas iframe) ───

function CardPreview({ student, card, face }: { student: StudentIdentity; card: any; face: 'recto' | 'verso'; }) {
  const s = student;
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200 flex flex-col" style={{ aspectRatio: '85.6 / 53.98' }}>
        <div className="flex items-center px-2 py-1.5 shrink-0" style={{ background: NAVY, color: '#fff' }}>
          <div className="w-8 h-8 rounded bg-white flex items-center justify-center font-bold" style={{ color: NAVY, fontSize: '10px' }}>AH</div>
          <div className="flex-1 text-center px-2 min-w-0">
            <div className="font-bold text-[7px] uppercase tracking-wide leading-tight break-words" style={{ wordBreak: 'break-word' }}>Établissement Scolaire</div>
            <div className="text-[5px] italic opacity-80 leading-tight">Excellence • Discipline • Travail</div>
          </div>
          <div className="w-8 shrink-0" />
        </div>
        <div className="flex flex-1 p-2 gap-2 min-h-0">
          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded border-2 overflow-hidden flex items-center justify-center" style={{ borderColor: NAVY, background: '#f3f4f6' }}>
              {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[7px] text-slate-400">PHOTO</span>}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Matricule</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.matricule || card.cardNumber}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>N° Carte</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{card.cardNumber}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Nom</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.lastName}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Prénom</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.firstName}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Parent</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.studentGuardians?.[0]?.guardian ? `${s.studentGuardians[0].guardian.firstName} ${s.studentGuardians[0].guardian.lastName}` : '—'}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Classe</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.studentEnrollments?.[0]?.class?.name || '—'}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Urgence</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.studentGuardians?.[0]?.guardian?.phone || '—'}</span></div>
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1 shrink-0" style={{ background: NAVY, color: '#fff' }}>
          <span className="text-[5px] opacity-90 truncate">Academia Helm</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200 flex flex-col" style={{ aspectRatio: '85.6 / 53.98' }}>
      <div className="flex items-center justify-between px-2 py-1.5 shrink-0" style={{ background: NAVY, color: '#fff' }}>
        <span className="text-[7px] font-bold uppercase tracking-wide">Conditions</span>
        <div className="text-right text-[5px] leading-tight"><div>Émise le : {formatDate(card.generatedAt)}</div><div>Expire le : {formatDate(card.validUntil)}</div></div>
      </div>
      <div className="flex flex-1 p-2 gap-2 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <ul className="text-[4px] text-slate-500 space-y-0.5 list-disc pl-2 mb-1">
            <li>Cette carte est strictement personnelle et incessible.</li>
            <li>À présenter à toute demande du personnel autorisé.</li>
            <li>Signaler toute perte ou vol à l'administration.</li>
          </ul>
        </div>
        <div className="flex flex-col items-center justify-between gap-1 shrink-0" style={{ width: '52px' }}>
          <div className="w-10 h-10 border border-slate-300 rounded bg-white flex items-center justify-center p-0.5">
            <div className="grid grid-cols-6 grid-rows-6 gap-px w-full h-full">{Array.from({ length: 36 }).map((_, i) => <div key={i} className={cn(((i * 7 + 3) % 5 < 3) ? 'bg-black' : 'bg-white')} />)}</div>
          </div>
          <div className="text-center"><div className="text-[6px] italic" style={{ color: NAVY, fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div><div className="text-[3px] text-slate-400">Signature</div></div>
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-1 shrink-0" style={{ background: NAVY, color: '#fff' }}>
        <span className="text-[5px] font-bold truncate">Établissement Scolaire</span>
        <span className="text-[5px] opacity-90 shrink-0">Academia Helm</span>
      </div>
    </div>
  );
}

// ─── Helpers ───

function InfoCard({ icon: Icon, label, value, mono, color }: { icon: any; label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
      <div className="flex items-center gap-1.5 mb-1"><Icon className="w-3 h-3 text-slate-400" /><p className="text-[10px] font-bold text-slate-400 uppercase">{label}</p></div>
      <p className={cn('text-sm font-medium', mono && 'font-mono', color || 'text-slate-700')}>{value}</p>
    </div>
  );
}

function FinanceCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
      <p className={cn('text-sm font-bold', color)}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-10 h-10 text-slate-300 mb-2" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}

// ============================================================================
// ⭐ OrionAlertsTab — Remplace l'ancien calcul local ORION par un appel API
//    backend (GET /api/students/orion/student/:studentId/alerts).
//
//    Avantages :
//      - Alertes cohérentes avec le tableau de bord tenant-wide ORION
//      - Reco actionnable pour chaque alerte
//      - 8 catégories : MATRICULE, STATUS, IDENTITY (NPI), PHOTO, GUARDIAN,
//        CARD, ENROLLMENT (+ sous-catégories)
//      - Support de academicYearId pour filtrer les alertes carte/inscription
//
//    Sévérités : CRITICAL > HIGH > MEDIUM > LOW
// ============================================================================
interface OrionAlert {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  description: string;
  recommendation?: string;
}

function OrionAlertsTab({ studentId, academicYearId }: { studentId: string; academicYearId?: string }) {
  const [alerts, setAlerts] = useState<OrionAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    const url = `/api/students/orion/student/${encodeURIComponent(studentId)}/alerts` +
      (academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : '');
    fetch(url, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Erreur lors du chargement des alertes');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [studentId, academicYearId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Alertes ORION — Dossier Élève
        </h3>
        <div className="flex items-center gap-2 text-slate-500 py-8">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm">Chargement des alertes depuis le backend…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Alertes ORION — Dossier Élève
        </h3>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-800">Erreur de chargement</p>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Alertes ORION — Dossier Élève
      </h3>

      {alerts.length === 0 ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">Dossier complet</p>
            <p className="text-xs text-emerald-700">Aucune alerte détectée par ORION. Le dossier de l'élève est conforme à toutes les règles d'identification.</p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {alerts.length} alerte{alerts.length > 1 ? 's' : ''} détectée{alerts.length > 1 ? 's' : ''} par ORION — données fournies par le backend.
          </p>
          {alerts.map((alert, i) => {
            const colorClasses = alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
              ? 'bg-rose-50 border-rose-200'
              : alert.severity === 'MEDIUM'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-blue-50 border-blue-200';
            const iconColor = alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
              ? 'text-rose-600'
              : alert.severity === 'MEDIUM'
              ? 'text-amber-600'
              : 'text-blue-600';
            const labelColor = alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
              ? 'text-rose-700'
              : alert.severity === 'MEDIUM'
              ? 'text-amber-700'
              : 'text-blue-700';
            return (
              <div key={i} className={cn('rounded-lg p-3 border', colorClasses)}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5', iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[9px] font-bold uppercase tracking-wider', labelColor)}>
                        {alert.severity}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
                        {alert.category}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{alert.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{alert.description}</p>
                    {alert.recommendation && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-start gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Reco :</span>
                        <p className="text-xs text-slate-700 italic">{alert.recommendation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
