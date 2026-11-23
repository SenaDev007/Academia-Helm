/**
 * ============================================================================
 * ASSIGNMENTS WORKSPACE - MODULE 2 (Affectations & Charges)
 * ============================================================================
 *
 * Architecture 3 couches :
 *   1. Classe officielle (AcademicClass) = CE1, CM2, 6ème…
 *   2. Classe physique (Class/section) = CE1 A, CE1 B…
 *   3. Affectation = TeacherClassAssignment lié à une classe physique
 *
 * ► MATERNELLE / PRIMAIRE : Modèle "Titulaire Unique + Spécialistes itinérants"
 *   - 1 titulaire par SECTION PHYSIQUE (ex: CE1 A, CE1 B)
 *   - Le titulaire gère toutes les matières de sa section, SAUF les matières
 *     « itinérantes » (Anglais, Informatique) dans les écoles NON bilingues :
 *     un professeur spécialiste les assure en parcourant toutes les classes de
 *     la maternelle au CM2, comme au secondaire.
 *     ⭐ 2026-09-13 — écoles CS & Mon Avenir Plus (anglais/informatique simples)
 *
 * ► SECONDAIRE : Modèle "Spécialiste"
 *   - 1 enseignant par matière, par section physique
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, CheckCircle2, AlertCircle, Clock, Plus, X,
  BookOpen, Layers, ChevronRight, UserCheck, UserPlus, Trash2,
  Star, Info, GraduationCap, Replace, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { formatWeeklyDurationWithSuffix } from '@/lib/utils/duration';
import { Button } from '@/components/ui/button';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// --- Types ---

interface AcademicClass {
  id: string;
  name: string;
  code: string;
  level?: { id: string; name: string };
  series?: { id: string; name: string };
  isActive: boolean;
  mainTeacherId?: string | null;
  mainTeacher?: { id: string; firstName: string; lastName: string } | null;
}

interface PhysicalClass {
  id: string;
  name: string;
  code: string;
  officialClassId: string;
  schoolLevelId: string;
  capacity?: number;
}

interface ClassSubject {
  id: string;
  weeklyHours: number;
  coefficient: number;
  subject: { id: string; name: string; code: string; language?: string };
  assignments: { id: string; classId: string | null; teacher: { id: string; firstName: string; lastName: string; matricule: string } }[];
}

interface TeacherProfile {
  id: string;
  teacherId: string;
  maxWeeklyHours: number;
  teacher: { id: string; firstName: string; lastName: string; matricule: string };
  subjectQualifications: { subjectId: string }[];
  levelAuthorizations: { levelId: string }[];
  assignedLanguages?: string[] | null;
}

// ⭐ Sujet du catalogue (GET /api/subjects) — utilisé pour proposer les matières
// itinérantes qui ne sont pas encore au programme de la classe sélectionnée.
interface CatalogSubject {
  id: string;
  name: string;
  code: string;
  abbreviation?: string | null;
  language?: string | null;
  schoolLevelId?: string;
  schoolLevel?: { id: string; name?: string; code?: string; label?: string } | null;
}

const isHomeroomLevel = (levelName?: string): boolean => {
  if (!levelName) return false;
  const n = levelName.toUpperCase();
  return n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM');
};

/**
 * ⭐ 169 — Catégorie de niveau (retour promoteur) : maternel-primaire À
 * PART, secondaire À PART. Sert à borner les enseignants proposés au niveau
 * de la classe sélectionnée — aucun mélange.
 */
const levelCategoryOf = (label?: string): 'MATERNEL_PRIMAIRE' | 'SECONDAIRE' | 'AUTRE' => {
  const n = (label || '').toUpperCase();
  if (n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM')) return 'MATERNEL_PRIMAIRE';
  if (n.includes('SECOND')) return 'SECONDAIRE';
  return 'AUTRE';
};

// ── ⭐ Matières « itinérantes » (Anglais / Informatique) ─────────────────────
// Écoles NON bilingues (maternel/primaire) : un enseignant spécialiste parcourt
// toutes les classes (maternelle → CM2) pour ces matières, exactement comme un
// professeur du secondaire. Détection : code ANG-*/INFO-* (catalogue suggéré),
// avec repli sur le nom exact « Anglais » / « Informatique » (création manuelle).
const ITINERANT_EXACT_NAMES = new Set(['anglais', 'english', 'informatique', 'computer science']);

const isItinerantSubject = (subject?: { name?: string; code?: string } | null): boolean => {
  if (!subject) return false;
  const code = (subject.code || '').toUpperCase().trim();
  if (code.startsWith('ANG-') || code.startsWith('INFO-')) return true;
  return ITINERANT_EXACT_NAMES.has((subject.name || '').toLowerCase().trim());
};

/** Famille de matière itinérante ('anglais' | 'informatique') — apparie les
 *  enregistrements Subject distincts par niveau (ex: ANG-20 maternel ↔ ANG-10 primaire). */
const subjectFamily = (name?: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('anglais') || n.includes('english')) return 'anglais';
  if (n.includes('informatique') || n.includes('computer')) return 'informatique';
  return n.trim();
};

const CANONICAL_CLASS_ORDER = [
  'maternelle 1', 'maternelle 2',
  'ci', 'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  '6eme', '6e', '5eme', '5e', '4eme', '4e', '3eme', '3e',
  '2nde', '1ere', 'terminale',
];
const getClassOrder = (name: string): number => {
  const lower = (name || '').toLowerCase().trim();
  const idx = CANONICAL_CLASS_ORDER.indexOf(lower);
  if (idx >= 0) return idx;
  for (let i = 0; i < CANONICAL_CLASS_ORDER.length; i++) {
    if (lower.startsWith(CANONICAL_CLASS_ORDER[i])) return i;
  }
  return CANONICAL_CLASS_ORDER.length;
};

// --- Component ---

