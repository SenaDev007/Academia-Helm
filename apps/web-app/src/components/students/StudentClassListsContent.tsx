'use client';

/**
 * ============================================================================
 * STUDENT CLASS LISTS CONTENT — Onglet « Liste des Élèves »
 * ============================================================================
 *
 * Affiche les élèves par classe PHYSIQUE (Class, table `classes`).
 * C'est le complément de l'onglet « Inscriptions » qui affiche les élèves par
 * classe OFFICIELLE (AcademicClass).
 *
 * Différences avec EnrollmentsContent :
 *   - Ici on groupe par `StudentEnrollment.classId` (classe physique, ex: CE1-A).
 *   - Le PDF généré utilise `mode='physical'` — une feuille par section physique.
 *   - Onglet allégé : juste l'arborescence + recherche + PDF, sans gestion d'inscriptions.
 *
 * Inscriptions vs Liste des élèves :
 *   - Inscriptions : « quelle classe officielle l'élève a-t-il intégrée ? » (admission)
 *   - Liste des élèves : « dans quelle section physique l'élève est-il assis ? » (affectation)
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Users, Loader2,
  FileText, BookOpen, Baby, GraduationCap, AlertCircle,
  FileDown, FileSpreadsheet, Upload, Zap,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentPreviewModal from './DocumentPreviewModal';
import ImportElevesModal from './ImportElevesModal';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import ResponsiveTableWrapper from '@/components/ui/tables/ResponsiveTableWrapper';
import { cn } from '@/lib/utils';
import { useAllClasses, useEnrollments, useInvalidateStudentsData } from '@/lib/query/student-queries';

// ⭐ FIX 2026-11-16 (1.0.15, retour promoteur) — LISTE OFFICIELLE des élèves :
//    seuls les élèves ACTIFS et ADMIS figurent dans cet onglet (avec les
//    variantes actives RE_ENROLLED / PROMOTED / ENROLLED / VALIDATED).
//    Les élèves retirés pour ABANDON (WITHDRAWN), transférés, exclus ou
//    sortis en fin d'année n'apparaissent PLUS ici — ils restent
//    consultables dans l'onglet dédié « Sorties & Abandons ».
//    (Miroir front de OFFICIAL_LIST_ENROLLMENT_STATUSES côté backend,
//    common/constants/official-list-statuses.ts — utilisée par les exports
//    Excel/PDF et les templates Educ Master pour la même règle.)
const OFFICIAL_LIST_ENROLLMENT_STATUSES = [
  'ACTIVE',
  'ADMITTED',
  'RE_ENROLLED',
  'PROMOTED',
  'ENROLLED',
  'VALIDATED',
] as const;

const isOfficiallyEnrolled = (e: Enrollment) =>
  (OFFICIAL_LIST_ENROLLMENT_STATUSES as readonly string[]).includes(e.status);

interface Enrollment {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string | null;
    studentCode?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    photoUrl?: string | null;
  };
  class?: { id: string; name: string; schoolLevelId?: string };
  /** ⭐ Classe officielle (AcademicClass) — fournie par GET /students/enrollments.
   *  Utilisée pour afficher la classe officielle des élèves non affectés. */
  academicClass?: { id: string; name: string } | null;
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
  officialClass?: { id: string; name: string } | null;
  capacity?: number | null;
  mainTeacher?: { id: string; firstName: string; lastName: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  RE_ENROLLED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
  TRANSFERRED: 'bg-slate-50 text-slate-600 border-slate-200',
  WITHDRAWN: 'bg-rose-50 text-rose-700 border-rose-200',
};

const getLevelIcon = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return <Baby className="w-5 h-5 text-pink-600" />;
  if (n.includes('PRIMAIRE')) return <BookOpen className="w-5 h-5 text-blue-600" />;
  if (n.includes('SECONDAIRE')) return <GraduationCap className="w-5 h-5 text-purple-600" />;
  return <BookOpen className="w-5 h-5 text-slate-600" />;
};

const getLevelBgColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'bg-pink-50';
  if (n.includes('PRIMAIRE')) return 'bg-blue-50';
  if (n.includes('SECONDAIRE')) return 'bg-purple-50';
  return 'bg-slate-50';
};

const getLevelBadgeColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'bg-pink-50 text-pink-700';
  if (n.includes('PRIMAIRE')) return 'bg-blue-50 text-blue-700';
  if (n.includes('SECONDAIRE')) return 'bg-purple-50 text-purple-700';
  return 'bg-slate-50 text-slate-700';
};

const getLevelHoverColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'hover:bg-pink-50/40';
  if (n.includes('PRIMAIRE')) return 'hover:bg-blue-50/40';
  if (n.includes('SECONDAIRE')) return 'hover:bg-purple-50/40';
  return 'hover:bg-slate-50/40';
};

const getLevelButtonHover = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'hover:bg-pink-100 hover:text-pink-600';
  if (n.includes('PRIMAIRE')) return 'hover:bg-blue-100 hover:text-blue-600';
  if (n.includes('SECONDAIRE')) return 'hover:bg-purple-100 hover:text-purple-600';
  return 'hover:bg-slate-100 hover:text-slate-600';
};

const getLevelGeneratedColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'text-pink-600';
  if (n.includes('PRIMAIRE')) return 'text-blue-600';
  if (n.includes('SECONDAIRE')) return 'text-purple-600';
  return 'text-emerald-600';
};

const getLevelDisplayName = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'Maternelle';
  if (n.includes('PRIMAIRE')) return 'Primaire';
  if (n.includes('SECONDAIRE')) return 'Secondaire';
  return name;
};

