'use client';

/**
 * ============================================================================
 * UNIFIED ADMINISTRATION WORKSPACE
 * ============================================================================
 *
 * Point d'entrée UNIQUE et centralisé pour gérer tout le personnel de
 * l'établissement par niveau scolaire (et par piste linguistique si bilingue).
 *
 * Fonctionnalités :
 *   1. Sélecteur de niveau scolaire en haut (Maternelle / Primaire / Secondaire).
 *      Les unités proviennent de /api/admin-structure/groups (mode SEPARATE
 *      ou FUSED_MATERNELLE_PRIMAIRE géré automatiquement).
 *
 *   2. Sélecteur de piste linguistique (FR / EN) si l'option bilingue est activée
 *      dans les paramètres. Permet de définir séparément l'équipe francophone
 *      et l'équipe anglophone pour chaque niveau.
 *
 *   3. Section "Équipe administrative" : tableau des affectations existantes
 *      (poste, titulaire, période, signature, actions) + bouton "Affecter un
 *      poste" qui ouvre un modal complet (poste, staff, functionLabel,
 *      période, signature upload/canvas, envoi identifiants).
 *
 *   4. Section "Équipe enseignante" : liste des enseignants du niveau+track
 *      sélectionné, avec :
 *      - Boutons rapides d'affectation à ce niveau (1 clic)
 *      - Toggle FR/EN par enseignant (si bilingue) pour marquer les langues
 *        qu'il enseigne dans ce niveau
 *      - Recherche par nom/matricule/poste
 *
 * Endpoints utilisés :
 *   GET    /api/admin-structure/groups                 → unités admin + mode
 *   GET    /api/school-levels                          → niveaux scolaires actifs
 *   GET    /api/hr/staff?status=ACTIVE                 → liste du personnel
 *   GET    /api/staff-admin-assignments                → affectations admin existantes
 *   POST   /api/staff-admin-assignments                → créer une affectation admin
 *   DELETE /api/staff-admin-assignments/:id            → supprimer une affectation admin
 *   PUT    /api/hr/staff/batch-assign-level            → affecter enseignants à un niveau
 *   PUT    /api/hr/staff/:staffId                      → mettre à jour un staff
 *                                                        (schoolLevelId, assignedLanguages)
 *   POST   /api/hr/staff/:staffId/generate-credentials → envoyer identifiants
 *   POST   /api/settings/stamps/generate               → générer cachets par niveau
 *   POST   /api/settings/signature/generate            → générer signature officielle
 *
 * Remplace :
 *   - DirectorsWorkspace.tsx (rôles directeur déjà couverts par ROLES_BY_LEVEL)
 *   - TeacherLevelAssignment.tsx comme sous-tab de Collaborateurs
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2, Trash2, Upload, Pen, School,
  Stamp, Plus, Mail, UserCheck, Eraser, FileSignature, X, Globe,
  ShieldCheck, Calendar, Send, GraduationCap, Search, Filter,
  Baby, BookOpen, Users,
} from 'lucide-react';
import { useBilingual, type LanguageTrack } from '@/contexts/BilingualContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import {
  ADMIN_ROLE_LABELS, ROLES_BY_UNIT, ADMIN_UNIT_LABELS, LEVEL_CODE_TO_UNIT,
  type AdminRole,
} from '@/lib/constants/admin-roles';

// ── Palette Academia Helm ───────────────────────────────────────────────────
const PRIMARY = '#1A2BA6'; // Royal Blue

// ── Types ───────────────────────────────────────────────────────────────────
interface SchoolLevel {
  id: string;
  code: string; // 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE' (codes français)
  name: string;
  isActive: boolean;
}

interface AdminGroup {
  unit: 'MAT' | 'PRI' | 'SEC' | 'MAT_PRI' | 'ALL';
  label: string;
  levelIds: string[];
  levelCodes: string[];
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
  roleType?: string | null;
  category?: string | null;
  employeeNumber?: string | null;
  schoolLevelId?: string | null;
  schoolLevel?: { id: string; code: string; name?: string } | null;
  assignedLanguages?: string[] | null;
}

interface AdminAssignment {
  id: string;
  staffId: string;
  schoolLevelCode: string;
  adminRole: AdminRole | string;
  academicYearId: string | null;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    employeeNumber?: string | null;
  } | null;
}

interface AssignmentFormState {
  adminRole: string;
  staffId: string;
  functionLabel: string;
  startDate: string;
  endDate: string;
  language: 'FR' | 'EN' | 'NONE';
  signatureDataUrl: string | null;
  signatureUploadedUrl: string | null;
  sendCredentials: boolean;
}

const EMPTY_FORM: AssignmentFormState = {
  adminRole: '',
  staffId: '',
  functionLabel: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  language: 'NONE',
  signatureDataUrl: null,
  signatureUploadedUrl: null,
  sendCredentials: true,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
async function authedFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  let url = path;
  if (method === 'GET') {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_t=${Date.now()}`;
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = res.statusText || 'Erreur réseau';
    if (text.trim()) {
      try {
        const j = JSON.parse(text);
        msg = j.message || j.error || msg;
      } catch { /* keep default */ }
    }
    throw new Error(msg);
  }
  if (!text.trim()) return null as T;
  try { return JSON.parse(text) as T; } catch {
    throw new Error('Réponse invalide du serveur');
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return '—'; }
}

