'use client';

/**
 * ============================================================================
 * DISCIPLINE WORKSPACE — Module Vie Scolaire (refonte 2026-09-28)
 * ============================================================================
 *
 * Refonte complète : remplace l'ancien monolithe de 1082 lignes par une
 * architecture propre en 4 couches :
 *
 *   1. disciplineApi          — service client centralisé (fetch + auth)
 *   2. useDisciplineData     — hook dédié au chargement des données
 *   3. useClassStudents      — hook dédié au chargement des élèves par classe
 *   4. Composants UI         — DisciplineWorkspace + 3 Tabs + 5 Modals
 *
 * Patterns canoniques appliqués :
 *   - Chargement des élèves : /api/students?classId=X&academicYearId=Y
 *     (le backend /students supporte classId directement dans le where,
 *     cf. students-prisma.service.ts:215 — c'est /enrollments qui ne le
 *     supportait PAS, c'était la source du bug « Aucun élève inscrit »).
 *   - Tri pédagogique des classes : 6e → 5e → 4e → 3e → 2nde → 1ère → Terminale
 *   - Modal centré : un SEUL className par <motion.div> (l'ancien avait 2
 *     className → le 2e écrasait le 1er → mx-auto perdu → modal à GAUCHE).
 *   - Settings rechargés après sauvegarde : le backend retourne l'objet
 *     {id, conduct_reference, critical_threshold} et le frontend met à
 *     jour l'état conductSettings (l'ancien ne relisait pas, d'où le bug
 *     « 17/5 affiché même après avoir sauvegardé 18/6 »).
 *
 * Tableaux de données :
 *   - rules : DisciplineRule[] (depuis /api/discipline/rules)
 *   - sanctions : Sanction[] (depuis /api/discipline/sanctions)
 *   - classes : ClassInfo[] (depuis /api/all-classes, filtrées SECONDAIRE)
 *   - conductSettings : { conduct_reference, critical_threshold } (depuis
 *     /api/discipline/conduct/settings)
 *   - classStudents : Map<classId, Student[]> (chargé à la demande quand
 *     on déplie une classe — pattern identique à Exams/grades)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Plus, Loader2, Search, Gavel, BookOpen, Settings, X,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Trash2, Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ─── Types ────────────────────────────────────────────────────────────────

interface DisciplineRule {
  id: string; name: string; description?: string;
  hours_penalty: number; points_deducted: number; severity: string; isActive: boolean;
}
interface Sanction {
  id: string; studentId: string; studentName: string; className: string;
  fault_name: string; hours_attributed: number; points_deducted: number;
  sanction_date: string; status: string; comment?: string;
  notificationStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  parentNotifiedAt?: string;
  notificationChannels?: { whatsapp?: string; sms?: string; event?: string };
}
interface ClassInfo { id: string; name: string; code: string; schoolLevelId?: string; }
interface LevelGroup { levelName: string; levelCode: string; classes: ClassInfo[]; }
interface ConductSettings { conduct_reference: number; critical_threshold: number; }
interface Student {
  id: string; firstName: string; lastName: string; matricule?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  MODERATE: 'bg-orange-100 text-orange-800 border-orange-300',
  MAJOR: 'bg-red-100 text-red-800 border-red-300',
  CRITICAL: 'bg-red-200 text-red-900 border-red-400',
};
const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Mineure', MODERATE: 'Modérée', MAJOR: 'Grave', CRITICAL: 'Critique',
};

// ─── Tri pédagogique (6e → 5e → 4e → 3e → 2nde → 1ère → Terminale) ────────
//    Patterns reconnus : « 6e », « 6ème », « 5e », « 4e », « 3e », « 2nde »,
//    « Seconde », « 1ère », « Première », « Terminale », « Tle », « Term ».
//    Tolérance aux accents (normalisation NFD) et séparateurs (espace/tiret).

const PEDAGOGICAL_ORDER = [
  '6E', '6EME', '5E', '5EME', '4E', '4EME', '3E', '3EME',
  '2NDE', 'SECONDE', '1ERE', 'PREMIERE', 'TERMINALE', 'TLE', 'TERM',
];

function pedagogicalSortIndex(name: string): number {
  const upper = (name || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    const pat = PEDAGOGICAL_ORDER[i];
    const re = new RegExp(`(^|\\s|-)${pat}(\\s|$|-)`, 'i');
    if (re.test(upper)) return i;
  }
  return PEDAGOGICAL_ORDER.length;
}

function sortClassesPedagogically<T extends { name?: string }>(classes: T[]): T[] {
  return [...classes].sort((a, b) => {
    const idxA = pedagogicalSortIndex(a.name || '');
    const idxB = pedagogicalSortIndex(b.name || '');
    if (idxA !== idxB) return idxA - idxB;
    return (a.name || '').localeCompare(b.name || '', 'fr');
  });
}

// ─── Service API centralisé ───────────────────────────────────────────────

async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const authHeaders = getClientAuthorizationHeader();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      msg = err?.message || err?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  // Some endpoints return empty body on success
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

const disciplineApi = {
  // ── Rules ──
  listRules: (academicYearId: string, schoolLevelId?: string) => {
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);
    return apiFetch<DisciplineRule[]>(`/api/discipline/rules?${params}`);
  },
  createRule: (data: Partial<DisciplineRule>) =>
    apiFetch('/api/discipline/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (data: Partial<DisciplineRule> & { id: string }) =>
    apiFetch('/api/discipline/rules', { method: 'PUT', body: JSON.stringify(data) }),

  // ── Sanctions ──
  listSanctions: (academicYearId: string, schoolLevelId?: string) => {
    const params = new URLSearchParams({ academicYearId });
    if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);
    return apiFetch<Sanction[]>(`/api/discipline/sanctions?${params}`);
  },
  createSanction: (data: any) =>
    apiFetch('/api/discipline/sanctions', { method: 'POST', body: JSON.stringify(data) }),
  cancelSanction: (id: string, reason: string) =>
    apiFetch(`/api/discipline/sanctions/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }),

  // ── Settings ──
  getSettings: (academicYearId: string) => {
    const params = new URLSearchParams({ academicYearId });
    return apiFetch<ConductSettings>(`/api/discipline/conduct/settings?${params}`);
  },
  updateSettings: (data: {
    academicYearId: string; schoolLevelId?: string;
    conduct_reference: number; critical_threshold: number;
  }) =>
    apiFetch('/api/discipline/conduct/settings', {
      method: 'PUT', body: JSON.stringify(data),
    }),

  // ── Classes (secondary) ──
  listSecondaryClasses: (academicYearId: string) => {
    const params = new URLSearchParams({ academicYearId });
    return apiFetch<ClassInfo[]>(`/api/all-classes?${params}`).then((all) =>
      (Array.isArray(all) ? all : []).filter((c: any) =>
        c.schoolLevel?.code === 'SECONDAIRE'
      )
    );
  },

  // ── Students per class (canonical pattern) ──
  //    Backend /students supports classId directly in the where clause
  //    (cf. students-prisma.service.ts:215 — studentEnrollments.some({classId})).
  //    This is the SAME pattern used by StudentsModulePage and Exams/grades.
  listStudentsByClass: (classId: string, academicYearId: string) => {
    const params = new URLSearchParams({ classId, academicYearId });
    return apiFetch<Student[]>(`/api/students?${params}`).then((d: any) => {
      // Backend may return array directly or { data: [], items: [] }
      return Array.isArray(d) ? d : (d?.data ?? d?.items ?? d?.students ?? []);
    });
  },
};

// ─── Hook : chargement des données Vie Scolaire ──────────────────────────

function useDisciplineData(academicYear?: any, schoolLevelId?: string) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DisciplineRule[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [conductSettings, setConductSettings] = useState<ConductSettings>({
    conduct_reference: 17, critical_threshold: 5,
  });

  const loadData = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const [rulesData, sanctionsData, classesData, settingsData] = await Promise.all([
        disciplineApi.listRules(academicYear.id, schoolLevelId).catch(() => []),
        disciplineApi.listSanctions(academicYear.id, schoolLevelId).catch(() => []),
        disciplineApi.listSecondaryClasses(academicYear.id).catch(() => []),
        disciplineApi.getSettings(academicYear.id).catch(() => null),
      ]);
      setRules(rulesData);
      setSanctions(sanctionsData);
      setClasses(classesData);
      if (settingsData && typeof settingsData.conduct_reference === 'number') {
        setConductSettings({
          conduct_reference: Number(settingsData.conduct_reference),
          critical_threshold: Number(settingsData.critical_threshold ?? 5),
        });
      }
    } catch (err) {
      console.error('Discipline load error:', err);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevelId]);

  useEffect(() => { loadData(); }, [loadData]);

  return {
    loading, rules, sanctions, classes, conductSettings,
    setRules, setSanctions, setClasses, setConductSettings,
    loadData,
  };
}

// ─── Hook : élèves par classe (chargés à la demande) ────────────────────

function useClassStudents(academicYearId?: string) {
  const [classStudents, setClassStudents] = useState<Map<string, Student[]>>(new Map());
  const [loadingClassStudents, setLoadingClassStudents] = useState<Set<string>>(new Set());

  const loadClassStudents = useCallback(async (classId: string) => {
    if (!academicYearId || classStudents.has(classId)) return;
    setLoadingClassStudents((prev) => new Set(prev).add(classId));
    try {
      const students = await disciplineApi.listStudentsByClass(classId, academicYearId);
      setClassStudents((prev) => new Map(prev).set(classId, students));
    } catch (err) {
      console.error('loadClassStudents error:', err);
      // On stocke un tableau vide pour ne pas retry indéfiniment
      setClassStudents((prev) => new Map(prev).set(classId, []));
    } finally {
      setLoadingClassStudents((prev) => {
        const n = new Set(prev);
        n.delete(classId);
        return n;
      });
    }
  }, [academicYearId, classStudents]);

  return { classStudents, loadingClassStudents, loadClassStudents };
}

// ─── Composant principal : DisciplineWorkspace ──────────────────────────

export default function DisciplineWorkspace({
  tenant, academicYear, schoolLevelId,
}: { tenant?: any; academicYear?: any; schoolLevelId?: string; }) {
  const [activeTab, setActiveTab] = useState<'sanctions' | 'conduct' | 'rules'>('sanctions');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [modalClassId, setModalClassId] = useState<string | null>(null);
  const [modalClassName, setModalClassName] = useState<string>('');
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);
  const [modalStudentName, setModalStudentName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [cancellingSanctionId, setCancellingSanctionId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editingRule, setEditingRule] = useState<DisciplineRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const {
    loading, rules, sanctions, classes, conductSettings,
    setRules, setSanctions, setClasses, setConductSettings, loadData,
  } = useDisciplineData(academicYear, schoolLevelId);

  const { classStudents, loadingClassStudents, loadClassStudents } = useClassStudents(academicYear?.id);

  const { toast } = useToast();

  // ⭐ Classes triées pédagogiquement (6e → Terminale) pour le tab Sanctions
  //    et pour le SanctionModal (sélecteur de classe).
  const sortedClasses = useMemo(() => sortClassesPedagogically(classes), [classes]);

  // Sanctions groupées par nom de classe
  const sanctionsByClass = useMemo(() => {
    const map = new Map<string, Sanction[]>();
    for (const s of sanctions) {
      const key = s.className || 'Sans classe';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sanctions]);

  const toggleClass = (id: string) => {
    setExpandedClasses((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
        loadClassStudents(id); // ⭐ Charger les élèves au dépliage
      }
      return n;
    });
  };

  const openSanctionModal = (
    classId: string | null,
    className: string,
    studentId?: string,
    studentName?: string,
  ) => {
    setModalClassId(classId);
    setModalClassName(className);
    setModalStudentId(studentId || null);
    setModalStudentName(studentName || '');
    setShowSanctionModal(true);
  };

  const handleCancelSanction = async (sanctionId: string) => {
    if (!cancelReason.trim()) {
      toast({
        title: 'Erreur',
        description: 'Veuillez indiquer le motif d\'annulation',
        variant: 'destructive',
      });
      return;
    }
    try {
      await disciplineApi.cancelSanction(sanctionId, cancelReason);
      toast({
        title: '✅ Sanction annulée',
        description: 'Les points ont été remboursés au compteur de conduite',
      });
      setCancellingSanctionId(null);
      setCancelReason('');
      loadData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await disciplineApi.updateRule({ id: ruleId, isActive: false });
      toast({ title: '✅ Règle supprimée', description: 'La règle a été désactivée' });
      setDeletingRuleId(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Discipline & Vie Scolaire
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Sanctions, compteur de conduite et présences — organisé par niveau et par classe
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'rules' && (
            <Button
              onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" /> Nouvelle règle
            </Button>
          )}
          <Button
            onClick={() => setShowSettingsModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            title="Configurer la moyenne de conduite"
          >
            <Settings className="w-4 h-4 mr-2" /> Paramètres conduite
          </Button>
          <Button
            onClick={() => {
              setModalClassId(null);
              setModalClassName('');
              setModalStudentId(null);
              setModalStudentName('');
              setShowSanctionModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Nouvelle sanction
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'sanctions', label: 'Sanctions', icon: Gavel },
          { id: 'conduct', label: 'Compteur de conduite', icon: BookOpen },
          { id: 'rules', label: 'Barème des fautes', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : activeTab === 'sanctions' ? (
        <SanctionsTab
          classes={sortedClasses}
          expandedClasses={expandedClasses}
          toggleClass={toggleClass}
          sanctionsByClass={sanctionsByClass}
          classStudents={classStudents}
          loadingClassStudents={loadingClassStudents}
          onOpenSanctionModal={openSanctionModal}
          onCancelSanction={(id) => { setCancellingSanctionId(id); setCancelReason(''); }}
        />
      ) : activeTab === 'conduct' ? (
        <ConductTab
          sanctions={sanctions}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          conductReference={conductSettings.conduct_reference}
          criticalThreshold={conductSettings.critical_threshold}
        />
      ) : (
        <RulesTab
          rules={rules}
          onEdit={(r) => setEditingRule(r)}
          onDelete={(id) => setDeletingRuleId(id)}
        />
      )}

      {/* Modals */}
      {showSanctionModal && (
        <SanctionModal
          onClose={() => setShowSanctionModal(false)}
          onSuccess={() => { loadData(); setShowSanctionModal(false); }}
          rules={rules}
          academicYearId={academicYear?.id}
          schoolLevelId={schoolLevelId}
          classId={modalClassId}
          className={modalClassName}
          preselectedStudentId={modalStudentId}
          preselectedStudentName={modalStudentName}
          allClasses={sortedClasses}
        />
      )}
      {showRuleModal && (
        <RuleModal
          onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
          onSuccess={() => { loadData(); setShowRuleModal(false); setEditingRule(null); }}
          editingRule={editingRule}
        />
      )}
      {showSettingsModal && (
        <ConductSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSuccess={(updated) => {
            // ⭐ 2026-09-28 — Mettre à jour immédiatement l'état conductSettings
            //    avec les valeurs retournées par le backend. Sans ça, l'UI
            //    afficherait encore les anciennes valeurs (17/5) jusqu'au
            //    prochain rechargement complet — d'où le bug « 17/5 affiché
            //    même après avoir sauvegardé 18/6 ».
            setConductSettings(updated);
            loadData();
            setShowSettingsModal(false);
          }}
          academicYearId={academicYear?.id}
          schoolLevelId={schoolLevelId}
          currentReference={conductSettings.conduct_reference}
          currentThreshold={conductSettings.critical_threshold}
        />
      )}

      {cancellingSanctionId && (
        <CancelSanctionModal
          onClose={() => { setCancellingSanctionId(null); setCancelReason(''); }}
          onConfirm={() => handleCancelSanction(cancellingSanctionId)}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
        />
      )}
      {deletingRuleId && (
        <DeleteRuleModal
          onClose={() => setDeletingRuleId(null)}
          onConfirm={() => handleDeleteRule(deletingRuleId)}
        />
      )}
    </div>
  );
}