export default function AssignmentsWorkspace() {
  const { academicYear } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();
  const { toast } = useToast();

  // Data
  const [loading, setLoading] = useState(true);
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [physicalClasses, setPhysicalClasses] = useState<PhysicalClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [teachersWithPhotos, setTeachersWithPhotos] = useState<any[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  // Multigrade assignments (pré-remplissage des titulaires)
  const [multigradeAssignments, setMultigradeAssignments] = useState<any[]>([]);

  // Selection — selectedPhysicalClassId is the PRIMARY selection
  const [selectedPhysicalClassId, setSelectedPhysicalClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'none' | 'assign-homeroom' | 'assign-teacher' | 'confirm-remove' | 'assign-itinerant' | 'confirm-remove-itinerant'>('none');
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<ClassSubject | null>(null);
  const [selectedTeacherInModal, setSelectedTeacherInModal] = useState<string | null>(null);
  // ⭐ Spécialistes itinérants (Anglais / Informatique — écoles non bilingues)
  const [activeItinerantSubject, setActiveItinerantSubject] = useState<ClassSubject | null>(null);
  const [itinerantApplyAll, setItinerantApplyAll] = useState(true);
  // ⭐ Catalogue des matières du tenant — pour combler les classes dont le
  //    programme ne contient pas encore la matière itinérante (scénario :
  //    « la matière Anglais existe pour le niveau Maternelle mais n'a jamais
  //    été affectée aux classes Maternelle 1 / Maternelle 2 »).
  const [catalogSubjects, setCatalogSubjects] = useState<CatalogSubject[]>([]);
  const [addingProgramSubjectId, setAddingProgramSubjectId] = useState<string | null>(null);
  // Classes maternel/primaire sans la matière itinérante au programme (modal)
  const [itinerantGaps, setItinerantGaps] = useState<Array<{ officialClass: AcademicClass; candidate: CatalogSubject | null }>>([]);
  const [itinerantGapsLoading, setItinerantGapsLoading] = useState(false);
  const [itinerantAutoAdd, setItinerantAutoAdd] = useState(true);
  // ⭐ 2026-09-29 — Professeur Principal (Secondaire)
  const [mainTeacherModalOpen, setMainTeacherModalOpen] = useState(false);
  const [mainTeacherSaving, setMainTeacherSaving] = useState(false);

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [classesData, teachersData, teachersWithPhotosData, multigradeData, catalogData] = await Promise.all([
        pedagogyFetch<AcademicClass[]>(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYear.id}`),
        pedagogyFetch<TeacherProfile[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYear.id}`),
        pedagogyFetch<any[]>(`/api/teachers`),
        // Charger les affectations multigrade pour pré-remplir les titulaires
        pedagogyFetch<any[]>(`/api/multigrade?academicYearId=${academicYear.id}&isActive=true`).catch(() => []),
        // ⭐ Catalogue des matières (même appel que l'onglet « Matières &
        //    programmes ») — sert à proposer les matières itinérantes
        //    (Anglais / Informatique) absentes du programme des classes.
        pedagogyFetch<CatalogSubject[]>(
          `/api/subjects?academicYearId=${academicYear.id}${isBilingual ? `&language=${currentTrack}` : ''}`
        ).catch(() => []),
      ]);

      const activeClasses = (classesData || []).filter(c => c.isActive !== false);
      setAcademicClasses(activeClasses);
      setTeachers(teachersData || []);
      setTeachersWithPhotos(teachersWithPhotosData || []);
      setMultigradeAssignments(multigradeData || []);
      setCatalogSubjects(Array.isArray(catalogData) ? catalogData : []);

      // ⭐ FIX PERF (2026-09-14) : l'endpoint /sections retourne TOUTES les
      // sections de l'année (avec officialClass inclus) en un seul appel.
      // L'ancien code l'appelait en boucle, UNE FOIS PAR CLASSE OFFICIELLE,
      // séquentiellement (même URL, même payload, N fois) → 10-15 requêtes
      // en cascade → plus de 60 secondes d'attente avant l'affichage.
      // Désormais : 1 seule requête, puis répartition côté client.
      const allPhysicalClasses: PhysicalClass[] = [];
      try {
        const sections = await pedagogyFetch<any[]>(
          `/api/pedagogy/academic-structure/sections?academicYearId=${academicYear.id}`
        );
        if (Array.isArray(sections)) {
          for (const s of sections) {
            const ac = activeClasses.find(c => c.id === s.officialClass?.id);
            if (!ac) continue;
            allPhysicalClasses.push({
              id: s.id,
              name: s.name,
              code: s.code,
              officialClassId: ac.id,
              schoolLevelId: ac.level?.id || '',
              capacity: s.capacity,
            });
          }
        }
      } catch {
        // Si l'endpoint sections échoue, on continue sans sections physiques
      }

      setPhysicalClasses(allPhysicalClasses);

      // Auto-sélectionner la première section physique
      if (allPhysicalClasses.length > 0 && !selectedPhysicalClassId) {
        setSelectedPhysicalClassId(allPhysicalClasses[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  // ⚠ isBilingual/currentTrack sont lus au chargement seulement : le catalogue
  // n'est exploité qu'en école NON bilingue (sinon itinerantActive = false),
  // donc inutile de recharger tout l'espace quand la piste change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Charger les class_subjects quand la classe officielle de la section sélectionnée change
  const selectedPhysicalClass = physicalClasses.find(pc => pc.id === selectedPhysicalClassId);
  const selectedOfficialClass = academicClasses.find(ac => ac.id === selectedPhysicalClass?.officialClassId);
  const isHomeroom = isHomeroomLevel(selectedOfficialClass?.level?.name);

  const loadClassSubjects = useCallback(async () => {
    if (!selectedOfficialClass?.id || !academicYear?.id) return;
    try {
      const data = await pedagogyFetch<ClassSubject[]>(
        `/api/pedagogy/class-subjects/${selectedOfficialClass.id}?academicYearId=${academicYear.id}`
      );
      // Filtrer par langue en mode bilingue
      let filtered = data || [];
      if (isBilingual) {
        filtered = filtered.filter(cs => {
          const lang = (cs.subject?.language || '').toUpperCase();
          if (currentTrack === 'EN') return lang === 'EN';
          if (currentTrack === 'FR') return lang !== 'EN';
          return true;
        });
      }
      setClassSubjects(filtered);
    } catch (e) {
      console.error(e);
      setClassSubjects([]);
    }
  }, [selectedOfficialClass?.id, academicYear?.id, isBilingual, currentTrack]);

  useEffect(() => {
    loadClassSubjects();
  }, [loadClassSubjects]);

  // --- Derived state ---

  // Filtrer les sections physiques par recherche
  const filteredPhysicalClasses = useMemo(() => {
    if (!search) return physicalClasses;
    const s = search.toLowerCase();
    return physicalClasses.filter(pc => {
      const officialName = academicClasses.find(ac => ac.id === pc.officialClassId)?.name || '';
      return pc.name.toLowerCase().includes(s) || officialName.toLowerCase().includes(s);
    });
  }, [physicalClasses, search, academicClasses]);

  // Grouper les sections par classe officielle (avec ordre canonique)
  const groupedSections = useMemo(() => {
    const groups: Record<string, { officialClass: AcademicClass; sections: PhysicalClass[] }> = {};
    for (const pc of filteredPhysicalClasses) {
      const oc = academicClasses.find(ac => ac.id === pc.officialClassId);
      if (!oc) continue;
      if (!groups[oc.id]) groups[oc.id] = { officialClass: oc, sections: [] };
      groups[oc.id].sections.push(pc);
    }
    return Object.values(groups).sort((a, b) => {
      const ao = getClassOrder(a.officialClass.name);
      const bo = getClassOrder(b.officialClass.name);
      return ao - bo;
    });
  }, [filteredPhysicalClasses, academicClasses]);

  // ⭐ Séparation matières régulières / itinérantes (Anglais, Informatique).
  //    Maternel/primaire en école NON bilingue uniquement — sinon tout reste
  //    « régulier » et le comportement historique (titulaire unique) est inchangé.
  const itinerantActive = isHomeroom && !isBilingual;
  const itinerantSubjects = useMemo(
    () => (itinerantActive ? classSubjects.filter(cs => isItinerantSubject(cs.subject)) : []),
    [classSubjects, itinerantActive],
  );
  const regularSubjects = useMemo(
    () => (itinerantActive ? classSubjects.filter(cs => !isItinerantSubject(cs.subject)) : classSubjects),
    [classSubjects, itinerantActive],
  );

  // Titulaire actuel = l'enseignant assigné aux matières RÉGULIÈRES de la section
  // (hors Anglais/Informatique confiés à un spécialiste itinérant — sinon le prof
  // d'anglais risquerait d'apparaître comme titulaire de la section).
  // On accepte les affectations avec le bon classId OU sans classId (anciennes, rétro-compat)
  const currentHomeroom = useMemo(() => {
    if (!isHomeroom || regularSubjects.length === 0 || !selectedPhysicalClassId) return null;
    // Chercher une affectation qui correspond à cette section (classId match OU classId NULL)
    for (const cs of regularSubjects) {
      const assign = (cs.assignments || []).find(a => a.classId === selectedPhysicalClassId || !a.classId);
      if (assign?.teacher) return assign.teacher;
    }
    return null;
  }, [isHomeroom, regularSubjects, selectedPhysicalClassId]);

  const homeroomFullyAssigned = isHomeroom && regularSubjects.length > 0 &&
    regularSubjects.every(cs => (cs.assignments || []).some(a => a.classId === selectedPhysicalClassId || !a.classId));

  // ⭐ 2026-09-29 — Professeur Principal (Secondaire uniquement)
  //    Récupéré depuis mainTeacherId sur AcademicClass.
  const currentMainTeacher = selectedOfficialClass?.mainTeacher || null;

  const saveMainTeacher = async (teacherId: string | null) => {
    if (!selectedOfficialClass?.id) return;
    setMainTeacherSaving(true);
    try {
      const res = await fetch(`/api/pedagogy/academic-structure/classes/${selectedOfficialClass.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mainTeacherId: teacherId }),
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      // Mettre à jour localement
      setAcademicClasses(prev => prev.map(ac =>
        ac.id === selectedOfficialClass.id
          ? { ...ac, mainTeacherId: teacherId, mainTeacher: teacherId ? teachers.find(t => t.teacherId === teacherId)?.teacher || null : null }
          : ac
      ));
      toast({ title: teacherId ? '✅ Professeur principal désigné' : '✅ Professeur principal retiré' });
      setMainTeacherModalOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    } finally {
      setMainTeacherSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ MATIÈRES ITINÉRANTES ABSENTES DU PROGRAMME (2026-09-15)
  // Scénatoire terrain : l'école crée la matière « Anglais » pour le niveau
  // Maternelle dans l'onglet « Matières & programmes » (le Subject existe)
  // MAIS l'affectation matière → classes (class_subjects) n'est jamais faite.
  // Résultat : la carte « spécialiste itinérant » ne s'affiche jamais pour
  // ces classes → IMPOSSIBLE d'affecter l'enseignant d'anglais, sans aucun
  // indice sur la cause. On prévoit ce scénario : on propose d'ajouter la
  // matière au programme DIRECTEMENT depuis cet onglet.
  // ─────────────────────────────────────────────────────────────────────────

  /** Libellé normalisé du niveau d'une matière du catalogue. */
  const catalogSubjectLevel = (s: CatalogSubject): string =>
    `${s.schoolLevel?.name || ''} ${s.schoolLevel?.code || ''} ${s.schoolLevel?.label || ''}`.toUpperCase();

  /** La matière du catalogue est-elle créée pour le niveau de la classe ? */
  const catalogSubjectMatchesClassLevel = (s: CatalogSubject, classLevelName?: string): boolean => {
    const lv = (classLevelName || '').toUpperCase();
    const isMaternel = lv.includes('MATERN');
    const isPrim = lv.includes('PRIMA') || lv.includes('PRIM');
    const sl = catalogSubjectLevel(s);
    if (isMaternel) return sl.includes('MATERN');
    if (isPrim) return sl.includes('PRIMA') || sl.includes('PRIM');
    return true; // niveau indéterminé → pas de filtrage
  };

  /** Matières itinérantes du catalogue (Anglais / Informatique) absentes du
   *  programme de la classe officielle sélectionnée — une proposition par
   *  famille, uniquement si une matière de la famille existe AU BON NIVEAU. */
  const missingItinerantSubjects = useMemo(() => {
    if (!itinerantActive || !selectedOfficialClass) return [];
    const coveredFamilies = new Set(
      classSubjects
        .filter(cs => isItinerantSubject(cs.subject))
        .map(cs => subjectFamily(cs.subject?.name)),
    );
    const out: CatalogSubject[] = [];
    const seen = new Set<string>();
    for (const s of catalogSubjects) {
      if (!isItinerantSubject(s)) continue;
      const fam = subjectFamily(s.name);
      if (coveredFamilies.has(fam) || seen.has(fam)) continue;
      // Une seule proposition par famille : la matière créée pour le niveau de
      // la classe (ex : ANG-20 « Maternelle » pour Maternelle 1). Si aucune
      // matière de la famille n'existe à ce niveau, on ne propose rien —
      // l'école doit d'abord la créer dans « Matières & programmes ».
      if (!catalogSubjectMatchesClassLevel(s, selectedOfficialClass.level?.name)) continue;
      seen.add(fam);
      out.push(s);
    }
    return out;
  }, [itinerantActive, selectedOfficialClass, classSubjects, catalogSubjects]);

  /** Retrouve, dans le catalogue, la matière itinérante d'une famille pour le
   *  niveau d'une classe (repli : primaire/maternelle, jamais secondaire). */
  const findCatalogItinerantSubject = useCallback((family: string, classLevelName?: string): CatalogSubject | null => {
    const candidates = catalogSubjects.filter(
      s => isItinerantSubject(s) && subjectFamily(s.name) === family,
    );
    if (candidates.length === 0) return null;
    const byLevel = candidates.find(s => catalogSubjectMatchesClassLevel(s, classLevelName));
    if (byLevel) return byLevel;
    return candidates.find(s => {
      const sl = catalogSubjectLevel(s);
      return sl.includes('PRIMA') || sl.includes('PRIM') || sl.includes('MATERN');
    }) || null;
  }, [catalogSubjects]);

  /** Classes maternel/primaire dont le programme ne contient PAS la matière
   *  itinérante active (avec, pour chacune, la matière candidate du catalogue
   *  à ajouter). Utilisé par le modal « Affecter un spécialiste ». */
  const computeItinerantGaps = useCallback(async (): Promise<Array<{ officialClass: AcademicClass; candidate: CatalogSubject | null }>> => {
    if (!academicYear?.id || !activeItinerantSubject?.subject) return [];
    const family = subjectFamily(activeItinerantSubject.subject.name);
    if (!family) return [];
    const homeroomClasses = academicClasses.filter(ac => isHomeroomLevel(ac.level?.name) && ac.isActive !== false);
    const gaps: Array<{ officialClass: AcademicClass; candidate: CatalogSubject | null }> = [];
    for (const oc of homeroomClasses) {
      let subjectsOfClass: ClassSubject[];
      if (oc.id === selectedOfficialClass?.id) {
        subjectsOfClass = classSubjects;
      } else {
        try {
          subjectsOfClass = (await pedagogyFetch<ClassSubject[]>(
            `/api/pedagogy/class-subjects/${oc.id}?academicYearId=${academicYear.id}`,
          )) || [];
        } catch {
          subjectsOfClass = [];
        }
      }
      const hasIt = subjectsOfClass.some(cs =>
        cs.subject?.id === activeItinerantSubject.subject?.id
        || (isItinerantSubject(cs.subject) && subjectFamily(cs.subject?.name) === family),
      );
      if (!hasIt) {
        gaps.push({ officialClass: oc, candidate: findCatalogItinerantSubject(family, oc.level?.name) });
      }
    }
    return gaps;
  }, [academicClasses, academicYear?.id, selectedOfficialClass?.id, classSubjects, activeItinerantSubject, findCatalogItinerantSubject]);

  // Calculer les classes sans la matière quand le modal s'ouvre (portée « toutes
  // les classes » uniquement). Annulé si le modal se referme.
  useEffect(() => {
    if (modal !== 'assign-itinerant' || !itinerantApplyAll) {
      setItinerantGaps([]);
      return;
    }
    let cancelled = false;
    setItinerantGapsLoading(true);
    computeItinerantGaps()
      .then(gaps => { if (!cancelled) setItinerantGaps(gaps); })
      .catch(() => { if (!cancelled) setItinerantGaps([]); })
      .finally(() => { if (!cancelled) setItinerantGapsLoading(false); });
    return () => { cancelled = true; };
  }, [modal, itinerantApplyAll, computeItinerantGaps]);

  /** Ajouter une matière itinérante du catalogue au programme de la classe
   *  officielle sélectionnée (2 h/semaine, coefficient 1 — modifiable ensuite
   *  dans l'onglet « Matières & programmes »). */
  const handleAddItinerantToProgram = async (subject: CatalogSubject) => {
    if (!academicYear?.id || !selectedOfficialClass?.id) return;
    setAddingProgramSubjectId(subject.id);
    try {
      await pedagogyFetch(`/api/pedagogy/class-subjects`, {
        method: 'POST',
        body: {
          classId: selectedOfficialClass.id,
          subjectId: subject.id,
          weeklyHours: 120,
          coefficient: 1,
          academicYearId: academicYear.id,
        },
      });
      await loadClassSubjects();
      toast({
        title: '✅ Matière ajoutée au programme',
        description: `${subject.name} fait maintenant partie du programme de ${selectedOfficialClass.name}. Vous pouvez lui affecter un enseignant spécialiste.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || "Impossible d'ajouter la matière au programme.",
        variant: 'destructive',
      });
    } finally {
      setAddingProgramSubjectId(null);
    }
  };

  // --- Actions ---

  /** MATERNELLE/PRIMAIRE : affecter le titulaire aux matières RÉGULIÈRES de la
   *  section physique (hors matières itinérantes confiées à un spécialiste). */
  const handleAssignHomeroom = async (teacherId: string) => {
    if (!academicYear?.id || regularSubjects.length === 0 || !selectedPhysicalClassId) return;
    setBulkAssigning(true);
    try {
      // 1. ⭐ FIX désaffectation croisée (2026-09-10) : supprimer UNIQUEMENT les
      //    affectations de CETTE section physique. `cs.assignments` contient les
      //    affectations de TOUTES les sections de la classe officielle (CE1 A,
      //    CE1 B…) — l'ancien code les supprimait toutes, puis ne recréait que la
      //    section courante → les autres sections perdaient leur titulaire
      //    « quelques instants » après leur affectation.
      //    Les lignes classId null (legacy) sont incluses car elles s'affichent
      //    pour cette section (même logique que currentHomeroom).
      const sectionAssignments = regularSubjects.flatMap(cs =>
        (cs.assignments || []).filter(a => a.classId === selectedPhysicalClassId || !a.classId)
      );
      for (const a of sectionAssignments) {
        await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {});
      }

      // 2. Créer une affectation pour chaque matière SÉQUENTIELLEMENT
      //    (pas en parallèle — évite le rate limit "too many requests" et garantit
      //    que TOUTES les matières sont persistées, pas seulement une partie)
      let created = 0;
      let failed = 0;
      for (const cs of regularSubjects) {
        try {
          await pedagogyFetch(`/api/pedagogy/teacher-class-assignments`, {
            method: 'POST',
            body: {
              academicYearId: academicYear.id,
              teacherId,
              classSubjectId: cs.id,
              classId: selectedPhysicalClassId,
            },
          });
          created++;
        } catch {
          // Si une matière échoue, on continue avec les autres
          failed++;
        }
      }

      await loadClassSubjects();
      setModal('none');
      setSearch('');
      setSelectedTeacherInModal(null);

      if (failed === 0) {
        toast({
          title: '✅ Titulaire affecté',
          description: `Le titulaire a été assigné à toutes les ${created} matières de ${selectedPhysicalClass?.name}.`,
        });
      } else {
        toast({
          title: '⚠️ Affectation partielle',
          description: `${created} matière(s) affectée(s), ${failed} échec(s) sur ${regularSubjects.length}. Réessayez pour compléter.`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter le titulaire.", variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** Retirer le titulaire de la section physique */
  const handleRemoveHomeroom = async () => {
    if (!academicYear?.id || !selectedPhysicalClassId) return;
    setBulkAssigning(true);
    try {
      // ⭐ FIX désaffectation croisée (2026-09-10) : même correction que
      // handleAssignHomeroom — ne supprimer que les affectations de CETTE
      // section physique, sinon « Retirer » vidait TOUTES les sections de la
      // classe officielle (CE1 A, CE1 B…).
      const sectionAssignments = regularSubjects.flatMap(cs =>
        (cs.assignments || []).filter(a => a.classId === selectedPhysicalClassId || !a.classId)
      );
      for (const a of sectionAssignments) {
        await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {});
      }
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Titulaire retiré', description: `Le titulaire de ${selectedPhysicalClass?.name} a été retiré.` });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** SECONDAIRE : affecter un enseignant à une matière */
  const handleAssignTeacher = async (teacherId: string) => {
    if (!activeSubject || !academicYear?.id || !selectedPhysicalClassId) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-class-assignments`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          teacherId,
          classSubjectId: activeSubject.id,
          classId: selectedPhysicalClassId,
        },
      });
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Succès', description: 'Enseignant affecté avec succès.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter l'enseignant.", variant: 'destructive' });
    }
  };

  /** Retirer une affectation individuelle */
  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${assignmentId}`, { method: 'DELETE' });
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Succès', description: 'Affectation retirée.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ⭐ SPÉCIALISTES ITINÉRANTS (Anglais / Informatique — écoles non bilingues)
  // Un professeur spécialiste (ex: « Professeur d'anglais » du module Personnel)
  // parcourt toutes les classes de la maternelle au CM2, comme au secondaire.
  // Affectation au niveau CLASSE OFFICIELLE (classId omis → toutes les sections).
  // ─────────────────────────────────────────────────────────────────────────

  /** Qualification d'un enseignant pour une matière itinérante :
   *  habilitation du profil académique, ou poste/spécialité RH correspondant
   *  (ex: « Professeur d'anglais »). Retourné comme libellé de badge, ou null. */
  const itinerantQualification = (
    t: TeacherProfile,
    subject?: { id: string; name: string } | null,
  ): string | null => {
    if (!subject) return null;
    if ((t.subjectQualifications || []).some(q => q.subjectId === subject.id)) return 'Qualifié';
    const twp = teachersWithPhotos.find(x => x.id === t.teacher.id);
    const pos = `${twp?.position || ''}`.toLowerCase();
    const spec = `${twp?.specialization || ''}`.toLowerCase();
    const fam = subjectFamily(subject.name);
    const posMatch = fam === 'anglais'
      ? pos.includes('anglais') || pos.includes('english')
      : pos.includes('informatique') || pos.includes('computer');
    if (posMatch) return twp?.position || 'Spécialiste';
    const specMatch = fam === 'anglais'
      ? spec.includes('anglais') || spec.includes('english')
      : spec.includes('informatique') || spec.includes('computer');
    if (specMatch) return 'Spécialiste';
    return null;
  };

  /** Résout, pour chaque classe maternel+primaire active, le ClassSubject de la
   *  famille de la matière itinérante (apparie les enregistrements Subject
   *  distincts par niveau : ex ANG-20 maternel ↔ ANG-10 primaire, via le nom). */
  const resolveItinerantTargets = useCallback(async (
    sourceSubjectId: string,
    sourceSubjectName: string,
  ): Promise<Array<{ officialClass: AcademicClass; cs: ClassSubject }>> => {
    if (!academicYear?.id) return [];
    const family = subjectFamily(sourceSubjectName);
    const homeroomClasses = academicClasses.filter(ac => isHomeroomLevel(ac.level?.name) && ac.isActive !== false);
    const targets: Array<{ officialClass: AcademicClass; cs: ClassSubject }> = [];
    for (const oc of homeroomClasses) {
      let subjectsOfClass: ClassSubject[];
      if (oc.id === selectedOfficialClass?.id) {
        subjectsOfClass = classSubjects;
      } else {
        try {
          subjectsOfClass = (await pedagogyFetch<ClassSubject[]>(
            `/api/pedagogy/class-subjects/${oc.id}?academicYearId=${academicYear.id}`,
          )) || [];
        } catch {
          subjectsOfClass = [];
        }
      }
      const target = subjectsOfClass.find(cs =>
        cs.subject?.id === sourceSubjectId
        || (isItinerantSubject(cs.subject) && subjectFamily(cs.subject?.name) === family),
      );
      if (target) targets.push({ officialClass: oc, cs: target });
    }
    return targets;
  }, [academicClasses, academicYear?.id, selectedOfficialClass?.id, classSubjects]);

  /** Affecter un enseignant spécialiste itinérant (cette classe OU maternelle → CM2) */
  const handleAssignItinerant = async (teacherId: string) => {
    if (!activeItinerantSubject || !academicYear?.id) return;
    setBulkAssigning(true);
    try {
      // 0. ⭐ COMBLER LES MANQUES (2026-09-15) : en portée « toutes les classes »,
      //    si des classes maternel/primaire n'ont pas la matière au programme et
      //    qu'une matière correspondante existe au catalogue (bon niveau), on
      //    l'ajoute automatiquement à leur programme AVANT l'affectation.
      //    Avant : le système se contentait d'avertir « X classe(s) sans cette
      //    matière au programme » et l'utilisateur n'avait AUCUN moyen d'agir
      //    depuis cet onglet (scénario : Anglais créé pour Maternelle mais
      //    jamais affecté aux classes Maternelle 1 / Maternelle 2).
      let addedToProgram = 0;
      if (itinerantApplyAll && itinerantAutoAdd && itinerantGaps.length > 0) {
        for (const gap of itinerantGaps) {
          if (!gap.candidate) continue;
          try {
            await pedagogyFetch(`/api/pedagogy/class-subjects`, {
              method: 'POST',
              body: {
                classId: gap.officialClass.id,
                subjectId: gap.candidate.id,
                weeklyHours: 120,
                coefficient: 1,
                academicYearId: academicYear.id,
              },
            });
            addedToProgram++;
          } catch {
            // Échec silencieux — la classe restera sans la matière et sera
            // comptée dans « sans cette matière au programme » du toast final.
          }
        }
      }

      // 1. Classes cibles : toutes (maternelle → CM2) ou juste la classe officielle courante.
      //    NB : les liens créés à l'étape 0 concernent d'AUTRES classes que la
      //    classe sélectionnée (le modal n'est ouvert que depuis une classe qui
      //    a déjà la matière) → resolveItinerantTargets les récupère en frais.
      let targets: Array<{ officialClass: AcademicClass; cs: ClassSubject }>;
      if (itinerantApplyAll) {
        targets = await resolveItinerantTargets(
          activeItinerantSubject.subject.id,
          activeItinerantSubject.subject.name,
        );
      } else {
        targets = selectedOfficialClass
          ? [{ officialClass: selectedOfficialClass, cs: activeItinerantSubject }]
          : [];
      }

      // 2. Pour chaque classe : rétro-correction (on remplace l'existant, y compris
      //    l'ancienne affectation du titulaire sur cette matière) puis création
      //    au niveau classe officielle (classId OMIS → visible pour toutes les
      //    sections). Séquentiel — évite le rate limit et garantit la persistance.
      let created = 0;
      let failed = 0;
      for (const { cs } of targets) {
        for (const a of cs.assignments || []) {
          await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {});
        }
        try {
          await pedagogyFetch(`/api/pedagogy/teacher-class-assignments`, {
            method: 'POST',
            body: {
              academicYearId: academicYear.id,
              teacherId,
              classSubjectId: cs.id,
              // ⭐ classId volontairement omis : affectation « toutes sections »
            },
          });
          created++;
        } catch {
          failed++;
        }
      }

      await loadClassSubjects();
      setModal('none');
      setSearch('');
      setSelectedTeacherInModal(null);

      const homeroomClassCount = academicClasses.filter(ac => isHomeroomLevel(ac.level?.name)).length;
      const withoutSubject = itinerantApplyAll ? Math.max(0, homeroomClassCount - targets.length) : 0;

      if (created > 0 && failed === 0) {
        toast({
          title: '✅ Spécialiste affecté',
          description: itinerantApplyAll
            ? `${activeItinerantSubject.subject.name} : l'enseignant parcourt ${created} classe(s) de la maternelle au CM2.`
              + (addedToProgram > 0 ? ` Matière ajoutée au programme de ${addedToProgram} classe(s).` : '')
              + (withoutSubject > 0
                ? ` ${withoutSubject} classe(s) sans cette matière au programme — utilisez « Ajouter au programme » sur ces classes ou l'onglet « Matières & programmes ».`
                : '')
            : `${activeItinerantSubject.subject.name} — spécialiste affecté à ${selectedOfficialClass?.name}.`,
        });
      } else if (created === 0 && failed === 0) {
        toast({
          title: '⚠️ Aucune classe concernée',
          description: addedToProgram > 0
            ? `La matière a été ajoutée au programme de ${addedToProgram} classe(s) mais l'affectation de l'enseignant a échoué. Réessayez.`
            : "Aucune classe n'a cette matière à son programme. Ajoutez-la d'abord via « Ajouter au programme » ou dans l'onglet « Matières & programmes ».",
          variant: 'destructive',
        });
      } else {
        toast({
          title: '⚠️ Affectation partielle',
          description: `${created} classe(s) affectée(s), ${failed} échec(s). Réessayez pour compléter.`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter le spécialiste.", variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** Retirer l'enseignant spécialiste d'une matière itinérante (cette classe ou partout) */
  const handleRemoveItinerant = async (everywhere: boolean) => {
    if (!activeItinerantSubject || !academicYear?.id) return;
    setBulkAssigning(true);
    try {
      let targets: ClassSubject[];
      if (everywhere) {
        const resolved = await resolveItinerantTargets(
          activeItinerantSubject.subject.id,
          activeItinerantSubject.subject.name,
        );
        targets = resolved.map(r => r.cs);
      } else {
        targets = [activeItinerantSubject];
      }

      let removed = 0;
      for (const cs of targets) {
        for (const a of cs.assignments || []) {
          await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {});
          removed++;
        }
      }

      await loadClassSubjects();
      setModal('none');
      toast({
        title: 'Spécialiste retiré',
        description: everywhere
          ? `Affectation retirée dans ${targets.length} classe(s) (maternelle → CM2).`
          : `L'enseignant spécialiste a été retiré de ${selectedOfficialClass?.name}.`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  // Helper : trouver la photo d'un enseignant depuis teachersWithPhotos
  const getTeacherPhoto = (teacherId: string): string | null => {
    const t = teachersWithPhotos.find(t => t.id === teacherId);
    return t?.photoUrl || null;
  };

  // Helper : trouver le titulaire multigrade pour une section physique donnée.
  // Si l'enseignant est en multigrade et que cette section fait partie de ses
  // classes assignées, on retourne l'enseignant pour le pré-remplir comme titulaire.
  const getMultigradeTeacher = (physicalClassId: string): { teacherId: string; teacherName: string } | null => {
    for (const mg of multigradeAssignments) {
      const classIds: string[] = Array.isArray(mg.classIds) ? mg.classIds : [];
      // Les classIds du multigrade sont des IDs de classe physique (Class)
      if (classIds.includes(physicalClassId)) {
        const teacher = mg.teacher;
        if (teacher) {
          return {
            teacherId: teacher.id,
            teacherName: `${teacher.lastName} ${teacher.firstName}`,
          };
        }
      }
    }
    return null;
  };

  // Titulaire multigrade pour la section actuellement sélectionnée
  const multigradeSuggestion = selectedPhysicalClassId ? getMultigradeTeacher(selectedPhysicalClassId) : null;

  // Helper : trouver assignedLanguages d'un enseignant depuis teachersWithPhotos
  const getTeacherLanguages = (teacherId: string): string[] => {
    const t = teachersWithPhotos.find(t => t.id === teacherId);
    return t?.assignedLanguages || [];
  };

  // Filtrer les enseignants éligibles
  // En mode bilingue, filtrer par la langue de l'enseignant (FR ou EN)
  // La langue vient de teachersWithPhotos (GET /api/teachers) qui inclut
  // assignedLanguages — TeacherProfile ne l'inclut pas.
  const eligibleTeachers = useMemo(() => {
    return teachers.filter(t => {
      if (isBilingual) {
        const langs = getTeacherLanguages(t.teacher.id);
        const teacherLang = langs.length > 0 ? langs[0] : null;
        if (currentTrack === 'EN' && teacherLang !== 'EN') return false;
        if (currentTrack === 'FR' && teacherLang === 'EN') return false;
      }
      return true;
    });
  }, [teachers, isBilingual, currentTrack, teachersWithPhotos]);

  // ⭐ 169 — FILTRE PAR NIVEAU DE LA CLASSE (retour promoteur) : quand une
  // classe du secondaire (6e → Terminale) est sélectionnée, les modals
  // d'affectation ne doivent lister QUE les enseignants du secondaire ; une
  // classe maternelle/primaire ne propose que les enseignants maternel-
  // primaire — AUCUN MÉLANGE. Le niveau de chaque enseignant vient de
  // GET /api/teachers (Teacher.schoolLevel name/code — teachersWithPhotos).
  const getTeacherCategory = (teacherId: string): 'MATERNEL_PRIMAIRE' | 'SECONDAIRE' | 'AUTRE' => {
    const t = teachersWithPhotos.find(x => x.id === teacherId);
    return levelCategoryOf(`${t?.schoolLevel?.name || ''} ${t?.schoolLevel?.code || ''}`);
  };
  const selectedClassCategory = levelCategoryOf(
    selectedOfficialClass?.level?.name || selectedPhysicalClass?.name || '',
  );
  const levelEligibleTeachers = useMemo(() => {
    if (selectedClassCategory === 'AUTRE') return eligibleTeachers;
    return eligibleTeachers.filter(t => getTeacherCategory(t.teacher.id) === selectedClassCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleTeachers, selectedClassCategory, teachersWithPhotos]);

  // --- Render ---

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Panneau gauche : Sections physiques ── */}
        {/* ⭐ FIX UX (2026-09-14) : hauteur bornée + barre de scroll interne —
            avant, une longue liste de sections étirait toute la page :
            il fallait descendre tout en bas pour cliquer une section puis
            remonter pour travailler dans le panneau de droite.
            ⭐ RETOUR UTILISATEUR (2026-09-14) : hauteur par défaut DOUBLÉE
            (2 × calc(100vh − 26rem)) — les panneaux étaient trop tassés. */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col lg:max-h-[calc(200vh-52rem)]">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" style={{ color: PRIMARY }} />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Sections physiques</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une section..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          {/* max-h mobile 120vh (doublé) ; desktop : borné par le panneau parent (lg:max-h-none) */}
          <div className="flex-1 min-h-0 p-2 overflow-y-auto max-h-[120vh] lg:max-h-none">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : groupedSections.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Aucune section physique trouvée.
                <br />
                Créez des sections dans Paramètres &gt; Structure.
              </div>
            ) : (
              groupedSections.map(({ officialClass, sections }) => (
                <div key={officialClass.id} className="mb-3">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {officialClass.name}
                  </div>
                  {sections.map(pc => {
                    const isSelected = selectedPhysicalClassId === pc.id;
                    return (
                      <button
                        key={pc.id}
                        onClick={() => setSelectedPhysicalClassId(pc.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5',
                          isSelected
                            ? 'text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100',
                        )}
                        style={isSelected ? { backgroundColor: PRIMARY } : undefined}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={cn(
                            'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black',
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                          )}>
                            {isHomeroomLevel(officialClass.level?.name) ? '★' : '🎓'}
                          </span>
                          {pc.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panneau droit : Détail de la section sélectionnée ── */}
        {/* ⭐ FIX UX (2026-09-14) : hauteur bornée + scroll interne pour que le
            panneau reste visible sans étirer la page quand la liste des
            matières (mode Spécialiste) est longue.
            ⭐ RETOUR UTILISATEUR (2026-09-14) : hauteur par défaut DOUBLÉE
            (2 × calc(100vh − 26rem)) — davantage de contenu visible d'emblée. */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col lg:max-h-[calc(200vh-52rem)]">
          {/* Bilingual switch */}
          {isBilingual && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 mx-4 mt-4 mb-2 self-start">
              <button
                onClick={() => setCurrentTrack('FR')}
                className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
                  currentTrack === 'FR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                Français
              </button>
              <button
                onClick={() => setCurrentTrack('EN')}
                className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
                  currentTrack === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                English
              </button>
            </div>
          )}

          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <Users className="w-3 h-3" /> Section physique
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedPhysicalClass?.name || 'Sélectionnez une section'}
                  </h3>
                  {selectedOfficialClass && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      (classe officielle : {selectedOfficialClass.name})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                  {isHomeroom
                    ? (itinerantSubjects.length > 0
                        ? '★ Mode Titulaire + spécialistes itinérants (Anglais, Informatique)'
                        : '★ Mode Titulaire — 1 enseignant pour toutes les matières')
                    : '🎓 Mode Spécialiste — 1 enseignant par matière'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {!selectedPhysicalClass ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-400 text-xs font-bold">Sélectionnez une section physique à gauche</p>
              </div>
            ) : isHomeroom ? (
              /* ══ MODE TITULAIRE (Maternelle / Primaire) ══ */
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Bannière multigrade : si un titulaire multigrade est suggéré pour cette section */}
                {multigradeSuggestion && !homeroomFullyAssigned && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <Layers className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-amber-900">Multigrade détecté</p>
                      <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        <strong>{multigradeSuggestion.teacherName}</strong> est assigné à cette section
                        via le multigrade. Vous pouvez le désigner directement comme titulaire.
                      </p>
                      <button
                        onClick={() => {
                          setSelectedTeacherInModal(multigradeSuggestion.teacherId);
                          setModal('assign-homeroom');
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Désigner {multigradeSuggestion.teacherName}
                      </button>
                    </div>
                  </div>
                )}
                {/* Bannière informative générale multigrade */}
                {multigradeAssignments.length > 0 && !multigradeSuggestion && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <p className="text-[11px] text-blue-700 font-medium">
                      {multigradeAssignments.length} enseignant(s) en multigrade configuré(s).
                      Cette section n'est pas concernée par le multigrade.
                    </p>
                  </div>
                )}

                {/* Bannière explicative */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {itinerantSubjects.length > 0 ? 'Modèle Titulaire + Spécialistes itinérants' : 'Modèle Titulaire Unique'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">
                      Un seul enseignant titulaire gère les {regularSubjects.length} matières de la section
                      <strong> {selectedPhysicalClass.name}</strong>.
                      {itinerantSubjects.length > 0 && (
                        <> Les matières <strong>{itinerantSubjects.map(cs => cs.subject.name).join(' et ')}</strong> sont
                          assurées par un enseignant spécialiste qui parcourt toutes les classes de la
                          maternelle au CM2 (comme au secondaire).</>
                      )}
                      Définissez le titulaire ci-dessous.
                    </p>
                  </div>
                </div>

                {/* Carte Titulaire */}
                <div className={cn(
                  'rounded-lg border p-5 bg-white shadow-sm transition-all',
                  homeroomFullyAssigned ? 'border-slate-200' : 'border-dashed border-slate-300',
                )}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}15` }}>
                      {homeroomFullyAssigned && currentHomeroom
                        ? (getTeacherPhoto(currentHomeroom.id)
                          ? <img src={getTeacherPhoto(currentHomeroom.id)!} alt="" className="w-full h-full object-cover" />
                          : <UserCheck className="w-5 h-5" style={{ color: PRIMARY }} />)
                        : <Star className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Titulaire</p>
                      {homeroomFullyAssigned && currentHomeroom ? (
                        <p className="text-base font-bold text-slate-900">
                          {currentHomeroom.lastName} {currentHomeroom.firstName}
                        </p>
                      ) : (
                        <p className="text-base font-bold text-slate-400">Non désigné</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {homeroomFullyAssigned ? (
                      <>
                        <button
                          onClick={() => { setSearch(''); setSelectedTeacherInModal(null); setModal('assign-homeroom'); }}
                          disabled={bulkAssigning}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Replace className="w-3.5 h-3.5" /> Remplacer
                        </button>
                        <button
                          onClick={() => setModal('confirm-remove')}
                          disabled={bulkAssigning}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Retirer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setSearch(''); setSelectedTeacherInModal(null); setModal('assign-homeroom'); }}
                        disabled={bulkAssigning || regularSubjects.length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        {bulkAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        Désigner le titulaire
                      </button>
                    )}
                  </div>
                </div>

                {/* ⭐ Matières confiées à un enseignant spécialiste itinérant
                    (Anglais / Informatique — école non bilingue) */}
                {itinerantSubjects.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <GraduationCap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">
                          Matières avec enseignant spécialiste itinérant
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed font-medium">
                          École non bilingue : ces matières sont assurées par un professeur
                          spécialiste qui parcourt toutes les classes de la maternelle au CM2
                          (comme au secondaire), et non par le titulaire de la section.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {itinerantSubjects.map(cs => {
                        const assignment = (cs.assignments || []).find(a => a.classId === selectedPhysicalClassId || !a.classId);
                        return (
                          <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-white">
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{cs.subject.name}</p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                                Coeff. {cs.coefficient} · {formatWeeklyDurationWithSuffix(cs.weeklyHours)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {assignment ? (
                                <>
                                  <span className="text-xs font-bold text-slate-700">
                                    {assignment.teacher.lastName} {assignment.teacher.firstName}
                                  </span>
                                  <button
                                    onClick={() => { setActiveItinerantSubject(cs); setItinerantApplyAll(true); setSelectedTeacherInModal(null); setSearch(''); setModal('assign-itinerant'); }}
                                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                                  >
                                    Remplacer
                                  </button>
                                  <button
                                    onClick={() => { setActiveItinerantSubject(cs); setModal('confirm-remove-itinerant'); }}
                                    className="text-[10px] font-semibold text-red-600 hover:underline"
                                  >
                                    Retirer
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => { setActiveItinerantSubject(cs); setItinerantApplyAll(true); setSelectedTeacherInModal(null); setSearch(''); setModal('assign-itinerant'); }}
                                  className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white shadow-sm"
                                  style={{ backgroundColor: ACCENT }}
                                >
                                  <UserPlus className="w-3 h-3" /> Affecter un spécialiste
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ⭐ MATIÈRES ITINÉRANTES ABSENTES DU PROGRAMME (2026-09-15)
                    Scénario : « Anglais » a été créée pour le niveau Maternelle
                    dans « Matières & programmes » mais jamais affectée aux
                    classes → aucune carte spécialiste ci-dessus → impasse.
                    On propose de l'ajouter au programme SANS quitter l'onglet. */}
                {itinerantActive && missingItinerantSubjects.length > 0 && (
                  <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50/40 p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Plus className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">
                          Matières itinérantes à ajouter au programme
                        </p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed font-medium">
                          Ces matières existent dans votre catalogue (onglet « Matières &amp; programmes »)
                          mais ne sont pas encore au programme de <strong>{selectedOfficialClass?.name}</strong>.
                          Ajoutez-les pour pouvoir affecter un enseignant spécialiste itinérant.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {missingItinerantSubjects.map(subject => (
                        <div key={subject.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-white">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{subject.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                              {subject.code}
                              {subject.schoolLevel?.name ? ` · niveau ${subject.schoolLevel.name}` : ''}
                              {' '}· 2h/semaine · coeff. 1
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddItinerantToProgram(subject)}
                            disabled={addingProgramSubjectId === subject.id}
                            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white shadow-sm disabled:opacity-60"
                            style={{ backgroundColor: addingProgramSubjectId === subject.id ? '#94a3b8' : ACCENT }}
                          >
                            {addingProgramSubjectId === subject.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Plus className="w-3 h-3" />}
                            Ajouter au programme
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Liste des matières du titulaire */}
                {regularSubjects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {regularSubjects.length} matière(s) de cette section
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {regularSubjects.map(cs => (
                        <span key={cs.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
                          {cs.subject.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ══ MODE SPÉCIALISTE (Secondaire) ══ */
              <div className="space-y-3">
                {/* ⭐ 2026-09-29 — Section Professeur Principal (Secondaire) */}
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-blue-100">
                      <Star className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">Professeur Principal</p>
                      {currentMainTeacher ? (
                        <p className="text-base font-bold text-slate-900">
                          {currentMainTeacher.lastName} {currentMainTeacher.firstName}
                        </p>
                      ) : (
                        <p className="text-base font-bold text-slate-400">Non désigné</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {currentMainTeacher ? (
                      <>
                        <button
                          onClick={() => setMainTeacherModalOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Replace className="w-3.5 h-3.5" /> Remplacer
                        </button>
                        <button
                          onClick={() => saveMainTeacher(null)}
                          disabled={mainTeacherSaving}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Retirer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setMainTeacherModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm bg-blue-600 hover:bg-blue-700 transition-all"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Désigner le professeur principal
                      </button>
                    )}
                  </div>
                </div>

                {/* Matières et affectations par enseignant */}
                {classSubjects.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    Aucune matière affectée à cette classe officielle.
                    Affectez d'abord des matières dans l'onglet « Matière & Programme ».
                  </div>
                ) : (
                  classSubjects.map(cs => {
                    const assignment = (cs.assignments || []).find(a => a.classId === selectedPhysicalClassId);
                    return (
                      <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{cs.subject.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            Coeff. {cs.coefficient} · {formatWeeklyDurationWithSuffix(cs.weeklyHours)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment ? (
                            <>
                              <span className="text-xs font-bold text-slate-700">
                                {assignment.teacher.lastName} {assignment.teacher.firstName}
                              </span>
                              <button
                                onClick={() => { setActiveSubject(cs); setSelectedTeacherInModal(null); setModal('assign-teacher'); }}
                                className="text-[10px] font-semibold text-blue-600 hover:underline"
                              >
                                Remplacer
                              </button>
                              <button
                                onClick={() => { setRemovingAssignmentId(assignment.id); setModal('confirm-remove'); }}
                                className="text-[10px] font-semibold text-red-600 hover:underline"
                              >
                                Retirer
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setActiveSubject(cs); setSelectedTeacherInModal(null); setModal('assign-teacher'); }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              <UserPlus className="w-3 h-3" /> Affecter
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Modals ══ */}

      {/* Modal: Assign Homeroom (Titulaire) */}
      <FormModal
        title={`Désigner le titulaire — ${selectedPhysicalClass?.name || ''}`}
        isOpen={modal === 'assign-homeroom'}
        onClose={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
        onConfirm={async () => {
          if (bulkAssigning || !selectedTeacherInModal) return;
          await handleAssignHomeroom(selectedTeacherInModal);
        }}
        size="large"
        actions={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
              disabled={bulkAssigning}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="modal-form"
              disabled={bulkAssigning || !selectedTeacherInModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: bulkAssigning ? '#94a3b8' : PRIMARY }}
            >
              {bulkAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Affectation en cours...
                </>
              ) : (
                'Confirmer'
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Sélectionnez l'enseignant titulaire pour la section <strong>{selectedPhysicalClass?.name}</strong>.
              Il sera affecté aux {regularSubjects.length} matières
              {itinerantSubjects.length > 0
                ? `, hors ${itinerantSubjects.map(cs => cs.subject.name).join(' et ')} (spécialiste itinérant).`
                : ' de cette section.'}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un enseignant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            {levelEligibleTeachers.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Aucun enseignant disponible.</p>
            ) : (
              levelEligibleTeachers
                .filter(t => {
                  if (!search) return true;
                  const s = search.toLowerCase();
                  return `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(s)
                    || (t.teacher.matricule || '').toLowerCase().includes(s);
                })
                .map(t => {
                  const isSelected = selectedTeacherInModal === t.teacher.id;
                  const photoUrl = getTeacherPhoto(t.teacher.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherInModal(t.teacher.id)}
                      disabled={bulkAssigning}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left disabled:opacity-50',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
                      )}
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {t.teacher.firstName?.[0]}{t.teacher.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.teacher.lastName} {t.teacher.firstName}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{t.teacher.matricule} · {t.maxWeeklyHours}h/sem max</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: PRIMARY }} />}
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </FormModal>

      {/* Modal: Assign Teacher (Spécialiste) */}
      <FormModal
        title={`Affecter un enseignant — ${activeSubject?.subject?.name || ''}`}
        isOpen={modal === 'assign-teacher'}
        onClose={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
        onConfirm={async () => {
          if (bulkAssigning || !selectedTeacherInModal) return;
          await handleAssignTeacher(selectedTeacherInModal);
        }}
        size="large"
        actions={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
              disabled={bulkAssigning}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="modal-form"
              disabled={bulkAssigning || !selectedTeacherInModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: bulkAssigning ? '#94a3b8' : PRIMARY }}
            >
              {bulkAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Affectation...
                </>
              ) : (
                'Confirmer'
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              Section : <strong>{selectedPhysicalClass?.name}</strong> · Matière : <strong>{activeSubject?.subject?.name}</strong>
            </p>
            {/* ⭐ 169 — le sélecteur est borné au niveau de la classe (aucun mélange). */}
            {selectedClassCategory !== 'AUTRE' && (
              <p className="text-[10px] text-blue-600 mt-1">
                Seuls les enseignants {selectedClassCategory === 'SECONDAIRE' ? 'du secondaire' : "de la maternelle & du primaire"} sont proposés.
              </p>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            {levelEligibleTeachers
              .filter(t => {
                if (!search) return true;
                const s = search.toLowerCase();
                return `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(s);
              })
              .map(t => {
                const isSelected = selectedTeacherInModal === t.teacher.id;
                const photoUrl = getTeacherPhoto(t.teacher.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacherInModal(t.teacher.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                        : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
                    )}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {t.teacher.firstName?.[0]}{t.teacher.lastName?.[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.teacher.lastName} {t.teacher.firstName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{t.teacher.matricule}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: PRIMARY }} />}
                  </button>
                );
              })}
          </div>
        </div>
      </FormModal>

      {/* ⭐ Modal: Assign Itinerant Specialist (Anglais / Informatique — école non bilingue) */}
      <FormModal
        title={`Affecter un spécialiste — ${activeItinerantSubject?.subject?.name || ''}`}
        isOpen={modal === 'assign-itinerant'}
        onClose={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
        onConfirm={async () => {
          if (bulkAssigning || !selectedTeacherInModal) return;
          await handleAssignItinerant(selectedTeacherInModal);
        }}
        size="large"
        actions={
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setModal('none'); setSearch(''); setSelectedTeacherInModal(null); }}
              disabled={bulkAssigning}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="modal-form"
              disabled={bulkAssigning || !selectedTeacherInModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: bulkAssigning ? '#94a3b8' : PRIMARY }}
            >
              {bulkAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Affectation...
                </>
              ) : (
                'Confirmer'
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">
              L'enseignant spécialiste assure <strong>{activeItinerantSubject?.subject?.name}</strong> comme au
              secondaire : il parcourt les classes concernées, indépendamment du titulaire de section.
            </p>
          </div>

          {/* Portée de l'affectation */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
            <input
              type="checkbox"
              checked={itinerantApplyAll}
              onChange={(e) => setItinerantApplyAll(e.target.checked)}
              className="mt-0.5 w-4 h-4"
              style={{ accentColor: ACCENT }}
            />
            <span>
              <span className="block text-xs font-bold text-slate-800">
                Affecter à toutes les classes (maternelle → CM2)
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5 font-medium">
                {itinerantApplyAll
                  ? 'Une seule action : toutes les classes de maternelle et de primaire ayant cette matière au programme.'
                  : `Affectation limitée à la classe ${selectedOfficialClass?.name || ''} (toutes ses sections).`}
              </span>
            </span>
          </label>

          {/* ⭐ CLASSES SANS LA MATIÈRE AU PROGRAMME (2026-09-15)
              On liste les classes concernées et on propose d'ajouter
              automatiquement la matière à leur programme — avant, ces classes
              étaient seulement comptées dans un toast d'avertissement. */}
          {itinerantApplyAll && (itinerantGapsLoading || itinerantGaps.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Classes sans « {activeItinerantSubject?.subject?.name} » au programme
              </p>
              {itinerantGapsLoading ? (
                <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> Vérification des programmes…
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                    {itinerantGaps.map(g => `${g.officialClass.name}${g.candidate ? '' : ' (matière absente du catalogue pour ce niveau)'}`).join(', ')}
                  </p>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-amber-200 bg-white cursor-pointer">
                    <input
                      type="checkbox"
                      checked={itinerantAutoAdd}
                      onChange={(e) => setItinerantAutoAdd(e.target.checked)}
                      className="mt-0.5 w-4 h-4"
                      style={{ accentColor: ACCENT }}
                    />
                    <span>
                      <span className="block text-xs font-bold text-slate-800">
                        Ajouter automatiquement la matière à leur programme
                      </span>
                      <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">
                        {itinerantAutoAdd
                          ? `La matière sera créée dans le programme de ${itinerantGaps.filter(g => g.candidate).length} classe(s) (2h/semaine, coeff. 1), puis l'enseignant y sera affecté.`
                          : 'Sans cette option, ces classes resteront sans la matière — vous pourrez l\'ajouter plus tard classe par classe.'}
                      </span>
                    </span>
                  </label>
                </>
              )}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un enseignant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="space-y-1.5">
            {levelEligibleTeachers.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Aucun enseignant disponible.</p>
            ) : (
              levelEligibleTeachers
                .filter(t => {
                  if (!search) return true;
                  const s = search.toLowerCase();
                  return `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(s)
                    || (t.teacher.matricule || '').toLowerCase().includes(s);
                })
                .sort((a, b) => {
                  const aq = itinerantQualification(a, activeItinerantSubject?.subject) ? 1 : 0;
                  const bq = itinerantQualification(b, activeItinerantSubject?.subject) ? 1 : 0;
                  return bq - aq;
                })
                .map(t => {
                  const isSelected = selectedTeacherInModal === t.teacher.id;
                  const photoUrl = getTeacherPhoto(t.teacher.id);
                  const qual = itinerantQualification(t, activeItinerantSubject?.subject);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeacherInModal(t.teacher.id)}
                      disabled={bulkAssigning}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left disabled:opacity-50',
                        isSelected
                          ? 'border-amber-500 bg-amber-50 ring-1 ring-amber-200'
                          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
                      )}
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                          {t.teacher.firstName?.[0]}{t.teacher.lastName?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-800 text-sm">
                          {t.teacher.lastName} {t.teacher.firstName}
                          {qual && (
                            <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 align-middle">
                              <Star className="w-2.5 h-2.5" /> {qual}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {t.teacher.matricule} · {t.maxWeeklyHours}h/sem max
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 ml-auto" style={{ color: PRIMARY }} />}
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </FormModal>

      {/* ⭐ Modal: Remove Itinerant Specialist (cette classe ou partout) */}
      <FormModal
        title={`Retirer le spécialiste — ${activeItinerantSubject?.subject?.name || ''}`}
        isOpen={modal === 'confirm-remove-itinerant'}
        onClose={() => setModal('none')}
        onConfirm={() => { /* Actions personnalisées ci-dessous */ }}
        size="md"
        actions={
          <div className="flex justify-end gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setModal('none')}
              disabled={bulkAssigning}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => handleRemoveItinerant(false)}
              disabled={bulkAssigning}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Cette classe uniquement
            </button>
            <button
              type="button"
              onClick={() => handleRemoveItinerant(true)}
              disabled={bulkAssigning}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ backgroundColor: bulkAssigning ? '#94a3b8' : '#dc2626' }}
            >
              {bulkAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
              Retirer partout (maternelle → CM2)
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Voulez-vous retirer l'enseignant spécialiste de{' '}
            <strong>{activeItinerantSubject?.subject?.name}</strong> ?
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
            <p>
              <strong>Cette classe uniquement</strong> : retire l'affectation pour{' '}
              {selectedOfficialClass?.name} (toutes ses sections).
            </p>
            <p>
              <strong>Retirer partout</strong> : supprime l'affectation dans toutes les classes de la
              maternelle au CM2.
            </p>
          </div>
        </div>
      </FormModal>

      {/* Modal: Confirm Remove */}
      <ConfirmModal
        title="Confirmer la suppression"
        isOpen={modal === 'confirm-remove'}
        onClose={() => setModal('none')}
        onConfirm={() => {
          if (isHomeroom) {
            handleRemoveHomeroom();
          } else if (removingAssignmentId) {
            handleRemoveAssignment(removingAssignmentId);
            setRemovingAssignmentId(null);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          {isHomeroom
            ? `Voulez-vous vraiment retirer le titulaire de la section ${selectedPhysicalClass?.name} ? Ses affectations sur les ${regularSubjects.length} matières de la classe seront supprimées${itinerantSubjects.length > 0 ? ' — les spécialistes itinérants (Anglais, Informatique) ne sont pas touchés' : ''}.`
            : 'Voulez-vous vraiment retirer cette affectation ?'}
        </p>
      </ConfirmModal>

      {/* ⭐ 2026-09-29 — Modal: Professeur Principal (Secondaire) */}
      {mainTeacherModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
          <div className="my-8 bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                <Star className="w-5 h-5" /> Professeur Principal
              </h3>
              <button onClick={() => setMainTeacherModalOpen(false)} className="p-1 hover:bg-blue-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600">
                Sélectionnez le professeur principal pour la classe <strong>{selectedOfficialClass?.name}</strong>.
              </p>
              <select
                id="main-teacher-select"
                defaultValue={selectedOfficialClass?.mainTeacherId || ''}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="">— Sélectionner un enseignant —</option>
                {/* ⭐ 169 — Professeur Principal = fonction du SECONDAIRE : seuls
                    les enseignants du secondaire sont proposés (aucun mélange
                    avec maternel-primaire). */}
                {teachers.filter(t => getTeacherCategory(t.teacherId) === 'SECONDAIRE').map(t => (
                  <option key={t.teacherId} value={t.teacherId}>
                    {t.teacher.lastName} {t.teacher.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setMainTeacherModalOpen(false)}>Annuler</Button>
              <Button
                onClick={() => {
                  const sel = document.getElementById('main-teacher-select') as HTMLSelectElement;
                  saveMainTeacher(sel?.value || null);
                }}
                disabled={mainTeacherSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {mainTeacherSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
