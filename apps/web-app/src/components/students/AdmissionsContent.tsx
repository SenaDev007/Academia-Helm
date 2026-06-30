'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Search, Filter, CheckCircle, XCircle, Clock, FileText,
  UserCheck, Calendar, BadgeCheck, AlertCircle, Loader2, Eye,
  Send, Pencil, X, Info, Star, AlertTriangle, Trash2, RotateCcw
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal, ReadOnlyModal } from '@/components/modules/blueprint';
import AdmissionForm from './AdmissionForm';
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
  mainGuardianName: string | null;
  mainGuardianPhone: string | null;
  mainGuardianEmail: string | null;
  convertedStudentId: string | null;
  schoolLevel?: { id: string; name: string; code?: string };
  academicYear?: { id: string; name: string };
}

export default function AdmissionsContent() {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const syncStatuses = useEntitySyncStatusBatch('STUDENT', tenantId ?? undefined);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // ⚠️ Niveaux scolaires — chargés depuis /api/school-levels pour faire le
  // mapping schoolLevelId → label côté client. La relation schoolLevel a été
  // supprimée du modèle Admission (mismatch FK school_levels vs education_levels).
  // Sans ça, le tableau affiche "Non défini" pour la colonne Niveau.
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => setSchoolLevels(Array.isArray(data) ? data : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // Helper : retourne le label d'un niveau à partir de son ID
  const getLevelLabel = (levelId: string | null | undefined): string => {
    if (!levelId) return 'Non défini';
    const level = schoolLevels.find(l => l.id === levelId);
    return level?.label || level?.code || 'Non défini';
  };

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  // Modal de confirmation personnalisé (remplace window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmLabel: 'Confirmer', onConfirm: () => {} });

  const showConfirm = (title: string, message: string, onConfirm: () => void, confirmLabel = 'Confirmer') => {
    setConfirmModal({ isOpen: true, title, message, confirmLabel, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };
  const [admissionDocuments, setAdmissionDocuments] = useState<any[]>([]);
  const [admissionInterviews, setAdmissionInterviews] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [showAddDocForm, setShowAddDocForm] = useState(false);
  const [showAddInterviewForm, setShowAddInterviewForm] = useState(false);
  const [newDocType, setNewDocType] = useState('BIRTH_CERTIFICATE');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newInterviewType, setNewInterviewType] = useState('INTERVIEW');
  const [newInterviewDate, setNewInterviewDate] = useState('');

  useEffect(() => {
    if (academicYear) {
      loadAdmissions();
    }
  }, [academicYear, schoolLevel]);

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

  // ─── Documents & Interviews (detail modal) ────────────────────────────────

  const loadDocuments = async (admissionId: string) => {
    setIsLoadingDocs(true);
    try {
      const docs = await studentsService.getAdmissionDocuments(admissionId);
      setAdmissionDocuments(Array.isArray(docs) ? docs : []);
      const interviews = await studentsService.getAdmissionInterviews(admissionId);
      setAdmissionInterviews(Array.isArray(interviews) ? interviews : []);
    } catch (e) {
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

  const handleAddDocument = async () => {
    if (!selectedAdmission) return;
    if (!newDocFile) {
      toast({ title: 'Fichier manquant', description: 'Veuillez sélectionner un fichier à uploader.', variant: 'error' });
      return;
    }
    setIsUploadingDoc(true);
    try {
      // 1. Upload du fichier via le proxy Next.js
      const formData = new FormData();
      formData.append('file', newDocFile);
      formData.append('documentType', newDocType);
      formData.append('fileName', newDocFile.name);
      formData.append('mimeType', newDocFile.type);
      formData.append('fileSize', String(newDocFile.size));

      const uploadRes = await fetch(`/api/students/admissions/${selectedAdmission.id}/documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Upload failed (${uploadRes.status})`);
      }

      toast({ title: '✅ Document uploadé', description: newDocFile.name, variant: 'success' });
      setShowAddDocForm(false);
      setNewDocFile(null);
      loadDocuments(selectedAdmission.id);
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
    return matchesSearch && matchesFilter;
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
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Candidat</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Niveau</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <AnimatePresence mode="popLayout">
                  {filteredAdmissions.map((admission, idx) => {
                    const status = getStatusConfig(admission.status);
                    const canEdit = !['CONVERTED', 'REJECTED'].includes(admission.status);
                    return (
                      <motion.tr
                        key={admission.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="group hover:bg-slate-50/80 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                              {admission.firstName[0]}{admission.lastName[0]}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                                {admission.lastName.toUpperCase()} {admission.firstName}
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
                                {admission.wantsBilingual && (
                                  <>
                                    <span>•</span>
                                    <span className="text-blue-500">Bilingue</span>
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

                            {/* Delete (only if not CONVERTED) */}
                            {!admission.convertedStudentId && (
                              <button
                                onClick={() => handleDelete(admission.id)}
                                disabled={isActionPending}
                                className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-rose-600 transition-all disabled:opacity-50"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                <div><span className="text-slate-400">Cursus bilingue :</span> {selectedAdmission.wantsBilingual ? '✓ Oui' : '✗ Non'}</div>
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
                      <option value="BIRTH_CERTIFICATE">Acte de naissance</option>
                      <option value="ID_PHOTO">Photo d'identité</option>
                      <option value="REPORT_CARD">Bulletin précédent</option>
                      <option value="TRANSFER_CERT">Certificat de transfert</option>
                      <option value="ID_DOCUMENT">Pièce d'identité du responsable</option>
                      <option value="PARENTAL_AUTH">Autorisation parentale</option>
                      <option value="OTHER">Autre document</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      onChange={e => setNewDocFile(e.target.files?.[0] || null)}
                      className="flex-1 text-xs file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
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
                          {doc.documentType === 'BIRTH_CERTIFICATE' ? 'Acte de naissance' :
                           doc.documentType === 'ID_PHOTO' ? 'Photo d\'identité' :
                           doc.documentType === 'REPORT_CARD' ? 'Bulletin précédent' :
                           doc.documentType === 'TRANSFER_CERT' ? 'Certificat de transfert' :
                           doc.documentType === 'ID_DOCUMENT' ? 'Pièce d\'identité' :
                           doc.documentType === 'PARENTAL_AUTH' ? 'Autorisation parentale' :
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

      {/* Modal de confirmation personnalisé (remplace window.confirm) */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeConfirm}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