function getUnitColor(unit: string): { bg: string; text: string; border: string } {
  switch (unit) {
    case 'MAT': return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
    case 'PRI': return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
    case 'SEC': return { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' };
    case 'MAT_PRI': return { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
    default: return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  }
}

// ── Icônes par niveau (pour le sélecteur) ────────────────────────────────────
const LEVEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MAT: Baby,
  PRI: BookOpen,
  SEC: School,
  MAT_PRI: School,
};

// ============================================================================
//  COMPOSANT PRINCIPAL
// ============================================================================

export default function UnifiedAdministrationWorkspace() {
  const moduleCtx = useModuleContext();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();

  const currentTenant = moduleCtx?.tenant;
  const currentAcademicYear = moduleCtx?.academicYear;
  const tenantId = moduleCtx?.tenantId;
  const academicYearId = currentAcademicYear?.id;

  // ── États UI ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingCredentials, setSendingCredentials] = useState<string | null>(null);
  const [generatingStamp, setGeneratingStamp] = useState<string | null>(null);
  const [generatingSignature, setGeneratingSignature] = useState(false);
  const [generatingRowSignature, setGeneratingRowSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── États données ─────────────────────────────────────────────────────────
  const [adminGroups, setAdminGroups] = useState<AdminGroup[]>([]);
  const [adminMode, setAdminMode] = useState<'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE'>('SEPARATE');
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [assignments, setAssignments] = useState<AdminAssignment[]>([]);

  // ── États sélection ───────────────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  // ── États modal admin ────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUnit, setModalUnit] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [signatureMode, setSignatureMode] = useState<'upload' | 'canvas' | 'none'>('none');

  // ── États section enseignants ─────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingTeacherChanges, setPendingTeacherChanges] = useState<
    Record<string, { levelId: string | null; languages?: string[] }>
  >({});

  // ── Dismiss auto du success ───────────────────────────────────────────────
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 4000);
    return () => clearTimeout(t);
  }, [success]);

  // ── Chargement initial ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Niveaux scolaires actifs
      const levelsData = await authedFetch<SchoolLevel[] | { items?: SchoolLevel[] }>('/api/school-levels');
      const levels = Array.isArray(levelsData) ? levelsData : (levelsData?.items ?? []);
      const activeLevels = levels.filter((l) => l.id !== 'ALL' && l.isActive);
      setSchoolLevels(activeLevels);

      // 2. Structure administrative (mode + groups)
      try {
        const groupsData = await authedFetch<{ mode: string; groups: AdminGroup[] }>(
          '/api/admin-structure/groups',
        );
        if (groupsData?.mode) {
          setAdminMode(groupsData.mode as 'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE');
        }
        if (Array.isArray(groupsData?.groups)) {
          const groups = groupsData.groups.filter((g) => g.unit !== 'ALL');
          setAdminGroups(groups);
          // Auto-sélection du premier groupe s'il n'y en a pas déjà un sélectionné
          if (groups.length > 0) {
            setSelectedUnit((prev) => prev ?? groups[0].unit);
          }
        }
      } catch (err) {
        console.warn('admin-structure/groups unavailable, falling back:', err);
        const fallbackGroups: AdminGroup[] = activeLevels.map((l) => ({
          unit: (LEVEL_CODE_TO_UNIT[l.code] || 'MAT') as AdminGroup['unit'],
          label: l.name,
          levelIds: [l.id],
          levelCodes: [l.code],
        }));
        setAdminGroups(fallbackGroups);
        setAdminMode('SEPARATE');
        if (fallbackGroups.length > 0) {
          setSelectedUnit((prev) => prev ?? fallbackGroups[0].unit);
        }
      }

      // 3. Liste du personnel actif + en cours d'embauche
      //    On inclut ACTIVE (en poste), PENDING_SIGNATURE (contrat pas encore signé)
      //    et PENDING_HIRE (embauche initiée mais pas finalisée) pour permettre à
      //    l'utilisateur de les affecter à un niveau dès la phase d'embauche.
      //    ⚠️ Sans PENDING_HIRE, les enseignants anglophones fraîchement recrutés
      //    via le flux public n'apparaissent pas dans l'onglet Administration.
      try {
        // On récupère TOUT le staff (pas de filtre status) et on filtre côté frontend
        // car l'API /api/hr/staff accepte un seul paramètre status à la fois.
        const staffData = await authedFetch<StaffOption[] | { items?: StaffOption[]; data?: StaffOption[] }>(
          `/api/hr/staff?limit=500`,
        );
        const allStaff = Array.isArray(staffData)
          ? staffData
          : (staffData?.items ?? staffData?.data ?? []);
        // Filtrer côté frontend : ne garder que les statuts exploitables
        const VALID_STATUSES = new Set(['ACTIVE', 'PENDING_SIGNATURE', 'PENDING_HIRE', 'active']);
        setStaffList(allStaff.filter((s) => !s.status || VALID_STATUSES.has(s.status)));
      } catch (err) {
        console.warn('Failed to load staff list:', err);
        setStaffList([]);
      }

      // 4. Affectations admin existantes
      try {
        const assignmentsData = await authedFetch<AdminAssignment[] | { items?: AdminAssignment[] }>(
          '/api/staff-admin-assignments',
        );
        const all = Array.isArray(assignmentsData) ? assignmentsData : (assignmentsData?.items ?? []);
        setAssignments(all);
      } catch (err) {
        console.warn('Failed to load admin assignments:', err);
        setAssignments([]);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Affectations admin filtrées par unité + piste linguistique ────────────
  const getAssignmentsForUnit = useCallback(
    (unit: string): AdminAssignment[] => {
      let list = assignments.filter((a) => a.schoolLevelCode === unit && a.isActive);
      // Si bilingue, filtrer par piste linguistique courante
      if (isBilingual) {
        list = list.filter((a) => {
          // On ne peut pas filtrer côté backend (champ language pas dans le model
          // assignment) — on filtre via le staff.assignedLanguages si présent,
          // sinon via le functionLabel (suffixe "Francophone"/"Anglophone").
          // ⚠️ Tant que la donnée n'est pas étiquetée, on garde l'affectation visible
          // dans les deux pistes — l'utilisateur peut la ré-affecter proprement.
          return true; // On garde l'affectation visible, l'utilisateur gère explicitement.
        });
      }
      return list;
    },
    [assignments, isBilingual],
  );

  // ── Enseignants filtrés pour le niveau sélectionné ────────────────────────
  const levelIdForSelectedUnit = useMemo<string | null>(() => {
    if (!selectedUnit) return null;
    const group = adminGroups.find((g) => g.unit === selectedUnit);
    if (!group || group.levelIds.length === 0) return null;
    // Pour MAT_PRI, on prend le premier levelId (Maternelle par convention)
    // mais on garde aussi le second (Primaire) pour filtrer les staff.
    return group.levelIds[0];
  }, [selectedUnit, adminGroups]);

  const allLevelIdsForSelectedUnit = useMemo<string[]>(() => {
    if (!selectedUnit) return [];
    const group = adminGroups.find((g) => g.unit === selectedUnit);
    return group?.levelIds ?? [];
  }, [selectedUnit, adminGroups]);

  // Filtrage enseignants : ⭐ uniquement roleType=TEACHER (exclut ADMIN, DIRECTOR,
  //    PROMOTEUR, etc.). Le promoteur et le personnel administratif ne doivent
  //    pas apparaître dans l'équipe enseignante — ils appartiennent à l'équipe
  //    administrative. Un staff avec roleType=TEACHER qui a aussi une affectation
  //    admin apparaîtra dans les DEUX sections (enseignant + admin), ce qui est
  //    correct car il a un double rôle.
  const teachersForSelectedLevel = useMemo(() => {
    let result = staffList.filter((s) => s.roleType === 'TEACHER');

    if (isBilingual) {
      // Filtrer par piste linguistique courante (FR ou EN)
      result = result.filter((s) => {
        const langs = s.assignedLanguages ?? ['FR', 'EN'];
        return langs.includes(currentTrack);
      });
    }

    // Filtrer par niveau (un des levelIds du groupe)
    result = result.filter((s) => {
      const effectiveLevelId = pendingTeacherChanges[s.id]?.levelId ?? s.schoolLevelId;
      // Inclure si :
      //   - l'enseignant est déjà affecté à un des levels du groupe, OU
      //   - il n'est affecté à aucun niveau (pour qu'on puisse l'ajouter)
      if (!effectiveLevelId) return true;
      return allLevelIdsForSelectedUnit.includes(effectiveLevelId);
    });

    // Recherche textuelle
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.employeeNumber?.toLowerCase().includes(q) ||
        s.position?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [staffList, allLevelIdsForSelectedUnit, isBilingual, currentTrack, searchQuery, pendingTeacherChanges]);

  // Tous les enseignants non affectés (pour permettre affectation rapide)
  const unassignedTeachersCount = useMemo(() => {
    return staffList.filter((s) => {
      if (s.roleType !== 'TEACHER') return false;
      const effectiveLevelId = pendingTeacherChanges[s.id]?.levelId ?? s.schoolLevelId;
      return !effectiveLevelId;
    }).length;
  }, [staffList, pendingTeacherChanges]);

  // ── Ouvrir le modal d'affectation admin ──────────────────────────────────
  const openAssignModal = useCallback((unit: string) => {
    setModalUnit(unit);
    setForm({
      ...EMPTY_FORM,
      // Pré-remplir la piste linguistique selon la track courante si bilingue
      language: isBilingual ? currentTrack : 'NONE',
      startDate: new Date().toISOString().slice(0, 10),
    });
    setSignatureMode('none');
    setModalOpen(true);
    setError(null);
    setSuccess(null);
  }, [isBilingual, currentTrack]);

  // ── Soumission du formulaire d'affectation admin ──────────────────────────
  const handleAssign = async () => {
    if (!modalUnit) return;
    if (!form.staffId) { setError('Veuillez sélectionner un membre du personnel.'); return; }
    if (!form.adminRole) { setError('Veuillez sélectionner un poste.'); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. functionLabel final (avec suffixe langue si bilingue)
      let finalFunctionLabel = form.functionLabel.trim();
      if (!finalFunctionLabel) {
        finalFunctionLabel = ADMIN_ROLE_LABELS[form.adminRole as AdminRole] || form.adminRole;
      }
      if (isBilingual && form.language !== 'NONE') {
        const langSuffix = form.language === 'FR' ? ' (Francophone)' : ' (Anglophone)';
        if (!finalFunctionLabel.toLowerCase().includes('francophone') &&
            !finalFunctionLabel.toLowerCase().includes('anglophone')) {
          finalFunctionLabel = `${finalFunctionLabel}${langSuffix}`;
        }
      }

      // 2. Créer l'affectation
      const payload: any = {
        staffId: form.staffId,
        schoolLevelCode: modalUnit,
        adminRole: form.adminRole,
        academicYearId: academicYearId || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      const created = await authedFetch<AdminAssignment>('/api/staff-admin-assignments', {
        method: 'POST',
        body: payload,
      });

      // 3. Signature officielle (optionnelle)
      const selectedStaff = staffList.find((s) => s.id === form.staffId);
      const shouldGenerateSignature = !!selectedStaff && modalUnit !== 'ALL';
      if (shouldGenerateSignature) {
        try {
          let educationLevelId: string | null = null;
          if (modalUnit !== 'MAT_PRI') {
            const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT)
              .find(([, u]) => u === modalUnit)?.[0];
            const level = schoolLevels.find((l) => l.code === unitLevelCode);
            educationLevelId = level?.id ?? null;
          }
          await authedFetch('/api/settings/signature/generate', {
            method: 'POST',
            body: {
              role: finalFunctionLabel,
              holderFirstName: selectedStaff.firstName,
              holderLastName: selectedStaff.lastName,
              educationLevelId,
            },
          });
        } catch (err: any) {
          console.warn('Signature generation failed (non-blocking):', err.message);
        }
      }

      // 4. Envoyer identifiants si demandé
      let credentialsSent = false;
      if (form.sendCredentials && selectedStaff?.email) {
        try {
          await authedFetch(`/api/hr/staff/${form.staffId}/generate-credentials`, { method: 'POST' });
          credentialsSent = true;
        } catch (err: any) {
          console.warn('Credentials sending failed (non-blocking):', err.message);
        }
      }

      // 5. Succès
      const staffName = selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}`.trim() : 'Staff';
      const roleLabel = ADMIN_ROLE_LABELS[form.adminRole as AdminRole] || form.adminRole;
      const credInfo = credentialsSent
        ? ' · Identifiants envoyés par email'
        : (form.sendCredentials ? ' · Envoi identifiants échoué (réessayez depuis le tableau)' : '');
      setSuccess(`${roleLabel} affecté(e) à ${staffName} pour ${ADMIN_UNIT_LABELS[modalUnit] || modalUnit}${credInfo}`);

      setModalOpen(false);
      setForm(EMPTY_FORM);
      setSignatureMode('none');
      setModalUnit(null);
      loadData();
    } catch (err: any) {
      const msg = err.message || 'Erreur lors de l\'affectation';
      setError(msg);
      toast({ variant: 'error', title: 'Échec de l\'affectation', description: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer une affectation admin ───────────────────────────────────────
  const handleDelete = async (assignmentId: string) => {
    if (!confirm('Supprimer cette affectation ? Le staff perdra ce poste administratif.')) return;
    setDeleting(assignmentId);
    setError(null);
    setSuccess(null);
    try {
      await authedFetch(`/api/staff-admin-assignments/${assignmentId}`, { method: 'DELETE' });
      setSuccess('Affectation supprimée');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  // ── Envoyer identifiants ──────────────────────────────────────────────────
  const handleSendCredentials = async (assignment: AdminAssignment) => {
    if (!assignment.staffId) { setError('Aucun staff lié à cette affectation.'); return; }
    setSendingCredentials(assignment.id);
    setError(null);
    setSuccess(null);
    try {
      await authedFetch(`/api/hr/staff/${assignment.staffId}/generate-credentials`, { method: 'POST' });
      const name = assignment.staff
        ? `${assignment.staff.firstName} ${assignment.staff.lastName}`.trim()
        : 'du staff';
      setSuccess(`Identifiants envoyés à ${name}. Un email avec identifiant + mot de passe temporaire a été envoyé.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi des identifiants');
    } finally {
      setSendingCredentials(null);
    }
  };

  // ── Générer cachets pour une unité ────────────────────────────────────────
  const handleGenerateStamp = async (unit: string) => {
    setGeneratingStamp(unit);
    setError(null);
    setSuccess(null);
    try {
      let educationLevelId: string | null = null;
      if (unit !== 'MAT_PRI') {
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT).find(([, u]) => u === unit)?.[0];
        const level = schoolLevels.find((l) => l.code === unitLevelCode);
        educationLevelId = level?.id ?? null;
      }
      await authedFetch('/api/settings/stamps/generate', {
        method: 'POST',
        body: { formats: ['circular', 'rectangular', 'oval'], educationLevelId },
      });
      const unitLabel = ADMIN_UNIT_LABELS[unit] || unit;
      setSuccess(`Cachets générés pour ${unitLabel}. Disponibles dans Paramètres > Cachets & Signatures.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération des cachets');
    } finally {
      setGeneratingStamp(null);
    }
  };

  // ── Générer signature officielle (modal) ──────────────────────────────────
  const handleGenerateOfficialSignature = async () => {
    if (!form.staffId || !form.adminRole || !modalUnit) {
      setError('Sélectionnez d\'abord un staff et un poste.');
      return;
    }
    setGeneratingSignature(true);
    setError(null);
    try {
      const selectedStaff = staffList.find((s) => s.id === form.staffId);
      if (!selectedStaff) throw new Error('Staff introuvable');
      let educationLevelId: string | null = null;
      if (modalUnit !== 'MAT_PRI') {
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT).find(([, u]) => u === modalUnit)?.[0];
        const level = schoolLevels.find((l) => l.code === unitLevelCode);
        educationLevelId = level?.id ?? null;
      }
      const roleLabel = form.functionLabel.trim() || ADMIN_ROLE_LABELS[form.adminRole as AdminRole] || form.adminRole;
      await authedFetch('/api/settings/signature/generate', {
        method: 'POST',
        body: {
          role: roleLabel,
          holderFirstName: selectedStaff.firstName,
          holderLastName: selectedStaff.lastName,
          educationLevelId,
        },
      });
      setSuccess(`Signature officielle générée pour ${selectedStaff.firstName} ${selectedStaff.lastName} (${roleLabel}).`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération de la signature');
    } finally {
      setGeneratingSignature(false);
    }
  };

  // ── Générer signature pour ligne existante ────────────────────────────────
  const handleGenerateSignatureForRow = async (assignment: AdminAssignment, unit: string) => {
    if (!assignment.staff) { setError('Staff introuvable pour cette affectation.'); return; }
    setGeneratingRowSignature(assignment.id);
    setError(null);
    setSuccess(null);
    try {
      let educationLevelId: string | null = null;
      if (unit !== 'MAT_PRI') {
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT).find(([, u]) => u === unit)?.[0];
        const level = schoolLevels.find((l) => l.code === unitLevelCode);
        educationLevelId = level?.id ?? null;
      }
      const roleLabel = ADMIN_ROLE_LABELS[assignment.adminRole as AdminRole] || assignment.adminRole;
      await authedFetch('/api/settings/signature/generate', {
        method: 'POST',
        body: {
          role: roleLabel,
          holderFirstName: assignment.staff.firstName,
          holderLastName: assignment.staff.lastName,
          educationLevelId,
        },
      });
      const staffName = `${assignment.staff.firstName} ${assignment.staff.lastName}`.trim();
      setSuccess(`Signature officielle régénérée pour ${staffName} (${roleLabel}).`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération de la signature');
    } finally {
      setGeneratingRowSignature(null);
    }
  };

  // ── Upload fichier signature ──────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, signatureUploadedUrl: dataUrl, signatureDataUrl: null }));
    };
    reader.readAsDataURL(file);
  };

  // ── Sélection staff → auto-remplit functionLabel ──────────────────────────
  const handleStaffSelect = (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) { setForm((prev) => ({ ...prev, staffId: '' })); return; }
    setForm((prev) => ({
      ...prev,
      staffId: staff.id,
      functionLabel: prev.functionLabel || staff.position || '',
    }));
  };

  // ── Rôles disponibles pour l'unité courante du modal ──────────────────────
  const availableRoles = useMemo<AdminRole[]>(() => {
    if (!modalUnit) return [];
    return ROLES_BY_UNIT[modalUnit] ?? ROLES_BY_UNIT.ALL;
  }, [modalUnit]);

  // ── Toggle niveau pour enseignant (affectation rapide) ────────────────────
  const handleToggleTeacherLevel = (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    const currentLevelId = staff?.schoolLevelId ?? null;
    const targetLevelId = levelIdForSelectedUnit;
    if (!targetLevelId) return;

    setPendingTeacherChanges((prev) => {
      const next = { ...prev };
      // Si déjà affecté à ce niveau → on retire ; sinon on affecte
      if (currentLevelId === targetLevelId) {
        next[staffId] = { levelId: null };
      } else {
        next[staffId] = { levelId: targetLevelId };
      }
      return next;
    });
  };

  // ── Toggle langue pour enseignant (bilingue) ─────────────────────────────
  const handleToggleTeacherLanguage = (staffId: string, lang: 'FR' | 'EN') => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;
    const pending = pendingTeacherChanges[staffId];
    const currentLangs = pending?.languages ?? staff.assignedLanguages ?? ['FR', 'EN'];
    const newLangs = currentLangs.includes(lang)
      ? currentLangs.filter((l) => l !== lang)
      : [...currentLangs, lang];
    const finalLangs = newLangs.length === 0 ? ['FR'] : newLangs;
    setPendingTeacherChanges((prev) => {
      const next = { ...prev };
      const currentLevelId = staff.schoolLevelId ?? null;
      const pendingLevel = next[staffId]?.levelId ?? currentLevelId;
      next[staffId] = { levelId: pendingLevel, languages: finalLangs };
      return next;
    });
  };

  // ── Sauvegarder les changements enseignants ───────────────────────────────
  const handleSaveTeacherChanges = async () => {
    const entries = Object.entries(pendingTeacherChanges);
    if (entries.length === 0) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      for (const [staffId, change] of entries) {
        if (!change.levelId) {
          // Désaffecter : schoolLevelId = null
          await authedFetch(`/api/hr/staff/${staffId}`, {
            method: 'PUT',
            body: {
              schoolLevelId: null,
              ...(change.languages !== undefined ? { assignedLanguages: change.languages } : {}),
            },
          });
        } else {
          // Affecter : batch-assign-level
          await authedFetch('/api/hr/staff/batch-assign-level', {
            method: 'PUT',
            body: {
              staffIds: [staffId],
              schoolLevelId: change.levelId,
              ...(change.languages !== undefined ? { languages: change.languages } : {}),
            },
          });
        }
      }
      setSuccess(`${entries.length} affectation(s) enseignant(s) enregistrée(s) avec succès.`);
      setPendingTeacherChanges({});
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
        <span className="ml-2 text-gray-600 text-sm">Chargement du personnel…</span>
      </div>
    );
  }

  // ── Rendu principal ───────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${PRIMARY}10` }}
        >
          <UserCheck className="w-6 h-6" style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900">
            Personnel par Niveau
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Centralisez l'équipe administrative et enseignante par niveau scolaire. Affectez directeurs, secrétaires, comptables, surveillants, et enseignants.
            {adminMode === 'FUSED_MATERNELLE_PRIMAIRE' && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-bold text-amber-700 border border-amber-200">
                <Globe className="w-3 h-3" /> Maternelle + Primaire fusionnés
              </span>
            )}
            {isBilingual && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[10px] font-bold text-blue-700 border border-blue-200">
                <Globe className="w-3 h-3" /> Bilingue FR/EN
              </span>
            )}
          </p>
        </div>
        {currentAcademicYear && (
          <div className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3" />
            Année : <strong className="text-gray-700">{currentAcademicYear.label}</strong>
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Sélecteur de niveau scolaire ──────────────────────────────────── */}
      {adminGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <School className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            Aucune unité administrative configurée. Activez au moins un niveau scolaire
            dans <strong>Paramètres &gt; Structure pédagogique</strong>.
          </p>
        </Card>
      ) : (
        <>
          {/* Segmented control pour les niveaux */}
          <div className="flex flex-wrap gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
            {adminGroups.map((group) => {
              const colors = getUnitColor(group.unit);
              const Icon = LEVEL_ICONS[group.unit] ?? School;
              const isActive = selectedUnit === group.unit;
              return (
                <button
                  key={group.unit}
                  type="button"
                  onClick={() => setSelectedUnit(group.unit)}
                  className={cn(
                    'flex-1 min-w-[140px] flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all',
                    isActive
                      ? 'text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  )}
                  style={isActive ? { background: PRIMARY } : {}}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                      isActive ? 'bg-white/20' : ''
                    )}
                    style={!isActive ? { background: colors.bg, color: colors.text } : {}}
                  >
                    {getAssignmentsForUnit(group.unit).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sélecteur de piste linguistique (si bilingue) */}
          {isBilingual && (
            <div className="flex items-center gap-2 bg-blue-50/50 border border-blue-100 rounded-xl p-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider px-2 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" /> Piste :
              </span>
              <div className="flex gap-1">
                {(['FR', 'EN'] as LanguageTrack[]).map((track) => (
                  <button
                    key={track}
                    type="button"
                    onClick={() => setCurrentTrack(track)}
                    className={cn(
                      'px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
                      currentTrack === track
                        ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                        : 'text-slate-500 hover:bg-white/50'
                    )}
                  >
                    {track === 'FR' ? 'Francophone (FR)' : 'Anglophone (EN)'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 italic ml-auto">
                Définissez séparément l'équipe francophone et l'équipe anglophone.
              </span>
            </div>
          )}

          {/* Contenu du niveau sélectionné */}
          {selectedUnit && (() => {
            const group = adminGroups.find((g) => g.unit === selectedUnit);
            if (!group) return null;
            const unitAssignments = getAssignmentsForUnit(group.unit);
            const colors = getUnitColor(group.unit);
            return (
              <div className="space-y-5">
                {/* ══════════════════════════════════════════════════════════════
                    SECTION 1 : ÉQUIPE ADMINISTRATIVE
                    ═══════════════════════════════════════════════════════════ */}
                <Card className="overflow-hidden">
                  <div
                    className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3"
                    style={{ background: `${colors.bg}40`, borderBottom: `2px solid ${colors.border}` }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: colors.text }}
                    >
                      <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">
                        Équipe administrative
                        {isBilingual && (
                          <span className="ml-2 text-[10px] font-bold text-blue-700">
                            · Piste {currentTrack === 'FR' ? 'Francophone' : 'Anglophone'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {unitAssignments.length} affectation{unitAssignments.length > 1 ? 's' : ''} active{unitAssignments.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateStamp(group.unit)}
                        disabled={generatingStamp === group.unit}
                        className="text-xs"
                      >
                        {generatingStamp === group.unit ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Stamp className="w-3 h-3" />
                        )}
                        Générer le cachet
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openAssignModal(group.unit)}
                        className="text-xs"
                        style={{ background: PRIMARY, color: 'white' }}
                      >
                        <Plus className="w-3 h-3" />
                        Affecter un poste
                      </Button>
                    </div>
                  </div>

                  <div className="p-4">
                    {unitAssignments.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-400">
                        <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Aucun poste administratif affecté pour {group.label}
                        {isBilingual && ` (piste ${currentTrack === 'FR' ? 'FR' : 'EN'})`}.
                        <br />
                        Cliquez sur « Affecter un poste » pour commencer.
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs font-bold uppercase text-gray-600">Poste</TableHead>
                              <TableHead className="text-xs font-bold uppercase text-gray-600">Titulaire</TableHead>
                              <TableHead className="text-xs font-bold uppercase text-gray-600">Période</TableHead>
                              <TableHead className="text-xs font-bold uppercase text-gray-600">Signature</TableHead>
                              <TableHead className="text-xs font-bold uppercase text-gray-600 text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unitAssignments.map((a) => {
                              const roleLabel = ADMIN_ROLE_LABELS[a.adminRole as AdminRole] || a.adminRole;
                              const staffName = a.staff
                                ? `${a.staff.firstName} ${a.staff.lastName}`.trim()
                                : '—';
                              const staffEmail = a.staff?.email || null;
                              return (
                                <TableRow key={a.id}>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-gray-900 text-xs md:text-sm">
                                        {roleLabel}
                                      </span>
                                      <span
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit mt-0.5"
                                        style={{ background: colors.bg, color: colors.text }}
                                      >
                                        <ShieldCheck className="w-2.5 h-2.5" />
                                        {group.unit}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="text-xs md:text-sm font-medium text-gray-900">{staffName}</span>
                                      {staffEmail && (
                                        <span className="text-[10px] text-gray-500">{staffEmail}</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-[10px] md:text-xs text-gray-600">
                                      <div>Du <strong>{formatDate(a.startDate)}</strong></div>
                                      {a.endDate ? (
                                        <div>Au <strong>{formatDate(a.endDate)}</strong></div>
                                      ) : (
                                        <div className="text-emerald-600 font-medium">En cours</div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateSignatureForRow(a, group.unit)}
                                      disabled={generatingRowSignature === a.id || !a.staff}
                                      className="inline-flex items-center gap-1 text-[10px] md:text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-2 py-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Générer / régénérer la signature officielle (texte) pour ce titulaire"
                                    >
                                      {generatingRowSignature === a.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <FileSignature className="w-3 h-3" />
                                      )}
                                      <span className="hidden md:inline">Signature</span>
                                    </button>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleSendCredentials(a)}
                                        disabled={sendingCredentials === a.id || !a.staffId}
                                        className="text-[10px] md:text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Envoyer les identifiants de connexion par email"
                                      >
                                        {sendingCredentials === a.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Mail className="w-3 h-3" />
                                        )}
                                        <span className="hidden md:inline">Identifiants</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(a.id)}
                                        disabled={deleting === a.id}
                                        className="text-[10px] md:text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40"
                                        title="Supprimer l'affectation"
                                      >
                                        {deleting === a.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </Card>

                {/* ══════════════════════════════════════════════════════════════
                    SECTION 2 : ÉQUIPE ENSEIGNANTE
                    ═══════════════════════════════════════════════════════════ */}
                <Card className="overflow-hidden">
                  <div
                    className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3"
                    style={{ background: `${colors.bg}20`, borderBottom: `2px solid ${colors.border}` }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: colors.text }}
                    >
                      <GraduationCap className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">
                        Équipe enseignante — {group.label}
                        {isBilingual && (
                          <span className="ml-2 text-[10px] font-bold text-blue-700">
                            · Piste {currentTrack === 'FR' ? 'Francophone' : 'Anglophone'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {teachersForSelectedLevel.length} enseignant(s) pour ce niveau
                        {unassignedTeachersCount > 0 && (
                          <span className="ml-2 text-amber-600">
                            · {unassignedTeachersCount} non affecté(s) au total
                          </span>
                        )}
                      </p>
                    </div>
                    {Object.keys(pendingTeacherChanges).length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveTeacherChanges}
                        disabled={saving}
                        className="text-xs"
                        style={{ background: PRIMARY, color: 'white' }}
                      >
                        {saving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        Enregistrer ({Object.keys(pendingTeacherChanges).length})
                      </Button>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    {/* Barre de recherche */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Rechercher un enseignant par nom, matricule ou poste..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                          !searchQuery
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        <Filter className="w-3.5 h-3.5" />
                        <span>Tous</span>
                      </button>
                    </div>

                    {/* Liste des enseignants */}
                    {teachersForSelectedLevel.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-100">
                        <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm font-semibold text-gray-600">
                          Aucun enseignant pour ce niveau
                          {isBilingual && ` (piste ${currentTrack})`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Embauchez d'abord du personnel depuis l'onglet « Personnel », puis affectez-le ici.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {teachersForSelectedLevel.map((staff) => {
                          const isAssignedHere = allLevelIdsForSelectedUnit.includes(
                            pendingTeacherChanges[staff.id]?.levelId ?? staff.schoolLevelId ?? ''
                          );
                          const hasPending = pendingTeacherChanges[staff.id] !== undefined;
                          const initials = `${staff.firstName?.[0] ?? ''}${staff.lastName?.[0] ?? ''}`;

                          return (
                            <div
                              key={staff.id}
                              className={cn(
                                'bg-white rounded-lg border transition-all',
                                hasPending
                                  ? 'border-amber-300 shadow-sm ring-1 ring-amber-200/50'
                                  : isAssignedHere
                                    ? 'border-emerald-200 bg-emerald-50/30'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              <div className="flex items-center gap-3 px-3 py-2.5">
                                {/* Avatar */}
                                <div
                                  className={cn(
                                    'w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                                    isAssignedHere ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                                  )}
                                >
                                  {initials}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-gray-900 text-sm truncate">
                                      {staff.firstName} {staff.lastName}
                                    </p>
                                    {hasPending && (
                                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase">
                                        Modifié
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate mt-0.5">
                                    {staff.position || 'Enseignant'}
                                    {staff.employeeNumber && ` · ${staff.employeeNumber}`}
                                    {staff.email && ` · ${staff.email}`}
                                  </p>
                                </div>

                                {/* Bouton affectation rapide */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleTeacherLevel(staff.id)}
                                  className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0',
                                    isAssignedHere
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200'
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  )}
                                  title={isAssignedHere ? 'Retirer de ce niveau' : `Affecter à ${group.label}`}
                                >
                                  {isAssignedHere ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Affecté</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Affecter</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Langues (si bilingue) */}
                              {isBilingual && (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/40 border-t border-blue-100/50 rounded-b-lg">
                                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                                    Langue :
                                  </span>
                                  {(['FR', 'EN'] as const).map((lang) => {
                                    const pending = pendingTeacherChanges[staff.id];
                                    const currentLangs = pending?.languages ?? staff.assignedLanguages ?? ['FR', 'EN'];
                                    const isLangActive = currentLangs.includes(lang);
                                    return (
                                      <button
                                        key={lang}
                                        type="button"
                                        onClick={() => handleToggleTeacherLanguage(staff.id, lang)}
                                        className={cn(
                                          'px-2 py-0.5 rounded text-[10px] font-bold transition-all',
                                          isLangActive
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-white text-blue-400 border border-blue-200 hover:bg-blue-50'
                                        )}
                                        title={isLangActive ? `Désactiver ${lang}` : `Activer ${lang}`}
                                      >
                                        {lang}
                                      </button>
                                    );
                                  })}
                                  <span className="text-[10px] text-slate-500 italic ml-1">
                                    Cochez les langues enseignées par ce personnel dans ce niveau.
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })()}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL : Affecter un poste administratif
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) {
          setModalUnit(null);
          setForm(EMPTY_FORM);
          setSignatureMode('none');
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserCheck className="w-4 h-4" style={{ color: PRIMARY }} />
              Affecter un poste administratif
              {modalUnit && (
                <span
                  className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: getUnitColor(modalUnit).bg,
                    color: getUnitColor(modalUnit).text,
                  }}
                >
                  {ADMIN_UNIT_LABELS[modalUnit] || modalUnit}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              Sélectionnez un poste, un membre du personnel et configurez la signature. Les identifiants de connexion seront envoyés si demandé.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Poste */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Poste administratif *
              </label>
              <select
                value={form.adminRole}
                onChange={(e) => setForm((prev) => ({ ...prev, adminRole: e.target.value }))}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">— Sélectionner un poste —</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    {ADMIN_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              {availableRoles.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Aucun poste disponible pour cette unité.
                </p>
              )}
            </div>

            {/* Staff */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Membre du personnel *
              </label>
              <select
                value={form.staffId}
                onChange={(e) => handleStaffSelect(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">— Sélectionner dans le staff —</option>
                {staffList.filter((s) => s.email).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                    {s.position ? ` (${s.position})` : ''}
                    {s.email ? ` — ${s.email}` : ''}
                  </option>
                ))}
              </select>
              {staffList.filter((s) => s.email).length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Aucun staff éligible (email requis). Embauchez d'abord du personnel avec un email valide.
                </p>
              )}
              {form.staffId && (
                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Staff sélectionné — ses coordonnées seront utilisées pour l'envoi des identifiants.
                </p>
              )}
            </div>

            {/* functionLabel + langue (si bilingue) */}
            <div className={cn('grid gap-3', isBilingual ? 'md:grid-cols-3' : 'md:grid-cols-1')}>
              <div className={isBilingual ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Fonction (libellé personnalisé)
                </label>
                <input
                  type="text"
                  value={form.functionLabel}
                  onChange={(e) => setForm((prev) => ({ ...prev, functionLabel: e.target.value }))}
                  placeholder="Laisser vide pour utiliser le libellé par défaut"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {isBilingual && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" /> Piste linguistique
                  </label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value as any }))}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="NONE">Indifférent</option>
                    <option value="FR">Francophone (FR)</option>
                    <option value="EN">Anglophone (EN)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Période */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date de début</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Signature */}
            <div className="border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <FileSignature className="w-3.5 h-3.5" /> Signature
                </label>
                <button
                  type="button"
                  onClick={handleGenerateOfficialSignature}
                  disabled={generatingSignature || !form.staffId || !form.adminRole}
                  className="text-[10px] text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Générer une signature officielle (texte) persistée dans tenant_signatures"
                >
                  {generatingSignature ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Stamp className="w-3 h-3" />
                  )}
                  Générer signature officielle
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSignatureMode('upload')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                    signatureMode === 'upload' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                  style={signatureMode === 'upload' ? { background: PRIMARY } : {}}
                >
                  <Upload className="w-3 h-3" /> Téléverser PNG
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode('canvas')}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                    signatureMode === 'canvas' ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                  style={signatureMode === 'canvas' ? { background: PRIMARY } : {}}
                >
                  <Pen className="w-3 h-3" /> Signature électronique
                </button>
              </div>

              {signatureMode === 'upload' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileUpload}
                    className="text-xs"
                  />
                  {form.signatureUploadedUrl && (
                    <div className="border border-slate-200 rounded-lg p-2 bg-slate-50 flex items-center gap-2">
                      <img src={form.signatureUploadedUrl} alt="Signature uploadée" className="max-h-20" />
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, signatureUploadedUrl: null }))}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Eraser className="w-3 h-3" /> Effacer
                      </button>
                    </div>
                  )}
                </div>
              )}

              {signatureMode === 'canvas' && (
                <div className="space-y-2">
                  {form.signatureDataUrl ? (
                    <div className="space-y-2">
                      <div className="border border-emerald-300 rounded-lg p-2 bg-emerald-50/30 flex items-center gap-2">
                        <img src={form.signatureDataUrl} alt="Signature capturée" className="max-h-24" />
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, signatureDataUrl: null }))}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Eraser className="w-3 h-3" /> Modifier
                        </button>
                      </div>
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Signature capturée
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-300 rounded-lg p-1 bg-slate-50/50">
                      <SignatureCanvas
                        width={400}
                        height={120}
                        onSignatureChange={(data) =>
                          setForm((prev) => ({ ...prev, signatureDataUrl: data }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {signatureMode === 'none' && (
                <p className="text-[10px] text-gray-400 italic">
                  Optionnel — vous pouvez générer une signature officielle (bouton ci-dessus) ou uploader/dessiner une signature.
                </p>
              )}
            </div>

            {/* Checkbox envoi identifiants */}
            <div
              className={cn(
                'rounded-lg p-4 border flex items-start gap-3',
                form.sendCredentials
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-slate-50 border-slate-200',
              )}
            >
              <input
                type="checkbox"
                id="send-credentials"
                checked={form.sendCredentials}
                onChange={(e) => setForm((prev) => ({ ...prev, sendCredentials: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <label htmlFor="send-credentials" className="text-xs text-slate-700 cursor-pointer flex-1">
                <strong className="flex items-center gap-1 text-slate-900">
                  <Send className="w-3 h-3" /> Envoyer les identifiants de connexion
                </strong>
                Crée un compte User avec un mot de passe temporaire et envoie un email au titulaire
                (identifiant + mot de passe + lien du portail école). Le titulaire pourra modifier son mot de passe après connexion.
              </label>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalOpen(false);
                setModalUnit(null);
                setForm(EMPTY_FORM);
                setSignatureMode('none');
              }}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleAssign}
              disabled={saving || !form.staffId || !form.adminRole}
              style={{ background: PRIMARY, color: 'white' }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Affecter le poste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