// ─── Sanctions Tab ────────────────────────────────────────────────────────

function SanctionsTab({
  classes, expandedClasses, toggleClass, sanctionsByClass,
  classStudents, loadingClassStudents, onOpenSanctionModal, onCancelSanction,
}: {
  classes: ClassInfo[];
  expandedClasses: Set<string>;
  toggleClass: (id: string) => void;
  sanctionsByClass: Map<string, Sanction[]>;
  classStudents: Map<string, Student[]>;
  loadingClassStudents: Set<string>;
  onOpenSanctionModal: (classId: string | null, className: string, studentId?: string, studentName?: string) => void;
  onCancelSanction: (sanctionId: string) => void;
}) {
  if (classes.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
        Aucune classe secondaire disponible.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {classes.map((cls) => {
        const clsSanctions = sanctionsByClass.get(cls.name) || [];
        return (
          <div key={cls.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleClass(cls.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-blue-50/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedClasses.has(cls.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span className="font-bold text-gray-900">{cls.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{clsSanctions.length} sanction(s)</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenSanctionModal(cls.id, cls.name); }}
                  className="px-2 py-1 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  + Sanction
                </button>
              </div>
            </button>
            {expandedClasses.has(cls.id) && (
              <div className="px-8 pb-3 space-y-3">
                {/* ⭐ Liste des élèves de la classe */}
                {loadingClassStudents.has(cls.id) ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement des élèves…
                  </div>
                ) : (classStudents.get(cls.id) || []).length > 0 ? (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Élèves de la classe
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {(classStudents.get(cls.id) || []).map((stu) => {
                        const studentSanctions = clsSanctions.filter((s) => s.studentId === stu.id);
                        return (
                          <div
                            key={stu.id}
                            className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-blue-50/50 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-gray-700 truncate">
                                {stu.lastName} {stu.firstName}
                              </span>
                              {studentSanctions.length > 0 && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold flex-shrink-0">
                                  {studentSanctions.length} sanction{studentSanctions.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenSanctionModal(
                                  cls.id, cls.name, stu.id,
                                  `${stu.lastName} ${stu.firstName}`,
                                );
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                            >
                              + Sanction
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 py-2">
                    Aucun élève inscrit dans cette classe.
                  </div>
                )}

                {/* ⭐ Sanctions existantes de la classe */}
                {clsSanctions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Sanctions enregistrées
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs whitespace-nowrap">Élève</TableHead>
                          <TableHead className="text-xs whitespace-nowrap">Faute</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Heures</TableHead>
                          <TableHead className="text-xs text-right whitespace-nowrap">Points</TableHead>
                          <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                          <TableHead className="text-xs text-center whitespace-nowrap">Statut</TableHead>
                          <TableHead className="text-xs text-center whitespace-nowrap">Notif. parent</TableHead>
                          <TableHead className="text-xs text-center whitespace-nowrap">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clsSanctions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-xs font-medium whitespace-nowrap">{s.studentName}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">{s.fault_name}</TableCell>
                            <TableCell className="text-xs text-right whitespace-nowrap">{s.hours_attributed}h</TableCell>
                            <TableCell className="text-xs text-right font-bold text-red-600 whitespace-nowrap">
                              -{s.points_deducted}
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {new Date(s.sanction_date).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell className="text-xs text-center whitespace-nowrap">
                              {s.status === 'ACTIVE' ? (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">
                                  Active
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                                  Annulée
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-center whitespace-nowrap">
                              <NotificationBadge status={s.notificationStatus} channels={s.notificationChannels} />
                            </TableCell>
                            <TableCell className="text-xs text-center whitespace-nowrap">
                              {s.status === 'ACTIVE' && (
                                <button
                                  onClick={() => onCancelSanction(s.id)}
                                  className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                >
                                  Annuler
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Conduct Tab ──────────────────────────────────────────────────────────

function ConductTab({
  sanctions, searchQuery, setSearchQuery, conductReference, criticalThreshold,
}: {
  sanctions: Sanction[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  conductReference: number;
  criticalThreshold: number;
}) {
  const conductByStudent = useMemo(() => {
    const map = new Map<string, {
      studentName: string; className: string; totalDeducted: number; reference: number;
    }>();
    for (const s of sanctions) {
      if (s.status !== 'ACTIVE') continue;
      const key = s.studentId;
      if (!map.has(key)) {
        map.set(key, {
          studentName: s.studentName, className: s.className,
          totalDeducted: 0, reference: conductReference,
        });
      }
      map.get(key)!.totalDeducted += s.points_deducted;
    }
    return Array.from(map.values()).map((c) => ({
      ...c, conduct_final: Math.max(0, c.reference - c.totalDeducted),
    })).sort((a, b) => a.conduct_final - b.conduct_final);
  }, [sanctions, conductReference]);

  const filtered = conductByStudent.filter((c) =>
    !searchQuery
    || c.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
    || c.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher un élève..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="text-right whitespace-nowrap">Référence</TableHead>
              <TableHead className="text-right whitespace-nowrap">Déduits</TableHead>
              <TableHead className="text-right whitespace-nowrap">Conduite</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Aucune donnée. Les données apparaîtront après la première sanction.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c, i) => {
                const isCritical = c.conduct_final <= criticalThreshold;
                const isWarning = c.conduct_final <= (conductReference / 2) && c.conduct_final > criticalThreshold;
                return (
                  <TableRow key={i} className="hover:bg-slate-50">
                    <TableCell className="font-medium whitespace-nowrap">{c.studentName}</TableCell>
                    <TableCell className="whitespace-nowrap">{c.className || '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{c.reference}</TableCell>
                    <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{c.totalDeducted}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'font-bold px-2 py-0.5 rounded',
                          isCritical
                            ? 'bg-red-100 text-red-700'
                            : isWarning
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700',
                        )}
                      >
                        {c.conduct_final}
                      </span>
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      {isCritical ? (
                        <span className="text-red-600 text-xs font-bold flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Critique
                        </span>
                      ) : isWarning ? (
                        <span className="text-orange-600 text-xs font-bold">Attention</span>
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────────────

function RulesTab({
  rules, onEdit, onDelete,
}: {
  rules: DisciplineRule[];
  onEdit: (rule: DisciplineRule) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="whitespace-nowrap">Faute</TableHead>
            <TableHead className="whitespace-nowrap">Description</TableHead>
            <TableHead className="text-right whitespace-nowrap">Heures</TableHead>
            <TableHead className="text-right whitespace-nowrap">Points</TableHead>
            <TableHead className="text-center whitespace-nowrap">Gravité</TableHead>
            <TableHead className="text-center whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                Aucune règle configurée. Cliquez sur &quot;Nouvelle règle&quot;.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((r) => (
              <TableRow key={r.id} className="hover:bg-slate-50">
                <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
                <TableCell className="text-sm text-gray-600 whitespace-nowrap">{r.description || '—'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{r.hours_penalty}h</TableCell>
                <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{r.points_deducted} pts</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', SEVERITY_COLORS[r.severity])}>
                    {SEVERITY_LABELS[r.severity] || r.severity}
                  </span>
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onEdit(r)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Modifier">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onDelete(r.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Supprimer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Sanction Modal ──────────────────────────────────────────────────────

function SanctionModal({
  onClose, onSuccess, rules, academicYearId, schoolLevelId,
  classId, className, preselectedStudentId, preselectedStudentName, allClasses,
}: {
  onClose: () => void;
  onSuccess: () => void;
  rules: DisciplineRule[];
  academicYearId?: string;
  schoolLevelId?: string;
  classId?: string | null;
  className?: string;
  preselectedStudentId?: string | null;
  preselectedStudentName?: string;
  allClasses?: ClassInfo[];
}) {
  const [selectedClassId, setSelectedClassId] = useState(classId || '');
  const [selectedStudent, setSelectedStudent] = useState<any>(
    preselectedStudentId
      ? {
          id: preselectedStudentId,
          firstName: preselectedStudentName?.split(' ')[1] || '',
          lastName: preselectedStudentName?.split(' ')[0] || '',
        }
      : null,
  );
  const [classStudentsList, setClassStudentsList] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [customFaultName, setCustomFaultName] = useState('');
  const [hours, setHours] = useState(0);
  const [points, setPoints] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // ⭐ Charger les élèves quand la classe change — pattern canonique
  //    /api/students?classId=X&academicYearId=Y
  useEffect(() => {
    if (!selectedClassId || !academicYearId) {
      setClassStudentsList([]);
      return;
    }
    setLoadingStudents(true);
    setClassStudentsList([]);
    disciplineApi
      .listStudentsByClass(selectedClassId, academicYearId)
      .then((list) => setClassStudentsList(list))
      .catch(() => setClassStudentsList([]))
      .finally(() => setLoadingStudents(false));
  }, [selectedClassId, academicYearId]);

  // ⭐ Quand on sélectionne une règle, les heures et points sont automatiques
  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      setCustomFaultName(rule.name);
      setHours(rule.hours_penalty);
      setPoints(rule.points_deducted);
    }
  };

  // ⭐ Quand on change les heures manuellement, recalculer les points
  const handleHoursChange = (newHours: number) => {
    setHours(newHours);
    const rule = rules.find((r) => r.id === selectedRuleId);
    if (rule && rule.hours_penalty > 0) {
      const ratio = rule.points_deducted / rule.hours_penalty;
      setPoints(Math.round(ratio * newHours * 100) / 100);
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !academicYearId) {
      toast({ title: 'Erreur', description: 'Sélectionnez un élève', variant: 'destructive' });
      return;
    }
    if (!customFaultName.trim()) {
      toast({ title: 'Erreur', description: 'Nommez la faute', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await disciplineApi.createSanction({
        studentId: selectedStudent.id,
        ruleId: selectedRuleId || null,
        faultName: customFaultName,
        hoursAttributed: hours,
        pointsDeducted: points,
        academicYearId,
        schoolLevelId: schoolLevelId || null,
        comment: comment || null,
      });
      toast({
        title: '✅ Sanction enregistrée',
        description: `${points} points déduits de la conduite`,
      });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
      {/* ⭐ 2026-09-28 — FIX « bande grise qui cache le modal » : on remplace
          motion.div (qui avait initial opacity:0 → restait invisible pendant
          l'animation framer-motion) par une div simple. Le centrage se fait
          via flex justify-center sur le parent + my-8 sur la modal. Plus de
          bande grise bloquante à l'ouverture. */}
      <div
        className="my-8 bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Gavel className="w-5 h-5" /> Nouvelle sanction
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Sélecteur de classe */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Classe</label>
            <select
              value={selectedClassId}
              onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudent(null); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">— Sélectionner une classe —</option>
              {(allClasses || []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {/* Sélecteur d'élève */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Élève</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedStudent.lastName} {selectedStudent.firstName}
                </span>
                <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-500">
                  Changer
                </button>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) => {
                  const stu = classStudentsList.find((s) => s.id === e.target.value);
                  if (stu) setSelectedStudent(stu);
                }}
                disabled={!selectedClassId || loadingStudents}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              >
                <option value="">
                  {loadingStudents
                    ? 'Chargement...'
                    : !selectedClassId
                      ? 'Sélectionnez d\'abord une classe'
                      : '— Sélectionner un élève —'}
                </option>
                {classStudentsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lastName} {s.firstName} {s.matricule ? `(${s.matricule})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Rule selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Faute (barème)</label>
            <select
              value={selectedRuleId}
              onChange={(e) => handleRuleSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">— Personnalisée —</option>
              {rules.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.hours_penalty}h, -{r.points_deducted}pts)
                </option>
              ))}
            </select>
          </div>
          {/* Custom fault name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la faute</label>
            <input
              type="text"
              value={customFaultName}
              onChange={(e) => setCustomFaultName(e.target.value)}
              placeholder="Ex: Retard, Bavardage..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          {/* Hours + Points */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heures de punition</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => handleHoursChange(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Points déduits {selectedRuleId && '(auto)'}
              </label>
              <input
                type="number"
                step="0.5"
                value={points}
                readOnly={!!selectedRuleId}
                onChange={(e) => setPoints(Number(e.target.value) || 0)}
                className={cn(
                  'w-full px-3 py-2 text-sm border rounded-lg',
                  selectedRuleId
                    ? 'bg-gray-50 text-gray-600 border-gray-200'
                    : 'border-gray-300',
                )}
              />
            </div>
          </div>
          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !selectedStudent}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Modal (CRUD barème) ────────────────────────────────────────────

function RuleModal({
  onClose, onSuccess, editingRule,
}: {
  onClose: () => void;
  onSuccess: () => void;
  editingRule?: DisciplineRule | null;
}) {
  const isEditing = !!editingRule;
  const [name, setName] = useState(editingRule?.name || '');
  const [description, setDescription] = useState(editingRule?.description || '');
  const [hours, setHours] = useState(editingRule?.hours_penalty || 0);
  const [points, setPoints] = useState(editingRule?.points_deducted || 0);
  const [severity, setSeverity] = useState(editingRule?.severity || 'MINOR');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = { name, description, hours_penalty: hours, points_deducted: points, severity };
      if (isEditing) {
        await disciplineApi.updateRule({ id: editingRule!.id, ...payload, isActive: true });
        toast({ title: '✅ Règle modifiée', description: `${name} — ${hours}h, -${points}pts` });
      } else {
        await disciplineApi.createRule(payload);
        toast({ title: '✅ Règle créée', description: `${name} — ${hours}h, -${points}pts` });
      }
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
      {/* ⭐ 2026-09-28 — FIX « bande grise » : div simple (pas de motion.div) +
          flex justify-center pour le centrage horizontal. */}
      <div
        className="my-8 bg-white rounded-xl shadow-2xl max-w-lg w-full"
      >
        <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Settings className="w-5 h-5" /> {isEditing ? 'Modifier la règle' : 'Nouvelle règle de faute'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la faute</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Retard, Bagarre..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optionnel)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heures de punition</label>
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Points déduits</label>
              <input
                type="number"
                step="0.5"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gravité</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            >
              <option value="MINOR">Mineure</option>
              <option value="MODERATE">Modérée</option>
              <option value="MAJOR">Grave</option>
              <option value="CRITICAL">Critique</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : isEditing ? (
              <Edit className="w-4 h-4 mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {isEditing ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Conduct Settings Modal ──────────────────────────────────────────────

function ConductSettingsModal({
  onClose, onSuccess, academicYearId, schoolLevelId, currentReference, currentThreshold,
}: {
  onClose: () => void;
  onSuccess: (updated: ConductSettings) => void;
  academicYearId?: string;
  schoolLevelId?: string;
  currentReference: number;
  currentThreshold: number;
}) {
  const [conductReference, setConductReference] = useState(currentReference);
  const [criticalThreshold, setCriticalThreshold] = useState(currentThreshold);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // ⭐ 2026-09-28 — Sync state quand les props changent (ex: ouverture du
  //    modal avec de nouvelles valeurs après une édition précédente).
  useEffect(() => {
    setConductReference(currentReference);
    setCriticalThreshold(currentThreshold);
  }, [currentReference, currentThreshold]);

  const handleSave = async () => {
    if (!academicYearId) {
      toast({ title: 'Erreur', description: 'Année académique requise', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result: any = await disciplineApi.updateSettings({
        academicYearId,
        schoolLevelId: schoolLevelId || null,
        conduct_reference: conductReference,
        critical_threshold: criticalThreshold,
      });
      // ⭐ 2026-09-28 — Le backend retourne { id, conduct_reference,
      //    critical_threshold }. On transmet ces valeurs à onSuccess pour
      //    que le parent mette à jour IMMÉDIATEMENT son état conductSettings
      //    (sans attendre le loadData). C'est ce qui corrige le bug « 17/5
      //    affiché même après avoir sauvegardé 18/6 ».
      const updated: ConductSettings = {
        conduct_reference: Number(result?.conduct_reference ?? conductReference),
        critical_threshold: Number(result?.critical_threshold ?? criticalThreshold),
      };
      toast({
        title: '✅ Paramètres sauvegardés',
        description: `Moyenne de conduite: ${updated.conduct_reference}/20 · Seuil critique: ${updated.critical_threshold}`,
      });
      onSuccess(updated);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
      {/* ⭐ 2026-09-28 — FIX « bande grise » : div simple + flex justify-center. */}
      <div
        className="my-8 bg-white rounded-xl shadow-2xl max-w-md w-full"
      >
        <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Paramètres de conduite
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moyenne de conduite (baseline)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Note de départ de chaque élève (généralement 17, mais configurable par l&apos;école).
            </p>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={conductReference}
              onChange={(e) => setConductReference(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seuil critique</label>
            <p className="text-xs text-gray-500 mb-2">
              En dessous de ce seuil, la conduite de l&apos;élève est considérée comme critique (affichage en rouge).
            </p>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <strong>Règle de calcul :</strong> Conduite = Moyenne de conduite − Σ points déduits (sanctions actives).
            <br />
            Au niveau du bulletin, une ligne « Conduite » sera ajoutée avec cette note.
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-blue-50 rounded-b-xl">
          <Button onClick={onClose} variant="outline" className="px-4 py-2">Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Settings className="w-4 h-4 mr-2" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Cancel Sanction Modal ───────────────────────────────────────────────

function CancelSanctionModal({
  onClose, onConfirm, cancelReason, setCancelReason,
}: {
  onClose: () => void;
  onConfirm: () => void;
  cancelReason: string;
  setCancelReason: (v: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
      {/* ⭐ 2026-09-28 — FIX « bande grise » : div simple + flex justify-center. */}
      <div
        className="my-8 bg-white rounded-xl shadow-2xl max-w-md w-full"
      >
        <div className="flex items-center justify-between p-4 border-b bg-red-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Annuler la sanction
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            L&apos;annulation d&apos;une sanction rembourse les points déduits au compteur de conduite de l&apos;élève.
            Cette action est définitive.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif d&apos;annulation *</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex: Erreur de saisie, sanction injustifiée..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <Button onClick={onClose} variant="outline" className="px-4 py-2">
            Fermer
          </Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2">
            <AlertTriangle className="w-4 h-4 mr-2" /> Confirmer l&apos;annulation
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Rule Modal ───────────────────────────────────────────────────

function DeleteRuleModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 overflow-y-auto flex justify-center" style={{ paddingTop: '80px' }}>
      {/* ⭐ 2026-09-28 — FIX « bande grise » : div simple + flex justify-center. */}
      <div
        className="my-8 bg-white rounded-xl shadow-2xl max-w-sm w-full"
      >
        <div className="flex items-center justify-between p-4 border-b bg-red-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-red-900">Supprimer la règle</h3>
          <button onClick={onClose} className="p-1 hover:bg-red-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer cette règle ? Elle sera désactivée et n&apos;apparaîtra plus dans le barème.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
          <Button onClick={onClose} variant="outline" className="px-4 py-2">Annuler</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2">
            <Trash2 className="w-4 h-4 mr-2" /> Supprimer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Search Bar ──────────────────────────────────────────────────────────

function SearchBar({
  searchQuery, setSearchQuery, placeholder,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// ─── Notification Badge (WhatsApp/SMS status) ────────────────────────────

function NotificationBadge({
  status, channels,
}: {
  status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  channels?: { whatsapp?: string; sms?: string; event?: string };
}) {
  if (!status) {
    return <span className="text-[10px] text-gray-400">—</span>;
  }
  const config: Record<string, { label: string; cls: string; icon: string }> = {
    PENDING: { label: 'En cours', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '⏳' },
    SENT: { label: 'Envoyé', cls: 'bg-green-100 text-green-700 border-green-300', icon: '✓' },
    FAILED: { label: 'Échec', cls: 'bg-red-100 text-red-700 border-red-300', icon: '✕' },
    SKIPPED: { label: 'Ignoré', cls: 'bg-gray-100 text-gray-500 border-gray-300', icon: '—' },
  };
  const c = config[status] || config.PENDING;
  const tooltip = channels
    ? `WhatsApp: ${channels.whatsapp || '—'} | SMS: ${channels.sms || '—'}${channels.event ? ` | ${channels.event === 'created' ? 'Création' : 'Annulation'}` : ''}`
    : '';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${c.cls}`}
      title={tooltip}
    >
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
}
