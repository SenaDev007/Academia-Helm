"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL — Grille hebdomadaire (5 jours × matières dynamiques)
 * ============================================================================
 *
 * Template officiel du primaire/maternelle.
 * Format paysage : 2 pages (recto + verso).
 * Les matières sont récupérées DYNAMIQUEMENT depuis la base de données
 * selon ce que l'école a configuré (table class_subjects / subjects).
 * Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  NotebookPen, Loader2, Save, RefreshCw, Send, Lock, Calendar,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, X, AlertCircle,
  FileSpreadsheet, FileText, ClipboardList, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

interface CahierJournalTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  /** ⭐ Classe à pré-sélectionner (pour éviter de perdre la sélection quand on switch d'onglet) */
  initialClassId?: string;
  /** ⭐ Callback appelé après un "Enregistrer" réussi — déclenche la bascule vers le sous-onglet Fiches */
  onJournalSaved?: (journalId: string, meta?: {
    weekStartDate?: string;
    weekEndDate?: string;
    className?: string;
    status?: string;
    classId?: string;
  }) => void;
  /** ⭐ Callback appelé après un "Soumettre" réussi (avec ou sans fiches) */
  onJournalSubmitted?: (journalId: string, meta?: {
    weekStartDate?: string;
    weekEndDate?: string;
    className?: string;
    status?: string;
    classId?: string;
  }) => void;
  /** ⭐ Callback appelé après chaque loadJournal réussi (y compris quand on switch de semaine).
   *    Permet au parent (CahierJournalFichesContainer) de connaître le journalId courant
   *    pour afficher les fiches liées en dessous de la grille hebdo. */
  onJournalLoaded?: (journalId: string | null, meta?: {
    weekStartDate?: string;
    weekEndDate?: string;
    className?: string;
    classId?: string;
  }) => void;
}

// === CONSTANTES DU TEMPLATE OFFICIEL ===

const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

const STATUS_CONFIG = {
  DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
  SUBMITTED: { label: "Soumis", color: "bg-blue-100 text-blue-700", icon: Send },
  VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
} as const;

