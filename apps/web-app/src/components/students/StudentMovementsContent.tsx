'use client';

/**
 * ============================================================================
 * SORTIES & ABANDONS — Sorties internes, abandons, archivage, réintégrations
 * ============================================================================
 *
 * Selon MODULE ELEVES.md — Onglet 7
 * Fonctionnalités :
 *   - Stats : sorties, abandons, archivés (calculées APRÈS filtre)
 *   - Liste des élèves (actifs + archivés/retirés)
 *   - Filtres : recherche, statut, niveau scolaire, classe, année
 *   - Action : Retirer un élève (abandon/sortie définitive, avec motif)
 *   - Action : Archiver un élève (fin d'année)
 *   - Action : Réintégrer un élève
 *
 * ⭐ Les transferts inter-écoles sont gérés EXCLUSIVEMENT dans l'onglet
 * « Transferts & Mobilité » (StudentTransferContent) qui offre un workflow
 * complet : demande, approbation, confirmation sortie, exécution, notification.
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  History, LogOut, UserMinus, Search, Loader2,
  ArrowRightLeft, RotateCcw, Archive, Users, Filter,
  ChevronLeft, ChevronRight, MoreHorizontal,
  // ⭐ P1.5 — Icônes pour les nouveaux statuts
  Ban, UserX, GraduationCap, Clock,
  // ⭐ Boutons PDF abandons
  FileDown,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStudents, useEnrollments } from '@/lib/query/student-queries';
import { useQueryClient } from '@tanstack/react-query';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  studentCode?: string;
  status: string;
  isActive: boolean;
  gender?: string | null;
  photoUrl?: string | null;
  updatedAt?: string;
  schoolLevelId?: string;
  dateOfBirth?: string | null;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
}

interface Enrollment {
  id: string;
  student: Student;
  class?: { id: string; name: string };
  status: string;
}

interface AcademicYearInfo {
  id: string;
  name: string;
  label?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: LogOut },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: Archive },
  TRANSFERRED: { label: 'Transféré', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: ArrowRightLeft },
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Users },
  // ⭐ P1.5 — Statuts manquants qui tombaient avant sur le fallback "Actif" (trompeur)
  EXCLUDED: { label: 'Exclu', color: 'bg-red-100 text-red-800 border-red-300', icon: Ban },
  INACTIVE: { label: 'Inactif', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: UserX },
  GRADUATED: { label: 'Diplômé', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: GraduationCap },
  PENDING: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
};

// ⭐ Composant Pagination réutilisable
// Affiche : « 1-50 sur 94 » + boutons Précédent/Suivant + numéros de page
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

  // Calculer la plage affichée (ex: 1-50 sur 94, 51-94 sur 94)
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  // Générer la liste des numéros de page à afficher
  // On affiche toujours la 1ère, la dernière, la courante, et 1 autour de la courante
  // Les pages éloignées sont remplacées par "…"
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
        {/* Bouton Précédent */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Précédent
        </button>

        {/* Numéros de page */}
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

        {/* Bouton Suivant */}
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

// Composant Avatar réutilisable : photo si dispo, sinon initiales
function StudentAvatar({ student, size = 'md' }: { student: Student; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  };
  const cls = sizes[size];
  if (student.photoUrl) {
    return (
      <img
        src={student.photoUrl}
        alt={`${student.firstName} ${student.lastName}`}
        className={cn(cls, 'rounded-full object-cover shrink-0 border border-slate-200')}
      />
    );
  }
  return (
    <div className={cn(
      cls,
      'rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0',
    )}>
      {student.lastName?.[0] || '?'}{student.firstName?.[0] || ''}
    </div>
  );
}

