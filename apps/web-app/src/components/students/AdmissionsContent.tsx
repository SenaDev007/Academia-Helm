'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, CheckCircle, XCircle, Clock, FileText,
  UserCheck, Calendar, BadgeCheck, AlertCircle, Loader2, Eye,
  Send, Pencil, X, Info, Star, AlertTriangle, Trash2, RotateCcw,
  ExternalLink, ArrowUpDown, ArrowUpAZ, ArrowDownAZ, ArrowDownUp,
  Settings, Save,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal, ReadOnlyModal } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import AdmissionForm from './AdmissionForm';
import DocumentPreviewModal from './DocumentPreviewModal';
import { toast } from '@/components/ui/toast';
import { studentsService } from '@/services/students.service';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';
import { cn } from '@/lib/utils';

interface Admission {
  id: string;
  admissionNumber: string | null;
  status: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  birthPlace: string | null;
  nationality: string | null;
  address: string | null;
  createdAt: string;
  applicationDate: string;
  decisionDate: string | null;
  notes: string | null;
  requestedClassId: string | null;
  requestedSeriesId: string | null;
  wantsBilingual: boolean;
  previousSchool: string | null;
  previousArrears?: number;
  isNewStudent?: boolean;
  mainGuardianName: string | null;
  mainGuardianPhone: string | null;
  mainGuardianEmail: string | null;
  convertedStudentId: string | null;
  schoolLevel?: { id: string; name: string; code?: string };
  academicYear?: { id: string; name: string };
  // ⭐ Étudiant converti (avec photo) + classe officielle souhaitée
  convertedStudent?: {
    id: string;
    photoUrl: string | null;
    matricule: string | null;
    studentCode: string | null;
  } | null;
  requestedAcademicClass?: { id: string; name: string; code?: string } | null;
  requestedAcademicClassId?: string | null;
}

