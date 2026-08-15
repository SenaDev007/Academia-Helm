'use client';

/**
 * ============================================================================
 * ADMINISTRATIVE STAFF WORKSPACE
 * ============================================================================
 *
 * Remplace DirectorsWorkspace.tsx — gère TOUS les postes administratifs par
 * niveau scolaire (au lieu de seulement les directeurs).
 *
 * Fonctionnalités :
 *   - Affichage des unités administratives selon le mode (SEPARATE ou FUSED)
 *     via /api/admin-structure/groups
 *   - Pour chaque unité (MAT, PRI, SEC, MAT_PRI) :
 *     • Tableau des affectations existantes (poste, titulaire, période, signature, actions)
 *     • Bouton "Affecter un poste" → modal avec :
 *       - Sélection du poste (adminRole) filtré par niveau (ROLES_BY_UNIT)
 *       - Sélection du staff depuis /api/hr/staff?status=ACTIVE
 *       - functionLabel personnalisé (optionnel)
 *       - Période (startDate / endDate)
 *       - Upload de signature OU canvas électronique
 *       - Bouton "Générer la signature officielle" (POST /api/settings/signature/generate)
 *       - Checkbox "Envoyer identifiants" (crée User + mdp temporaire)
 *     • Bouton "Générer le cachet" (POST /api/settings/stamps/generate)
 *   - Mode bilingue : sélecteur de piste FR/EN dans le modal (le libellé de
 *     fonction est suffixé par la piste)
 *
 * Endpoints utilisés :
 *   GET    /api/admin-structure/groups                 → unités admin + mode
 *   GET    /api/school-levels                          → niveaux scolaires actifs
 *   GET    /api/hr/staff?status=ACTIVE                 → liste du personnel
 *   GET    /api/staff-admin-assignments                → affectations existantes
 *   POST   /api/staff-admin-assignments                → créer une affectation
 *   DELETE /api/staff-admin-assignments/:id            → supprimer une affectation
 *   POST   /api/hr/staff/:staffId/generate-credentials → envoyer identifiants
 *   POST   /api/settings/stamps/generate               → générer cachets par niveau
 *   POST   /api/settings/signature/generate            → générer signature officielle
 *
 * Props :
 *   { user?, tenant?, academicYear? } — optionnels, fallback sur useAppSession /
 *   useAcademicYearContext si non fournis.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, CheckCircle2, Trash2, Upload, Pen, School,
  Stamp, Plus, Mail, UserCheck, Eraser, FileSignature, X, Globe,
  ShieldCheck, Calendar, Send,
} from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { useAcademicYearContext } from '@/contexts/AcademicYearContext';
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
import {
  ADMIN_ROLE_LABELS, ROLES_BY_UNIT, ADMIN_UNIT_LABELS, LEVEL_CODE_TO_UNIT,
  type AdminRole,
} from '@/lib/constants/admin-roles';
import type { User, Tenant, AcademicYear } from '@/types';

// ── Palette Academia Helm ───────────────────────────────────────────────────
const PRIMARY = '#1A2BA6'; // Royal Blue

// ── Types ───────────────────────────────────────────────────────────────────
interface AdministrativeStaffWorkspaceProps {
  user?: User;
  tenant?: Tenant;
  academicYear?: AcademicYear;
}

interface SchoolLevel {
  id: string;
  code: string; // 'MATERNELLE' | 'PRIMARY' | 'SECONDAIRE'
  name: string;
  isActive: boolean;
}

interface AdminGroup {
  unit: 'MAT' | 'PRI' | 'SEC' | 'MAT_PRI' | 'ALL';
  label: string;
  levelIds: string[];
  levelCodes: string[]; // ['MATERNELLE'] ou ['MATERNELLE','PRIMARY'] pour MAT_PRI
}

interface StaffOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  status: string;
}

interface AdminAssignment {
  id: string;
  staffId: string;
  schoolLevelCode: string; // 'MAT' | 'PRI' | 'SEC' | 'MAT_PRI' | 'ALL'
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

// ── Helper : fetch authentifié (utilise getClientAuthorizationHeader) ─────────
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
      } catch {
        /* keep default */
      }
    }
    throw new Error(msg);
  }
  if (!text.trim()) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse invalide du serveur');
  }
}

