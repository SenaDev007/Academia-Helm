'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  User, Shield, Users, Mail, Phone, FileCheck, AlertCircle,
  Search, Loader2, Download, Eye, X, CreditCard, FileText,
  History, BookOpen, GraduationCap, Calendar, MapPin, Hash,
  ArrowLeft, HeartPulse, Wallet, Activity, RotateCw,
  ClipboardList, AlertTriangle,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import DocumentPreviewModal from './DocumentPreviewModal';

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
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200' },
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

type DetailTab = 'identite' | 'admin' | 'parents' | 'scolarite' | 'documents' | 'carte' | 'frais' | 'medical' | 'bulletins' | 'observations' | 'orion' | 'audit';

const NAVY = '#0D1F6E';
const LEVEL_ORDER: Record<string, number> = { MATERNELLE: 1, MAT: 1, PRIMAIRE: 2, PRIMARY: 2, SECONDAIRE: 3, SECONDARY: 3 };

function getInitials(s: StudentIdentity) { return `${s.lastName?.[0] || ''}${s.firstName?.[0] || ''}`.toUpperCase(); }
function getAge(dob?: string) { if (!dob) return null; return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)); }
function formatDate(d?: string) { if (!d) return 'N/A'; return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
function formatMoney(amount?: number) { if (amount === null || amount === undefined) return '—'; return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'; }

export default function StudentIdentityContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentIdentity[]>([]);
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentIdentity | null>(null);

  useEffect(() => { if (academicYear) loadData(); }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [studentsData, classesRes] = await Promise.all([
        studentsService.getAll({ academicYearId: academicYear.id, limit: '200' }),
        fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      const allStudents = Array.isArray(studentsData) ? studentsData : (studentsData?.data || []);
      setStudents(allStudents);
      setAllClasses(Array.isArray(classesRes) ? classesRes : []);
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); }
    finally { setIsLoading(false); }
  };

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

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (filterLevelId) {
        const sci = studentClassMap.get(s.id);
        if (!sci || sci.levelId !== filterLevelId) return false;
      }
      if (filterClassId) {
        const sci = studentClassMap.get(s.id);
        if (!sci || sci.id !== filterClassId) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.matricule || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [students, filterLevelId, filterClassId, searchTerm, studentClassMap]);

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
    return <StudentDashboard student={selectedStudent} academicYear={academicYear} onBack={() => setSelectedStudent(null)} />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Shield className="w-5 h-5 text-blue-600" /></div>
          <div><h3 className="font-semibold text-slate-900">Dossiers Élèves</h3><p className="text-xs text-slate-500">{filteredStudents.length} élève(s) · {students.filter(s => s.npi).length} avec NPI</p></div>
        </div>
        <div className="relative w-48 sm:w-64">
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
    </div>
  );
}

// ─── Dashboard élève plein écran ───

