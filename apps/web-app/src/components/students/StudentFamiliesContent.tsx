'use client';

/**
 * ============================================================================
 * FAMILLES & RESPONSABLES LÉGAUX — CRUD guardian
 * ============================================================================
 * Selon MODULE ELEVES.md — Onglet 5
 * Enrichissements : add/edit/delete guardian, marquer principal, 
 * recherche par élève ou parent, stats réelles.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Mail, Phone, Star, Heart, Loader2, User,
  Edit2, Trash2, X, Check, Shield, ChevronLeft, ChevronRight,
  KeyRound, UserCheck, Send, ExternalLink, UsersRound,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
// ⭐ nov. 2026 — mêmes icônes officielles que le modal d'encaissement
//    (module Finance) pour l'envoi multi-canal des identifiants parent.
//    15/11/2026 : SMS (Termii) en premier canal.
//    ⭐ 15/11/2026 (retour promoteur) : WhatsApp RÉACTIVÉ aux côtés du SMS —
//    bouton ACTIF (lien wa.me pré-rempli — envoi manuel fiable, même pattern
//    que le module Finance), on garde TOUS les canaux : SMS, WhatsApp,
//    Email, Helm Connect.
import { GmailIcon, HelmConnectIcon, SmsIcon, WhatsAppIcon } from '@/components/finance/OfficialIcons';

interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  relationship: string;
  /** ⭐ nov. 2026 — présent dans la réponse API (guardian: true) : compte
   *    parent lié (User role=PARENT). null/absent = pas encore de compte. */
  userId?: string | null;
}

interface StudentGuardian {
  id: string;
  relationship: string;
  isPrimary: boolean;
  guardian: Guardian;
}

interface StudentWithGuardians {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  photoUrl?: string | null;
  studentGuardians: StudentGuardian[];
}

interface GuardianForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
}

const RELATIONSHIPS = ['PÈRE', 'MÈRE', 'TUTEUR', 'ONCLE', 'TANTE', 'GRAND_PARENT', 'FRÈRE', 'SŒUR', 'AUTRE'];

/** ⭐ nov. 2026 — résultat d'une création / renvoi d'identifiants parent */
interface AccountActionResult {
  guardianId: string;
  studentId: string;
  account: { userId?: string; created?: boolean } | null;
  credentials?: { portalUrl: string; identifier: string; identifierType: 'PHONE' | 'EMAIL'; password?: string | null };
  notification: Record<string, { status?: string; to?: string; error?: string }>;
}