// ── Helper : formatage date ─────────────────────────────────────────────────
function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ── Helper : couleur badge par unité ────────────────────────────────────────
function getUnitColor(unit: string): { bg: string; text: string; border: string } {
  switch (unit) {
    case 'MAT':
      return { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5' };
    case 'PRI':
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
    case 'SEC':
      return { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' };
    case 'MAT_PRI':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
    default:
      return { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  }
}

// ============================================================================
//  COMPOSANT PRINCIPAL
// ============================================================================

export default function AdministrativeStaffWorkspace({
  user, tenant, academicYear,
}: AdministrativeStaffWorkspaceProps) {
  // ⭐ Fallback sur les contextes si les props ne sont pas fournies
  const session = useAppSession();
  const ayCtx = useAcademicYearContext();
  const { isEnabled: isBilingual } = useBilingual();

  const currentUser = user ?? session.user;
  const currentTenant = tenant ?? session.tenant;
  const currentAcademicYear = academicYear ?? ayCtx.currentYear;
  const tenantId = currentTenant?.id;
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

  // ── États modal ───────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUnit, setModalUnit] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [signatureMode, setSignatureMode] = useState<'upload' | 'canvas' | 'none'>('none');

  // ── Dismiss auto du success après 4s ──────────────────────────────────────
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
      // 1. Charger les niveaux scolaires (pour résoudre levelIds → UUIDs)
      const levelsData = await authedFetch<SchoolLevel[] | { items?: SchoolLevel[] }>('/api/school-levels');
      const levels = Array.isArray(levelsData) ? levelsData : (levelsData?.items ?? []);
      const activeLevels = levels.filter((l) => l.id !== 'ALL' && l.isActive);
      setSchoolLevels(activeLevels);

      // 2. Charger la structure administrative (mode + groups)
      try {
        const groupsData = await authedFetch<{ mode: string; groups: AdminGroup[] }>(
          '/api/admin-structure/groups',
        );
        if (groupsData?.mode) {
          setAdminMode(groupsData.mode as 'SEPARATE' | 'FUSED_MATERNELLE_PRIMAIRE');
        }
        if (Array.isArray(groupsData?.groups)) {
          setAdminGroups(groupsData.groups.filter((g) => g.unit !== 'ALL'));
        }
      } catch (err) {
        // Fallback : si l'endpoint admin-structure n'est pas dispo, on construit
        // les groups depuis les schoolLevels actifs (mode SEPARATE par défaut)
        console.warn('admin-structure/groups unavailable, falling back to SEPARATE mode:', err);
        const fallbackGroups: AdminGroup[] = activeLevels.map((l) => ({
          unit: (LEVEL_CODE_TO_UNIT[l.code] || 'MAT') as AdminGroup['unit'],
          label: l.name,
          levelIds: [l.id],
          levelCodes: [l.code],
        }));
        setAdminGroups(fallbackGroups);
        setAdminMode('SEPARATE');
      }

      // 3. Charger la liste du personnel actif
      try {
        const staffData = await authedFetch<StaffOption[] | { items?: StaffOption[]; data?: StaffOption[] }>(
          `/api/hr/staff?status=ACTIVE&limit=500`,
        );
        const allStaff = Array.isArray(staffData)
          ? staffData
          : (staffData?.items ?? staffData?.data ?? []);
        // Filtrer : doit avoir un email (sinon pas d'envoi d'identifiants possible)
        setStaffList(allStaff.filter((s) => s.email));
      } catch (err) {
        console.warn('Failed to load staff list:', err);
        setStaffList([]);
      }

      // 4. Charger les affectations existantes
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Affectations filtrées par unité ───────────────────────────────────────
  const getAssignmentsForUnit = useCallback(
    (unit: string): AdminAssignment[] => {
      return assignments.filter((a) => a.schoolLevelCode === unit && a.isActive);
    },
    [assignments],
  );

  // ── Ouvrir le modal d'affectation ─────────────────────────────────────────
  const openAssignModal = useCallback((unit: string) => {
    setModalUnit(unit);
    setForm({
      ...EMPTY_FORM,
      startDate: new Date().toISOString().slice(0, 10),
    });
    setSignatureMode('none');
    setModalOpen(true);
    setError(null);
    setSuccess(null);
  }, []);

  // ── Soumission du formulaire d'affectation ────────────────────────────────
  const handleAssign = async () => {
    if (!modalUnit) return;
    if (!form.staffId) {
      setError('Veuillez sélectionner un membre du personnel.');
      return;
    }
    if (!form.adminRole) {
      setError('Veuillez sélectionner un poste.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Construire le functionLabel final (avec suffixe langue si bilingue)
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

      // 2. Créer l'affectation via /api/staff-admin-assignments
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

      // 3. Générer la signature officielle (si demandé)
      //    On appelle /api/settings/signature/generate qui crée une tenant_signature
      //    persistante (text-based) à partir du nom du titulaire + rôle + niveau.
      const selectedStaff = staffList.find((s) => s.id === form.staffId);
      const shouldGenerateSignature =
        form.signatureDataUrl || form.signatureUploadedUrl || form.adminRole;
      if (shouldGenerateSignature && selectedStaff && modalUnit !== 'ALL') {
        try {
          // Pour MAT_PRI en mode fused, on passe educationLevelId = null (cachets globaux)
          // Pour MAT/PRI/SEC, on passe l'UUID du niveau
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
          // Non bloquant — la signature est optionnelle
          console.warn('Signature generation failed (non-blocking):', err.message);
        }
      }

      // 4. Envoyer les identifiants si demandé
      let credentialsSent = false;
      if (form.sendCredentials && selectedStaff?.email) {
        try {
          await authedFetch(`/api/hr/staff/${form.staffId}/generate-credentials`, {
            method: 'POST',
          });
          credentialsSent = true;
        } catch (err: any) {
          // Non bloquant — l'affectation est créée, on signale juste l'échec
          console.warn('Credentials sending failed (non-blocking):', err.message);
        }
      }

      // 5. Succès
      const staffName = selectedStaff
        ? `${selectedStaff.firstName} ${selectedStaff.lastName}`.trim()
        : 'Staff';
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
      setError(err.message || 'Erreur lors de l\'affectation');
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer une affectation ─────────────────────────────────────────────
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

  // ── Envoyer / Renvoyer les identifiants ───────────────────────────────────
  const handleSendCredentials = async (assignment: AdminAssignment) => {
    if (!assignment.staffId) {
      setError('Aucun staff lié à cette affectation.');
      return;
    }
    setSendingCredentials(assignment.id);
    setError(null);
    setSuccess(null);
    try {
      await authedFetch(`/api/hr/staff/${assignment.staffId}/generate-credentials`, {
        method: 'POST',
      });
      const name = assignment.staff
        ? `${assignment.staff.firstName} ${assignment.staff.lastName}`.trim()
        : 'du staff';
      setSuccess(`Identifiants envoyés à ${name}. Un email avec login + mot de passe temporaire a été envoyé.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi des identifiants');
    } finally {
      setSendingCredentials(null);
    }
  };

  // ── Générer les cachets pour une unité ────────────────────────────────────
  const handleGenerateStamp = async (unit: string) => {
    setGeneratingStamp(unit);
    setError(null);
    setSuccess(null);
    try {
      // Pour MAT_PRI en mode fused → educationLevelId = null (cachets globaux)
      // Pour MAT/PRI/SEC → UUID du niveau correspondant
      let educationLevelId: string | null = null;
      if (unit !== 'MAT_PRI') {
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT)
          .find(([, u]) => u === unit)?.[0];
        const level = schoolLevels.find((l) => l.code === unitLevelCode);
        educationLevelId = level?.id ?? null;
      }
      await authedFetch('/api/settings/stamps/generate', {
        method: 'POST',
        body: {
          formats: ['circular', 'rectangular', 'oval'],
          educationLevelId,
        },
      });
      const unitLabel = ADMIN_UNIT_LABELS[unit] || unit;
      setSuccess(`Cachets générés pour ${unitLabel} (circulaire, rectangulaire, ovale). Disponibles dans Paramètres > Cachets & Signatures.`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération des cachets');
    } finally {
      setGeneratingStamp(null);
    }
  };

  // ── Générer la signature officielle depuis le modal ───────────────────────
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
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT)
          .find(([, u]) => u === modalUnit)?.[0];
        const level = schoolLevels.find((l) => l.code === unitLevelCode);
        educationLevelId = level?.id ?? null;
      }
      const roleLabel = form.functionLabel.trim() ||
        ADMIN_ROLE_LABELS[form.adminRole as AdminRole] ||
        form.adminRole;
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

  // ── Générer la signature officielle pour une affectation existante ────────
  //    (depuis le tableau — bouton "Signature" dans la colonne dédiée)
  const handleGenerateSignatureForRow = async (assignment: AdminAssignment, unit: string) => {
    if (!assignment.staff) {
      setError('Staff introuvable pour cette affectation.');
      return;
    }
    setGeneratingRowSignature(assignment.id);
    setError(null);
    setSuccess(null);
    try {
      let educationLevelId: string | null = null;
      if (unit !== 'MAT_PRI') {
        const unitLevelCode = Object.entries(LEVEL_CODE_TO_UNIT)
          .find(([, u]) => u === unit)?.[0];
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
      setSuccess(`Signature officielle régénérée pour ${staffName} (${roleLabel}). Disponible dans Paramètres > Cachets & Signatures.`);
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
    if (!staff) {
      setForm((prev) => ({ ...prev, staffId: '' }));
      return;
    }
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

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
        <span className="ml-2 text-gray-600 text-sm">Chargement du personnel administratif…</span>
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
          <h2 className="text-xl font-bold text-gray-900">Personnel Administratif par Niveau</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Affectez les postes administratifs (directeurs, surveillants, secrétaires, comptables…) par unité scolaire.
            {adminMode === 'FUSED_MATERNELLE_PRIMAIRE' && (
              <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-bold text-amber-700 border border-amber-200">
                <Globe className="w-3 h-3" /> Mode Maternelle + Primaire fusionné
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
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{success}</span>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-emerald-400 hover:text-emerald-600"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ⭐ Carte par unité administrative */}
      {adminGroups.length === 0 ? (
        <Card className="p-8 text-center">
          <School className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            Aucune unité administrative configurée. Activez au moins un niveau scolaire
            dans <strong>Paramètres &gt; Structure pédagogique</strong>.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {adminGroups.map((group) => {
            const unitAssignments = getAssignmentsForUnit(group.unit);
            const colors = getUnitColor(group.unit);
            return (
              <Card key={group.unit} className="overflow-hidden">
                {/* Header unité */}
                <div
                  className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3"
                  style={{ background: `${colors.bg}40`, borderBottom: `2px solid ${colors.border}` }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: colors.text }}
                  >
                    <School className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900">{group.label}</h3>
                    <p className="text-xs text-gray-500">
                      {unitAssignments.length} affectation{unitAssignments.length > 1 ? 's' : ''} active{unitAssignments.length > 1 ? 's' : ''}
                      {adminMode === 'FUSED_MATERNELLE_PRIMAIRE' && group.unit === 'MAT_PRI' && ' · Maternelle + Primaire fusionnées'}
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

                {/* Tableau des affectations */}
                <div className="p-4">
                  {unitAssignments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400">
                      <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      Aucun poste administratif affecté pour cette unité.
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
                                      style={{
                                        background: colors.bg,
                                        color: colors.text,
                                      }}
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
            );
          })}
        </div>
      )}

      {/* ⭐ MODAL : Affecter un poste */}
      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) {
          setModalUnit(null);
          setForm(EMPTY_FORM);
          setSignatureMode('none');
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
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

          <div className="space-y-4 py-2">
            {/* Poste (adminRole) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Poste administratif *
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> Membre du personnel *
              </label>
              <select
                value={form.staffId}
                onChange={(e) => handleStaffSelect(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">— Sélectionner dans le staff —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                    {s.position ? ` (${s.position})` : ''}
                    {s.email ? ` — ${s.email}` : ''}
                  </option>
                ))}
              </select>
              {staffList.length === 0 && (
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
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
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Piste linguistique
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de début</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Signature */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                  <FileSignature className="w-3 h-3" /> Signature
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
                  <Upload className="w-3 h-3" /> Upload PNG
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

              {/* Upload mode */}
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
                      <img
                        src={form.signatureUploadedUrl}
                        alt="Signature uploadée"
                        className="max-h-20"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, signatureUploadedUrl: null }))}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                      >
                        <Eraser className="w-3 h-3" /> Effacer
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">
                    Aperçu uniquement. Pour persister, utilisez « Générer signature officielle ».
                  </p>
                </div>
              )}

              {/* Canvas mode */}
              {signatureMode === 'canvas' && (
                <div className="space-y-2">
                  {form.signatureDataUrl ? (
                    <div className="space-y-2">
                      <div className="border border-emerald-300 rounded-lg p-2 bg-emerald-50/30 flex items-center gap-2">
                        <img
                          src={form.signatureDataUrl}
                          alt="Signature capturée"
                          className="max-h-24"
                        />
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
                'rounded-lg p-3 border flex items-start gap-2',
                form.sendCredentials
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-slate-50 border-slate-200',
              )}
            >
              <input
                type="checkbox"
                id="send-credentials"
                checked={form.sendCredentials}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sendCredentials: e.target.checked }))
                }
                className="mt-0.5 w-4 h-4 accent-blue-600"
              />
              <label htmlFor="send-credentials" className="text-xs text-slate-700 cursor-pointer flex-1">
                <strong className="flex items-center gap-1 text-slate-900">
                  <Send className="w-3 h-3" /> Envoyer les identifiants de connexion
                </strong>
                Crée un compte User avec un mot de passe temporaire et envoie un email au titulaire
                (login + mot de passe + lien du portail école). Le titulaire pourra modifier son mot de passe après connexion.
              </label>
            </div>
          </div>

          <DialogFooter>
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