function StudentDashboard({ student, academicYear, onBack }: { student: StudentIdentity; academicYear: any; onBack: () => void; }) {
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

      // ⭐ Compte financier + transactions + fee profile (régime)
      try {
        const accounts = await financeService.getStudentAccounts({ studentId, academicYearId: academicYear?.id });
        const account = Array.isArray(accounts) ? accounts[0] : (accounts?.data?.[0] || accounts);
        setFinanceAccount(account);
        if (account?.id) {
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
    { id: 'observations', label: 'Observations', icon: FileText },
    { id: 'orion', label: 'Alertes ORION', icon: AlertTriangle },
    { id: 'audit', label: 'Audit', icon: Shield },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"><ArrowLeft className="w-3.5 h-3.5" /> Retour</button>
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
            <InfoCard icon={MapPin} label="Adresse" value={student.address || '—'} />
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
                {/* ⭐ Rendu React de la carte (pas d'iframe) */}
                <div className="bg-slate-100 p-4 rounded-xl relative w-full max-w-md">
                  <CardPreview student={student} card={studentCard} face={cardFace} />
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
            <div className="grid grid-cols-2 gap-4">
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
        ) : activeTab === 'observations' ? (
          /* ⭐ Onglet Observations (MODULE ELEVES.md §14) */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Observations</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">Types : administrative, pédagogique, disciplinaire, financière, familiale, générale. Les observations sensibles sont protégées par permission.</p>
            </div>
            {movementHistory && movementHistory.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Historique des mouvements</p>
                {movementHistory.map((m: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-600 uppercase">{m.actionType || m.type || 'Mouvement'}</span>
                      <span className="text-[10px] text-slate-400">{m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '—'}</span>
                    </div>
                    <p className="text-xs text-slate-600">{m.description || m.reason || m.comment || ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm italic">Aucune observation enregistrée.</p>
            )}
          </div>
        ) : activeTab === 'orion' ? (
          /* ⭐ Onglet Alertes ORION (MODULE ELEVES.md §15) */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertes ORION — Dossier Élève
            </h3>
            {(() => {
              const alerts: Array<{ severity: string; message: string }> = [];
              if (!student.matricule) alerts.push({ severity: 'HIGH', message: 'Matricule manquant — l\'élève n\'a pas de matricule attribué.' });
              if (!student.npi) alerts.push({ severity: 'MEDIUM', message: 'NPI non renseigné — numéro d\'identification personnel manquant.' });
              if (!student.photoUrl) alerts.push({ severity: 'LOW', message: 'Aucune photo de l\'élève dans le dossier.' });
              if (student.status !== 'ACTIVE') alerts.push({ severity: 'MEDIUM', message: `Statut non actif : ${student.status}.` });
              if (alerts.length === 0) {
                return (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                    <span className="text-xl">✅</span>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Dossier complet</p>
                      <p className="text-xs text-emerald-700">Aucune alerte détectée par ORION.</p>
                    </div>
                  </div>
                );
              }
              return alerts.map((alert, i) => (
                <div key={i} className={cn('rounded-lg p-3 border flex items-start gap-3',
                  alert.severity === 'HIGH' ? 'bg-rose-50 border-rose-200' :
                  alert.severity === 'MEDIUM' ? 'bg-amber-50 border-amber-200' :
                  'bg-blue-50 border-blue-200'
                )}>
                  <AlertTriangle className={cn('w-4 h-4 shrink-0 mt-0.5',
                    alert.severity === 'HIGH' ? 'text-rose-600' :
                    alert.severity === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'
                  )} />
                  <div>
                    <span className={cn('text-[9px] font-bold uppercase tracking-wider',
                      alert.severity === 'HIGH' ? 'text-rose-700' :
                      alert.severity === 'MEDIUM' ? 'text-amber-700' : 'text-blue-700'
                    )}>{alert.severity}</span>
                    <p className="text-xs text-slate-700 mt-0.5">{alert.message}</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : activeTab === 'audit' ? (
          /* ⭐ Onglet Audit (MODULE ELEVES.md §22) */
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              Audit du dossier
            </h3>
            <p className="text-xs text-slate-400">Traçabilité complète des modifications apportées au dossier de l'élève. Aucune suppression destructive n'est autorisée.</p>
            {movementHistory && movementHistory.length > 0 ? (
              <div className="space-y-2">
                {movementHistory.map((log: any, i: number) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{log.actionType || log.type || 'ACTION'}</span>
                      <span className="text-[10px] text-slate-400">{log.date ? new Date(log.date).toLocaleString('fr-FR') : '—'}</span>
                    </div>
                    {log.userId && <p className="text-[10px] text-slate-400">Par : {log.userId}</p>}
                    {(log.description || log.reason || log.comment) && <p className="text-xs text-slate-600 mt-1">{log.description || log.reason || log.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm italic">Aucune entrée d'audit disponible.</p>
            )}
          </div>
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