export default function StudentClassListsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  // ⭐ Section « Non affectés » (élèves sans classe physique) — ouverte par défaut
  // pour attirer l'attention de l'admin sur les affectations manquantes.
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);

  // Tracking de la génération PDF par classe
  const [pdfGeneratingClassId, setPdfGeneratingClassId] = useState<string | null>(null);
  const [pdfExistsClasses, setPdfExistsClasses] = useState<Set<string>>(new Set());
  const [previewClassPdf, setPreviewClassPdf] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  // ⭐ Export Excel par classe physique + exports globaux
  const [excelGeneratingClassId, setExcelGeneratingClassId] = useState<string | null>(null);
  const [isGlobalExcelExporting, setIsGlobalExcelExporting] = useState(false);
  const [isGlobalPdfExporting, setIsGlobalPdfExporting] = useState(false);
  const [bulkSetupLoading, setBulkSetupLoading] = useState(false);
  // ⭐ Import en masse (même modal que l'onglet Inscriptions)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // ⭐ React Query — cache partagé, pas de re-fetch au remontage
  const allClassesQuery = useAllClasses(academicYear?.id);
  const enrollmentsQuery = useEnrollments(academicYear?.id);
  // ⭐ FIX 2026-09-23 : invalidation de TOUTE la famille du module Élèves
  //    (helper partagé) — pas seulement les clés de cet onglet. Après une
  //    affectation/réaffectation, les autres vues (Inscriptions, Élèves…)
  //    se rafraîchissent aussi au lieu de servir leur cache périmé.
  const invalidateStudentsData = useInvalidateStudentsData();

  // Synchronisation React Query → state local
  useEffect(() => {
    setClasses(allClassesQuery.data || []);
    setEnrollments(enrollmentsQuery.data || []);
    setIsLoading(allClassesQuery.isLoading || enrollmentsQuery.isLoading);
  }, [allClassesQuery.data, enrollmentsQuery.data, allClassesQuery.isLoading, enrollmentsQuery.isLoading]);

  // ⭐ FIX 2026-11-16 (1.0.15) : inscriptions de la LISTE OFFICIELLE uniquement
  //    (actifs + admis). Les abandons/transferts/exclusions/sorties sont filtrés
  //    en amont de l'arborescence ET des compteurs — l'onglet « Sorties &
  //    Abandons » reste la vue dédiée pour les retrouver.
  const officialEnrollments = useMemo(
    () => enrollments.filter(isOfficiallyEnrolled),
    [enrollments],
  );

  const loadData = async () => {
    invalidateStudentsData();
  };

  // Vérifier quels PDFs existent déjà (mode physique)
  useEffect(() => {
    if (!academicYear || classes.length === 0) return;
    const checkAll = async () => {
      const results = await Promise.all(
        classes.map(async (cls) => {
          try {
            const res = await studentsService.checkClassListPdfExists(cls.id, academicYear.id, 'physical');
            return res.exists ? cls.id : null;
          } catch { return null; }
        }),
      );
      setPdfExistsClasses(new Set(results.filter(Boolean) as string[]));
    };
    checkAll();
  }, [academicYear, classes]);

  // ─── Arborescence niveau → classe physique → élèves ──────────────────
  const treeData = useMemo(() => {
    const levelMap = new Map<string, { id: string; name: string }>();
    for (const cls of classes) {
      const levelId = cls.schoolLevelId;
      if (!levelMap.has(levelId)) {
        const levelName = cls.schoolLevel?.name || cls.schoolLevel?.code || '';
        if (levelName) levelMap.set(levelId, { id: levelId, name: levelName });
      }
    }

    const classesByLevel = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      if (!classesByLevel.has(cls.schoolLevelId)) classesByLevel.set(cls.schoolLevelId, []);
      classesByLevel.get(cls.schoolLevelId)!.push(cls);
    }

    // ⭐ Grouper par classe PHYSIQUE (classId) — LISTE OFFICIELLE uniquement
    const enrollmentsByClass = new Map<string, Enrollment[]>();
    for (const enr of officialEnrollments) {
      const classId = enr.class?.id || 'unassigned';
      if (!enrollmentsByClass.has(classId)) enrollmentsByClass.set(classId, []);
      enrollmentsByClass.get(classId)!.push(enr);
    }
    for (const [, list] of enrollmentsByClass) {
      list.sort((a, b) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`));
    }

    const levelOrder = (name: string) => {
      const n = name.toUpperCase();
      if (n.includes('MATERNELLE')) return 0;
      if (n.includes('PRIMAIRE')) return 1;
      if (n.includes('SECONDAIRE')) return 2;
      return 3;
    };

    const classOrder = (name: string): number => {
      const n = (name || '').trim().toUpperCase();
      if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
      if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
      if (n === 'CI') return 10;
      if (n === 'CP') return 11;
      if (n === 'CE1') return 12;
      if (n === 'CE2') return 13;
      if (n === 'CM1') return 14;
      if (n === 'CM2') return 15;
      if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
      if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
      if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
      if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
      if (n === '2NDE') return 24;
      if (n === '1ERE' || n === '1ÈRE') return 25;
      if (n === 'TERMINALE' || n === 'TLE') return 26;
      return 100 + name.charCodeAt(0);
    };

    return Array.from(levelMap.values())
      .sort((a, b) => levelOrder(a.name) - levelOrder(b.name))
      .map(level => {
        const levelClasses = (classesByLevel.get(level.id) || []).sort((a, b) => classOrder(a.name) - classOrder(b.name));
        // ⭐ Compteur = élèves OFFICIELS du niveau (abandons/exclus filtrés)
        const levelEnrollments = officialEnrollments.filter(e => {
          const cls = classes.find(c => c.id === e.class?.id);
          return cls?.schoolLevelId === level.id;
        });
        return {
          level,
          classes: levelClasses.map(cls => ({
            classInfo: cls,
            students: enrollmentsByClass.get(cls.id) || [],
          })),
          totalStudents: levelEnrollments.length,
        };
      });
  }, [classes, officialEnrollments]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const q = searchQuery.toLowerCase();
    return treeData.map(node => ({
      ...node,
      classes: node.classes.map(c => ({
        ...c,
        students: c.students.filter(s =>
          `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(q) ||
          (s.student.matricule || '').toLowerCase().includes(q)
        ),
      })),
    }));
  }, [treeData, searchQuery]);

  // ⭐ FIX 2026-09-06 — Anomalie « élèves CP absents de la Liste des élèves » :
  // les inscriptions créées avec une classe OFFICIELLE (academicClassId) mais sans
  // classe PHYSIQUE (classId null) ne peuvent pas être rattachées à une section
  // ci-dessus. Avant ce correctif, elles étaient silencieusement INVISIBLES dans
  // cet onglet (cas des 22 élèves CP de CSPEB). On les regroupe désormais dans une
  // section dédiée « Non affectés » afin que l'école puisse les affecter via
  // l'onglet Affectations & Mouvements.
  const unassignedStudents = useMemo(() => {
    const knownClassIds = new Set(classes.map(c => c.id));
    // ⭐ FIX 2026-11-16 (1.0.15) : mêmes règles que l'arborescence — uniquement
    //    les élèves OFFICIELS (actifs + admis) ; les abandons ne doivent plus
    //    apparaître dans la liste officielle (onglet dédié « Sorties & Abandons »).
    const list = officialEnrollments.filter(e =>
      (!e.class?.id || !knownClassIds.has(e.class.id)) &&
      isOfficiallyEnrolled(e),
    );
    list.sort((a, b) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(
      `${b.student.lastName} ${b.student.firstName}`));
    return list;
  }, [classes, officialEnrollments]);

  const filteredUnassigned = useMemo(() => {
    if (!searchQuery.trim()) return unassignedStudents;
    const q = searchQuery.toLowerCase();
    return unassignedStudents.filter(s =>
      `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(q) ||
      (s.student.matricule || '').toLowerCase().includes(q)
    );
  }, [unassignedStudents, searchQuery]);

  const toggleLevel = (id: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleClass = (id: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Stats globales ──────────────────────────────────────────────────
  const totalStudents = useMemo(() => enrollments.length, [enrollments]);
  const totalClasses = useMemo(() => classes.length, [classes]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-slate-500">Chargement des listes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — white card cohérent avec les autres onglets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Liste des Élèves par Classe</h2>
              <p className="text-xs text-slate-500">
                Listes par section physique (CE1-A, CE1-B...). Le PDF regroupe les élèves affectés à chaque section.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">{totalClasses} classe{totalClasses > 1 ? 's' : ''}</span>
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">{totalStudents} élève{totalStudents > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Barre de recherche + boutons globaux */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève par nom ou matricule..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
          {/* ⭐ Bouton Excel global — TOUTES les sections physiques, une feuille par section */}
          <button
            onClick={async () => {
              if (!academicYear) return;
              setIsGlobalExcelExporting(true);
              try {
                await studentsService.exportGlobalPhysicalExcel(academicYear.id);
                toast({ title: '✅ Excel global généré', description: 'Toutes les sections', variant: 'success' });
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message, variant: 'error' });
              } finally {
                setIsGlobalExcelExporting(false);
              }
            }}
            disabled={isGlobalExcelExporting || isGlobalPdfExporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition disabled:opacity-50 whitespace-nowrap"
            title="Excel global — toutes les sections dans un seul fichier (une feuille par section)"
          >
            {isGlobalExcelExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {isGlobalExcelExporting ? '...' : 'Excel global'}
          </button>
          {/* ⭐ Bouton PDF global — TOUTES les sections physiques, page-break par section */}
          <button
            onClick={async () => {
              if (!academicYear) return;
              setIsGlobalPdfExporting(true);
              try {
                await studentsService.exportGlobalPhysicalPdf(academicYear.id);
                toast({ title: '✅ PDF global généré', description: 'Toutes les sections', variant: 'success' });
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message, variant: 'error' });
              } finally {
                setIsGlobalPdfExporting(false);
              }
            }}
            disabled={isGlobalExcelExporting || isGlobalPdfExporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-300 transition disabled:opacity-50 whitespace-nowrap"
            title="PDF global — toutes les sections dans un seul PDF (page-break par section)"
          >
            {isGlobalPdfExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {isGlobalPdfExporting ? '...' : 'PDF global'}
          </button>
          {/* ⭐ V3-12: Import button removed — use the Inscriptions tab for importing students */}
          {/* ⭐ Bouton Génération en masse — matricule + compte financier + admission */}
          <button
            onClick={async () => {
              if (!academicYear?.id) return;
              if (!confirm('Générer les matricules, comptes financiers et admissions pour TOUS les élèves sans matricule ? Cela peut prendre quelques minutes.')) return;
              setBulkSetupLoading(true);
              try {
                const res = await fetch('/api/students/bulk-setup', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ academicYearId: academicYear.id }),
                });
                const data = await res.json();
                if (res.ok) {
                  // ⭐ P3.2 — Remplacer alert() par toast() pour cohérence UI
                  toast({
                    title: '✅ Génération terminée',
                    description: `${data.matriculeGenerated} matricule(s) · ${data.accountsCreated} compte(s) financier(s) · ${data.enrollmentsUpdated} admission(s) traitée(s)${data.matriculeFailed > 0 ? ` · ${data.matriculeFailed} échec(s) matricule` : ''}${data.accountsFailed > 0 ? ` · ${data.accountsFailed} échec(s) compte` : ''}`,
                    variant: 'success',
                  });
                  // ⭐ P3.2 — Recharger sans window.location.reload() pour préserver l'état UI
                  loadData();
                } else {
                  toast({
                    title: '❌ Erreur',
                    description: data.message || data.error || 'Erreur inconnue',
                    variant: 'error',
                  });
                }
              } catch (e: any) {
                toast({
                  title: '❌ Erreur réseau',
                  description: e?.message || 'Erreur inconnue',
                  variant: 'error',
                });
              } finally {
                setBulkSetupLoading(false);
              }
            }}
            disabled={bulkSetupLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-300 transition whitespace-nowrap disabled:opacity-50"
            title="Générer en masse les matricules, comptes financiers et admissions pour les élèves qui n'en ont pas"
          >
            {bulkSetupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {bulkSetupLoading ? 'Génération...' : 'Générer matricules'}
          </button>
        </div>
      </div>

      {/* Arborescence */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredTree.length === 0 ? (
          <div className="py-20 text-center">
            <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Aucune classe physique trouvée pour ce contexte.</p>
            <p className="text-slate-400 text-xs mt-1">
              Les sections physiques sont créées dans l'onglet « Affectations &amp; Mouvements » à partir des classes officielles.
            </p>
          </div>
        ) : (
          filteredTree.map((node) => {
            const isExpanded = expandedLevels.has(node.level.id);
            const levelName = node.level.name;
            return (
              <div key={node.level.id}>
                <button
                  onClick={() => toggleLevel(node.level.id)}
                  className={cn('w-full flex items-center gap-3 px-5 py-4 transition-colors text-left group', getLevelHoverColor(levelName))}
                >
                  <div className="shrink-0">
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600" /> : <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />}
                  </div>
                  <div className={cn('p-2.5 rounded-lg shrink-0', getLevelBgColor(levelName))}>{getLevelIcon(levelName)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-slate-800">{getLevelDisplayName(levelName)}</p>
                    <p className="text-xs text-slate-500">{node.classes.length} classe{node.classes.length > 1 ? 's' : ''} · {node.totalStudents} élève{node.totalStudents > 1 ? 's' : ''}</p>
                  </div>
                  <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-bold text-slate-600 shrink-0">{node.totalStudents}</span>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      {node.classes.length === 0 ? (
                        <p className="px-5 py-3 text-xs text-slate-400 italic pl-14">Aucune classe</p>
                      ) : (
                        <div className="divide-y divide-slate-50">
                          {node.classes.map(({ classInfo, students }) => {
                            const isClassExpanded = expandedClasses.has(classInfo.id);
                            const filteredStudents = searchQuery.trim()
                              ? students.filter(s => `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(searchQuery.toLowerCase()) || (s.student.matricule || '').toLowerCase().includes(searchQuery.toLowerCase()))
                              : students;
                            return (
                              <div key={classInfo.id}>
                                <div className={cn('w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left group', getLevelHoverColor(levelName))}>
                                  <button
                                    onClick={() => toggleClass(classInfo.id)}
                                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                    aria-label={`Basculer la classe ${classInfo.name}`}
                                  >
                                    <div className="shrink-0 pl-6">
                                      {isClassExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                                    </div>
                                    <div className="p-1.5 bg-slate-100 rounded-lg shrink-0"><Users className="w-4 h-4 text-slate-500" /></div>
                                    <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{classInfo.name}</span>
                                    {(classInfo as any).officialClass?.name && (
                                      <span className="text-[10px] text-slate-400 italic">↳ {(classInfo as any).officialClass.name}</span>
                                    )}
                                    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0', getLevelBadgeColor(levelName))}>{filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}</span>
                                  </button>
                                  {/* Bouton Générer PDF — mode physique */}
                                  <button
                                    onClick={() => {
                                      if (!academicYear) return;
                                      setPdfGeneratingClassId(classInfo.id);
                                      studentsService.generateAndStoreClassListPdf(classInfo.id, academicYear.id, 'physical')
                                        .then(() => {
                                          setPdfExistsClasses(prev => new Set(prev).add(classInfo.id));
                                          toast({ title: '✅ PDF généré et enregistré', description: classInfo.name, variant: 'success' });
                                        })
                                        .catch(err => toast({ title: 'Erreur PDF', description: err.message, variant: 'error' }))
                                        .finally(() => setPdfGeneratingClassId(null));
                                    }}
                                    disabled={pdfGeneratingClassId === classInfo.id}
                                    className={cn(
                                      'p-1.5 rounded-lg transition shrink-0',
                                      pdfGeneratingClassId === classInfo.id
                                        ? 'bg-blue-100 text-blue-600 cursor-wait'
                                        : cn('text-slate-400', getLevelButtonHover(levelName)),
                                    )}
                                    title="Générer la liste de classe (PDF)"
                                  >
                                    {pdfGeneratingClassId === classInfo.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : pdfExistsClasses.has(classInfo.id)
                                        ? <FileDown className={cn('w-3.5 h-3.5', getLevelGeneratedColor(levelName))} />
                                        : <FileDown className="w-3.5 h-3.5" />}
                                  </button>
                                  {/* Bouton Visualiser */}
                                  <button
                                    onClick={async () => {
                                      if (!academicYear) return;
                                      setPdfGeneratingClassId(classInfo.id);
                                      try {
                                        const { url, fileName } = await studentsService.getStoredClassListPdf(classInfo.id, academicYear.id, 'physical');
                                        setPreviewClassPdf({ filePath: url, fileName, mimeType: 'application/pdf' });
                                      } catch (err: any) {
                                        toast({ title: '⚠️ Aucun PDF', description: 'Générez d\'abord le document', variant: 'info' });
                                      } finally {
                                        setPdfGeneratingClassId(null);
                                      }
                                    }}
                                    disabled={pdfGeneratingClassId === classInfo.id || !pdfExistsClasses.has(classInfo.id)}
                                    className={cn(
                                      'p-1.5 rounded-lg transition shrink-0',
                                      pdfExistsClasses.has(classInfo.id)
                                        ? cn('text-slate-400', getLevelButtonHover(levelName))
                                        : 'text-slate-300 cursor-not-allowed',
                                    )}
                                    title={pdfExistsClasses.has(classInfo.id) ? 'Visualiser la liste de classe' : 'Générez d\'abord le PDF'}
                                  >
                                    {pdfGeneratingClassId === classInfo.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <FileText className="w-3.5 h-3.5" />}
                                  </button>
                                  {/* ⭐ Bouton Excel — génère un fichier Excel pour cette section physique */}
                                  <button
                                    onClick={async () => {
                                      if (!academicYear) return;
                                      setExcelGeneratingClassId(classInfo.id);
                                      try {
                                        await studentsService.exportPhysicalClassExcel(academicYear.id, classInfo.id, classInfo.name);
                                        toast({ title: '✅ Excel généré', description: classInfo.name, variant: 'success' });
                                      } catch (e: any) {
                                        toast({ title: 'Erreur Excel', description: e.message, variant: 'error' });
                                      } finally {
                                        setExcelGeneratingClassId(null);
                                      }
                                    }}
                                    disabled={excelGeneratingClassId === classInfo.id}
                                    className={cn(
                                      'p-1.5 rounded-lg transition shrink-0',
                                      excelGeneratingClassId === classInfo.id
                                        ? 'bg-green-100 text-green-600 cursor-wait'
                                        : 'text-slate-400 hover:bg-green-100 hover:text-green-600',
                                    )}
                                    title="Générer le fichier Excel de cette section"
                                  >
                                    {excelGeneratingClassId === classInfo.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <FileSpreadsheet className="w-3.5 h-3.5" />}
                                  </button>
                                </div>

                                {/* Liste des élèves de la classe */}
                                <AnimatePresence>
                                  {isClassExpanded && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                      {filteredStudents.length === 0 ? (
                                        <p className="px-5 py-3 text-xs text-slate-400 italic pl-14">Aucun élève affecté à cette section.</p>
                                      ) : (
                                        <ResponsiveTableWrapper>
                                        <table className="w-full text-xs">
                                          <thead className="bg-slate-50/60">
                                            <tr>
                                              <th className="px-14 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">N°</th>
                                              <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Nom et Prénom(s)</th>
                                              <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Matricule</th>
                                              <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Sexe</th>
                                              <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-50">
                                            {filteredStudents.map((s, i) => (
                                              <tr key={s.id} className="hover:bg-blue-50/30 transition-colors">
                                                <td className="px-14 py-2 text-slate-400">{i + 1}</td>
                                                <td className="px-2 py-2 font-semibold text-slate-700">
                                                  {s.student.lastName.toUpperCase()} {s.student.firstName}
                                                </td>
                                                <td className="px-2 py-2 font-mono text-slate-500">{s.student.matricule || s.student.studentCode || '—'}</td>
                                                <td className="px-2 py-2 text-slate-500">{s.student.gender === 'M' ? 'M' : s.student.gender === 'F' ? 'F' : '—'}</td>
                                                <td className="px-2 py-2">
                                                  <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border', STATUS_COLORS[s.status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                                                    {s.status}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                        </ResponsiveTableWrapper>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* ⭐ FIX 2026-09-06 — Section « Non affectés à une classe physique » : */}
      {/* inscrits avec une classe officielle (ex : CP) mais sans section physique. */}
      {filteredUnassigned.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setIsUnassignedExpanded(prev => !prev)}
            className="w-full flex items-center gap-3 px-5 py-4 transition-colors text-left group hover:bg-amber-50"
          >
            <div className="shrink-0">
              {isUnassignedExpanded
                ? <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />
                : <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-amber-600" />}
            </div>
            <div className="p-2.5 rounded-lg shrink-0 bg-amber-50">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-800">Non affectés à une classe physique</p>
              <p className="text-xs text-slate-500">
                {filteredUnassigned.length} élève{filteredUnassigned.length > 1 ? 's' : ''} inscrit{filteredUnassigned.length > 1 ? 's' : ''} en classe officielle mais sans section physique — affectez-le{filteredUnassigned.length > 1 ? 's' : ''} via l'onglet « Affectations &amp; Mouvements »
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-50 rounded-full text-sm font-bold text-amber-600 shrink-0">{filteredUnassigned.length}</span>
          </button>

          <AnimatePresence>
            {isUnassignedExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <ResponsiveTableWrapper>
                  <table className="w-full text-xs">
                    <thead className="bg-amber-50/60">
                      <tr>
                        <th className="px-14 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">N°</th>
                        <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Nom et Prénom(s)</th>
                        <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Matricule</th>
                        <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Classe officielle</th>
                        <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Sexe</th>
                        <th className="px-2 py-2 text-left font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredUnassigned.map((s, i) => (
                        <tr key={s.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-14 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-2 py-2 font-semibold text-slate-700">
                            {s.student.lastName.toUpperCase()} {s.student.firstName}
                          </td>
                          <td className="px-2 py-2 font-mono text-slate-500">{s.student.matricule || s.student.studentCode || '—'}</td>
                          <td className="px-2 py-2 text-slate-500">{s.academicClass?.name || '—'}</td>
                          <td className="px-2 py-2 text-slate-500">{s.student.gender === 'M' ? 'M' : s.student.gender === 'F' ? 'F' : '—'}</td>
                          <td className="px-2 py-2">
                            <span className={cn('inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border', STATUS_COLORS[s.status] || 'bg-slate-50 text-slate-600 border-slate-200')}>
                              {s.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTableWrapper>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Modal de visualisation PDF */}
      {previewClassPdf && (
        <DocumentPreviewModal
          doc={{
            filePath: previewClassPdf.filePath,
            fileName: previewClassPdf.fileName,
            mimeType: previewClassPdf.mimeType,
          }}
          onClose={() => {
            if (previewClassPdf?.filePath.startsWith('blob:')) {
              URL.revokeObjectURL(previewClassPdf.filePath);
            }
            setPreviewClassPdf(null);
          }}
        />
      )}

      {/* ⭐ Modal d'import en masse — même modal que l'onglet Inscriptions */}
      <ImportElevesModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // Recharger la liste des élèves après import
          window.location.reload();
        }}
      />
    </div>
  );
}