// Helper pour parser les entries JSON
function parseEntries(entries: any): Record<string, Record<string, string>> {
  if (!entries) return {};
  if (typeof entries === "string") {
    try { return JSON.parse(entries); } catch { return {}; }
  }
  return entries as Record<string, Record<string, string>>;
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

// Calcul du lundi de la semaine pour une date donnée
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = day === 0 ? -6 : 1 - day; // reculer au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ⭐ Format LOCAL (YYYY-MM-DD) — évite le bug de timezone de toISOString()
// qui convertit en UTC et décale la date d'un jour en arrière quand on est en
// UTC+1 (ex: lundi 20 juillet 00:00 local → dimanche 19 juillet 23:00 UTC).
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  // Parser comme date locale (YYYY-MM-DD) pour éviter le bug UTC
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CahierJournalTab({ tenantId, academicYearId, teacherId, initialClassId, onJournalSaved, onJournalSubmitted, onJournalLoaded }: CahierJournalTabProps) {
  const { academicYear } = useModuleContext();
  const { user } = useAppSession();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || "");
  const [weekStart, setWeekStart] = useState<Date>(getMondayOfWeek(new Date()));
  const [journal, setJournal] = useState<any>(null);
  const [entries, setEntries] = useState<Record<string, Record<string, string>>>({});
  const [observations, setObservations] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [directorNameState, setDirectorNameState] = useState("");
  const [teacherSignature, setTeacherSignature] = useState<string | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // ⭐ Modal de confirmation professionnel (remplace confirm())
  const { warning: confirmWarning, dialog: confirmDialog } = useConfirmDialog();
  // ⭐ Modal de sélection des jours (cahier journal + fiches pédagogiques)
  const [showDaySelectionModal, setShowDaySelectionModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState<string[]>(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi']);

  // ⭐ Travaux & Suivi liés au cahier journal (Phase 4c)
  //    Fetch les HomeworkEntry liés à ce cahier journal (devoirs, leçons, récitations, exposés)
  //    + statut de chaque élève (récitation réussie/échouée, leçon copiée/non copiée)
  const [linkedTasks, setLinkedTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  // ⭐ Modal de création d'un devoir lié au cahier journal
  const [showTaskFormModal, setShowTaskFormModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    taskType: 'HOMEWORK',
    maxScore: 20,
    presentationDate: '',
    observations: '',
  });
  const [creatingTask, setCreatingTask] = useState(false);
  // Matières dynamiques chargées depuis la base de données
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);

  // === Chargement des classes + matières ===
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYearId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].classId);
        }
      } catch {
        setClasses([]);
      }
    })();
  }, [teacherId, academicYearId]);

  // === Chargement des matières disponibles pour la classe sélectionnée ===
  useEffect(() => {
    if (!selectedClassId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${academicYearId}&classId=${selectedClassId}&teacherId=${teacherId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setDynamicSubjects(Array.isArray(data) ? data : []);
      } catch {
        setDynamicSubjects([]);
      }
    })();
  }, [selectedClassId, academicYearId, teacherId]);

  // ⭐ REGROUPEMENT DES MATIÈRES (cahier journal)
  // Certaines matières sont regroupées sous un seul nom de colonne :
  //   - FRANÇAIS : Dictée, Grammaire, Exercices structuraux, Conjugaison,
  //     Communication orale, Orthographe, Lecture, Vocabulaire, Expression écrite,
  //     Graphisme, Écriture, Combinatoire
  //   - ÉDUCATION SOCIALE : Morale, Civisme, Histoire, Géographie
  //   - ÉDUCATION ARTISTIQUE : Chant, Poésie, Dessin, Compte, Couture, Atelier,
  //     Art dramatique, Éducation artistique plastique, Éducation artistique vivante
  // Les matières non listées dans un groupe restent individuelles.
  const SUBJECT_GROUPS: { groupName: string; subjects: string[] }[] = [
    {
      groupName: "Français",
      subjects: [
        "Dictée", "Grammaire", "Exercices structuraux", "Conjugaison",
        "Communication orale", "Orthographe", "Lecture", "Vocabulaire",
        "Expression écrite", "Graphisme", "Écriture", "Combinatoire",
        "Dictee", "Exercices Structuraux", "Communication Orale",
        "Expression Ecrite",
      ],
    },
    {
      groupName: "Éducation sociale",
      subjects: [
        "Morale", "Civisme", "Histoire", "Géographie", "Geographie",
        "Education sociale", "Éducation sociale",
      ],
    },
    {
      groupName: "Éducation artistique",
      subjects: [
        "Chant", "Poésie", "Dessin", "Compte", "Couture", "Atelier",
        "Art dramatique", "Éducation artistique plastique",
        "Éducation artistique vivante", "Education artistique plastique",
        "Education artistique vivante", "Poesie",
      ],
    },
  ];

  // Type pour une colonne du tableau (groupée ou individuelle)
  type TableColumn =
    | { type: "group"; groupName: string; subjects: any[] }
    | { type: "single"; subject: any };

  // Transformer la liste plate de matières en colonnes (groupées ou individuelles)
  const groupedColumns: TableColumn[] = (() => {
    const used = new Set<string>(); // subjectIds déjà placés dans un groupe
    const result: TableColumn[] = [];

    // 1. Parcourir les groupes définis
    for (const group of SUBJECT_GROUPS) {
      const matchingSubjects = dynamicSubjects.filter((s: any) => {
        const name = (s.subjectName || "").trim().toLowerCase();
        return group.subjects.some(g => g.trim().toLowerCase() === name);
      });
      if (matchingSubjects.length > 0) {
        result.push({ type: "group", groupName: group.groupName, subjects: matchingSubjects });
        matchingSubjects.forEach((s: any) => used.add(s.subjectId));
      }
    }

    // 2. Ajouter les matières non groupées (individuelles)
    for (const s of dynamicSubjects) {
      if (!used.has(s.subjectId)) {
        result.push({ type: "single", subject: s });
      }
    }

    return result;
  })();

  // Répartir les colonnes en 2 pages (recto = première moitié, verso = seconde moitié)
  const RECTO_COLUMNS = groupedColumns.slice(0, Math.ceil(groupedColumns.length / 2));
  const VERSO_COLUMNS = groupedColumns.slice(Math.ceil(groupedColumns.length / 2));

  // ⭐ Obtenir la clé d'entrée pour une colonne (nom du groupe ou nom de la matière)
  const getColumnKey = (col: TableColumn): string => {
    if (col.type === "group") return col.groupName;
    return col.subject.subjectName;
  };

  // ⭐ Obtenir la liste des noms de matières pour l'affichage sous l'en-tête de groupe
  const getColumnSubLabels = (col: TableColumn): string[] => {
    if (col.type === "group") {
      return col.subjects.map((s: any) => s.subjectName);
    }
    return [];
  };

  // === Chargement du cahier journal ===
  const loadJournal = useCallback(async () => {
    if (!selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/pedagogy-space/cahier-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          academicYearId, teacherId, classId: selectedClassId,
          weekStartDate: formatDate(weekStart),
          className: classes.find(c => c.classId === selectedClassId)?.className || "",
        }),
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setJournal(data);
      setEntries(parseEntries(data.entries));
      setObservations(data.observations || "");
      setDirectorName(data.directorName || "");
      // ⭐ Charger les signatures existantes
      setTeacherSignature(data.teacherSignature || null);
      setDirectorSignature(data.directorSignature || null);
      // ⭐ Notifier le parent du journalId courant (pour afficher les fiches liées)
      onJournalLoaded?.(data.id, {
        weekStartDate: data.weekStartDate,
        weekEndDate: data.weekEndDate,
        className: data.classNameResolved || data.className,
        classId: selectedClassId,
      });
    } catch (e: any) {
      toast.error("Erreur lors du chargement", { description: e.message });
      setJournal(null);
      onJournalLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, teacherId, selectedClassId, weekStart, classes, onJournalLoaded]);

  useEffect(() => {
    if (selectedClassId) loadJournal();
  }, [loadJournal, selectedClassId]);

  // ⭐ Fetch les HomeworkEntry liés au cahier journal courant (Phase 4c)
  //    Quand un journal est chargé (journal.id existe), on récupère les
  //    devoirs/leçons/récitations/exposés qui y sont rattachés via cahierJournalId.
  useEffect(() => {
    if (!journal?.id) {
      setLinkedTasks([]);
      return;
    }
    (async () => {
      setLoadingTasks(true);
      try {
        const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/tasks`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setLinkedTasks(Array.isArray(data) ? data : []);
        } else {
          setLinkedTasks([]);
        }
      } catch {
        setLinkedTasks([]);
      } finally {
        setLoadingTasks(false);
      }
    })();
  }, [journal?.id]);

  // ⭐ Handler pour créer un devoir lié au cahier journal courant
  //    Le devoir créé aura cahierJournalId = journal.id (lien explicite)
  const handleCreateLinkedTask = async () => {
    if (!journal?.id || !taskForm.title || !taskForm.dueDate) {
      toast.error("Titre et date d'échéance sont obligatoires");
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch('/api/pedagogy-space/homeworks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          academicYearId,
          schoolLevelId: journal.schoolLevelId,
          teacherId,
          classId: selectedClassId,
          title: taskForm.title,
          description: taskForm.description || '',
          dueDate: taskForm.dueDate,
          taskType: taskForm.taskType,
          maxScore: Number(taskForm.maxScore) || undefined,
          presentationDate: taskForm.presentationDate || undefined,
          observations: taskForm.observations || undefined,
          cahierJournalId: journal.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Erreur création');
      }
      toast.success('✅ Devoir créé et lié au cahier journal');
      setShowTaskFormModal(false);
      setTaskForm({ title: '', description: '', dueDate: '', taskType: 'HOMEWORK', maxScore: 20, presentationDate: '', observations: '' });
      // Re-fetch les tâches liées
      const tasksRes = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/tasks`, { credentials: 'include' });
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setLinkedTasks(Array.isArray(data) ? data : []);
      }
    } catch (e: any) {
      toast.error('Erreur création devoir', { description: e.message });
    } finally {
      setCreatingTask(false);
    }
  };

  // ⭐ Charger le nom + signature du directeur depuis school_directors (RH → Directeurs)
  //    Résolu par niveau scolaire de la classe + piste linguistique (FR par défaut).
  //    Le label devient "Directeur" ou "Directrice" selon le genre.
  const [directorInfo, setDirectorInfo] = useState<{
    fullName: string;
    functionLabel: string | null;
    signatureDataUrl: string | null;
    signatureUploadedUrl: string | null;
    gender: string | null;
  } | null>(null);

  useEffect(() => {
    if (!journal?.schoolLevelId) return;
    let cancelled = false;
    (async () => {
      try {
        // Déterminer la langue du directeur (FR par défaut, EN si bilingue et piste EN)
        const directorLang = 'FR'; // Pour l'instant, FR ; on pourrait détecter la piste de la classe
        const res = await fetch(
          `/api/hr/school-directors/by-level?schoolLevelId=${encodeURIComponent(journal.schoolLevelId)}&language=${directorLang}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          // Fallback : essayer l'autre langue
          const fallbackLang = directorLang === 'FR' ? 'EN' : 'FR';
          const res2 = await fetch(
            `/api/hr/school-directors/by-level?schoolLevelId=${encodeURIComponent(journal.schoolLevelId)}&language=${fallbackLang}`,
            { credentials: 'include' },
          );
          if (!res2.ok) return;
          const data2 = await res2.json();
          if (!cancelled && data2) {
            setDirectorInfo({
              fullName: data2.fullName || '',
              functionLabel: data2.functionLabel || null,
              signatureDataUrl: data2.signatureDataUrl || null,
              signatureUploadedUrl: data2.signatureUploadedUrl || null,
              gender: data2.gender || null,
            });
          }
          return;
        }
        const data = await res.json();
        if (!cancelled && data) {
          setDirectorInfo({
            fullName: data.fullName || '',
            functionLabel: data.functionLabel || null,
            signatureDataUrl: data.signatureDataUrl || null,
            signatureUploadedUrl: data.signatureUploadedUrl || null,
            gender: data.gender || null,
          });
        }
      } catch {
        // Silent fail — le directeur n'est pas configuré, on garde le fallback settings/identity
        if (!cancelled) {
          try {
            const res = await fetch('/api/settings/identity', { credentials: 'include' });
            if (res.ok) {
              const data = await res.json();
              if (!cancelled) {
                setDirectorNameState(data.directorName || data.director_name || '');
              }
            }
          } catch { /* silent */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [journal?.schoolLevelId]);

  // ⭐ Construire le label "Directeur" ou "Directrice" selon le genre
  const directorLabel = directorInfo?.gender === 'F' ? 'Directrice' : 'Directeur';
  const directorDisplayName = directorInfo?.fullName || directorNameState || 'Nom du directeur';
  const directorSig = directorInfo?.signatureDataUrl || directorInfo?.signatureUploadedUrl || null;

  // ⭐ Export PDF (Excel supprimé — pas pertinent pour le cahier journal)
  const handleExport = async (format: "pdf") => {
    if (!journal || exporting) return;
    setExporting(format);
    try {
      const res = await fetch(
        `/api/pedagogy-space/cahier-journal/${journal.id}/export?format=pdf`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cahier_Journal_${formatDate(weekStart)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ PDF exporté");
    } catch (e: any) {
      toast.error("Erreur d'export PDF", { description: e.message });
    } finally {
      setExporting(null);
    }
  };

  // === Sauvegarde ===
  const handleSave = async () => {
    if (!journal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          entries,
          observations,
          directorName,
          teacherSignature,
          directorSignature,
        }),
      });
      if (!res.ok) throw new Error("Erreur de sauvegarde");
      toast.success("✅ Cahier journal enregistré");
      // ⭐ Déclencher la bascule vers le sous-onglet Fiches (si le parent écoute)
      onJournalSaved?.(journal.id, {
        weekStartDate: journal.weekStartDate,
        weekEndDate: journal.weekEndDate,
        className: journal.classNameResolved || journal.className,
        status: journal.status,
        classId: selectedClassId,
      });
      loadJournal();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Soumission au directeur (cahier journal + fiches pédagogiques associées) ===
  //    Ouvre un modal de sélection des jours à soumettre :
  //      - Soit toute la semaine (lundi → vendredi)
  //      - Soit un sous-ensemble (ex: lundi, mardi, mercredi)
  //    Puis soumet le cahier journal + les fiches pédagogiques des jours
  //    sélectionnés en une seule transaction.
  const handleSubmit = () => {
    if (!journal) return;
    setShowDaySelectionModal(true);
  };

  // ⭐ Confirme et soumet le cahier journal + fiches pédagogiques
  const confirmSubmitWithFiches = async () => {
    if (!journal) return;
    const ok = await confirmWarning(
      `Confirmer la soumission ?`,
      'Soumission cahier journal + fiches',
      `Classe : ${journal.classNameResolved || journal.className || '—'}\n` +
      `Semaine du ${new Date(journal.weekStartDate).toLocaleDateString('fr-FR')}\n` +
      `Jours sélectionnés : ${selectedDays.length === 5 ? 'Toute la semaine' : selectedDays.join(', ')}\n\n` +
      `Cette action soumet :\n` +
      `• Le cahier journal\n` +
      `• Les fiches pédagogiques des jours sélectionnés\n\n` +
      `Le directeur sera notifié par email, WhatsApp et SMS.\n` +
      `Cette action est irréversible.`
    );
    if (!ok) return;
    setShowDaySelectionModal(false);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/submit-with-fiches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dayRange: selectedDays,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      toast.success("✅ Cahier journal soumis au directeur", {
        description: `${data.totalFiches || 0} fiche(s) pédagogique(s) soumise(s) — le directeur a été notifié.`,
      });
      // ⭐ Déclencher la bascule vers le sous-onglet Fiches (pour voir le résultat)
      onJournalSubmitted?.(journal.id, {
        weekStartDate: journal.weekStartDate,
        weekEndDate: journal.weekEndDate,
        className: journal.classNameResolved || journal.className,
        status: 'SUBMITTED',
      });
      loadJournal();
    } catch (e: any) {
      toast.error("Erreur lors de la soumission", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ⭐ Bascule la sélection d'un jour
  const toggleDay = (day: string) => {
    setSelectedDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  // === Navigation entre semaines ===
  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };
  const thisWeek = () => setWeekStart(getMondayOfWeek(new Date()));

  // === Mise à jour d'une case (day × subject) ===
  const updateEntry = (dayKey: string, subjectKey: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [dayKey]: {
        ...(prev[dayKey] || {}),
        [subjectKey]: value,
      },
    }));
  };

  const getEntry = (dayKey: string, subjectKey: string): string => {
    return entries[dayKey]?.[subjectKey] || "";
  };

  const selectedClass = classes.find(c => c.classId === selectedClassId);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  const isReadOnly = journal && (journal.status === "SUBMITTED" || journal.status === "VALIDATED");
  const statusConfig = journal ? STATUS_CONFIG[journal.status as keyof typeof STATUS_CONFIG] : null;

  return (
    <div className="space-y-4">
      {/* === En-tête : classe + semaine + actions === */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
            disabled={loading}
          >
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.className || c.classId} ({c.totalStudents || 0} élèves)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Semaine</label>
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[180px] text-center">
              du {formatDateFR(formatDate(weekStart))} au {formatDateFR(formatDate(weekEnd))}
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-slate-200 rounded-lg" title="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={thisWeek} className="ml-1 p-2 hover:bg-blue-100 text-blue-600 rounded-lg" title="Cette semaine">
              <Calendar className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {statusConfig && (
          <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wide", statusConfig.color)}>
            <statusConfig.icon className="h-4 w-4" />
            {statusConfig.label}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading || !journal || isReadOnly}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </button>
          {/* ⭐ Bouton Soumettre le cahier journal (séparé du registre + évaluation) */}
          <button
            onClick={handleSubmit}
            disabled={submitting || loading || !journal || journal.status !== "DRAFT"}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Soumettre
          </button>
          {/* ⭐ Badge statut si déjà soumis/validé */}
          {journal && journal.status !== "DRAFT" && (
            <span className="text-xs text-emerald-700 bg-emerald-100 px-3 py-2 rounded-lg font-semibold">
              {journal.status === 'SUBMITTED' ? '✓ Soumis au directeur' : journal.status === 'VALIDATED' ? '✓ Validé' : journal.status}
            </span>
          )}
          {/* ⭐ Bouton Export PDF (Excel supprimé — pas pertinent pour le cahier journal) */}
          {journal && (
            <button onClick={() => handleExport("pdf")} disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
              {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Export PDF
            </button>
          )}
        </div>
      </div>

      {journal?.status === "REJECTED" && journal.rejectionReason && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>Motif du rejet :</strong> {journal.rejectionReason}
        </div>
      )}

      {/* === En-tête du document === */}
      {!loading && journal && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 print:shadow-none">
          {dynamicSubjects.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <strong>Aucune matière configurée pour cette classe.</strong> L'administration de l'école
              doit d'abord configurer les matières dans le module Matières (table class_subjects).
            </div>
          )}
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">CAHIER JOURNAL</h2>
              <div className="text-sm text-slate-600">
                Nom de la classe : <span className="font-semibold">{selectedClass?.className || "—"}</span>
              </div>
              <div className="text-sm text-slate-600">
                Effectif : {selectedClass?.totalStudents || 0} élèves
                ({selectedClass?.boys || 0} G, {selectedClass?.girls || 0} F)
              </div>
            </div>
            <div className="text-right text-sm text-slate-600">
              <div>Semaine du <span className="font-semibold">{formatDateFR(formatDate(weekStart))}</span></div>
              <div>au <span className="font-semibold">{formatDateFR(formatDate(weekEnd))}</span></div>
              <div className="text-xs text-slate-400 mt-1">
                Année académique {academicYear?.label || academicYear?.name || ""}
              </div>
            </div>
          </div>

          {/* === PAGE 1 (RECTO) === JOURS | COLONNES GROUPÉES | OBSERVATIONS */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 1 — Recto</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {RECTO_COLUMNS.map((col) => {
                    const key = getColumnKey(col);
                    const subLabels = getColumnSubLabels(col);
                    return (
                      <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "180px" }}>
                        <div className="font-bold">{key}</div>
                        {subLabels.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                            {subLabels.map((label, i) => (
                              <span key={i}>
                                {i > 0 && <span className="text-slate-300"> · </span>}
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                    OBSERVATIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                      <div className="text-[10px] text-slate-400 mt-1 font-normal">
                        {formatDateFR(formatDate(new Date(weekStart.getTime() + (day.id - 1) * 86400000)))}
                      </div>
                    </td>
                    {RECTO_COLUMNS.map((col) => {
                      const key = getColumnKey(col);
                      return (
                        <td key={key} className="border border-slate-300 p-0">
                          <RichTextEditor
                            value={getEntry(day.key, key)}
                            onChange={(html) => updateEntry(day.key, key, html)}
                            disabled={isReadOnly}
                            placeholder="—"
                            minHeight="96px"
                          />
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 p-0">
                      <RichTextEditor
                        value={getEntry(day.key, "observations")}
                        onChange={(html) => updateEntry(day.key, "observations", html)}
                        disabled={isReadOnly}
                        placeholder="—"
                        minHeight="96px"
                      />
                      {/* ⭐ Observation du directeur (en rouge, sous l'observation de l'enseignant) */}
                      {getEntry(day.key, "directorObservation") && (
                        <div className="p-2 bg-red-50 border-t-2 border-red-300">
                          <div className="text-[9px] font-bold text-red-600 uppercase mb-1">Observation du Directeur</div>
                          <div className="text-xs text-red-800 font-semibold whitespace-pre-wrap">{getEntry(day.key, "directorObservation")}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === PAGE 2 (VERSO) === COLONNES GROUPÉES (suite) */}
          <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Page 2 — Verso</div>
          <div className="overflow-x-auto border border-slate-300 rounded-lg mb-6">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                    JOURS
                  </th>
                  {VERSO_COLUMNS.map((col) => {
                    const key = getColumnKey(col);
                    const subLabels = getColumnSubLabels(col);
                    return (
                      <th key={key} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "160px" }}>
                        <div className="font-bold">{key}</div>
                        {subLabels.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                            {subLabels.map((label, i) => (
                              <span key={i}>
                                {i > 0 && <span className="text-slate-300"> · </span>}
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <tr key={day.key} className="hover:bg-slate-50">
                    <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                      {day.label}
                    </td>
                    {VERSO_COLUMNS.map((col) => {
                      const key = getColumnKey(col);
                      return (
                        <td key={key} className="border border-slate-300 p-0">
                          <RichTextEditor
                            value={getEntry(day.key, key)}
                            onChange={(html) => updateEntry(day.key, key, html)}
                            disabled={isReadOnly}
                            placeholder="—"
                            minHeight="96px"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === OBSERVATIONS GLOBALES (bas de page) === */}
          {/* ⭐ Observations générales de la semaine */}
          {/*    En rouge quand le cahier journal est VALIDATED/REJECTED (observation du directeur) */}
          <div className={cn("mb-6 p-3 rounded-lg border", isReadOnly && (journal?.status === 'VALIDATED' || journal?.status === 'REJECTED') ? "bg-red-50 border-red-300" : "bg-white border-slate-200")}>
            <label className={cn(
              "block text-xs font-bold uppercase mb-2",
              isReadOnly && (journal?.status === 'VALIDATED' || journal?.status === 'REJECTED') ? "text-red-700" : "text-slate-700"
            )}>
              {isReadOnly && (journal?.status === 'VALIDATED' || journal?.status === 'REJECTED')
                ? "Observation générale du Directeur"
                : "Observations générales de la semaine"}
            </label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              disabled={isReadOnly}
              rows={3}
              placeholder="Observations générales sur la semaine..."
              className={cn(
                "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400",
                isReadOnly && (journal?.status === 'VALIDATED' || journal?.status === 'REJECTED')
                  ? "text-red-800 font-semibold border-red-200 bg-red-50/50"
                  : "border-slate-300 disabled:bg-slate-50"
              )}
            />
          </div>

          {/* === TRAVAUX & SUIVI LIÉS AU CAHIER JOURNAL (Phase 4c) === */}
          {/*    Affiche les HomeworkEntry rattachés à ce cahier journal (devoirs, leçons,
                  récitations, exposés) + le statut de chaque élève.
                  Permet à l'enseignant de rattacher un devoir à une case du cahier journal
                  lors de la création (cahierJournalId = journal.id). */}
          {journal?.id && (
            <div className="mb-6 p-4 rounded-xl border-2 border-blue-200 bg-blue-50/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase">Travaux & Suivi de la semaine</h3>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => {
                      // Pré-remplir la date d'échéance avec la date de fin de semaine
                      setTaskForm(prev => ({
                        ...prev,
                        dueDate: prev.dueDate || (journal.weekEndDate ? new Date(journal.weekEndDate).toISOString().split('T')[0] : ''),
                      }));
                      setShowTaskFormModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Créer un devoir lié
                  </button>
                )}
              </div>

              {loadingTasks ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : linkedTasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <ClipboardList className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs">Aucun devoir/exercice/leçon lié à cette semaine.</p>
                  <p className="text-[10px] mt-1">Cliquez sur "Créer un devoir lié" pour rattacher un travail à ce cahier journal.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedTasks.map((task) => {
                    const isExpanded = expandedTaskId === task.id;
                    const TASK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
                      HOMEWORK: { label: 'Devoir', color: 'bg-blue-100 text-blue-700' },
                      RESEARCH: { label: 'Recherche/Exposé', color: 'bg-purple-100 text-purple-700' },
                      LESSON: { label: 'Leçon à recopier', color: 'bg-amber-100 text-amber-700' },
                      RECITATION: { label: 'Récitation', color: 'bg-cyan-100 text-cyan-700' },
                      PRACTICAL: { label: 'Activité pratique', color: 'bg-emerald-100 text-emerald-700' },
                      PROJECT: { label: 'Projet', color: 'bg-rose-100 text-rose-700' },
                    };
                    const typeConfig = TASK_TYPE_LABELS[task.taskType] || TASK_TYPE_LABELS.HOMEWORK;
                    return (
                      <div key={task.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                        {/* En-tête cliquable */}
                        <button
                          onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-50"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", typeConfig.color)}>
                              {typeConfig.label}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                            {task.subject?.name && (
                              <span className="text-xs text-slate-500">• {task.subject.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            {/* Mini stats */}
                            <span className="text-emerald-600 font-bold">✓ {task.done + task.recited + task.presented}</span>
                            <span className="text-rose-600 font-bold">✗ {task.notDone + task.notRecited + task.notPresented}</span>
                            <span className="text-amber-600 font-bold">⏳ {task.pending}</span>
                            <span className="text-slate-400">/ {task.totalStudents}</span>
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                          </div>
                        </button>

                        {/* Détails expand */}
                        {isExpanded && (
                          <div className="p-3 border-t border-slate-100 space-y-3">
                            {/* Description + dates */}
                            <div className="text-xs text-slate-600">
                              {task.description && <p className="mb-1">{task.description}</p>}
                              <div className="flex gap-4">
                                <span>📅 Échéance : <strong>{new Date(task.dueDate).toLocaleDateString('fr-FR')}</strong></span>
                                {task.presentationDate && (
                                  <span>🎤 Présentation : <strong>{new Date(task.presentationDate).toLocaleDateString('fr-FR')}</strong></span>
                                )}
                                {task.maxScore && <span>📊 Note max : <strong>{task.maxScore}/20</strong></span>}
                              </div>
                              {task.observations && <p className="mt-1 italic text-slate-500">📝 {task.observations}</p>}
                            </div>

                            {/* Tableau des élèves */}
                            {task.students && task.students.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-slate-50">
                                      <th className="border border-slate-200 px-2 py-1.5 text-left font-bold">Élève</th>
                                      <th className="border border-slate-200 px-2 py-1.5 text-center font-bold">Statut</th>
                                      <th className="border border-slate-200 px-2 py-1.5 text-center font-bold">Note</th>
                                      <th className="border border-slate-200 px-2 py-1.5 text-left font-bold">Appréciation</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {task.students.map((ts: any) => {
                                      const STATUS_COLORS: Record<string, string> = {
                                        DONE: 'bg-emerald-100 text-emerald-700',
                                        NOT_DONE: 'bg-rose-100 text-rose-700',
                                        PENDING: 'bg-slate-100 text-slate-600',
                                        LATE: 'bg-red-100 text-red-700',
                                        INCOMPLETE: 'bg-amber-100 text-amber-700',
                                        TO_REDO: 'bg-rose-100 text-rose-700',
                                        RECITED: 'bg-emerald-100 text-emerald-700',
                                        NOT_RECITED: 'bg-rose-100 text-rose-700',
                                        PRESENTED: 'bg-emerald-100 text-emerald-700',
                                        NOT_PRESENTED: 'bg-rose-100 text-rose-700',
                                      };
                                      const STATUS_LABELS: Record<string, string> = {
                                        DONE: 'Fait', NOT_DONE: 'Non fait', PENDING: 'En attente',
                                        LATE: 'En retard', INCOMPLETE: 'Incomplet', TO_REDO: 'À refaire',
                                        RECITED: 'Récit. réussie', NOT_RECITED: 'Récit. échouée',
                                        PRESENTED: 'Exposé présenté', NOT_PRESENTED: 'Exposé non présenté',
                                      };
                                      return (
                                        <tr key={ts.id || ts.studentId}>
                                          <td className="border border-slate-200 px-2 py-1 font-medium">
                                            {ts.student?.firstName} {ts.student?.lastName}
                                          </td>
                                          <td className="border border-slate-200 px-2 py-1 text-center">
                                            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-bold", STATUS_COLORS[ts.status] || 'bg-slate-100')}>
                                              {STATUS_LABELS[ts.status] || ts.status}
                                            </span>
                                          </td>
                                          <td className="border border-slate-200 px-2 py-1 text-center font-bold">
                                            {ts.score != null ? `${ts.score}/${task.maxScore || 20}` : '—'}
                                          </td>
                                          <td className="border border-slate-200 px-2 py-1 text-slate-600">
                                            {ts.appreciation || '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === MODAL : Créer un devoir lié au cahier journal (Phase 4c) === */}
          {showTaskFormModal && journal?.id && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b bg-blue-50 border-blue-200">
                  <div className="flex items-center gap-3">
                    <Plus className="h-10 w-10 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Créer un devoir lié à la semaine</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ce devoir sera rattaché au cahier journal de la semaine du {journal.weekStartDate ? new Date(journal.weekStartDate).toLocaleDateString('fr-FR') : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Titre *</label>
                    <input type="text" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      placeholder="Ex: Exercices page 45, Leçon à recopier, Récitation table de 7..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Description</label>
                    <textarea value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      rows={2} placeholder="Détails du devoir..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Type</label>
                      <select value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                        <option value="HOMEWORK">Devoir / Exercices</option>
                        <option value="LESSON">Leçon à recopier</option>
                        <option value="RECITATION">Récitation</option>
                        <option value="RESEARCH">Recherche / Exposé</option>
                        <option value="PRACTICAL">Activité pratique</option>
                        <option value="PROJECT">Projet</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Note max</label>
                      <input type="number" value={taskForm.maxScore} onChange={(e) => setTaskForm({ ...taskForm, maxScore: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date d'échéance *</label>
                      <input type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Date de présentation (optionnel)</label>
                      <input type="date" value={taskForm.presentationDate} onChange={(e) => setTaskForm({ ...taskForm, presentationDate: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Observations</label>
                    <textarea value={taskForm.observations} onChange={(e) => setTaskForm({ ...taskForm, observations: e.target.value })}
                      rows={2} placeholder="Observations pour les parents..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                  <button onClick={() => setShowTaskFormModal(false)} disabled={creatingTask}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50">
                    Annuler
                  </button>
                  <button onClick={handleCreateLinkedTask} disabled={creatingTask || !taskForm.title || !taskForm.dueDate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                    {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Créer le devoir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === PIED DE PAGE — Signatures (comme Registre d'appel) === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
            {/* Signature Directeur */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Visa du {directorLabel}</div>
                  <div className="text-xs text-slate-500">
                    {journal?.status === 'VALIDATED'
                      ? `${directorDisplayName} — Signature et cachet`
                      : `${directorDisplayName} — Signature disponible après validation`}
                  </div>
                </div>
                {journal?.status === 'VALIDATED' && (directorSignature || directorSig) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
                {journal?.status !== 'VALIDATED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">
                    En attente
                  </span>
                )}
              </div>
              {/* ⭐ Signature du directeur : affichée SEULEMENT si le cahier journal est VALIDATED.
                  Avant validation, l'enseignant ne voit pas la signature du directeur. */}
              {journal?.status === 'VALIDATED' ? (
                <>
                  {(directorSignature || directorSig) ? (
                    <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                      <img src={directorSignature || directorSig || ''} alt={`Signature ${directorLabel}`} className="max-h-24 mx-auto" />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-2 h-[120px] flex items-center justify-center text-slate-400 text-xs">
                      Signature du directeur non disponible
                    </div>
                  )}
                </>
              ) : (
                <div className="border-2 border-dashed border-amber-300 bg-amber-50/30 rounded-xl p-2 h-[120px] flex items-center justify-center text-amber-600 text-xs font-medium">
                  {journal?.status === 'SUBMITTED'
                    ? 'Cahier journal soumis — en attente de validation du directeur'
                    : journal?.status === 'REJECTED'
                    ? 'Cahier journal rejeté — à corriger et resoumettre'
                    : 'La signature du directeur apparaîtra après validation'}
                </div>
              )}
            </div>

            {/* Signature Titulaire */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">Visa du Titulaire</div>
                  <div className="text-xs text-slate-500">
                    {/* ⭐ Afficher le VRAI titulaire de la classe (résolu backend)
                        au lieu du user connecté (qui peut être le promoteur) */}
                    {journal?.teacherFirstName || journal?.teacherLastName
                      ? `${journal.teacherGender === 'F' ? 'Mme' : (journal.teacherGender === 'M' ? 'M.' : '')} ${(journal.teacherLastName || '').toUpperCase()} ${journal.teacherFirstName || ''}`.trim()
                      : (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Nom du titulaire')
                    } — Signature
                  </div>
                </div>
                {teacherSignature && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Signé
                  </span>
                )}
              </div>
              {teacherSignature ? (
                <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                  <img src={teacherSignature} alt="Signature Titulaire" className="max-h-24 mx-auto" />
                </div>
              ) : (
                <SignatureCanvas
                  width={400}
                  height={120}
                  disabled={isReadOnly}
                  placeholder="Signature du Titulaire"
                  onSignatureChange={(data) => setTeacherSignature(data)}
                />
              )}
              {teacherSignature && !isReadOnly && (
                <button type="button" onClick={() => setTeacherSignature(null)} className="text-xs text-red-500 hover:underline">
                  Effacer la signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === États de chargement === */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Chargement du cahier journal…
        </div>
      )}

      {!loading && !selectedClassId && classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <NotebookPen className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium text-slate-600">Aucune classe assignée</p>
          <p className="text-sm text-slate-500 mt-1">Vous n'avez pas de classe assignée pour cette année.</p>
        </div>
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <Lock className="h-4 w-4" />
          Ce cahier journal est verrouillé (statut: {journal?.status}). Vous ne pouvez plus le modifier.
        </div>
      )}
      {/* ⭐ Modal de confirmation professionnel (remplace confirm()) */}
      {confirmDialog}

      {/* ⭐ Modal de sélection des jours (cahier journal + fiches pédagogiques) */}
      {showDaySelectionModal && journal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Soumettre au directeur</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Cahier journal + fiches pédagogiques
                </p>
              </div>
              <button
                onClick={() => setShowDaySelectionModal(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Infos contexte */}
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 space-y-1">
              <div><strong>Classe :</strong> {journal.classNameResolved || journal.className || '—'}</div>
              <div><strong>Semaine :</strong> du {new Date(journal.weekStartDate).toLocaleDateString('fr-FR')} au {new Date(journal.weekEndDate).toLocaleDateString('fr-FR')}</div>
            </div>

            {/* Sélection des jours */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Jours à soumettre <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Sélectionnez les jours à inclure dans cette soumission.
                Les fiches pédagogiques des jours sélectionnés seront automatiquement
                soumises avec le cahier journal.
              </p>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'lundi', label: 'Lun' },
                  { key: 'mardi', label: 'Mar' },
                  { key: 'mercredi', label: 'Mer' },
                  { key: 'jeudi', label: 'Jeu' },
                  { key: 'vendredi', label: 'Ven' },
                ].map(day => (
                  <button
                    key={day.key}
                    onClick={() => toggleDay(day.key)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                      selectedDays.includes(day.key)
                        ? "bg-emerald-600 text-white border-2 border-emerald-700"
                        : "bg-white text-slate-600 border-2 border-slate-200 hover:border-emerald-300"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setSelectedDays(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'])}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  Tout sélectionner
                </button>
                <span className="text-slate-300">·</span>
                <button
                  onClick={() => setSelectedDays([])}
                  className="text-xs font-semibold text-slate-500 hover:underline"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            {/* Avertissement */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Cette action soumet le cahier journal et les fiches pédagogiques des
                jours sélectionnés. Le directeur sera notifié par email, WhatsApp et SMS.
                Cette action est irréversible.
              </p>
            </div>

            {/* Boutons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDaySelectionModal(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmSubmitWithFiches}
                disabled={submitting || selectedDays.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Soumission...' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