export default function StudentFamiliesContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentWithGuardians[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentWithGuardians | null>(null);
  const [guardianForm, setGuardianForm] = useState<GuardianForm | null>(null);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [editingGuardianJunctionId, setEditingGuardianJunctionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 24;

  // ⭐ nov. 2026 (demande promoteur) — sous-onglets de l'onglet Famille :
  //    « Responsables » (CRUD existant) | « Création de compte » (créer les
  //    comptes parents pour les responsables sans compte — étape skippée au
  //    wizard d'inscription — et leur envoyer leurs identifiants de connexion).
  const [activeSubTab, setActiveSubTab] = useState<'guardians' | 'accounts'>('guardians');
  const [provisioningKey, setProvisioningKey] = useState<string | null>(null); // `${studentId}:${guardianId}`
  const [accountResults, setAccountResults] = useState<Record<string, AccountActionResult>>({});
  // ⭐ 15/11/2026 (retour promoteur) — GÉNÉRATION MULTIPLE : les élèves SANS
  //    responsable sont exclus de la liste (visibles uniquement en statistique
  //    — retournables dans le sous-onglet « Responsables »). Dès qu'un
  //    responsable est associé, l'élève apparaît ici pour la création du compte.
  const [kpiStudents, setKpiStudents] = useState<StudentWithGuardians[]>([]);
  // ⭐ 15/11/2026 (retour promoteur) — deux boutons de génération multiple :
  //    création multiple des comptes + envoi multiple des identifiants.
  const [bulkAction, setBulkAction] = useState<'create' | 'resend' | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    action: 'create' | 'resend';
    summary: { total: number; created: number; sent: number; failed: number; skipped: number };
    results: any[];
  } | null>(null);
  // ⭐ Bug fix : vraie pagination serveur. On stocke le total retourné par le
  // backend (data.total) au lieu de l'inférer depuis students.length (qui ne
  // contenait que la 1ère page de 50 élèves — défaut backend).
  const [totalFamilies, setTotalFamilies] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // ⭐ KPIs globaux (calculés sur une fetch séparée limit=200, sans pagination).
  // On ne peut pas utiliser data.total pour ces 3 stats car le backend ne
  // retourne pas de stats agrégées par guardian. On garde donc un fetch
  // "all students" non paginé pour calculer ces compteurs.
  const [kpiStats, setKpiStats] = useState({
    totalGuardians: 0,
    studentsWithPrimary: 0,
    studentsWithoutGuardian: 0,
    // ⭐ nov. 2026 — responsables sans compte parent (sous-onglet
    //    « Création de compte ») : calculé sur le même fetch global (limit=200).
    guardiansWithoutAccount: 0,
  });

  // ⭐ Bug fix : reset currentPage à 1 quand la recherche change.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ⭐ Bug fix : recharger au changement de page/recherche (debounce 250ms sur search).
  useEffect(() => {
    if (!academicYear) return;
    const timeout = setTimeout(() => {
      loadData();
    }, searchTerm ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, schoolLevel, currentPage, searchTerm]);

  // ⭐ KPIs : fetch séparée (limit=200, sans pagination) pour avoir les vrais
  // compteurs agrégés par guardian. Rechargée quand l'année/niveau/recherche change.
  useEffect(() => {
    if (!academicYear) return;
    const timeout = setTimeout(() => {
      loadKpiStats();
    }, searchTerm ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear, schoolLevel, searchTerm]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      // ⭐ Bug fix : passer page/limit/search au backend pour la vraie pagination.
      // L'ancien code ne passait pas page/limit (récupérait 50 par défaut) et
      // la pagination côté UI ne faisait que slice() sans re-fetch.
      // ⭐ FIX 2026-11-15 « Famille vide pour les profils restreints » : ne
      //    JAMAIS envoyer la sentinelle 'ALL' (option virtuelle « Mon
      //    périmètre / Tous les niveaux ») en query schoolLevelId —
      //    AccessScopeGuard la rejette en 403 pour les comptes restreints
      //    (directrice Mat+Pri…) → liste + KPIs Familles vides. Sans niveau
      //    explicite, le périmètre serveur s'applique.
      const familyLevelId =
        schoolLevel?.id && schoolLevel.id !== 'ALL' ? schoolLevel.id : '';
      const data = await studentsService.getAll({
        academicYearId: academicYear.id,
        schoolLevelId: familyLevelId,
        includeGuardians: 'true',
        page: String(currentPage),
        limit: String(PAGE_SIZE),
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      });
      // ⭐ Gérer la réponse paginée { data, total, ... } ou l'ancien format array
      const list = Array.isArray(data) ? data : (data?.data || []);
      setStudents(list);
      setTotalFamilies(!Array.isArray(data) && data?.total != null ? data.total : list.length);
      setTotalPages(!Array.isArray(data) && data?.totalPages != null ? data.totalPages : 1);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ⭐ Charge tous les élèves (limit=200, max backend) pour calculer les KPIs
   * agrégés par guardian. Pas de pagination ici — on veut le vrai total.
   * Cette fonction est debouncée via le useEffect ci-dessus.
   */
  const loadKpiStats = async () => {
    if (!academicYear) return;
    try {
      // ⭐ FIX 2026-11-15 : idem loadData — jamais la sentinelle 'ALL' en query
      //    (403 AccessScopeGuard pour les profils restreints → KPIs à zéro).
      const familyLevelId =
        schoolLevel?.id && schoolLevel.id !== 'ALL' ? schoolLevel.id : '';
      const data = await studentsService.getAll({
        academicYearId: academicYear.id,
        schoolLevelId: familyLevelId,
        includeGuardians: 'true',
        limit: '200',
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
      });
      const allStudents: StudentWithGuardians[] = Array.isArray(data) ? data : (data?.data || []);
      // ⭐ 15/11/2026 — liste complète (limit=200) également stockée pour le
      //    sous-onglet « Création de compte » : la liste cible n'est PLUS
      //    paginée par 24 — on veut TOUS les responsables sans compte d'un
      //    coup (génération multiple).
      setKpiStudents(allStudents);
      setKpiStats({
        totalGuardians: allStudents.reduce((sum, s) => sum + (s.studentGuardians?.length || 0), 0),
        studentsWithPrimary: allStudents.filter(s => s.studentGuardians?.some(sg => sg.isPrimary)).length,
        studentsWithoutGuardian: allStudents.filter(s => !s.studentGuardians || s.studentGuardians.length === 0).length,
        guardiansWithoutAccount: allStudents.reduce(
          (sum, s) => sum + (s.studentGuardians?.filter(sg => !sg.guardian.userId).length || 0), 0,
        ),
      });
    } catch (e) {
      console.warn('Failed to load KPI stats:', e);
    }
  };

  // ⭐ Bug fix : la recherche est envoyée au backend (filtre sur firstName,
  // lastName, studentCode). On garde en plus un filtrage côté client pour
  // chercher aussi par guardian firstName/lastName/phone (non supporté par le
  // backend). Pour éviter d'exclure à tort les élèves retournés par le backend
  // via studentCode (que le client ne filtre pas nativement), on ajoute aussi
  // une vérification sur studentCode si présent.
  const filteredStudents = !searchTerm.trim()
    ? students
    : students.filter(s => {
        const q = searchTerm.toLowerCase();
        const studentMatch =
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          (s.matricule || '').toLowerCase().includes(q) ||
          ((s as any).studentCode || '').toLowerCase().includes(q);
        const guardianMatch = s.studentGuardians?.some(sg =>
          `${sg.guardian.firstName} ${sg.guardian.lastName}`.toLowerCase().includes(q) ||
          (sg.guardian.phone || '').includes(searchTerm)
        );
        return studentMatch || guardianMatch;
      });

  // ⭐ KPIs : utilisent kpiStats (vraies valeurs agrégées) au lieu de students.length
  const totalGuardians = kpiStats.totalGuardians;
  const studentsWithPrimary = kpiStats.studentsWithPrimary;
  const studentsWithoutGuardian = kpiStats.studentsWithoutGuardian;
  // ⭐ nov. 2026 — KPI du sous-onglet « Création de compte »
  const guardiansWithoutAccountKpi = kpiStats.guardiansWithoutAccount;

  // ═══════════════════════════════════════════════════════════════════
  // ⭐ 15/11/2026 (retour promoteur) — FILTRE du sous-onglet « Création de
  //    compte » : UNIQUEMENT les élèves qui ONT des responsables dont le
  //    compte n'est pas encore créé. Les élèves SANS responsable sont
  //    EXCLUS de la liste (statistique « Sans parent » uniquement — ils sont
  //    retournables dans le sous-onglet « Responsables ») ; dès qu'on leur
  //    associe un responsable, ils apparaissent ici pour créer le compte.
  // ═══════════════════════════════════════════════════════════════
  const accountsTargetStudents = kpiStudents.filter(
    s =>
      (s.studentGuardians?.length || 0) > 0 &&
      s.studentGuardians.some(sg => !sg.guardian.userId),
  );
  const filteredAccountsStudents = !searchTerm.trim()
    ? accountsTargetStudents
    : accountsTargetStudents.filter(s => {
        const q = searchTerm.toLowerCase();
        const studentMatch =
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          (s.matricule || '').toLowerCase().includes(q) ||
          ((s as any).studentCode || '').toLowerCase().includes(q);
        const guardianMatch = s.studentGuardians?.some(sg =>
          `${sg.guardian.firstName} ${sg.guardian.lastName}`.toLowerCase().includes(q) ||
          (sg.guardian.phone || '').includes(searchTerm)
        );
        return studentMatch || guardianMatch;
      });
  // Compteurs des deux boutons de génération multiple (sur la liste filtrée)
  const bulkCreateCount = filteredAccountsStudents.reduce(
    (sum, s) => sum + (s.studentGuardians?.filter(sg => !sg.guardian.userId).length || 0), 0,
  );
  const bulkResendCount = filteredAccountsStudents.reduce(
    (sum, s) => sum + (s.studentGuardians?.filter(sg => sg.guardian.userId).length || 0), 0,
  );

  /**
   * ⭐ 15/11/2026 (retour promoteur — « une vingtaine de parents sans compte,
   * tout faire un à un est ingérable ») — GÉNÉRATION MULTIPLE des comptes
   * parents (deux boutons) :
   *   - action='create' : crée TOUS les comptes manquants de la vue + envoie
   *     les identifiants (SMS + email + Helm Connect)
   *   - action='resend' : renvoie les identifiants (mot de passe régénéré)
   *     aux responsables déjà dotés d'un compte dans la vue
   * Backend : POST /students/guardians/account/bulk (timeout 5 min).
   */
  const handleBulkProvision = async (action: 'create' | 'resend') => {
    const ids = filteredAccountsStudents.flatMap(s =>
      s.studentGuardians
        .filter(sg => (action === 'create' ? !sg.guardian.userId : !!sg.guardian.userId))
        .map(sg => sg.guardian.id),
    );
    if (ids.length === 0) {
      toast({
        title: action === 'create' ? 'Aucun compte à créer' : 'Aucun identifiant à renvoyer',
        description: action === 'create'
          ? 'Tous les responsables de la vue ont déjà un compte.'
          : 'Aucun responsable de la vue n\u2019a encore de compte.',
        variant: 'info',
      });
      return;
    }
    if (action === 'create' && !confirm(
      `Créer ${ids.length} compte(s) parent et envoyer les identifiants (SMS, email, Helm Connect) ?`,
    )) return;
    if (action === 'resend' && !confirm(
      `Renvoyer les identifiants (mot de passe régénéré) à ${ids.length} parent(s) ?`,
    )) return;

    setBulkAction(action);
    setBulkResult(null);
    try {
      const result = await studentsService.bulkProvisionParentAccounts(ids, action);
      const summary = result?.summary ?? { total: ids.length, created: 0, sent: 0, failed: 0, skipped: 0 };
      setBulkResult({ action, summary, results: result?.results ?? [] });
      toast({
        title: action === 'create' ? 'Création multiple terminée' : 'Envoi multiple terminé',
        description: [
          action === 'create' && summary.created ? `${summary.created} compte(s) créé(s)` : '',
          summary.sent ? `${summary.sent} envoi(s) réussi(s)` : '',
          summary.failed ? `${summary.failed} échec(s)` : '',
          summary.skipped ? `${summary.skipped} ignoré(s)` : '',
        ].filter(Boolean).join(' — ') || 'Aucun traitement.',
        variant: summary.failed > 0 ? 'warning' : 'success',
      });
      loadData();
      loadKpiStats(); // rafraîchir userId + compteurs (badge « N sans compte »)
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Échec de la génération multiple', variant: 'error' });
    } finally {
      setBulkAction(null);
    }
  };

  const openAddGuardian = (student: StudentWithGuardians) => {
    setEditingStudent(student);
    setEditingGuardianId(null);
    setEditingGuardianJunctionId(null);
    setGuardianForm({ firstName: '', lastName: '', phone: '', email: '', relationship: 'PÈRE', isPrimary: false });
  };

  const openEditGuardian = (student: StudentWithGuardians, sg: StudentGuardian) => {
    setEditingStudent(student);
    // ✅ FIX: use sg.guardian.id (Guardian UUID), NOT sg.id (junction table ID)
    // sg.id is the StudentGuardian junction ID — backend looks up Guardian by guardianId
    setEditingGuardianId(sg.guardian.id);
    // ⭐ Store junction ID for relationship update
    setEditingGuardianJunctionId(sg.id);
    setGuardianForm({
      firstName: sg.guardian.firstName,
      lastName: sg.guardian.lastName,
      phone: sg.guardian.phone || '',
      email: sg.guardian.email || '',
      relationship: sg.relationship,
      isPrimary: sg.isPrimary,
    });
  };

  const saveGuardian = async () => {
    if (!editingStudent || !guardianForm) return;
    if (!guardianForm.firstName.trim() || !guardianForm.lastName.trim()) {
      toast({ title: 'Champs requis', description: 'Prénom et nom du responsable sont obligatoires', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingGuardianId) {
        // ✅ FIX: Update guardian info (firstName, lastName, phone, email, address)
        // Backend UpdateGuardianDto only accepts these fields — NOT relationship/isPrimary
        await apiFetch(`/students/${editingStudent.id}/guardians/${editingGuardianId}`, {
          method: 'PUT',
          body: JSON.stringify({
            firstName: guardianForm.firstName,
            lastName: guardianForm.lastName,
            phone: guardianForm.phone,
            email: guardianForm.email,
          }),
        });

        // ✅ FIX: Update relationship/isPrimary via separate endpoint
        // (UpdateGuardianRelationDto accepts relationship + isPrimary)
        if (editingGuardianJunctionId) {
          await apiFetch(`/students/${editingStudent.id}/guardians/relation/${editingGuardianJunctionId}`, {
            method: 'PUT',
            body: JSON.stringify({
              relationship: guardianForm.relationship,
              isPrimary: guardianForm.isPrimary,
            }),
          }).catch((e: any) => {
            // ⭐ Ne plus avaler silencieusement — avertir l'utilisateur
            console.warn('updateRelation:', e?.message);
            toast({
              title: '⚠️ Lien non mis à jour',
              description: e?.message || 'La mise à jour de la relation a échoué.',
              variant: 'error',
            });
          });
        }

        toast({ title: '✅ Responsable modifié', variant: 'success' });
      } else {
        // ✅ FIX: Send FLAT guardian object, not { guardians: [...] }
        // Backend CreateGuardianDto expects flat { firstName, lastName, relationship, phone, email, ... }
        await apiFetch(`/students/${editingStudent.id}/guardians`, {
          method: 'POST',
          body: JSON.stringify({
            firstName: guardianForm.firstName,
            lastName: guardianForm.lastName,
            relationship: guardianForm.relationship,
            phone: guardianForm.phone,
            email: guardianForm.email,
            isPrimary: guardianForm.isPrimary,
          }),
        });
        toast({ title: '✅ Responsable ajouté', variant: 'success' });
      }
      setGuardianForm(null);
      setEditingStudent(null);
      setEditingGuardianId(null);
      setEditingGuardianJunctionId(null);
      loadData();
      loadKpiStats();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGuardian = async (studentId: string, guardianId: string) => {
    if (!confirm('Supprimer ce responsable ?')) return;
    try {
      await apiFetch(`/students/${studentId}/guardians/${guardianId}`, { method: 'DELETE' });
      toast({ title: '✅ Responsable supprimé', variant: 'success' });
      loadData();
      loadKpiStats(); // ⭐ Recharger aussi les KPIs
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ⭐ nov. 2026 (demande promoteur) — Sous-onglet « Création de compte » :
  // créer le compte parent d'un responsable sans compte (étape skippée au
  // wizard d'inscription) et lui envoyer ses identifiants de connexion —
  // par SMS (Termii) + email + Helm Connect, exactement comme le modal
  // d'encaissement du module Finance envoie le reçu (Backend : POST
  // /students/:studentId/guardians/:guardianId/account).
  // ═══════════════════════════════════════════════════════════════════════

  const guardianKey = (studentId: string, guardianId: string) => `${studentId}:${guardianId}`;

  /**
   * Crée (ou garantit) le compte parent ET envoie les identifiants par les
   * canaux demandés (défaut email + helm_connect). Idempotent : peut aussi
   * servir à RENVOYER les identifiants d'un compte existant.
   */
  const handleProvisionAccount = async (
    student: StudentWithGuardians,
    sg: StudentGuardian,
    channels?: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[],
  ) => {
    const key = guardianKey(student.id, sg.guardian.id);
    setProvisioningKey(key);
    try {
      const result = await studentsService.provisionParentAccount(
        student.id,
        sg.guardian.id,
        { sendCredentials: true, ...(channels?.length ? { channels } : {}) },
      );
      setAccountResults(prev => ({
        ...prev,
        [key]: {
          guardianId: sg.guardian.id,
          studentId: student.id,
          account: result?.account ?? null,
          credentials: result?.credentials,
          notification: result?.notification ?? {},
        },
      }));

      // Toast selon le résultat (comme handleResendReceipt du modal d'encaissement)
      const wasCreated = result?.account?.created === true;
      const notif: Record<string, any> = (result?.notification as Record<string, any>) ?? {};
      const channelLabel = (ch: string) =>
        ch === 'helm_connect' ? 'Helm Connect' : ch === 'sms' ? 'SMS' : ch === 'email' ? 'email' : ch;
      const sentChannels = Object.entries(notif)
        .filter(([ch, r]) => ch !== 'error' && r?.status === 'sent')
        .map(([ch]) => channelLabel(ch));
      const failedChannels = Object.entries(notif)
        .filter(([ch, r]) => ch !== 'error' && r?.status === 'failed')
        .map(([ch]) => channelLabel(ch));
      if (sentChannels.length > 0) {
        toast({
          title: wasCreated ? '✅ Compte parent créé' : 'Identifiants renvoyés',
          description: `Informations de connexion envoyées par ${sentChannels.join(' et ')}${failedChannels.length ? ` (échec : ${failedChannels.join(', ')})` : ''}.`,
          variant: 'success',
        });
      } else if (failedChannels.length > 0) {
        toast({
          title: wasCreated ? 'Compte créé — envoi en échec' : 'Échec d\u2019envoi',
          description: `Le compte a bien été ${wasCreated ? 'créé' : 'traité'}, mais l\u2019envoi a échoué (${failedChannels.join(', ')}). Vérifiez les contacts du parent puis réessayez.`,
          variant: 'error',
        });
      } else {
        // Canaux « skipped » (contacts manquants) — informer honnêtement
        const skipped = Object.entries(notif)
          .filter(([ch, r]) => ch !== 'error' && r?.status === 'skipped')
          .map(([ch, r]) => r?.error || ch);
        toast({
          title: wasCreated ? '✅ Compte parent créé' : 'Aucun envoi',
          description: skipped.length
            ? `Compte ${wasCreated ? 'créé' : 'existant'}, mais contact manquant : ${skipped.join(' ; ')}. Complétez le téléphone/email du parent.`
            : 'Aucun canal d\u2019envoi disponible pour ce parent.',
          variant: 'info',
        });
      }
      loadData(); // rafraîchir userId des guardians
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Échec de la création du compte parent', variant: 'error' });
    } finally {
      setProvisioningKey(null);
    }
  };

  /**
   * Renvoi des identifiants sur UN canal précis (boutons du bandeau de
   * succès — même UX que le modal d'encaissement : SMS actif (Termii),
   * Email actif, Helm Connect actif).
   */
  const handleResendChannel = async (
    student: StudentWithGuardians,
    sg: StudentGuardian,
    channel: 'sms' | 'email' | 'helm_connect',
  ) => {
    const key = guardianKey(student.id, sg.guardian.id);
    setProvisioningKey(key);
    try {
      const result = await studentsService.provisionParentAccount(
        student.id,
        sg.guardian.id,
        { createAccount: false, sendCredentials: true, channels: [channel] },
      );
      // Mettre à jour le bandeau de résultat avec le statut du canal renvoyé
      setAccountResults(prev => {
        const existing = prev[key];
        if (!existing) {
          return {
            ...prev,
            [key]: {
              guardianId: sg.guardian.id,
              studentId: student.id,
              account: result?.account ?? null,
              credentials: result?.credentials,
              notification: result?.notification ?? {},
            },
          };
        }
        return {
          ...prev,
          [key]: { ...existing, notification: { ...existing.notification, ...(result?.notification ?? {}) } },
        };
      });
      const status = result?.notification?.[channel];
      if (status?.status === 'skipped') {
        toast({ title: 'Contact manquant', description: status.reason || status.error || `Aucun contact pour ${channel}.`, variant: 'error' });
      } else if (status?.status === 'failed') {
        toast({ title: 'Échec d\u2019envoi', description: status.error || `Échec de l\u2019envoi par ${channel}.`, variant: 'error' });
      } else {
        toast({
          title: 'Identifiants envoyés',
          description: `Envoyés par ${channel === 'helm_connect' ? 'Helm Connect' : channel === 'sms' ? 'SMS' : 'email'}${status?.to ? ` à ${status.to}` : ''}.`,
          variant: 'success',
        });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || `Échec envoi par ${channel}.`, variant: 'error' });
    } finally {
      setProvisioningKey(null);
    }
  };

  /**
   * ⭐ 15/11/2026 (retour promoteur — « WhatsApp est fonctionnel, on garde
   * WhatsApp ») : envoi WhatsApp par LIEN wa.me pré-rempli (même pattern que
   * le module Finance — TransactionsContent « Envoi rapide (lien) ») :
   * ouvre WhatsApp Web/app avec le numéro du parent (format international
   * Bénin 229…) et le message d'identifiants pré-rempli — l'utilisateur
   * n'a plus qu'à cliquer « Envoyer » dans WhatsApp.
   */
  const handleWhatsAppSend = (student: StudentWithGuardians, sg: StudentGuardian) => {
    const key = guardianKey(student.id, sg.guardian.id);
    const result = accountResults[key];
    const rawPhone = (sg.guardian.phone || '').replace(/[^\d]/g, '');
    if (!rawPhone) {
      toast({
        title: 'Numéro manquant',
        description: 'Ce parent n\u2019a pas de téléphone — complétez sa fiche (sous-onglet Responsables).',
        variant: 'error',
      });
      return;
    }
    // Format international Bénin : 229 + numéro (le « + » est retiré pour wa.me)
    const intlPhone = rawPhone.startsWith('229')
      ? rawPhone
      : rawPhone.length === 10 && rawPhone.startsWith('01')
        ? `229${rawPhone}`
        : rawPhone;
    const credentials = result?.credentials;
    const message = credentials
      ? [
          `Bonjour ${sg.guardian.firstName || ''} ${sg.guardian.lastName || ''}`.trim() + ',',
          ``,
          `Votre compte parent est actif. Voici vos identifiants :`,
          ``,
          `Portail : ${credentials.portalUrl}`,
          `Identifiant : ${credentials.identifier}`,
          `Mot de passe : ${credentials.password || 'votre mot de passe habituel'}`,
          ``,
          `Onglet « Parent », puis connexion avec votre identifiant et votre mot de passe.`,
          ``,
          `Cordialement, l'administration.`,
        ].join('\n')
      : `Bonjour, votre compte parent est actif sur notre portail. Contactez l'administration pour recevoir vos identifiants.`;

    window.open(
      `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer',
    );
    // Marquer le canal WhatsApp comme traité (envoi manuel — l'utilisateur
    // clique « Envoyer » dans WhatsApp) + toast explicite.
    setAccountResults(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {
          guardianId: sg.guardian.id,
          studentId: student.id,
          account: null,
          credentials: undefined,
          notification: {},
        }),
        notification: {
          ...(prev[key]?.notification ?? {}),
          whatsapp: { status: 'sent', to: intlPhone },
        },
      },
    }));
    toast({
      title: 'WhatsApp ouvert',
      description: 'Le message est pré-rempli — cliquez sur « Envoyer » dans WhatsApp.',
      variant: 'success',
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* ⭐ nov. 2026 — Sous-onglets de l'onglet Famille : « Responsables »
          (CRUD existant) | « Création de compte » (comptes parents pour les
          responsables sans compte — rattrapage du skip du wizard d'inscription). */}
      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-1">
        <button
          onClick={() => setActiveSubTab('guardians')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition',
            activeSubTab === 'guardians'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <Users className="w-4 h-4" /> Responsables
        </button>
        <button
          onClick={() => setActiveSubTab('accounts')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition',
            activeSubTab === 'accounts'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <KeyRound className="w-4 h-4" /> Création de compte
          {guardiansWithoutAccountKpi > 0 && (
            <span className={cn(
              'ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
              activeSubTab === 'accounts' ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700',
            )}>
              {guardiansWithoutAccountKpi} sans compte
            </span>
          )}
        </button>
      </div>

      {/* Stats — adaptées au sous-onglet actif */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50"><Users className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-[10px] font-medium text-slate-500 uppercase">Familles</p><p className="text-base font-bold text-slate-900">{totalFamilies}</p></div>
        </div>
        {activeSubTab === 'guardians' ? (
          <>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50"><Shield className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Responsables</p><p className="text-base font-bold text-slate-900">{totalGuardians}</p></div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50"><Star className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Principaux</p><p className="text-base font-bold text-slate-900">{studentsWithPrimary}</p></div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-50"><Heart className="w-4 h-4 text-rose-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Sans parent</p><p className="text-base font-bold text-slate-900">{studentsWithoutGuardian}</p></div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-50"><UserCheck className="w-4 h-4 text-emerald-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Comptes actifs</p><p className="text-base font-bold text-slate-900">{Math.max(0, totalGuardians - guardiansWithoutAccountKpi)}</p></div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-50"><KeyRound className="w-4 h-4 text-rose-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Sans compte</p><p className="text-base font-bold text-slate-900">{guardiansWithoutAccountKpi}</p></div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-50"><Heart className="w-4 h-4 text-amber-600" /></div>
              <div><p className="text-[10px] font-medium text-slate-500 uppercase">Sans parent</p><p className="text-base font-bold text-slate-900">{studentsWithoutGuardian}</p></div>
            </div>
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Rechercher par élève ou parent..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Cards — sous-onglet « Responsables » (CRUD existant) */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
      ) : (activeSubTab === 'accounts' ? filteredAccountsStudents.length === 0 : filteredStudents.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">
            {activeSubTab === 'accounts'
              ? 'Aucun responsable sans compte — tous les parents de la vue ont déjà un compte'
              : 'Aucune famille trouvée'}
          </p>
          {activeSubTab === 'accounts' && (
            <p className="text-xs mt-1 max-w-md text-center">
              Les élèves sans responsable sont retournables dans le sous-onglet « Responsables »
              (statistique « Sans parent ») — associez-leur un responsable et ils apparaîtront ici.
            </p>
          )}
        </div>
      ) : activeSubTab === 'guardians' ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => (
            <div key={student.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="w-4 h-4 text-blue-600" /></div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Famille {student.lastName}</span>
                </div>
                <button onClick={() => openAddGuardian(student)} className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition" title="Ajouter un responsable">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex-1 space-y-2">
                {/* Enfant */}
                <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-50 bg-blue-50/30">
                  <div className="w-8 h-8 rounded-full bg-white border border-blue-100 overflow-hidden flex items-center justify-center text-blue-600 shrink-0">
                    {student.photoUrl ? (
                      <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-900 truncate">{student.firstName} {student.lastName}</p>
                    <p className="text-[9px] text-blue-400">{student.matricule || 'Sans matricule'}</p>
                  </div>
                </div>
                {/* Guardians */}
                {student.studentGuardians.map(sg => (
                  <div key={sg.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/50 border border-slate-100 group">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                      {sg.guardian.firstName?.[0]}{sg.guardian.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                        {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sg.guardian.phone && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{sg.guardian.phone}</span>}
                        {sg.guardian.email && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{sg.guardian.email}</span>}
                      </div>
                      <p className="text-[8px] text-slate-300 uppercase mt-0.5">{sg.relationship}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => openEditGuardian(student, sg)} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Modifier"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteGuardian(student.id, sg.id)} className="p-1 hover:bg-rose-100 rounded text-rose-600" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {student.studentGuardians.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-2">Aucun responsable — cliquez sur +</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ⭐ Pagination Famille — utilise le vrai total serveur (data.total) et
            déclenche loadData() au changement de page via le useEffect qui watch currentPage. */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-blue-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" /> Précédent
            </button>
            <span className="text-sm font-mono text-slate-500">
              Page {currentPage} / {totalPages}
              <span className="text-slate-400 ml-2">({totalFamilies} familles)</span>
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-blue-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        </>
      ) : (
        /* ═══════════════════════════════════════════════════════════════
           ⭐ nov. 2026 — Sous-onglet « Création de compte »
           ⭐ 15/11/2026 (retour promoteur) : UNIQUEMENT les élèves dont les
           responsables existent mais n'ont pas encore de compte (les élèves
           sans responsable sont exclus — statistique « Sans parent » seule,
           retournables dans le sous-onglet « Responsables »). Deux boutons de
           GÉNÉRATION MULTIPLE (création + envoi) au lieu d'un par un.
           ═══════════════════════════════════════════════════════════════ */
        <>
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
          <p className="font-semibold text-[11px] text-blue-900 mb-0.5">Création de comptes parents — portail parent</p>
          <p className="text-[11px] text-blue-800 leading-relaxed">
            Les <strong>informations de connexion</strong> (adresse du portail + numéro de
            téléphone ou email, avec un mot de passe simple) seront envoyées au parent par{' '}
            <strong>SMS</strong> (premier canal : le parent n'a pas forcément d'email),{' '}
            <strong>email</strong> et <strong>Helm Connect</strong>.
          </p>
        </div>

        {/* ⭐ 15/11/2026 (retour promoteur) — DEUX BOUTONS de génération
            multiple : « une vingtaine de parents sans compte, il faut pouvoir
            tout faire d'un coup au lieu de le faire un à un ». */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleBulkProvision('create')}
            disabled={bulkAction !== null || bulkCreateCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={bulkCreateCount === 0
              ? 'Aucun responsable sans compte dans la vue'
              : 'Créer TOUS les comptes manquants de la vue et envoyer les identifiants (SMS, email, Helm Connect)'}
          >
            {bulkAction === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />}
            {bulkAction === 'create' ? 'Création multiple en cours…' : `Création multiple — ${bulkCreateCount} compte(s)`}
          </button>
          <button
            onClick={() => handleBulkProvision('resend')}
            disabled={bulkAction !== null || bulkResendCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={bulkResendCount === 0
              ? 'Aucun responsable avec compte dans la vue'
              : 'Renvoyer les identifiants (mot de passe régénéré) à tous les parents déjà dotés d\'un compte dans la vue'}
          >
            {bulkAction === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {bulkAction === 'resend' ? 'Envoi multiple en cours…' : `Envoi multiple des identifiants — ${bulkResendCount} compte(s)`}
          </button>
          <span className="text-[10px] text-slate-400">
            {accountsTargetStudents.length} élève(s) concerné(s){searchTerm.trim() ? ' (vue filtrée)' : ''}
          </span>
        </div>

        {/* Bandeau de résultat de la génération multiple — détail par parent */}
        {bulkResult && (
          <div className={`p-3 rounded-xl border space-y-2 ${
            bulkResult.summary.failed > 0
              ? 'border-amber-200 bg-amber-50/70'
              : 'border-emerald-200 bg-emerald-50/70'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <p className={`text-xs font-bold ${bulkResult.summary.failed > 0 ? 'text-amber-900' : 'text-emerald-900'}`}>
                {bulkResult.action === 'create' ? 'Création multiple terminée' : 'Envoi multiple terminé'} —{' '}
                {bulkResult.summary.created > 0 && `${bulkResult.summary.created} créé(s), `}
                {bulkResult.summary.sent} envoi(s) réussi(s)
                {bulkResult.summary.failed > 0 && `, ${bulkResult.summary.failed} échec(s)`}
                {bulkResult.summary.skipped > 0 && `, ${bulkResult.summary.skipped} ignoré(s)`}
              </p>
              <button
                onClick={() => setBulkResult(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 shrink-0"
                title="Fermer le rapport"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {bulkResult.results.map((r: any, i: number) => (
                <div key={`${r.guardianId}-${i}`} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded bg-white/70">
                  <span className="font-semibold text-slate-700 truncate">
                    {r.guardianName || r.guardianId}
                    {r.studentName ? <span className="font-normal text-slate-400"> — {r.studentName}</span> : null}
                  </span>
                  <span className={`shrink-0 font-medium ${
                    r.status === 'sent' ? 'text-emerald-700'
                      : r.status === 'failed' ? 'text-rose-700'
                        : 'text-slate-400'
                  }`}>
                    {r.status === 'sent' && '✓ '}
                    {r.status === 'failed' && '✗ '}
                    {r.status === 'skipped' && '— '}
                    {r.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAccountsStudents.map(student => (
            <div key={student.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-blue-100 rounded-lg shrink-0"><User className="w-4 h-4 text-blue-600" /></div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{student.firstName} {student.lastName}</p>
                    <p className="text-[9px] text-slate-400">{student.matricule || 'Sans matricule'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                  {student.studentGuardians.filter(sg => !sg.guardian.userId).length}/{student.studentGuardians.length} à créer
                </span>
              </div>
              <div className="p-3 flex-1 space-y-2">
                {student.studentGuardians.map(sg => {
                  const key = guardianKey(student.id, sg.guardian.id);
                  const result = accountResults[key];
                  const hasAccount = !!sg.guardian.userId || !!result?.account?.userId;
                  const isWorking = provisioningKey === key;
                  const identifier = sg.guardian.phone || sg.guardian.email;
                  return (
                    <div key={sg.id} className={`rounded-lg border p-3 space-y-2 ${hasAccount ? 'border-emerald-100 bg-emerald-50/40' : 'border-rose-100 bg-rose-50/30'}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                            {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}
                          </div>
                          <p className="text-[8px] text-slate-400 uppercase mt-0.5">{sg.relationship}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {sg.guardian.phone && <span className="text-[9px] text-slate-500 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{sg.guardian.phone}</span>}
                            {sg.guardian.email && <span className="text-[9px] text-slate-500 flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{sg.guardian.email}</span>}
                          </div>
                        </div>
                        {hasAccount ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full shrink-0">
                            <UserCheck className="w-3 h-3" /> COMPTE ACTIF
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-full shrink-0">
                            <KeyRound className="w-3 h-3" /> SANS COMPTE
                          </span>
                        )}
                      </div>

                      {/* Action : créer OU renvoyer les identifiants */}
                      <div className="flex flex-wrap items-center gap-2">
                        {hasAccount ? (
                          <button
                            onClick={() => handleProvisionAccount(student, sg)}
                            disabled={isWorking || !identifier}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={identifier ? 'Renvoyer les informations de connexion par SMS, email et Helm Connect' : 'Ce parent n\u2019a ni téléphone ni email'}
                          >
                            {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            Renvoyer les identifiants
                          </button>
                        ) : (
                          <button
                            onClick={() => handleProvisionAccount(student, sg)}
                            disabled={isWorking || !identifier}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                            title={identifier ? 'Créer le compte parent et envoyer les informations de connexion (SMS, email, Helm Connect)' : 'Ce parent n\u2019a ni téléphone ni email — complétez sa fiche'}
                          >
                            {isWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                            Créer le compte + envoyer les identifiants
                          </button>
                        )}
                      </div>
                      {!identifier && (
                        <p className="text-[10px] text-amber-700 flex items-center gap-1">
                          ⚠️ Ni téléphone ni email — complétez la fiche du responsable (sous-onglet Responsables) avant de créer le compte.
                        </p>
                      )}

                      {/* Bandeau résultat — même UX que le bandeau « reçu » du
                          modal d'encaissement (NewPaymentModal) */}
                      {result && (
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 space-y-2">
                          <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5" />
                            {result.account?.created ? 'Compte parent créé — informations de connexion' : 'Informations de connexion'}
                          </p>
                          <div className="text-[11px] text-emerald-900 space-y-1">
                            <p className="flex items-center gap-1 flex-wrap">
                              <span className="text-emerald-700 font-medium">Portail :</span>
                              <a
                                href={result.credentials?.portalUrl}
                                target="_blank" rel="noopener noreferrer"
                                className="font-medium text-blue-700 hover:underline break-all inline-flex items-center gap-1"
                              >
                                {result.credentials?.portalUrl} <ExternalLink className="w-3 h-3" />
                              </a>
                            </p>
                            <p>
                              <span className="text-emerald-700 font-medium">Identifiant :</span>{' '}
                              <span className="font-mono font-bold">{result.credentials?.identifier}</span>
                              <span className="text-emerald-700"> ({result.credentials?.identifierType === 'PHONE' ? 'téléphone' : 'email'})</span>
                            </p>
                            <p>
                              <span className="text-emerald-700 font-medium">Mot de passe :</span>{' '}
                              {result.credentials?.password ? (
                                <span className="font-mono font-bold">{result.credentials.password}</span>
                              ) : (
                                <span className="text-emerald-700">votre mot de passe habituel</span>
                              )}
                            </p>
                          </div>
                          {/* Statuts par canal + renvoi unitaire (pattern modal d'encaissement)
                              ⭐ 15/11/2026 — QUATRE canaux (retour promoteur) :
                              SMS (Termii, premier canal — le parent sans email ne peut rien
                              recevoir par email et le message Helm Connect suppose déjà un
                              compte connecté), WhatsApp (lien wa.me pré-rempli — envoi
                              manuel fiable), Email, Helm Connect. */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200">
                            {(['sms', 'whatsapp', 'email', 'helm_connect'] as const).map(channel => {
                              const st = result.notification?.[channel];
                              const label = channel === 'sms'
                                ? 'SMS'
                                : channel === 'whatsapp'
                                  ? 'WhatsApp'
                                  : channel === 'email'
                                    ? 'Email'
                                    : 'Helm Connect';
                              const isManualWhatsApp = channel === 'whatsapp';
                              return (
                                <button
                                  key={channel}
                                  onClick={() =>
                                    isManualWhatsApp
                                      ? handleWhatsAppSend(student, sg)
                                      : handleResendChannel(student, sg, channel as 'sms' | 'email' | 'helm_connect')
                                  }
                                  disabled={!isManualWhatsApp && provisioningKey === key}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition disabled:opacity-40 ${
                                    st?.status === 'sent'
                                      ? 'border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title={
                                    isManualWhatsApp
                                      ? 'WhatsApp — ouvre WhatsApp avec le message d\u2019identifiants pré-rempli (cliquez Envoyer dans WhatsApp)'
                                      : st?.status === 'skipped'
                                      ? (st.error || 'Canal non disponible')
                                      : st?.status === 'failed'
                                        ? (st.error || 'Échec d\u2019envoi')
                                        : channel === 'sms'
                                          ? 'SMS via Termii — envoyer par ce canal'
                                          : 'Envoyer par ce canal'
                                  }
                                >
                                  {channel === 'sms'
                                    ? <SmsIcon className="w-3.5 h-3.5" />
                                    : channel === 'whatsapp'
                                      ? <WhatsAppIcon className="w-3.5 h-3.5" />
                                      : channel === 'email'
                                        ? <GmailIcon className="w-3.5 h-3.5" />
                                        : <HelmConnectIcon className="w-3.5 h-3.5" />}
                                  {label}
                                  {st?.status === 'sent' && <span className="text-emerald-600">✓</span>}
                                  {st?.status === 'failed' && <span className="text-rose-600">✗</span>}
                                  {st?.status === 'skipped' && <span className="text-amber-600">—</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* ⭐ 15/11/2026 : les élèves SANS responsable n'apparaissent
                    plus ici (filtre accountsTargetStudents) — ils sont
                    retournables dans le sous-onglet « Responsables »
                    (statistique « Sans parent »). */}
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Modal Add/Edit Guardian */}
      <AnimatePresence>
        {guardianForm && editingStudent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setGuardianForm(null); setEditingStudent(null); }}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  {editingGuardianId ? 'Modifier le responsable' : 'Ajouter un responsable'}
                </h3>
                <button onClick={() => { setGuardianForm(null); setEditingStudent(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-slate-500">Pour : <strong>{editingStudent.firstName} {editingStudent.lastName}</strong></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                    <input type="text" value={guardianForm.firstName} onChange={e => setGuardianForm({ ...guardianForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                    <input type="text" value={guardianForm.lastName} onChange={e => setGuardianForm({ ...guardianForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone</label>
                    <input type="tel" value={guardianForm.phone} onChange={e => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input type="email" value={guardianForm.email} onChange={e => setGuardianForm({ ...guardianForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lien</label>
                    <select value={guardianForm.relationship} onChange={e => setGuardianForm({ ...guardianForm, relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={guardianForm.isPrimary} onChange={e => setGuardianForm({ ...guardianForm, isPrimary: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-slate-700">Responsable principal</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => { setGuardianForm(null); setEditingStudent(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Annuler</button>
                <button onClick={saveGuardian} disabled={isSaving}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                  {isSaving ? 'Enregistrement...' : <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Enregistrer</span>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