export default function AdmissionsContent() {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const syncStatuses = useEntitySyncStatusBatch('STUDENT', tenantId ?? undefined);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'date-recent' | 'date-old'>('name-asc');
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');

  // Nettoyer la sélection quand on change de filtre
  useEffect(() => { setSelectedIds(new Set()); }, [activeFilter]);

  // ⚠️ Niveaux scolaires — chargés depuis /api/school-levels pour faire le
  // mapping schoolLevelId → label côté client. La relation schoolLevel a été
  // supprimée du modèle Admission (mismatch FK school_levels vs education_levels).
  // Sans ça, le tableau affiche "Non défini" pour la colonne Niveau.
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);

  // ⚠️ Classes — chargées depuis /api/classes pour faire le mapping
  // requestedClassId → label côté client. Permet d'afficher la classe souhaitée
  // par le parent dans la liste + le détail + l'édition.
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);

  // Multi-sélection pour actions en lot
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchActionPending, setBatchActionPending] = useState(false);

  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const levels = Array.isArray(data) ? data : [];
        console.log('[AdmissionsContent] School levels loaded:', levels.map(l => ({ id: l.id?.substring(0, 8), name: l.name, code: l.code })));
        setSchoolLevels(levels);
      })
      .catch(() => setSchoolLevels([]));

    // ⭐ Charger les classes physiques et déduire les classes officielles créées.
    // On utilise /api/all-classes (classes physiques) comme la "Liste des élèves",
    // puis on déduplique par officialClass.id pour n'avoir que les classes
    // officielles réellement paramétrées (pas toutes les séries de la structure).
    fetch('/api/all-classes', { credentials: 'include' })
      .then(res => {
        if (!res.ok) return [];
        return res.json();
      })
      .then(data => {
        const physicalClasses = Array.isArray(data) ? data : (data?.data || []);
        // Dédupliquer par officialClass.id pour n'avoir que les classes officielles créées
        const officialMap = new Map<string, any>();
        for (const cls of physicalClasses) {
          if (cls.officialClass && !officialMap.has(cls.officialClass.id)) {
            officialMap.set(cls.officialClass.id, {
              id: cls.officialClass.id,
              name: cls.officialClass.name,
              levelId: cls.schoolLevelId,
              level: cls.schoolLevel,
            });
          }
        }
        const classes = Array.from(officialMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setSchoolClasses(classes);
      })
      .catch((e) => {
        console.warn('[AdmissionsContent] Failed to load classes:', e?.message);
        setSchoolClasses([]);
      });
  }, []);

  // Helper : retourne le label d'un niveau à partir de son ID
  const getLevelLabel = (levelId: string | null | undefined): string => {
    if (!levelId) return 'Non défini';
    const level = schoolLevels.find(l => l.id === levelId);
    return level?.label || level?.code || 'Non défini';
  };

  // Helper : retourne le label d'une classe OFFICIELLE à partir de son UUID.
  // ⭐ Utilise requestedAcademicClassId en priorité (nouveau champ), avec
  // fallback sur requestedClassId pour les admissions legacy (avant migration 013).
  const getClassLabel = (admission: any): string => {
    const classId = admission?.requestedAcademicClassId || admission?.requestedClassId;
    if (!classId) return '—';
    const cls = schoolClasses.find(c => c.id === classId);
    return cls?.name || cls?.code || `Classe ${classId.substring(0, 8)}…`;
  };

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // ⭐ État pour le modal de paramétrage des admissions publiques
  const [isAdmissionSettingsOpen, setIsAdmissionSettingsOpen] = useState(false);
  const [admissionSettings, setAdmissionSettings] = useState({
    admissionEnabled: true,
    admissionOpenDate: '',
    admissionCloseDate: '',
  });
  const [isLoadingAdmissionSettings, setIsLoadingAdmissionSettings] = useState(false);
  const [isSavingAdmissionSettings, setIsSavingAdmissionSettings] = useState(false);

  // ⭐ Sous-onglet actif dans Admissions : 'list' (liste des admissions) ou 'settings' (paramétrage)
  const [admissionSubTab, setAdmissionSubTab] = useState<'list' | 'settings'>('list');

  // Modal de confirmation personnalisé (remplace window.confirm)
  // Type controls l'icône et la couleur du bouton pour s'adapter au contexte
  // de l'action (info=bleu pour soumettre, success=vert pour accepter/inscrire,
  // warning=jaune pour reprendre, danger=rouge pour supprimer/rejeter).
  type ConfirmType = 'info' | 'success' | 'warning' | 'danger';
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmType: ConfirmType;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'Confirmer', confirmType: 'warning', onConfirm: () => {} });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = 'Confirmer',
    confirmType: ConfirmType = 'warning',
  ) => {
    setConfirmModal({ isOpen: true, title, message, confirmLabel, confirmType, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };
  const [admissionDocuments, setAdmissionDocuments] = useState<any[]>([]);
  const [admissionInterviews, setAdmissionInterviews] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [showAddInterviewForm, setShowAddInterviewForm] = useState(false);
  // ─── Visualisation de document (modal intégré) ──
  // Le filePath est un data URL (base64) déjà chargé avec les documents.
  // Pas besoin de fetch le backend — utiliser directement comme src d'iframe.
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  const [newDocType, setNewDocType] = useState('BIRTH_CERTIFICATE');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newInterviewType, setNewInterviewType] = useState('INTERVIEW');
  const [newInterviewDate, setNewInterviewDate] = useState('');

  // ─── Quick view "Voir les pièces" (depuis la liste, sans ouvrir le détail) ──
  const [quickViewAdmission, setQuickViewAdmission] = useState<Admission | null>(null);
  const [quickViewDocs, setQuickViewDocs] = useState<any[]>([]);
  const [isLoadingQuickViewDocs, setIsLoadingQuickViewDocs] = useState(false);

  useEffect(() => {
    if (academicYear) {
      loadAdmissions();
    }
  }, [academicYear, schoolLevel]);

  // ⭐ Charger les paramètres d'admission quand on ouvre le modal
  useEffect(() => {
    if (isAdmissionSettingsOpen && academicYear?.id) {
      loadAdmissionSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmissionSettingsOpen, academicYear?.id]);

  const loadAdmissionSettings = async () => {
    if (!academicYear?.id) return;
    setIsLoadingAdmissionSettings(true);
    try {
      const res = await fetch('/api/academic-years', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const years = Array.isArray(data) ? data : (data?.data || []);
        const year = years.find((y: any) => y.id === academicYear.id);
        if (year) {
          setAdmissionSettings({
            admissionEnabled: year.admissionEnabled !== false,
            admissionOpenDate: year.admissionOpenDate ? year.admissionOpenDate.substring(0, 10) : '',
            admissionCloseDate: year.admissionCloseDate ? year.admissionCloseDate.substring(0, 10) : '',
          });
        }
      }
    } catch (e) {
      console.error('Failed to load admission settings:', e);
    } finally {
      setIsLoadingAdmissionSettings(false);
    }
  };

  const handleSaveAdmissionSettings = async () => {
    if (!academicYear?.id) return;
    setIsSavingAdmissionSettings(true);
    try {
      const res = await fetch(`/api/settings/academic-years/${academicYear.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          admissionEnabled: admissionSettings.admissionEnabled,
          admissionOpenDate: admissionSettings.admissionOpenDate || null,
          admissionCloseDate: admissionSettings.admissionCloseDate || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Erreur sauvegarde');
      }
      toast({ title: '✅ Paramètres enregistrés', description: 'Les admissions publiques ont été configurées.', variant: 'success' });
      setIsAdmissionSettingsOpen(false);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsSavingAdmissionSettings(false);
    }
  };

  const loadAdmissions = async () => {
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear?.id || '',
        ...(schoolLevel?.id && schoolLevel.id !== 'ALL' && { schoolLevelId: schoolLevel.id }),
      };
      const data = await studentsService.getAdmissions(params);
      setAdmissions(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load admissions:', e);
      setAdmissions([]);
      toast({ title: 'Erreur de chargement', description: e?.message || 'Impossible de charger les admissions. Vérifiez que les migrations DB sont appliquées.', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    setIsActionPending(true);
    try {
      await studentsService.createAdmission(data);
      toast({ title: 'Succès', description: 'Dossier d\'admission créé avec succès', variant: 'success' });
      setIsCreateModalOpen(false);
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors de la création', variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleEdit = async (data: any) => {
    if (!selectedAdmission) return;
    setIsActionPending(true);
    try {
      await studentsService.updateAdmission(selectedAdmission.id, data);
      toast({ title: 'Succès', description: 'Dossier modifié avec succès', variant: 'success' });
      setIsEditModalOpen(false);
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors de la modification', variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleConvert = async (id: string) => {
    setIsActionPending(true);
    try {
      await studentsService.convertAdmission(id);
      toast({
        title: '✅ Conversion réussie',
        description: 'Candidat converti en élève. Matricule généré, compte financier créé, responsable légal enregistré.',
        variant: 'success'
      });
      setIsConvertModalOpen(false);
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors de la conversion', variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSubmit = async (id: string) => {
    setIsActionPending(true);
    try {
      await studentsService.submitAdmission(id);
      toast({ title: 'Succès', description: 'Dossier soumis pour examen', variant: 'success' });
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors de la soumission', variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDecide = async (id: string, decision: 'ACCEPTED' | 'REJECTED') => {
    const label = decision === 'ACCEPTED' ? 'accepter' : 'refuser';
    showConfirm(
      `${decision === 'ACCEPTED' ? 'Accepter' : 'Refuser'} le dossier`,
      `Êtes-vous sûr de vouloir ${label} ce dossier d'admission ?`,
      async () => {
        setIsActionPending(true);
        try {
          await studentsService.decideAdmission(id, { decision, comment: 'Dossier revu' });
          toast({ title: 'Succès', description: `Dossier ${decision === 'ACCEPTED' ? 'accepté' : 'refusé'}`, variant: 'success' });
          loadAdmissions();
        } catch (e: any) {
          toast({ title: 'Erreur', description: e.message || 'Erreur lors de la décision', variant: 'error' });
        } finally {
          setIsActionPending(false);
        }
      },
      decision === 'ACCEPTED' ? 'Accepter' : 'Refuser',
      decision === 'ACCEPTED' ? 'success' : 'danger',
    );
  };

  // Remettre un dossier en arrière (ACCEPTED/REJECTED → UNDER_REVIEW ou SUBMITTED)
  const handleRollback = async (id: string, targetStatus: 'SUBMITTED' | 'UNDER_REVIEW') => {
    const label = targetStatus === 'SUBMITTED' ? 'en soumis' : 'en examen';
    showConfirm(
      'Reprendre le dossier',
      `Voulez-vous remettre ce dossier ${label} ? Cela annulera la décision précédente.`,
      async () => {
        setIsActionPending(true);
        try {
          await studentsService.updateAdmission(id, {
            status: targetStatus,
          });
          toast({ title: 'Succès', description: `Dossier remis ${label}`, variant: 'success' });
          loadAdmissions();
        } catch (e: any) {
          toast({ title: 'Erreur', description: e.message || 'Erreur', variant: 'error' });
        } finally {
          setIsActionPending(false);
        }
      },
      'Confirmer',
      'warning',
    );
  };

  const handleDelete = async (id: string) => {
    showConfirm(
      'Supprimer le dossier',
      'Êtes-vous sûr de vouloir supprimer ce dossier d\'admission ? Cette action est irréversible.',
      async () => {
        setIsActionPending(true);
        try {
          await studentsService.deleteAdmission(id);
          toast({ title: 'Succès', description: 'Dossier supprimé', variant: 'success' });
          loadAdmissions();
        } catch (e: any) {
          toast({ title: 'Erreur', description: e.message || 'Erreur lors de la suppression', variant: 'error' });
        } finally {
          setIsActionPending(false);
        }
      },
      'Supprimer',
      'danger',
    );
  };

  const handleWaitlist = async (id: string) => {
    setIsActionPending(true);
    try {
      await studentsService.waitlistAdmission(id, 'Mis en liste d\'attente');
      toast({ title: 'Succès', description: 'Dossier mis en liste d\'attente', variant: 'success' });
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCancel = async (id: string) => {
    setIsActionPending(true);
    try {
      await studentsService.cancelAdmission(id, 'Dossier annulé');
      toast({ title: 'Succès', description: 'Dossier annulé', variant: 'success' });
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  // ─── Batch / Multi-sélection ─────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelectedIds(prev => {
      // Si tous sont déjà sélectionnés → désélectionner tout
      if (ids.every(id => prev.has(id))) return new Set();
      // Sinon → sélectionner tous
      return new Set(ids);
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBatchSubmit = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Même pattern que handleSubmit (single) : appel direct du service,
    // pas de modal de confirmation. L'utilisateur a déjà fait la sélection
    // multiple — le bouton "Soumettre en lot" est l'action explicite.
    setBatchActionPending(true);
    try {
      const result = await studentsService.batchSubmitAdmissions(ids);
      toast({
        title: '✅ Soumission en lot terminée',
        description: `${result.succeeded} réussie(s), ${result.failed} échouée(s)`,
        variant: result.failed > 0 ? 'destructive' : 'success',
      });
      clearSelection();
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setBatchActionPending(false);
    }
  };

  const handleBatchAcceptAndEnroll = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Même pattern que le bouton single "Accepter et inscrire directement"
    // (qui utilise showConfirm avec type 'success') — mais en version batch
    // avec appel au service batchAcceptAndEnrollAdmissions.
    showConfirm(
      'Accepter et inscrire en lot',
      `Accepter et inscrire ${ids.length} candidature(s) ? Cette action va créer les dossiers élèves, générer les matricules, comptes financiers et responsables légaux.`,
      async () => {
        setBatchActionPending(true);
        try {
          const result = await studentsService.batchAcceptAndEnrollAdmissions(
            ids,
            'Acceptation en lot',
          );
          const succeeded = result.results?.filter((r: any) => r.success) ?? [];
          const matricules = succeeded.map((r: any) => r.matricule).filter(Boolean).join(', ');
          toast({
            title: result.failed > 0
              ? 'Acceptation en lot partielle'
              : '✅ Acceptation en lot terminée',
            description: matricules
              ? `${result.succeeded} inscrit(s) [${matricules}], ${result.failed} échouée(s)`
              : `${result.succeeded} inscrit(s), ${result.failed} échouée(s)`,
            variant: result.failed > 0 ? 'destructive' : 'success',
          });
          clearSelection();
          loadAdmissions();
        } catch (e: any) {
          toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
        } finally {
          setBatchActionPending(false);
        }
      },
      'Accepter et inscrire',
      'success',
    );
  };

  const handleBatchAccept = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBatchActionPending(true);
    try {
      const result = await studentsService.batchAcceptAdmissions(ids);
      toast({
        title: '✅ Acceptation en lot terminée',
        description: `${result.succeeded} réussie(s), ${result.failed} échouée(s)`,
        variant: result.failed > 0 ? 'destructive' : 'success',
      });
      clearSelection();
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setBatchActionPending(false);
    }
  };

  const handleBatchConvert = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Même pattern direct que handleSubmit (single) — pas de modal.
    setBatchActionPending(true);
    try {
      const result = await studentsService.batchConvertAdmissions(ids);
      const succeeded = result.results.filter((r: any) => r.success);
      const matricules = succeeded.map((r: any) => r.matricule).filter(Boolean).join(', ');
      toast({
        title: '✅ Conversion en lot terminée',
        description: `${result.succeeded} élève(s) créé(s)${matricules ? ` — Matricules: ${matricules}` : ''}${result.failed > 0 ? ` — ${result.failed} échouée(s)` : ''}`,
        variant: result.failed > 0 ? 'destructive' : 'success',
      });
      clearSelection();
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setBatchActionPending(false);
    }
  };

  // ─── Documents & Interviews (detail modal) ────────────────────────────────

  const loadDocuments = async (admissionId: string) => {
    setIsLoadingDocs(true);
    try {
      const docs = await studentsService.getAdmissionDocuments(admissionId);
      // L'API peut retourner un array direct ou { documents: [...] } ou { data: [...] }
      const docsArray = Array.isArray(docs) ? docs :
                        Array.isArray(docs?.documents) ? docs.documents :
                        Array.isArray(docs?.data) ? docs.data : [];
      setAdmissionDocuments(docsArray);

      const interviews = await studentsService.getAdmissionInterviews(admissionId);
      const interviewsArray = Array.isArray(interviews) ? interviews :
                              Array.isArray(interviews?.interviews) ? interviews.interviews : [];
      setAdmissionInterviews(interviewsArray);
    } catch (e: any) {
      console.error('loadDocuments error:', e);
      setAdmissionDocuments([]);
      setAdmissionInterviews([]);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleOpenDetail = (admission: Admission) => {
    setSelectedAdmission(admission);
    setIsDetailModalOpen(true);
    loadDocuments(admission.id);
  };

  /**
   * Quick view "Voir les pièces" — ouvre un petit modal listant les documents
   * de l'admission, avec bouton "Ouvrir" pour prévisualiser chacun.
   * Évite d'avoir à ouvrir le détail complet pour vérifier les pièces jointes.
   */
  const handleQuickViewDocs = async (admission: Admission) => {
    setQuickViewAdmission(admission);
    setQuickViewDocs([]);
    setIsLoadingQuickViewDocs(true);
    try {
      const docs = await studentsService.getAdmissionDocuments(admission.id);
      const docsArray = Array.isArray(docs) ? docs :
                        Array.isArray(docs?.documents) ? docs.documents :
                        Array.isArray(docs?.data) ? docs.data : [];
      setQuickViewDocs(docsArray);
    } catch (e: any) {
      console.error('handleQuickViewDocs error:', e);
      setQuickViewDocs([]);
    } finally {
      setIsLoadingQuickViewDocs(false);
    }
  };

  const handleAddDocument = async () => {
    if (!selectedAdmission) return;
    if (!newDocFile) {
      toast({ title: 'Fichier manquant', description: 'Veuillez sélectionner un fichier à uploader.', variant: 'error' });
      return;
    }

    // Limite 20 Mo (alignée sur IMAGE_OR_PDF_DATA_URL_PIPE côté backend)
    const MAX_BYTES = 20 * 1024 * 1024;
    if (newDocFile.size > MAX_BYTES) {
      toast({
        title: 'Fichier trop volumineux',
        description: 'La taille maximale est de 20 Mo.',
        variant: 'error',
      });
      return;
    }

    // Vérifier le type MIME autorisé (images + PDF + .doc/.docx)
    const allowedMime = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMime.includes(newDocFile.type)) {
      toast({
        title: 'Type de fichier non autorisé',
        description: 'Formats acceptés : images (JPEG, PNG, WebP, GIF), PDF, Word (.doc, .docx).',
        variant: 'error',
      });
      return;
    }

    setIsUploadingDoc(true);
    try {
      // 1. Lire le fichier en data URL (base64) — pattern RH
      const fileDataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
        reader.readAsDataURL(newDocFile);
      });

      // 2. POST JSON au proxy Next.js (qui forward au backend upload-document)
      const uploadRes = await fetch(`/api/students/admissions/${selectedAdmission.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          documentType: newDocType,
          fileName: newDocFile.name,
          fileDataUrl,
          mimeType: newDocFile.type,
          fileSize: newDocFile.size,
        }),
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Upload failed (${uploadRes.status})`);
      }

      toast({ title: '✅ Document uploadé', description: newDocFile.name, variant: 'success' });
      setShowAddDocForm(false);
      setNewDocFile(null);
      // Petit délai pour laisser le backend persister, puis recharger
      setTimeout(() => loadDocuments(selectedAdmission.id), 500);
    } catch (e: any) {
      toast({ title: 'Erreur upload', description: e.message, variant: 'error' });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleValidateDoc = async (docId: string) => {
    try {
      await studentsService.validateAdmissionDocument(docId);
      toast({ title: '✅ Document validé', variant: 'success' });
      if (selectedAdmission) loadDocuments(selectedAdmission.id);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  const handleRejectDoc = async (docId: string) => {
    try {
      await studentsService.rejectAdmissionDocument(docId, 'Document refusé');
      toast({ title: 'Document refusé', variant: 'success' });
      if (selectedAdmission) loadDocuments(selectedAdmission.id);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    showConfirm(
      'Supprimer le document',
      'Voulez-vous vraiment supprimer ce document ? Cette action est irréversible.',
      async () => {
        try {
          await studentsService.deleteAdmissionDocument(docId);
          toast({ title: 'Document supprimé', variant: 'success' });
          if (selectedAdmission) loadDocuments(selectedAdmission.id);
        } catch (e: any) {
          toast({ title: 'Erreur', description: e.message, variant: 'error' });
        }
      },
      'Supprimer',
      'danger',
    );
  };

  const handleAddInterview = async () => {
    if (!selectedAdmission) return;
    try {
      await studentsService.createAdmissionInterview(selectedAdmission.id, {
        type: newInterviewType,
        scheduledAt: newInterviewDate || undefined,
      });
      toast({ title: '✅ Entretien/test planifié', variant: 'success' });
      setShowAddInterviewForm(false);
      setNewInterviewDate('');
      loadDocuments(selectedAdmission.id);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  const handleCompleteInterview = async (interviewId: string) => {
    const result = window.prompt('Résultat (FAVORABLE / UNFAVORABLE / TO_REVIEW):', 'FAVORABLE');
    if (!result) return;
    try {
      await studentsService.completeAdmissionInterview(interviewId, {
        result,
        status: result === 'FAVORABLE' ? 'FAVORABLE' : result === 'UNFAVORABLE' ? 'UNFAVORABLE' : 'TO_REVIEW',
      });
      toast({ title: '✅ Entretien terminé', variant: 'success' });
      if (selectedAdmission) loadDocuments(selectedAdmission.id);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  const handleDeleteInterview = async (interviewId: string) => {
    showConfirm(
      'Supprimer l\'entretien',
      'Voulez-vous vraiment supprimer cet entretien/test ?',
      async () => {
        try {
          await studentsService.deleteAdmissionInterview(interviewId);
          toast({ title: 'Entretien supprimé', variant: 'success' });
          if (selectedAdmission) loadDocuments(selectedAdmission.id);
        } catch (e: any) {
          toast({ title: 'Erreur', description: e.message, variant: 'error' });
        }
      },
      'Supprimer',
      'danger',
    );
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setIsActionPending(true);
    try {
      await studentsService.updateAdmission(id, { status: newStatus });
      toast({ title: 'Succès', description: `Statut mis à jour : ${getStatusConfig(newStatus).label}`, variant: 'success' });
      loadAdmissions();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Erreur lors du changement de statut', variant: 'error' });
    } finally {
      setIsActionPending(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <FileText className="w-3.5 h-3.5" />, label: 'Brouillon' };
      case 'SUBMITTED':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Send className="w-3.5 h-3.5" />, label: 'Soumis' };
      case 'UNDER_REVIEW':
        return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Search className="w-3.5 h-3.5" />, label: 'En examen' };
      case 'ACCEPTED':
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Accepté' };
      case 'REJECTED':
        return { color: 'bg-rose-100 text-rose-700 border-rose-200', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Refusé' };
      case 'WAITLISTED':
        return { color: 'bg-violet-100 text-violet-700 border-violet-200', icon: <Star className="w-3.5 h-3.5" />, label: 'Liste attente' };
      case 'MISSING_DOCUMENTS':
        return { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Docs manquants' };
      case 'CONVERTED':
        return { color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: <BadgeCheck className="w-3.5 h-3.5" />, label: 'Inscrit' };
      default:
        return { color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <FileText className="w-3.5 h-3.5" />, label: status };
    }
  };

  const filteredAdmissions = admissions.filter(a => {
    const matchesSearch = `${a.firstName} ${a.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (a.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = activeFilter === 'ALL' || a.status === activeFilter;
    const matchesLevel = !filterLevelId ||
      a.schoolLevelId === filterLevelId ||
      a.schoolLevel?.id === filterLevelId ||
      // Vérifier aussi avec schoolLevelId (UUID school_levels) si le filterLevelId
      // est en réalité l'UUID education_levels (cas de /api/school-levels)
      schoolLevels.find(l => l.id === filterLevelId)?.schoolLevelId === a.schoolLevelId;
    // ⭐ Filtre par classe OFFICIELLE : utilise requestedAcademicClassId (nouveau)
    // avec fallback sur requestedClassId (legacy) pour les anciennes admissions.
    const matchesClass = !filterClassId ||
      a.requestedAcademicClassId === filterClassId ||
      a.requestedClassId === filterClassId;
    return matchesSearch && matchesFilter && matchesLevel && matchesClass;
  }).sort((a, b) => {
    // Tri selon le mode sélectionné
    switch (sortBy) {
      case 'name-asc':
        return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr');
      case 'name-desc':
        return `${b.lastName} ${b.firstName}`.localeCompare(`${a.lastName} ${a.firstName}`, 'fr');
      case 'date-recent': {
        const dA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const dB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return dB - dA;
      }
      case 'date-old': {
        const dA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const dB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return dA - dB;
      }
      default:
        return 0;
    }
  });

  // Filtres étendus avec compteurs
  const FILTER_TABS = [
    { id: 'ALL', label: 'Tous', count: admissions.length },
    { id: 'PENDING', label: 'Brouillons', count: admissions.filter(a => a.status === 'PENDING').length },
    { id: 'SUBMITTED', label: 'Soumis', count: admissions.filter(a => a.status === 'SUBMITTED').length },
    { id: 'UNDER_REVIEW', label: 'En examen', count: admissions.filter(a => a.status === 'UNDER_REVIEW').length },
    { id: 'ACCEPTED', label: 'Acceptés', count: admissions.filter(a => a.status === 'ACCEPTED').length },
    { id: 'CONVERTED', label: 'Inscrits', count: admissions.filter(a => a.status === 'CONVERTED').length },
    { id: 'REJECTED', label: 'Refusés', count: admissions.filter(a => a.status === 'REJECTED').length },
  ];

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Demandes', value: admissions.length, icon: <FileText className="text-blue-600" />, color: 'bg-blue-50' },
          { label: 'En Attente', value: admissions.filter(a => a.status === 'SUBMITTED' || a.status === 'PENDING').length, icon: <Clock className="text-amber-600" />, color: 'bg-amber-50' },
          { label: 'Acceptés', value: admissions.filter(a => a.status === 'ACCEPTED').length, icon: <CheckCircle className="text-emerald-600" />, color: 'bg-emerald-50' },
          { label: 'Taux de Conversion', value: admissions.length ? Math.round((admissions.filter(a => a.status === 'CONVERTED').length / admissions.length) * 100) + '%' : '0%', icon: <BadgeCheck className="text-indigo-600" />, color: 'bg-indigo-50' },
        ].map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou n° dossier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
            />
          </div>
        </div>

        {/* Filtres niveau scolaire + classe */}
        <div className="flex items-center gap-2">
          <select
            value={filterLevelId}
            onChange={(e) => { setFilterLevelId(e.target.value); setFilterClassId(''); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="">Tous les niveaux</option>
            {schoolLevels.map(l => (
              <option key={l.id} value={l.id}>{l.label || l.name || l.code}</option>
            ))}
          </select>
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            disabled={!filterLevelId}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
          >
            <option value="">Toutes les classes officielles</option>
            {(() => {
              // ⭐ Filtrage sur les classes OFFICIELLES (AcademicClass) par niveau.
              const selectedLevel = schoolLevels.find(l => l.id === filterLevelId);
              const levelCode = selectedLevel?.code?.toUpperCase() || '';
              const levelName = selectedLevel?.name?.toUpperCase() || '';
              return schoolClasses
                .filter(c => {
                  if (!filterLevelId) return true;
                  // Les AcademicClass ont c.level (relation) avec name/code
                  const classLevelName = (c.level?.name || '').toUpperCase();
                  const classLevelCode = (c.level?.code || '').toUpperCase();
                  return classLevelName === levelName ||
                         classLevelCode === levelCode ||
                         classLevelName.includes(levelCode) ||
                         levelCode.includes(classLevelName);
                })
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.code}</option>
                ));
            })()}
          </select>
        </div>

        {/* Sélecteur de tri */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1">
            {[
              { id: 'name-asc', icon: ArrowUpAZ, label: 'A → Z' },
              { id: 'name-desc', icon: ArrowDownAZ, label: 'Z → A' },
              { id: 'date-recent', icon: ArrowDownUp, label: 'Récent' },
              { id: 'date-old', icon: ArrowUpDown, label: 'Ancien' },
            ].map((opt) => {
              const Icon = opt.icon;
              const isActive = sortBy === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id as any)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title={opt.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nouveau Dossier
          </button>
        </div>
      </div>

      {/* ⭐ Sous-onglets Admissions : Liste | Paramétrage */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
        <button
          onClick={() => setAdmissionSubTab('list')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            admissionSubTab === 'list'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <FileText className="w-3.5 h-3.5" />
          Liste des admissions
        </button>
        <button
          onClick={() => setAdmissionSubTab('settings')}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
            admissionSubTab === 'settings'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          Paramétrage
        </button>
      </div>

      {/* ⭐ Panneau Paramétrage (quand sous-onglet 'settings' est actif) */}
      {admissionSubTab === 'settings' && (
        <AdmissionSettingsPanel
          academicYearId={academicYear?.id}
          settings={admissionSettings}
          setSettings={setAdmissionSettings}
          isLoading={isLoadingAdmissionSettings}
          isSaving={isSavingAdmissionSettings}
          onLoad={loadAdmissionSettings}
          onSave={handleSaveAdmissionSettings}
        />
      )}

      {/* ⭐ Contenu Liste (quand sous-onglet 'list' est actif) */}
      {admissionSubTab === 'list' && (
      <>
      {/* Filter tabs with counters */}
      <div className="flex flex-wrap gap-1 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
        {FILTER_TABS.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5',
              activeFilter === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                activeFilter === f.id ? 'bg-white/20' : 'bg-slate-100'
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Barre d'actions batch (multi-sélection) */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-blue-900">
              {selectedIds.size} sélectionnée(s)
            </span>
            <button onClick={clearSelection} className="text-xs text-blue-600 hover:text-blue-800 underline">
              Tout désélectionner
            </button>
          </div>
          <div className="flex items-center gap-2">
            {/* Submit batch — visible si au moins une PENDING */}
            {filteredAdmissions.some(a => selectedIds.has(a.id) && a.status === 'PENDING') && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleBatchSubmit}
                disabled={batchActionPending}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Soumettre en lot
              </Button>
            )}
            {/* Accept batch — visible si au moins une SUBMITTED ou UNDER_REVIEW */}
            {filteredAdmissions.some(a => selectedIds.has(a.id) && (a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW')) && (
              <Button
                size="sm"
                onClick={handleBatchAccept}
                disabled={batchActionPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                Accepter en lot
              </Button>
            )}
            {/* Accepter et inscrire en lot — visible si au moins une PENDING/DRAFT/SUBMITTED */}
            {filteredAdmissions.some(a => selectedIds.has(a.id) && ['PENDING', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MISSING_DOCUMENTS', 'WAITLISTED'].includes(a.status)) && (
              <Button
                size="sm"
                onClick={handleBatchAcceptAndEnroll}
                disabled={batchActionPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                Accepter et inscrire en lot
              </Button>
            )}
            {/* Convert batch — visible si au moins une ACCEPTED */}
            {filteredAdmissions.some(a => selectedIds.has(a.id) && a.status === 'ACCEPTED') && (
              <Button
                size="sm"
                onClick={handleBatchConvert}
                disabled={batchActionPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                Convertir en lot
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <p className="text-slate-500 font-medium">Récupération des dossiers...</p>
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="p-4 bg-slate-50 rounded-full">
              <AlertCircle className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 font-medium text-center">
              Aucun dossier d'admission trouvé<br />
              <span className="text-xs font-normal">Essayez de modifier vos filtres ou créez un nouveau dossier</span>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto h-full">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={filteredAdmissions.length > 0 && filteredAdmissions.every(a => selectedIds.has(a.id))}
                      onChange={() => toggleSelectAll(filteredAdmissions.map(a => a.id))}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Candidat</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Niveau</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Classe officielle</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <AnimatePresence mode="popLayout">
                  {filteredAdmissions.map((admission, idx) => {
                    const status = getStatusConfig(admission.status);
                    // ⭐ L'édition est toujours autorisée (même CONVERTED) pour corriger
                    // des informations, ajouter des notes, etc. Le statut CONVERTED
                    // ne doit pas empêcher la modification du dossier d'admission.
                    const canEdit = true;
                    return (
                      <motion.tr
                        key={admission.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`group hover:bg-slate-50/80 transition-colors ${selectedIds.has(admission.id) ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(admission.id)}
                            onChange={() => toggleSelect(admission.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors overflow-hidden shrink-0">
                              {/* ⭐ Photo de l'élève (si converti avec photo) sinon initiales */}
                              {admission.convertedStudent?.photoUrl ? (
                                <img
                                  src={admission.convertedStudent.photoUrl}
                                  alt={`${admission.firstName} ${admission.lastName}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <>{admission.firstName[0]}{admission.lastName[0]}</>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                                {admission.lastName.toUpperCase()} {admission.firstName}
                                {admission.isNewStudent === false ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200" title="Ancien élève — paie les frais de réinscription">
                                    ↻ Ancien élève
                                  </span>
                                ) : admission.isNewStudent === true ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200" title="Nouvel élève — paie les frais d'inscription">
                                    ★ Nouvel élève
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  {admission.admissionNumber || 'N/A'}
                                </span>
                                {admission.gender && (
                                  <>
                                    <span>•</span>
                                    <span>{admission.gender === 'M' ? 'Garçon' : 'Fille'}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-700">
                            {getLevelLabel(admission.schoolLevelId)}
                          </div>
                          {admission.previousSchool && (
                            <div className="text-xs text-slate-400 truncate max-w-[150px]">
                              Prov: {admission.previousSchool}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-700">
                            {getClassLabel(admission)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {format(new Date(admission.createdAt), 'dd MMM yyyy', { locale: fr })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', status.color)}>
                            {status.icon}
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-1 opacity-60 group-hover:opacity-100 transition-all">
                            {/* Voir détail */}
                            <button
                              onClick={() => handleOpenDetail(admission)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-all"
                              title="Voir le détail"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Voir les pièces — quick view sans ouvrir le détail */}
                            <button
                              onClick={() => handleQuickViewDocs(admission)}
                              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-violet-600 transition-all"
                              title="Voir les pièces justificatives"
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Éditer (si non CONVERTED/REJECTED) */}
                            {canEdit && (
                              <button
                                onClick={() => { setSelectedAdmission(admission); setIsEditModalOpen(true); }}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-600 transition-all"
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {/* Soumettre (PENDING → SUBMITTED) */}
                            {admission.status === 'PENDING' && (
                              <button
                                onClick={() => handleSubmit(admission.id)}
                                disabled={isActionPending}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-blue-600 transition-all disabled:opacity-50"
                                title="Soumettre pour examen"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {/* Accepter/Refuser (SUBMITTED, UNDER_REVIEW) */}
                            {(admission.status === 'SUBMITTED' || admission.status === 'UNDER_REVIEW') && (
                              <>
                                <button
                                  onClick={() => handleDecide(admission.id, 'ACCEPTED')}
                                  disabled={isActionPending}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-600 transition-all disabled:opacity-50"
                                  title="Accepter"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDecide(admission.id, 'REJECTED')}
                                  disabled={isActionPending}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-all disabled:opacity-50"
                                  title="Refuser"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* Accepter et inscrire directement (DRAFT, PENDING — bypass étapes) */}
                            {(admission.status === 'DRAFT' || admission.status === 'PENDING' || admission.status === 'MISSING_DOCUMENTS' || admission.status === 'WAITLISTED') && (
                              <button
                                onClick={() => {
                                  // Utilisation du modal de confirmation personnalisé
                                  // (showConfirm) avec type "success" (vert) — pas un modal
                                  // de suppression. Remplace l'ancien `confirmDialog.success()`
                                  // qui n'était jamais défini → ReferenceError silencieux.
                                  showConfirm(
                                    'Accepter et inscrire',
                                    `Accepter et inscrire directement ${admission.firstName} ${admission.lastName} ? Cette action va créer le dossier élève, générer le matricule, le compte financier et le responsable légal.`,
                                    async () => {
                                      try {
                                        setIsActionPending(true);
                                        // Utilisation du service (apiFetch → backend direct,
                                        // évite le 404 BFF) au lieu d'un fetch inline vers
                                        // /api/students/admissions/:id/accept-and-enroll.
                                        const student = await studentsService.acceptAndEnrollAdmission(
                                          admission.id,
                                          'Acceptation directe',
                                        );
                                        toast({
                                          title: '✅ Élève inscrit',
                                          description: `Le dossier a été accepté et l'élève est maintenant inscrit.${
                                            student?.matricule ? ` Matricule : ${student.matricule}.` : ''
                                          } Compte financier et responsable légal créés.`,
                                          variant: 'success',
                                        });
                                        loadAdmissions();
                                      } catch (e: any) {
                                        toast({
                                          title: 'Erreur',
                                          description: e?.message || 'Échec de l\'acceptation et inscription',
                                          variant: 'destructive',
                                        });
                                      } finally {
                                        setIsActionPending(false);
                                      }
                                    },
                                    'Accepter et inscrire',
                                    'success',
                                  );
                                }}
                                disabled={isActionPending}
                                className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-all disabled:opacity-50 border border-emerald-200"
                                title="Accepter et inscrire directement"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}

                            {/* Convertir (ACCEPTED → CONVERTED) */}
                            {admission.status === 'ACCEPTED' && (
                              <>
                                <button
                                  onClick={() => handleRollback(admission.id, 'UNDER_REVIEW')}
                                  disabled={isActionPending}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-600 transition-all disabled:opacity-50"
                                  title="Remettre en examen"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedAdmission(admission);
                                    setIsConvertModalOpen(true);
                                  }}
                                  disabled={isActionPending}
                                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-indigo-600 transition-all disabled:opacity-50"
                                  title="Convertir en élève"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* Remettre en soumis (REJECTED → SUBMITTED) */}
                            {admission.status === 'REJECTED' && (
                              <button
                                onClick={() => handleRollback(admission.id, 'SUBMITTED')}
                                disabled={isActionPending}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-amber-600 transition-all disabled:opacity-50"
                                title="Reprendre le dossier"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete — disponible pour toutes les admissions non converties.
                                Pour les CONVERTED, on ne peut pas supprimer (l'élève existe déjà). */}
                            {!admission.convertedStudentId ? (
                              <button
                                onClick={() => handleDelete(admission.id)}
                                disabled={isActionPending}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-all disabled:opacity-50"
                                title="Supprimer le dossier"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="p-2 text-slate-300" title="Suppression impossible — l'élève est déjà inscrit">
                                <Trash2 className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────────────────── */}

      {/* Create modal */}
      <FormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Nouveau Dossier d'Admission"
        subtitle="Remplissez les informations du candidat pour initier le cycle de vie."
        size="lg"
        actions={null}
      >
        <AdmissionForm onSubmit={handleCreate} />
      </FormModal>

      {/* Edit modal */}
      {isEditModalOpen && selectedAdmission && (
        <FormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Modifier le Dossier"
          subtitle={`${selectedAdmission.lastName} ${selectedAdmission.firstName} — ${selectedAdmission.admissionNumber || 'N/A'}`}
          size="lg"
          actions={null}
        >
          <AdmissionForm
            initialData={{
              ...selectedAdmission,
              // ⚠️ Mapper schoolLevelId → requestedLevelId pour le formulaire
              // (le formulaire utilise requestedLevelId, mais l'admission stocke schoolLevelId)
              requestedLevelId: selectedAdmission.schoolLevelId,
              birthDate: selectedAdmission.dateOfBirth,
            }}
            onSubmit={handleEdit}
          />
        </FormModal>
      )}

      {/* Detail modal */}
      {isDetailModalOpen && selectedAdmission && (
        <ReadOnlyModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Dossier ${selectedAdmission.admissionNumber || 'N/A'}`}
          subtitle={`${selectedAdmission.lastName.toUpperCase()} ${selectedAdmission.firstName}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Statut */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              {(() => {
                const s = getStatusConfig(selectedAdmission.status);
                return (
                  <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border', s.color)}>
                    {s.icon} {s.label}
                  </span>
                );
              })()}
              <span className="text-xs text-slate-400">
                Déposé le {format(new Date(selectedAdmission.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </span>
            </div>

            {/* Identité */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Identité du Candidat</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400">Nom :</span> <strong>{selectedAdmission.lastName}</strong></div>
                <div><span className="text-slate-400">Prénom :</span> <strong>{selectedAdmission.firstName}</strong></div>
                <div><span className="text-slate-400">Sexe :</span> {selectedAdmission.gender === 'M' ? 'Masculin' : selectedAdmission.gender === 'F' ? 'Féminin' : '—'}</div>
                <div><span className="text-slate-400">Date naissance :</span> {selectedAdmission.dateOfBirth ? format(new Date(selectedAdmission.dateOfBirth), 'dd/MM/yyyy', { locale: fr }) : '—'}</div>
                <div><span className="text-slate-400">Lieu naissance :</span> {selectedAdmission.birthPlace || '—'}</div>
                <div><span className="text-slate-400">Nationalité :</span> {selectedAdmission.nationality || '—'}</div>
                <div className="col-span-2"><span className="text-slate-400">Adresse :</span> {selectedAdmission.address || '—'}</div>
              </div>
            </div>

            {/* Vœux académiques */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Vœux Académiques</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-400">Niveau souhaité :</span> <strong>{getLevelLabel(selectedAdmission.schoolLevelId)}</strong></div>
                <div><span className="text-slate-400">Classe souhaitée :</span> <strong>{getClassLabel(selectedAdmission)}</strong></div>
                <div className="col-span-2"><span className="text-slate-400">Établissement précédent :</span> {selectedAdmission.previousSchool || '—'}</div>
              </div>
            </div>

            {/* Responsable légal */}
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Responsable Légal</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2"><span className="text-slate-400">Nom :</span> <strong>{selectedAdmission.mainGuardianName || '—'}</strong></div>
                <div><span className="text-slate-400">Téléphone :</span> {selectedAdmission.mainGuardianPhone || '—'}</div>
                <div><span className="text-slate-400">Email :</span> {selectedAdmission.mainGuardianEmail || '—'}</div>
              </div>
            </div>

            {/* Décision */}
            {selectedAdmission.decisionDate && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Décision</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-400">Date décision :</span> {format(new Date(selectedAdmission.decisionDate), 'dd/MM/yyyy', { locale: fr })}</div>
                  {selectedAdmission.notes && (
                    <div className="col-span-2"><span className="text-slate-400">Notes :</span> {selectedAdmission.notes}</div>
                  )}
                </div>
              </div>
            )}

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Pièces Justificatives</h4>
                <button
                  onClick={() => setShowAddDocForm(!showAddDocForm)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {showAddDocForm ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {showAddDocForm && (
                <div className="space-y-3 mb-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex gap-2">
                    <select
                      value={newDocType}
                      onChange={e => setNewDocType(e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="BIRTH_CERTIFICATE">Acte de naissance sécurisé</option>
                      <option value="ID_PHOTO">Photo d'identité</option>
                      <option value="NPI">NPI (Numéro d'Identification Personnelle)</option>
                      <option value="REPORT_CARD">Bulletin précédent</option>
                      <option value="SCHOOL_CERTIFICATE">Certificat de scolarité</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      onChange={e => setNewDocFile(e.target.files?.[0] || null)}
                      className="flex-1 text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.avif,.doc,.docx"
                    />
                    <button
                      onClick={handleAddDocument}
                      disabled={!newDocFile || isUploadingDoc}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    >
                      {isUploadingDoc ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Upload...</>
                      ) : (
                        'Uploader'
                      )}
                    </button>
                  </div>
                  {newDocFile && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{newDocFile.name}</p>
                        <p className="text-[10px] text-slate-400">{Math.round(newDocFile.size / 1024)}KB · {newDocFile.type || 'Type inconnu'}</p>
                      </div>
                      <button
                        onClick={() => setNewDocFile(null)}
                        className="p-1 hover:bg-rose-100 rounded text-rose-500 transition shrink-0"
                        title="Retirer ce fichier"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isLoadingDocs ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                </div>
              ) : admissionDocuments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">Aucun document déposé</p>
              ) : (
                <div className="space-y-2">
                  {admissionDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700">
                          {doc.documentType === 'BIRTH_CERTIFICATE' ? 'Acte de naissance sécurisé' :
                           doc.documentType === 'ID_PHOTO' ? 'Photo d\'identité' :
                           doc.documentType === 'NPI' ? 'NPI (Numéro d\'Identification Personnelle)' :
                           doc.documentType === 'REPORT_CARD' ? 'Bulletin précédent' :
                           doc.documentType === 'SCHOOL_CERTIFICATE' ? 'Certificat de scolarité' :
                           doc.documentType}
                        </p>
                        {doc.fileName && <p className="text-[10px] text-slate-400 truncate">{doc.fileName}</p>}
                        {doc.comment && <p className="text-[10px] text-slate-400 italic truncate">{doc.comment}</p>}
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        doc.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        doc.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        doc.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      )}>
                        {doc.status === 'VALIDATED' ? 'Validé' :
                         doc.status === 'REJECTED' ? 'Refusé' :
                         doc.status === 'SUBMITTED' ? 'Soumis' : 'En attente'}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {/* Bouton "Visualiser" — ouvre le document dans un modal intégré
                            Affiché même si filePath est null (l'endpoint download gère le cas) */}
                        <button
                          onClick={() => setPreviewDoc({
                            filePath: doc.filePath,
                            fileName: doc.fileName || 'document',
                            mimeType: doc.mimeType || 'application/pdf',
                          })}
                          disabled={!doc.filePath}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={doc.filePath ? "Visualiser le document" : "Aucun fichier joint"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Visualiser
                        </button>
                        {doc.status === 'SUBMITTED' && (
                          <>
                            <button onClick={() => handleValidateDoc(doc.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRejectDoc(doc.id)} className="p-1 hover:bg-rose-100 rounded text-rose-600" title="Refuser">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteDoc(doc.id)} className="p-1 hover:bg-rose-100 rounded text-rose-500" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Entretiens / Tests */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase">Entretiens & Tests</h4>
                <button
                  onClick={() => setShowAddInterviewForm(!showAddInterviewForm)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {showAddInterviewForm ? 'Annuler' : '+ Planifier'}
                </button>
              </div>

              {showAddInterviewForm && (
                <div className="flex gap-2 mb-3 p-3 bg-slate-50 rounded-lg flex-wrap">
                  <select
                    value={newInterviewType}
                    onChange={e => setNewInterviewType(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="INTERVIEW">Entretien</option>
                    <option value="TEST">Test</option>
                    <option value="OBSERVATION">Observation</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={newInterviewDate}
                    onChange={e => setNewInterviewDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[180px]"
                  />
                  <button
                    onClick={handleAddInterview}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
                  >
                    Confirmer
                  </button>
                </div>
              )}

              {admissionInterviews.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">Aucun entretien ou test planifié</p>
              ) : (
                <div className="space-y-2">
                  {admissionInterviews.map(interview => (
                    <div key={interview.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700">
                          {interview.type === 'INTERVIEW' ? 'Entretien' : interview.type === 'TEST' ? 'Test' : 'Observation'}
                        </p>
                        {interview.scheduledAt && (
                          <p className="text-[10px] text-slate-400">
                            {format(new Date(interview.scheduledAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                          </p>
                        )}
                        {interview.result && (
                          <p className="text-[10px] text-slate-500 font-medium">Résultat : {interview.result}</p>
                        )}
                        {interview.comment && (
                          <p className="text-[10px] text-slate-400 italic truncate">{interview.comment}</p>
                        )}
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                        interview.status === 'FAVORABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        interview.status === 'UNFAVORABLE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        interview.status === 'DONE' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        interview.status === 'ABSENT' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      )}>
                        {interview.status === 'FAVORABLE' ? 'Favorable' :
                         interview.status === 'UNFAVORABLE' ? 'Défavorable' :
                         interview.status === 'DONE' ? 'Terminé' :
                         interview.status === 'ABSENT' ? 'Absent' :
                         interview.status === 'TO_REVIEW' ? 'À revoir' : 'Planifié'}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        {interview.status === 'PLANNED' && (
                          <button onClick={() => handleCompleteInterview(interview.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Terminer">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleDeleteInterview(interview.id)} className="p-1 hover:bg-rose-100 rounded text-rose-500" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversion */}
            {selectedAdmission.convertedStudentId && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
                <BadgeCheck className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-800">
                  <strong>Élève créé.</strong> Ce dossier a été converti en dossier élève officiel.
                  ID : <code className="bg-indigo-100 px-1 rounded">{selectedAdmission.convertedStudentId.slice(0, 8)}…</code>
                </div>
              </div>
            )}
          </div>
        </ReadOnlyModal>
      )}

      {/* Modal "Voir les pièces" — quick view depuis la liste */}
      {quickViewAdmission && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setQuickViewAdmission(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Pièces justificatives</h3>
                  <p className="text-xs text-slate-500">
                    {quickViewAdmission.firstName} {quickViewAdmission.lastName}
                    {quickViewAdmission.admissionNumber && (
                      <span className="ml-2 text-slate-400">· {quickViewAdmission.admissionNumber}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickViewAdmission(null)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — liste des documents */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {isLoadingQuickViewDocs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                </div>
              ) : quickViewDocs.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 font-medium">Aucun document déposé</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ce dossier n'a pas encore de pièces jointes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {quickViewDocs.map(doc => {
                    const typeLabel =
                      doc.documentType === 'BIRTH_CERTIFICATE' ? 'Acte de naissance sécurisé' :
                      doc.documentType === 'ID_PHOTO' ? 'Photo d\'identité' :
                      doc.documentType === 'NPI' ? 'NPI (Numéro d\'Identification Personnelle)' :
                      doc.documentType === 'REPORT_CARD' ? 'Bulletin précédent' :
                      doc.documentType === 'SCHOOL_CERTIFICATE' ? 'Certificat de scolarité' :
                      doc.documentType || 'Document';
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                      >
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-700 truncate">{typeLabel}</p>
                          {doc.fileName && (
                            <p className="text-[11px] text-slate-400 truncate">{doc.fileName}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                            doc.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            doc.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            doc.status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {doc.status === 'VALIDATED' ? 'Validé' :
                           doc.status === 'REJECTED' ? 'Refusé' :
                           doc.status === 'SUBMITTED' ? 'Soumis' : 'En attente'}
                        </span>
                        <button
                          onClick={() => setPreviewDoc({
                            filePath: doc.filePath,
                            fileName: doc.fileName || 'document',
                            mimeType: doc.mimeType || 'application/pdf',
                          })}
                          disabled={!doc.filePath}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition border border-blue-200 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={doc.filePath ? "Visualiser le document" : "Aucun fichier joint"}
                        >
                          <Eye className="w-4 h-4" />
                          Visualiser
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {quickViewDocs.length} document{quickViewDocs.length > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const adm = quickViewAdmission;
                    setQuickViewAdmission(null);
                    handleOpenDetail(adm);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Ouvrir le détail
                </button>
                <button
                  onClick={() => setQuickViewAdmission(null)}
                  className="px-4 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Convert confirmation */}
      <ConfirmModal
        isOpen={isConvertModalOpen}
        onCancel={() => setIsConvertModalOpen(false)}
        onConfirm={() => selectedAdmission && handleConvert(selectedAdmission.id)}
        title="Confirmation de conversion"
        message={`Êtes-vous sûr de vouloir convertir ${selectedAdmission?.firstName} ${selectedAdmission?.lastName} en dossier élève officiel ? Cette action générera automatiquement : un matricule, un compte financier, un token de vérification QR, un dossier académique, et enregistrera le responsable légal.`}
        confirmLabel="Convertir maintenant"
        type="info"
        isLoading={isActionPending}
      />

      {/* Footer */}
      <div className="flex items-center justify-between text-slate-400 text-[11px] px-2 font-medium">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Système de validation actif</span>
          <span className="flex items-center gap-1.5"><BadgeCheck className="w-3 h-3" /> Conformité EDUCMASTER assurée</span>
        </div>
        <div>Academia Helm Student Lifecycle Engine v2.0</div>
      </div>

      {/* ─── MODAL DE VISUALISATION (data URL directe — pas de fetch nécessaire) ─── */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Modal de confirmation personnalisé (remplace window.confirm)
         - Type "info" (bleu)      : soumettre, actions neutres
         - Type "success" (vert)   : accepter, inscrire, convertir
         - Type "warning" (jaune)  : reprendre, annuler une décision
         - Type "danger" (rouge)   : supprimer, rejeter */}
      {confirmModal.isOpen && (() => {
        // Configuration par type : icône, couleurs header/body/footer/button
        const typeConfig = {
          info: {
            Icon: Send,
            iconBg: 'bg-blue-50',
            iconColor: 'text-blue-600',
            btnColor: 'bg-blue-600 hover:bg-blue-700',
            border: 'border-blue-100',
            bodyBg: 'bg-white',
          },
          success: {
            Icon: CheckCircle,
            iconBg: 'bg-emerald-50',
            iconColor: 'text-emerald-600',
            btnColor: 'bg-emerald-600 hover:bg-emerald-700',
            border: 'border-emerald-100',
            bodyBg: 'bg-white',
          },
          warning: {
            Icon: AlertTriangle,
            iconBg: 'bg-amber-50',
            iconColor: 'text-amber-600',
            btnColor: 'bg-amber-600 hover:bg-amber-700',
            border: 'border-amber-100',
            bodyBg: 'bg-white',
          },
          danger: {
            Icon: AlertCircle,
            iconBg: 'bg-rose-50',
            iconColor: 'text-rose-600',
            btnColor: 'bg-rose-600 hover:bg-rose-700',
            border: 'border-rose-100',
            bodyBg: 'bg-white',
          },
        };
        const cfg = typeConfig[confirmModal.confirmType];
        const { Icon } = cfg;
        return (
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeConfirm}
          >
            <div
              className={`bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border-t-4 ${cfg.border}`}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`px-6 py-5 border-b border-slate-100 ${cfg.iconBg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">{confirmModal.title}</h3>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {confirmModal.message}
                </p>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
                <button
                  onClick={closeConfirm}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    closeConfirm();
                    confirmModal.onConfirm();
                  }}
                  className={`px-4 py-2 ${cfg.btnColor} text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      </>
      )}

      {/* ⭐ Modal de paramétrage des admissions publiques (legacy — garde pour compatibilité) */}
      {isAdmissionSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsAdmissionSettingsOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-600" />
                Paramétrer les admissions publiques
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configurez la période d'ouverture des admissions sur le portail public.
                Hors de cette période, le portail public bloquera les nouvelles soumissions.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4">
              {isLoadingAdmissionSettings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Activation manuelle */}
                  <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200">
                    <input
                      type="checkbox"
                      checked={admissionSettings.admissionEnabled}
                      onChange={(e) => setAdmissionSettings(prev => ({ ...prev, admissionEnabled: e.target.checked }))}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Admissions activées</div>
                      <div className="text-xs text-slate-500">
                        Décochez pour désactiver immédiatement les admissions publiques (priorité sur les dates).
                      </div>
                    </div>
                  </label>

                  {/* Date d'ouverture */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Date d'ouverture des admissions
                    </label>
                    <input
                      type="date"
                      value={admissionSettings.admissionOpenDate}
                      onChange={(e) => setAdmissionSettings(prev => ({ ...prev, admissionOpenDate: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Laisser vide = les admissions sont ouvertes immédiatement (si activées).
                    </p>
                  </div>

                  {/* Date de clôture */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Date de clôture des admissions
                    </label>
                    <input
                      type="date"
                      value={admissionSettings.admissionCloseDate}
                      onChange={(e) => setAdmissionSettings(prev => ({ ...prev, admissionCloseDate: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Laisser vide = les admissions restent ouvertes indéfiniment (si activées).
                    </p>
                  </div>

                  {/* Statut actuel */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <Info className="w-4 h-4 inline mr-1" />
                    <strong>Statut actuel :</strong>{' '}
                    {admissionSettings.admissionEnabled
                      ? (() => {
                          const now = new Date();
                          const open = admissionSettings.admissionOpenDate ? new Date(admissionSettings.admissionOpenDate) : null;
                          const close = admissionSettings.admissionCloseDate ? new Date(admissionSettings.admissionCloseDate) : null;
                          if (open && now < open) return `Ouverture prévue le ${open.toLocaleDateString('fr-FR')}`;
                          if (close && now > close) return `Clôturées depuis le ${close.toLocaleDateString('fr-FR')}`;
                          return 'Ouvertes aux soumissions publiques';
                        })()
                      : 'Désactivées manuellement'}
                  </div>
                </>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setIsAdmissionSettingsOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveAdmissionSettings}
                disabled={isSavingAdmissionSettings || isLoadingAdmissionSettings}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
              >
                {isSavingAdmissionSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSavingAdmissionSettings ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : Panneau de paramétrage des admissions publiques ───
// Affiché quand le sous-onglet 'settings' est actif dans AdmissionsContent.

interface AdmissionSettingsPanelProps {
  academicYearId?: string;
  settings: {
    admissionEnabled: boolean;
    admissionOpenDate: string;
    admissionCloseDate: string;
  };
  setSettings: React.Dispatch<React.SetStateAction<{
    admissionEnabled: boolean;
    admissionOpenDate: string;
    admissionCloseDate: string;
  }>>;
  isLoading: boolean;
  isSaving: boolean;
  onLoad: () => void;
  onSave: () => void;
}

function AdmissionSettingsPanel({
  academicYearId,
  settings,
  setSettings,
  isLoading,
  isSaving,
  onLoad,
  onSave,
}: AdmissionSettingsPanelProps) {
  // Charger les paramètres au montage du panneau
  useEffect(() => {
    if (academicYearId) {
      onLoad();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  // Calculer le statut actuel
  const now = new Date();
  const open = settings.admissionOpenDate ? new Date(settings.admissionOpenDate) : null;
  const close = settings.admissionCloseDate ? new Date(settings.admissionCloseDate) : null;
  let statusText = 'Ouvertes aux soumissions publiques';
  let statusColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
  if (!settings.admissionEnabled) {
    statusText = 'Désactivées manuellement';
    statusColor = 'bg-rose-50 border-rose-200 text-rose-800';
  } else if (open && now < open) {
    statusText = `Ouverture prévue le ${open.toLocaleDateString('fr-FR')}`;
    statusColor = 'bg-amber-50 border-amber-200 text-amber-800';
  } else if (close && now > close) {
    statusText = `Clôturées depuis le ${close.toLocaleDateString('fr-FR')}`;
    statusColor = 'bg-slate-100 border-slate-200 text-slate-700';
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-600" />
          Paramétrage des admissions publiques
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Configurez la période d'ouverture des admissions sur le portail public.
          Hors de cette période, le portail public bloquera les nouvelles soumissions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="px-6 py-6 space-y-6">
          {/* Statut actuel */}
          <div className={cn('rounded-lg p-4 border flex items-start gap-3', statusColor)}>
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Statut actuel</p>
              <p className="text-sm mt-0.5">{statusText}</p>
            </div>
          </div>

          {/* Activation manuelle */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Contrôle manuel</h4>
            <label className="flex items-start gap-3 p-4 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200 transition">
              <input
                type="checkbox"
                checked={settings.admissionEnabled}
                onChange={(e) => setSettings(prev => ({ ...prev, admissionEnabled: e.target.checked }))}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
              />
              <div>
                <div className="text-sm font-semibold text-slate-700">Admissions activées</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Décochez pour désactiver immédiatement les admissions publiques.
                  Cette option a la priorité sur les dates ci-dessous.
                </div>
              </div>
            </label>
          </div>

          {/* Dates d'ouverture et clôture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Date d'ouverture
              </label>
              <input
                type="date"
                value={settings.admissionOpenDate}
                onChange={(e) => setSettings(prev => ({ ...prev, admissionOpenDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Laisser vide = ouvertes immédiatement (si activées).
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
                Date de clôture
              </label>
              <input
                type="date"
                value={settings.admissionCloseDate}
                onChange={(e) => setSettings(prev => ({ ...prev, admissionCloseDate: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Laisser vide = ouvertes indéfiniment (si activées).
              </p>
            </div>
          </div>

          {/* Note informative */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
            <Info className="w-4 h-4 inline mr-1" />
            <strong>Comment ça fonctionne :</strong> Le portail public d'admissions vérifie
            ces paramètres à chaque soumission. Si les admissions sont désactivées ou si la
            date actuelle est hors de la période [ouverture, clôture], le portail affiche un
            message informant que les admissions sont fermées et bloque la soumission.
          </div>

          {/* Bouton sauvegarder */}
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