export default function StudentMovementsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  // ⭐ Nouveaux filtres : niveau, classe, année (modifiables, pas figés au contexte)
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterYearId, setFilterYearId] = useState<string>('');

  // ⭐ Pagination : page courante + total + totalPages
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0, page: 1, limit: 50, totalPages: 1,
  });
  const PAGE_SIZE = 50;

  // ⭐ Stats globales (vrai chiffre) : chargées séparément SANS pagination
  // (limit=200 pour récupérer tous les élèves et calculer les vraies stats)
  const [globalStats, setGlobalStats] = useState({
    total: 0, active: 0, withdrawn: 0, archived: 0, transferred: 0,
  });

  const [actionStudent, setActionStudent] = useState<Student | null>(null);
  const [actionType, setActionType] = useState<'archive' | 'withdraw' | 'reactivate' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Transfert inter-écoles
  const [transferSearchQuery, setTransferSearchQuery] = useState('');
  const [allSchools, setAllSchools] = useState<any[]>([]);
  const [transferSelectedSchool, setTransferSelectedSchool] = useState<any | null>(null);
  const [transferExternalSchoolName, setTransferExternalSchoolName] = useState('');
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  // L'année sélectionnée = filtreYearId si défini, sinon année du contexte
  const effectiveYearId = filterYearId || academicYear?.id || '';

  useEffect(() => {
    // Charger les années scolaires une fois
    fetch('/api/academic-years', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setAcademicYears(Array.isArray(data) ? data : []))
      .catch(() => setAcademicYears([]));
  }, []);

  // Charger les classes
  // ⭐ FIX : passer academicYearId pour récupérer les classes de l'année
  //    sélectionnée (et non l'année active par défaut).
  // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : l'effet se REJOUE quand
  //    l'année du contexte change — avant, deps `[]` figeaient l'année au
  //    montage (closure stale) : les classes ne suivaient pas le sélecteur.
  useEffect(() => {
    fetch(`/api/all-classes${academicYear?.id ? `?academicYearId=${encodeURIComponent(academicYear.id)}` : ''}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setClasses(Array.isArray(data) ? data : []))
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  // ⭐ Bug fix : reset currentPage à 1 quand n'importe quel filtre change.
  // Sans ça, on reste bloqué sur une page potentiellement vide (ex: page 3 avec
  // un nouveau filtre qui ne retourne qu'1 page de résultats).
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterLevelId, filterClassId, searchQuery]);

  // ⭐ FIX : utilise React Query (useStudents + useEnrollments) au lieu de fetch manuel.
  const studentsQuery = useStudents({
    academicYearId: effectiveYearId,
    page: currentPage,
    limit: PAGE_SIZE,
    schoolLevelId: filterLevelId || undefined,
    classId: filterClassId || undefined,
    status: filterStatus !== 'ALL' ? filterStatus : undefined,
    search: searchQuery.trim() || undefined,
  });
  const enrollmentsQuery = useEnrollments(effectiveYearId);
  const queryClient = useQueryClient();

  // Synchronisation React Query → state local
  useEffect(() => {
    if (!effectiveYearId) return;
    const sd = studentsQuery.data;
    if (sd) {
      setStudents(sd.data || []);
      setPagination({
        total: sd.total || 0, page: sd.page || 1,
        limit: sd.limit || PAGE_SIZE, totalPages: sd.totalPages || 1,
      });
    }
    setEnrollments(enrollmentsQuery.data || []);
    setIsLoading(studentsQuery.isLoading || enrollmentsQuery.isLoading);
  }, [studentsQuery.data, enrollmentsQuery.data, studentsQuery.isLoading, enrollmentsQuery.isLoading, effectiveYearId]);

  // ⭐ Stats globales (inchangé — utilise loadGlobalStats)
  useEffect(() => {
    if (effectiveYearId) loadGlobalStats();
  }, [effectiveYearId, filterLevelId, filterClassId, filterYearId, schoolLevel?.id]);

  const loadData = () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['enrollments', effectiveYearId] });
  };

  /**
   * ⭐ Bug fix : utilise le vrai endpoint /api/students/statistics qui fait des
   * count() SQL par statut. L'ancien code fetchait 200 élèves (limit=200) et
   * comptait côté client → stats fausses dès qu'on dépassait 200 élèves.
   *
   * Le backend retourne : { total, active, preRegistered, admitted, pending,
   * archived, withdrawn, byStatus: [{status, _count}], ... }.
   * On calcule `transferred` depuis byStatus (non retourné directement).
   */
  const loadGlobalStats = async () => {
    if (!effectiveYearId) return;
    try {
      const stats = await studentsService.getStatistics(
        effectiveYearId,
        filterLevelId || schoolLevel?.id || 'ALL',
      );
      // Calculer transferred depuis byStatus (le backend ne le retourne pas directement)
      const byStatus: Array<{ status: string; _count: number }> = Array.isArray(stats?.byStatus) ? stats.byStatus : [];
      const transferred = byStatus.find(s => s.status === 'TRANSFERRED')?._count ?? 0;
      setGlobalStats({
        total: stats?.total ?? 0,
        active: stats?.active ?? 0,
        withdrawn: stats?.withdrawn ?? 0,
        archived: stats?.archived ?? 0,
        transferred,
      });
    } catch (e) {
      console.warn('Failed to load global stats:', e);
    }
  };

  // Construire un map studentId → classId pour filtrer par classe
  const studentClassMap = useMemo(() => {
    const m = new Map<string, string>();
    enrollments.forEach(e => {
      if (e.class?.id) m.set(e.student.id, e.class.id);
    });
    return m;
  }, [enrollments]);

  // Niveaux uniques (extrait des classes)
  const levels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code?: string }>();
    classes.forEach(c => {
      if (c.schoolLevelId && !map.has(c.schoolLevelId)) {
        map.set(c.schoolLevelId, {
          id: c.schoolLevelId,
          name: c.schoolLevel?.name || c.schoolLevel?.code || 'Niveau',
          code: c.schoolLevel?.code,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [classes]);

  // Classes filtrées par niveau sélectionné
  const filteredClasses = useMemo(() => {
    if (!filterLevelId) return classes;
    return classes.filter(c => c.schoolLevelId === filterLevelId);
  }, [classes, filterLevelId]);

  // ⭐ Bug fix : suppression du filtrage client. Le backend applique déjà tous
  // les filtres (status, schoolLevelId, classId, search) en SQL — refiltrer
  // côté client cassait la pagination (les élèves hors-page étaient exclus).
  // On conserve juste le tri alphabétique pour l'affichage.
  const filteredStudents = useMemo(() => {
    return [...students].sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`),
    );
  }, [students]);

  // ⭐ Stats GLOBALES (vrai chiffre) — proviennent de globalStats (tous les élèves)
  // PAS de filteredStudents.length qui ne reflète que la page courante.
  // On garde quand même un compteur "affichés sur cette page" pour la transparence.
  const stats = globalStats;

  const handleAction = async () => {
    if (!actionStudent || !actionType || !effectiveYearId) return;
    setIsProcessing(true);
    try {
      if (actionType === 'archive') {
        // ⭐ P1.4 — Envoyer le reason + ne pas avaler l'erreur
        await apiFetch(`/students/${actionStudent.id}/archive`, {
          method: 'POST',
          body: { reason: actionReason || 'Archive demandée' },
        });
        toast({ title: '✅ Élève archivé', description: `${actionStudent.firstName} ${actionStudent.lastName}`, variant: 'success' });
      } else if (actionType === 'withdraw') {
        await studentsService.withdrawStudent({
          studentId: actionStudent.id,
          academicYearId: effectiveYearId,
          exitReason: actionReason || 'Abandon',
        });
        toast({ title: '✅ Élève retiré', description: `${actionStudent.firstName} ${actionStudent.lastName} a été marqué comme abandon.`, variant: 'success' });
      } else if (actionType === 'reactivate') {
        await studentsService.reintegrateStudent({
          studentId: actionStudent.id,
          academicYearId: effectiveYearId,
          schoolLevelId: schoolLevel?.id || actionStudent.schoolLevelId || '',
        });
        toast({ title: '✅ Élève réintégré', description: `${actionStudent.firstName} ${actionStudent.lastName} est de nouveau actif.`, variant: 'success' });
      }
      // Fermer le modal
      setActionStudent(null);
      setActionType(null);
      setActionReason('');
      setTransferSelectedSchool(null);
      setTransferExternalSchoolName('');
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Action échouée', variant: 'error' });
      // ⭐ Fermer le modal même en cas d'erreur (l'action a peut-être partiellement réussi)
      setActionStudent(null);
      setActionType(null);
      setActionReason('');
      setTransferSelectedSchool(null);
      setTransferExternalSchoolName('');
    } finally {
      // ⭐ TOUJOURS recharger les données, même en cas d'erreur.
      // Ceci garantit que le tableau et les stats reflètent l'état réel
      // de la base, même si l'action a partiellement réussi (ex: élève
      // mis à ACTIVE mais erreur sur l'inscription).
      setIsProcessing(false);
      loadData();
      loadGlobalStats();
    }
  };

  const openAction = (student: Student, type: 'archive' | 'withdraw' | 'reactivate') => {
    setActionStudent(student);
    setActionType(type);
    setActionReason('');
    setTransferSelectedSchool(null);
    setTransferExternalSchoolName('');
    setTransferSearchQuery('');
    if (type === 'transfer') {
      loadAllSchools();
    }
  };

  const loadAllSchools = async () => {
    if (allSchools.length > 0) return;
    setIsLoadingSchools(true);
    try {
      const res = await fetch('/api/public/schools/list', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const schools = Array.isArray(data) ? data : (data?.schools || []);
        setAllSchools(schools);
      }
    } catch {
      setAllSchools([]);
    } finally {
      setIsLoadingSchools(false);
    }
  };

  const filteredSchools = useMemo(() => {
    if (!transferSearchQuery.trim()) return allSchools;
    const q = transferSearchQuery.toLowerCase();
    return allSchools.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.subdomain || '').toLowerCase().includes(q) ||
      (s.slug || '').toLowerCase().includes(q)
    );
  }, [allSchools, transferSearchQuery]);

  const resetFilters = () => {
    setFilterStatus('ALL');
    setFilterLevelId('');
    setFilterClassId('');
    setFilterYearId('');
    setSearchQuery('');
  };

  // ⭐ État pour les exports PDF abandons
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ⭐ PDF Abandons par classe — génère le PDF des abandons de la classe sélectionnée
  // dans le filtre. Utilise l'endpoint class-list/:classId/pdf avec status=WITHDRAWN.
  const handleExportClassPdf = async () => {
    if (!filterClassId || !effectiveYearId) {
      toast({ title: 'Sélection requise', description: 'Veuillez sélectionner une classe dans le filtre.', variant: 'error' });
      return;
    }
    setIsExportingPdf(true);
    try {
      const { url, fileName } = await studentsService.generateClassListPdf(
        filterClassId,
        effectiveYearId,
        'physical',
        'WITHDRAWN',
      );
      // Télécharger le PDF
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `abandons_${filterClassId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Nettoyer la blob URL après un court délai
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ PDF généré', description: 'Liste des abandons de la classe téléchargée.', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur PDF', description: e.message || 'Génération échouée', variant: 'error' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ⭐ PDF Abandons global — génère un PDF par niveau (MATERNELLE, PRIMAIRE, SECONDAIRE)
  // contenant tous les abandons de chaque classe du niveau. Utilise l'endpoint
  // export/all-classes-pdf avec status=WITHDRAWN. Si un niveau est sélectionné dans
  // le filtre, génère uniquement ce niveau. Sinon, génère tous les niveaux.
  const handleExportGlobalPdf = async () => {
    if (!effectiveYearId) return;
    setIsExportingPdf(true);
    try {
      // Si un niveau est sélectionné, générer uniquement ce niveau
      const levelsToExport = filterLevelId
        ? levels.filter(l => l.id === filterLevelId)
        : levels;

      if (levelsToExport.length === 0) {
        toast({ title: 'Aucun niveau', description: 'Aucun niveau scolaire disponible pour l\'export.', variant: 'error' });
        return;
      }

      for (const level of levelsToExport) {
        // L'endpoint exportAllClassesPdf attend un code (MATERNELLE/PRIMAIRE/SECONDAIRE)
        // On récupère le code depuis le schoolLevel
        const levelCode = level.code || level.name?.toUpperCase() || '';
        if (!levelCode) continue;
        await studentsService.exportAllClassesPdf(effectiveYearId, levelCode, 'WITHDRAWN');
      }
      toast({ title: '✅ PDF générés', description: `${levelsToExport.length} PDF d'abandons téléchargé(s).`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur PDF', description: e.message || 'Génération échouée', variant: 'error' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats — calculées sur la liste filtrée */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'bg-slate-50 text-slate-600' },
          { label: 'Actifs', value: stats.active, icon: Users, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Retirés', value: stats.withdrawn, icon: LogOut, color: 'bg-rose-50 text-rose-600' },
          { label: 'Archivés', value: stats.archived, icon: Archive, color: 'bg-amber-50 text-amber-600' },
          { label: 'Transférés', value: stats.transferred, icon: ArrowRightLeft, color: 'bg-blue-50 text-blue-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className={cn('p-2 rounded-lg', stat.color)}><stat.icon className="w-4 h-4" /></div>
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{stat.label}</p>
              <p className="text-base font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar — filtres enrichis */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase">
            <Filter className="w-3.5 h-3.5" /> Filtres
          </div>
          {/* Recherche */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          {/* Filtre statut */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="WITHDRAWN">Retirés</option>
            <option value="ARCHIVED">Archivés</option>
            <option value="TRANSFERRED">Transférés</option>
          </select>
          {/* Filtre année */}
          <select
            value={filterYearId}
            onChange={(e) => setFilterYearId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Année scolaire"
          >
            <option value="">Année : {academicYear?.name || '—'}</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name || y.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Filtre niveau */}
          <select
            value={filterLevelId}
            onChange={(e) => { setFilterLevelId(e.target.value); setFilterClassId(''); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Niveau scolaire"
          >
            <option value="">Tous les niveaux</option>
            {levels.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {/* Filtre classe */}
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Classe"
            disabled={!filterLevelId && filteredClasses.length === 0}
          >
            <option value="">Toutes les classes</option>
            {filteredClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {/* Bouton reset */}
          {(filterStatus !== 'ALL' || filterLevelId || filterClassId || filterYearId || searchQuery) && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition"
            >
              ✕ Réinitialiser
            </button>
          )}
          {/* ⭐ Boutons PDF Abandons */}
          <div className="flex items-center gap-2 ml-auto">
            {/* PDF par classe — visible uniquement quand une classe est sélectionnée */}
            {filterClassId && (
              <button
                onClick={handleExportClassPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition disabled:opacity-50"
                title="Générer le PDF des abandons de la classe sélectionnée"
              >
                {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                PDF Abandons (classe)
              </button>
            )}
            {/* PDF Global — génère un PDF par niveau */}
            <button
              onClick={handleExportGlobalPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition disabled:opacity-50"
              title="Générer le PDF global des abandons (toutes classes, par niveau)"
            >
              {isExportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              PDF Abandons (global)
            </button>
            <div className="text-xs text-slate-400">
              {pagination.total} élève(s) · page {pagination.page}/{pagination.totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Liste des élèves */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Aucun élève trouvé avec ces filtres</p>
          </div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Élève</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Classe</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE;
                  const Icon = statusInfo.icon;
                  const studentClassId = studentClassMap.get(student.id);
                  const studentClass = classes.find(c => c.id === studentClassId);
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <StudentAvatar student={student} size="md" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{student.lastName.toUpperCase()} {student.firstName}</p>
                            {student.dateOfBirth && (
                              <p className="text-[10px] text-slate-400">
                                Né(e) le {new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{student.matricule || student.studentCode || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {studentClass ? (
                          <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                            {studentClass.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Non affecté</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', statusInfo.color)}>
                          <Icon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {student.status === 'ACTIVE' && student.isActive && (
                            <>
                              <button
                                onClick={() => openAction(student, 'withdraw')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition"
                                title="Retirer l'élève (sortie définitive)"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Retirer
                              </button>
                              {/* ⭐ Le transfert inter-écoles est désormais géré exclusivement
                                  dans l'onglet « Transferts & Mobilité ». Cet onglet ne gère
                                  que les sorties internes (retraits, abandons, archivage, réintégration). */}
                              <button
                                onClick={() => openAction(student, 'archive')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                                title="Archiver (fin d'année)"
                              >
                                <Archive className="w-3.5 h-3.5" /> Archiver
                              </button>
                            </>
                          )}
                          {(student.status === 'WITHDRAWN' || student.status === 'ARCHIVED') && (
                            <button
                              onClick={() => openAction(student, 'reactivate')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                              title="Réintégrer l'élève"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Réintégrer
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ⭐ Composant Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={(page) => setCurrentPage(page)}
          isLoading={isLoading}
        />
      )}

      {/* Modal d'action */}
      {actionStudent && actionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActionStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {actionType === 'archive' && 'Archiver l\'élève'}
                {actionType === 'withdraw' && 'Retirer l\'élève'}
                {actionType === 'reactivate' && 'Réintégrer l\'élève'}
                {actionType === 'transfer' && 'Transférer l\'élève'}
              </h3>
              <div className="flex items-center gap-2 mt-2">
                <StudentAvatar student={actionStudent} size="sm" />
                <p className="text-sm text-slate-600">
                  {actionStudent.firstName} {actionStudent.lastName}
                  {actionStudent.matricule && ` · ${actionStudent.matricule}`}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {(actionType === 'archive' || actionType === 'withdraw') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {actionType === 'withdraw' ? 'Motif du retrait' : 'Motif de l\'archivage'}
                  </label>
                  <textarea
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    rows={3}
                    placeholder={actionType === 'withdraw' ? 'Ex : Déménagement, changement d\'école...' : 'Ex : Fin d\'année scolaire...'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}

              {actionType === 'transfer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      École de destination (sur Academia Helm)
                    </label>
                    <input
                      type="text"
                      value={transferSearchQuery}
                      onChange={(e) => setTransferSearchQuery(e.target.value)}
                      placeholder="Rechercher une école..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    />
                    {isLoadingSchools ? (
                      <p className="text-xs text-slate-400 py-3 text-center">Chargement des écoles...</p>
                    ) : filteredSchools.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                        {filteredSchools.map(school => (
                          <button
                            key={school.id}
                            onClick={() => {
                              setTransferSelectedSchool(school);
                              setTransferExternalSchoolName('');
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition border-b border-slate-50 last:border-b-0',
                              transferSelectedSchool?.id === school.id && 'bg-blue-50 font-semibold text-blue-700',
                            )}
                          >
                            <span>{school.name}</span>
                            {school.subdomain && (
                              <span className="text-xs text-slate-400 ml-2">{school.subdomain}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-2">
                        {allSchools.length === 0 ? 'Aucune école trouvée.' : 'Aucune école ne correspond à votre recherche.'}
                      </p>
                    )}
                    {transferSelectedSchool && (
                      <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-xs text-blue-700">
                          ✅ École sélectionnée : <strong>{transferSelectedSchool.name}</strong>
                        </p>
                        <p className="text-[10px] text-blue-600 mt-1">
                          L'élève gardera son matricule global et recevra un nouveau matricule local dans cette école.
                        </p>
                      </div>
                    )}
                  </div>

                  {!transferSelectedSchool && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Ou nom de l'école (si non sur Academia Helm)
                      </label>
                      <input
                        type="text"
                        value={transferExternalSchoolName}
                        onChange={(e) => setTransferExternalSchoolName(e.target.value)}
                        placeholder="Ex : École Saint-Joseph de Parakou"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        Si l'école n'est pas sur Academia Helm, seul un enregistrement administratif sera effectué.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Motif du transfert (optionnel)
                    </label>
                    <textarea
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      rows={2}
                      placeholder="Ex : Déménagement, meilleur environnement..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              )}
              {actionType === 'reactivate' && (
                <p className="text-sm text-slate-600">
                  L'élève sera réintégré avec le statut <strong>ACTIF</strong>. Il retrouvera l'accès à tous les services.
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setActionStudent(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'transfer' && !transferSelectedSchool && !transferExternalSchoolName.trim())}
                className={cn(
                  'px-4 py-2 text-sm font-bold text-white rounded-lg transition disabled:opacity-50',
                  actionType === 'reactivate' ? 'bg-emerald-600 hover:bg-emerald-700'
                  : actionType === 'transfer' ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-rose-600 hover:bg-rose-700'
                )}
              >
                {isProcessing ? 'Traitement...' : actionType === 'transfer' ? 'Transférer' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
