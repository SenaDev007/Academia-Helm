/**
 * ============================================================================
 * HR MODULE - STAFF DETAIL PAGE (v2 — Photo + Matricules + Structured Docs)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Mail, 
  MapPin, 
  Shield, 
  FileText, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  User,
  Fingerprint,
  X,
  Upload,
  Loader2,
  GraduationCap,
  Award,
  Camera,
  Trash2,
  RefreshCw,
  Key,
  Send,
  Eye,
  Clock,
  BadgeCheck,
  XCircle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Globe,
  Building2,
  UserX,
  UserCheck,
  Package,
  DollarSign,
  Phone,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { formatCurrency } from '@/lib/utils';
import { compressImageFileToDataUrl } from '@/lib/media';
import { toast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { StaffTerminationModal } from '../../_components/modals/StaffTerminationModal';
import { HRShell } from '../../_components/HRShell';

const PRIMARY = '#1A2BA6';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

// Document categories configuration
const DOC_CATEGORIES: Record<string, { label: string; icon: any; color: string; order: number }> = {
  IDENTITE:      { label: 'Pièces d\'identité',          icon: Shield,         color: 'blue',   order: 1 },
  DIPLOMES:      { label: 'Diplômes & Certificats',      icon: GraduationCap,  color: 'purple', order: 2 },
  EXPERIENCE:    { label: 'Expérience professionnelle',   icon: Briefcase,      color: 'emerald',order: 3 },
  ADMINISTRATIF: { label: 'Documents administratifs',     icon: FileText,       color: 'amber',  order: 4 },
  MEDICAL:       { label: 'Documents médicaux',           icon: Award,          color: 'red',    order: 5 },
  GENERAL:       { label: 'Autres documents',             icon: FolderOpen,     color: 'slate',  order: 6 },
};

const DOC_TYPE_OPTIONS = [
  { value: 'CV',                    label: 'CV / Curriculum Vitae',   category: 'EXPERIENCE' },
  { value: 'CNI',                   label: 'Carte d\'identité',       category: 'IDENTITE' },
  { value: 'PASSPORT',              label: 'Passeport',               category: 'IDENTITE' },
  { value: 'BIRTH_CERTIFICATE',     label: 'Acte de naissance',      category: 'IDENTITE' },
  { value: 'DIPLOMA',               label: 'Diplôme',                category: 'DIPLOMES' },
  { value: 'CERTIFICATE',           label: 'Certificat / Attestation',category: 'DIPLOMES' },
  { value: 'TRANSCRIPT',            label: 'Relevé de notes',        category: 'DIPLOMES' },
  { value: 'CONTRACT',              label: 'Contrat de travail',      category: 'ADMINISTRATIF' },
  { value: 'CNSS_CERTIFICATE',      label: 'Attestation CNSS',       category: 'ADMINISTRATIF' },
  { value: 'WORK_PERMIT',           label: 'Autorisation de travail', category: 'ADMINISTRATIF' },
  { value: 'MEDICAL_CERTIFICATE',   label: 'Certificat médical',     category: 'MEDICAL' },
  { value: 'OTHER',                 label: 'Autre document',         category: 'GENERAL' },
];

const VALIDATION_STATUS: Record<string, { label: string; className: string; icon: any }> = {
  PENDING:   { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  VALIDATED: { label: 'Validé',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: BadgeCheck },
  REJECTED:  { label: 'Rejeté',     className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

function formatEmergencyContact(contact: any): string {
  if (!contact) return 'Non renseigné';
  if (typeof contact === 'string') return contact;
  if (typeof contact === 'object') {
    const parts: string[] = [];
    if (contact.name) parts.push(contact.name);
    if (contact.phone) parts.push(contact.phone);
    if (contact.relationship) parts.push(`(${contact.relationship})`);
    return parts.length > 0 ? parts.join(' — ') : JSON.stringify(contact);
  }
  return String(contact);
}

function computeSeniority(hireDate: string | null | undefined): string {
  if (!hireDate) return 'Non renseignée';
  const start = new Date(hireDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0 && months === 0) return 'Moins d\'un mois';
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} moi${months > 1 ? 's' : ''}`);
  return parts.join(', ');
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE:    { label: 'Actif',      className: 'text-emerald-600' },
  INACTIVE:  { label: 'Inactif',    className: 'text-slate-500' },
  SUSPENDED: { label: 'Suspendu',   className: 'text-amber-600' },
  ON_LEAVE:  { label: 'En congé',   className: 'text-blue-600' },
};

const TERMINATION_TYPE_LABELS: Record<string, string> = {
  RESIGNATION: 'Démission',
  DISMISSAL: 'Licenciement',
  MUTUAL_AGREEMENT: 'Rupture conventionnelle',
  END_OF_CONTRACT: 'Fin de contrat',
  RETIREMENT: 'Retraite',
  DEATH: 'Décès',
  ABANDONMENT: 'Abandon de poste',
  OTHER: 'Autre',
};

export default function StaffDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenant } = useModuleContext();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [documentsGrouped, setDocumentsGrouped] = useState<Record<string, any[]>>({});

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [docReloading, setDocReloading] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Document request (relance) modal — professionnel
  const [docRequestOpen, setDocRequestOpen] = useState(false);
  const [docRequestLoading, setDocRequestLoading] = useState(false);
  const [docRequestResult, setDocRequestResult] = useState<{ uploadUrl?: string; success: boolean; message?: string } | null>(null);

  // Document upload modal
  const [docOpen, setDocOpen] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docForm, setDocForm] = useState({ 
    documentType: 'CV', 
    description: '',
    expiresAt: '',
  });
  const [docFile, setDocFile] = useState<File | null>(null);

  // Photo upload
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Expanded document categories
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Termination modal
  const [terminationModalOpen, setTerminationModalOpen] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  const fetchMember = useCallback(async () => {
    if (!tenant?.id || !id) return;
    try {
      setLoading(true);
      const result = await hrFetch<any>(hrUrl(`staff/${id}`, { tenantId: tenant.id }));
      setMember(result);
      setContracts(result.contracts || []);
      setEvaluations(result.evaluations || []);
      setTrainings(result.trainings || []);

      // Fetch documents grouped
      try {
        const docsResult = await hrFetch<any>(hrUrl(`staff/${id}/documents`, { tenantId: tenant.id }));
        if (docsResult?.grouped) {
          setDocumentsGrouped(docsResult.grouped);
          // Auto-expand all categories that have documents
          setExpandedCategories(new Set(Object.keys(docsResult.grouped)));
        } else if (Array.isArray(result.documents)) {
          // Fallback: group client-side
          const grouped: Record<string, any[]> = {};
          for (const doc of result.documents) {
            const cat = doc.category || 'GENERAL';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(doc);
          }
          setDocumentsGrouped(grouped);
          setExpandedCategories(new Set(Object.keys(grouped)));
        }
      } catch {
        // Fallback to member.documents
        if (Array.isArray(result.documents)) {
          const grouped: Record<string, any[]> = {};
          for (const doc of result.documents) {
            const cat = doc.category || 'GENERAL';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(doc);
          }
          setDocumentsGrouped(grouped);
          setExpandedCategories(new Set(Object.keys(grouped)));
        }
      }

      // Try to fetch trainings from dedicated endpoint
      try {
        const trainingsData = await hrFetch<any[]>(hrUrl(`evaluations/trainings/staff/${id}`, { tenantId: tenant.id }));
        if (trainingsData && trainingsData.length > 0) setTrainings(trainingsData);
      } catch {}
    } catch (error) {
      console.error('Error fetching staff detail:', error);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, id]);

  useEffect(() => { fetchMember(); }, [fetchMember]);

  // ─── Photo Upload (pattern data URL — identique au logo école) ────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant?.id) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'error', title: 'Format invalide. Utilisez JPEG, PNG ou WebP.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'error', title: 'Fichier trop volumineux (max 10 Mo).' });
      return;
    }

    try {
      setPhotoUploading(true);

      // 1. Compresser l'image côté navigateur → data URL (base64)
      const photoDataUrl = await compressImageFileToDataUrl(file, {
        maxEdge: 512,        // 512px max pour photo de profil (suffisant)
        quality: 0.85,
        mimeType: 'image/jpeg',
      });

      // 2. Envoyer le data URL en JSON (pas de multipart/form-data)
      await hrFetch<any>(hrUrl(`staff/${id}/photo-data`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { photoDataUrl },
      });

      toast({ variant: 'success', title: 'Photo mise à jour avec succès' });
      fetchMember();
    } catch (err: any) {
      console.error('Photo upload error:', err);
      toast({ variant: 'error', title: err.message || 'Erreur lors du téléchargement de la photo' });
    } finally {
      setPhotoUploading(false);
      // Reset input
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handlePhotoDelete = async () => {
    if (!tenant?.id) return;
    try {
      await hrFetch<any>(hrUrl(`staff/${id}/photo`, { tenantId: tenant.id }), {
        method: 'DELETE',
      });
      toast({ variant: 'success', title: 'Photo supprimée' });
      fetchMember();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur lors de la suppression de la photo' });
    }
  };

  // ─── Relance demande de documents (modal professionnel) ───────────────────
  const openDocRequestModal = () => {
    setDocRequestResult(null);
    setDocRequestOpen(true);
  };

  const sendDocRequest = async () => {
    if (!tenant?.id || !member) return;
    try {
      setDocRequestLoading(true);
      setDocRequestResult(null);
      // Envoie staffId uniquement — le backend résout candidateId via HrApplication
      const res = await hrFetch<any>(hrUrl('recruitment/document-upload/send', { tenantId: tenant.id }), {
        method: 'POST',
        body: { staffId: member.id },
      });
      setDocRequestResult({
        success: true,
        uploadUrl: res?.uploadUrl,
        message: `Un email a été envoyé à ${member.email || "l'adresse du destinataire"}.`,
      });
    } catch (err: any) {
      setDocRequestResult({
        success: false,
        message: err.message || "Erreur lors de l'envoi de la demande",
      });
    } finally {
      setDocRequestLoading(false);
    }
  };

  // ─── Edit Modal ─────────────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!member) return;
    // Parse bankDetails for form display
    const bankDetailsObj = member.bankDetails && typeof member.bankDetails === 'object' ? member.bankDetails : {};
    setEditForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phone: member.phone || '',
      position: member.position || '',
      category: member.category || '',
      gender: member.gender || '',
      dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().split('T')[0] : '',
      birthDate: member.birthDate ? new Date(member.birthDate).toISOString().split('T')[0] : '',
      address: member.address || '',
      hireDate: member.hireDate ? new Date(member.hireDate).toISOString().split('T')[0] : '',
      contractType: member.contractType || '',
      nationality: member.nationality || '',
      maritalStatus: member.maritalStatus || '',
      numberOfChildren: member.numberOfChildren ?? '',
      nationalId: member.nationalId || '',
      cnssNumber: member.cnssNumber || '',
      ifuNumber: member.ifuNumber || '',
      salary: member.salary ?? '',
      bankName: bankDetailsObj.bankName || '',
      bankAccountNumber: bankDetailsObj.accountNumber || '',
      bankAccountName: bankDetailsObj.accountName || '',
      emergencyContact: typeof member.emergencyContact === 'object' && member.emergencyContact ? JSON.stringify(member.emergencyContact) : (member.emergencyContact || ''),
      qualifications: member.qualifications || '',
      department: member.department || '',
      notes: member.notes || '',
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      const submitData: any = { ...editForm };

      // Clean up empty date strings → send null instead (backend converts to null)
      for (const dateField of ['birthDate', 'dateOfBirth', 'hireDate']) {
        if (submitData[dateField] === '') {
          submitData[dateField] = null;
        }
      }

      // Handle salary — empty string → null, otherwise convert to number
      if (submitData.salary === '' || submitData.salary === null || submitData.salary === undefined) {
        delete submitData.salary;
      } else {
        submitData.salary = parseFloat(submitData.salary) || null;
      }

      // Handle numberOfChildren — empty string → null, otherwise convert to int
      // ⚠️ Important : 0 est une valeur valide (célibataire avec 0 enfant).
      // Ne PAS utiliser `|| null` car `0 || null` = `null` (falsy).
      // On utilise `?? null` qui ne convertit que null/undefined.
      if (submitData.numberOfChildren === '' || submitData.numberOfChildren === null || submitData.numberOfChildren === undefined) {
        submitData.numberOfChildren = null;
      } else {
        const parsed = parseInt(submitData.numberOfChildren, 10);
        submitData.numberOfChildren = isNaN(parsed) ? null : parsed;
      }

      // Build bankDetails object from individual fields
      const bankName = submitData.bankName || '';
      const bankAccountNumber = submitData.bankAccountNumber || '';
      const bankAccountName = submitData.bankAccountName || '';
      if (bankName || bankAccountNumber || bankAccountName) {
        submitData.bankDetails = { bankName, accountNumber: bankAccountNumber, accountName: bankAccountName };
      } else {
        submitData.bankDetails = null;
      }
      // Remove individual bank fields (they are not Prisma fields)
      delete submitData.bankName;
      delete submitData.bankAccountNumber;
      delete submitData.bankAccountName;

      // Handle emergencyContact — try to parse as JSON, else wrap as object
      if (typeof submitData.emergencyContact === 'string' && submitData.emergencyContact.trim()) {
        try {
          submitData.emergencyContact = JSON.parse(submitData.emergencyContact);
        } catch {
          // Wrap free-form text as structured object for backend compatibility
          submitData.emergencyContact = { note: submitData.emergencyContact };
        }
      } else if (!submitData.emergencyContact || (typeof submitData.emergencyContact === 'string' && !submitData.emergencyContact.trim())) {
        submitData.emergencyContact = null;
      }

      await hrFetch<any>(hrUrl(`staff/${id}`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: submitData,
      });
      toast({ variant: 'success', title: 'Fiche collaborateur mise à jour' });
      setEditOpen(false);
      fetchMember();
    } catch (err: any) {
      toast({ variant: 'error', title: err.message || 'Erreur lors de la mise à jour' });
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Document Upload ────────────────────────────────────────────────────────
  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !tenant?.id) return;
    try {
      setDocLoading(true);

      // ─── Pattern data URL (identique au logo école + photo profil) ───────
      // Pour les images : compression côté navigateur (compressImageFileToDataUrl)
      // Pour les PDF et autres : lecture directe en data URL (FileReader)
      let fileDataUrl: string;
      const isImage = docFile.type.startsWith('image/');

      if (isImage) {
        // Compresser les images (max 1600px, qualité 0.85)
        fileDataUrl = await compressImageFileToDataUrl(docFile, {
          maxEdge: 1600,
          quality: 0.85,
          mimeType: 'image/jpeg',
        });
      } else {
        // PDF et autres fichiers : lecture directe en base64 data URL
        fileDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
          reader.readAsDataURL(docFile);
        });
      }

      // Envoyer le data URL en JSON (pas de multipart/form-data)
      await hrFetch<any>(hrUrl(`staff/${id}/documents-data`, { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          documentType: docForm.documentType,
          fileName: docFile.name,
          fileDataUrl,
          mimeType: docFile.type || (isImage ? 'image/jpeg' : 'application/octet-stream'),
          fileSize: docFile.size,
          description: docForm.description || undefined,
          expiresAt: docForm.expiresAt || undefined,
        },
      });

      toast({ variant: 'success', title: 'Document ajouté avec succès' });
      setDocOpen(false);
      setDocForm({ documentType: 'CV', description: '', expiresAt: '' });
      setDocFile(null);
      fetchMember();
    } catch (err: any) {
      console.error('Document upload error:', err);
      toast({ variant: 'error', title: err.message || 'Erreur lors de l\'ajout du document' });
    } finally {
      setDocLoading(false);
    }
  };

  const handleDocDelete = async (docId: string) => {
    if (!tenant?.id) return;
    try {
      await hrFetch<any>(hrUrl(`staff/${id}/documents/${docId}`, { tenantId: tenant.id }), {
        method: 'DELETE',
      });
      toast({ variant: 'success', title: 'Document supprimé' });
      fetchMember();
    } catch (err: any) {
      toast({ variant: 'error', title: err.message || 'Erreur lors de la suppression du document' });
    }
  };

  const handleDocValidate = async (docId: string, status: 'VALIDATED' | 'REJECTED') => {
    if (!tenant?.id) return;
    try {
      await hrFetch<any>(hrUrl(`staff/${id}/documents/${docId}/validate`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status },
      });
      toast({ variant: 'success', title: status === 'VALIDATED' ? 'Document validé' : 'Document rejeté' });
      fetchMember();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur lors de la validation' });
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // ─── Reactivate Staff ─────────────────────────────────────────────────────
  const handleReactivate = async () => {
    if (!tenant?.id || !id) return;
    try {
      setReactivateLoading(true);
      await hrFetch<any>(hrUrl(`staff/${id}/reactivate`, { tenantId: tenant.id }), {
        method: 'POST',
        body: { reason: 'Réintégration du collaborateur' },
      });
      toast({ variant: 'success', title: 'Collaborateur réactivé avec succès' });
      fetchMember();
    } catch (err: any) {
      toast({ variant: 'error', title: err.message || 'Erreur lors de la réactivation' });
    } finally {
      setReactivateLoading(false);
    }
  };

  if (loading) {
    return (
      <HRShell activeId="staff" title="Personnel" description="Fiches détaillées des collaborateurs, contrats et documents.">
        <div className="p-8 animate-pulse text-center">Chargement de la fiche...</div>
      </HRShell>
    );
  }

  if (!member) {
    return (
      <HRShell activeId="staff" title="Personnel" description="Fiches détaillées des collaborateurs, contrats et documents.">
        <div className="p-8 text-center">
          <h3 className="text-xl font-bold">Collaborateur non trouvé</h3>
          <button onClick={() => router.push('/app/hr/staff')} className="mt-4 text-blue-600 font-bold flex items-center gap-2 mx-auto">
            <ArrowLeft size={16} /> Retour à la liste
          </button>
        </div>
      </HRShell>
    );
  }

  const statusInfo = STATUS_LABELS[member.status] || STATUS_LABELS.INACTIVE;
  const hireDate = member.contracts?.[0]?.startDate || member.hireDate || null;
  const isTerminated = member.status === 'INACTIVE' && member.terminationType;
  const terminationLabel = TERMINATION_TYPE_LABELS[member.terminationType] || member.terminationType;
  const terminationDetails = (typeof member.terminationDetails === 'object' && member.terminationDetails) ? member.terminationDetails : null;

  // Sort categories by order
  const sortedCategories = Object.entries(DOC_CATEGORIES).sort(([,a], [,b]) => a.order - b.order);

  // Compute total documents count
  const totalDocs = Object.values(documentsGrouped).reduce((acc: number, docs: any[]) => acc + docs.length, 0);

  return (
    <HRShell activeId="staff" title="Personnel" description="Fiches détaillées des collaborateurs, contrats et documents.">
    <div className="space-y-6 pb-20">
      {/* Hidden photo input */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handlePhotoUpload}
      />

      {/* ─── Edit Modal ──────────────────────────────────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><Edit3 className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Modifier la fiche</h3>
                  <p className="text-xs text-white/70">{member.firstName} {member.lastName}</p>
                </div>
              </div>
              <button onClick={() => setEditOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">

              {/* ── Section: Identité ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <User className="h-3.5 w-3.5" /> Identité
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Prénom</label>
                    <input required type="text" className={inputClass} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Nom</label>
                    <input required type="text" className={inputClass} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Genre</label>
                    <select className={inputClass} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">— Non renseigné —</option>
                      <option value="MALE">Masculin</option>
                      <option value="FEMALE">Féminin</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date de naissance</label>
                    <input type="date" className={inputClass} value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nationalité</label>
                    <input type="text" className={inputClass} value={editForm.nationality} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} placeholder="Ex : Béninoise" />
                  </div>
                  <div>
                    <label className={labelClass}>N° Pièce d&apos;identité</label>
                    <input type="text" className={inputClass} value={editForm.nationalId} onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })} placeholder="CNI / Passeport" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Situation matrimoniale</label>
                    <select className={inputClass} value={editForm.maritalStatus} onChange={(e) => setEditForm({ ...editForm, maritalStatus: e.target.value })}>
                      <option value="">— Non renseigné —</option>
                      <option value="SINGLE">Célibataire</option>
                      <option value="MARRIED">Marié(e)</option>
                      <option value="DIVORCED">Divorcé(e)</option>
                      <option value="WIDOWED">Veuf/Veuve</option>
                      <option value="SEPARATED">Séparé(e)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Nombre d&apos;enfants</label>
                    <input type="number" min="0" className={inputClass} value={editForm.numberOfChildren} onChange={(e) => setEditForm({ ...editForm, numberOfChildren: e.target.value })} placeholder="0" />
                  </div>
                </div>
              </div>

              {/* ── Section: Contact ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Phone className="h-3.5 w-3.5" /> Contact
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" className={inputClass} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <input type="tel" className={inputClass} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Adresse</label>
                  <input type="text" className={inputClass} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Contact d&apos;urgence</label>
                  <input type="text" className={inputClass} value={editForm.emergencyContact} onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })} placeholder="Nom — Tél — Lien de parenté" />
                </div>
              </div>

              {/* ── Section: Professionnel ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <Briefcase className="h-3.5 w-3.5" /> Professionnel
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Poste</label>
                    <input type="text" className={inputClass} value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Département</label>
                    <input type="text" className={inputClass} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Catégorie</label>
                    <select className={inputClass} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                      <option value="">— Non renseignée —</option>
                      <option value="PEDAGOGICAL">Corps Enseignant</option>
                      <option value="ADMIN">Administration</option>
                      <option value="SUPPORT">Personnel d&apos;appui</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Type de contrat</label>
                    <select className={inputClass} value={editForm.contractType} onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value })}>
                      <option value="">— Non défini —</option>
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="VACATAIRE">Vacataire</option>
                      <option value="STAGE">Stage</option>
                      <option value="CONSULTANT">Consultant</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date d&apos;embauche</label>
                    <input type="date" className={inputClass} value={editForm.hireDate} onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Qualifications</label>
                    <input type="text" className={inputClass} value={editForm.qualifications} onChange={(e) => setEditForm({ ...editForm, qualifications: e.target.value })} placeholder="Diplômes, certifications…" />
                  </div>
                </div>
              </div>

              {/* ── Section: Rémunération ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <DollarSign className="h-3.5 w-3.5" /> Rémunération & Banque
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Salaire de base (FCFA)</label>
                    <input type="number" min="0" step="1" className={inputClass} value={editForm.salary} onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelClass}>N° CNSS</label>
                    <input type="text" className={inputClass} value={editForm.cnssNumber} onChange={(e) => setEditForm({ ...editForm, cnssNumber: e.target.value })} placeholder="Numéro d&apos;immatriculation" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>N° IFU</label>
                    <input type="text" className={inputClass} value={editForm.ifuNumber} onChange={(e) => setEditForm({ ...editForm, ifuNumber: e.target.value })} placeholder="Identifiant Fiscal Unique" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Banque</label>
                    <input type="text" className={inputClass} value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} placeholder="Nom de la banque" />
                  </div>
                  <div>
                    <label className={labelClass}>N° Compte bancaire</label>
                    <input type="text" className={inputClass} value={editForm.bankAccountNumber} onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelClass}>Titulaire du compte</label>
                    <input type="text" className={inputClass} value={editForm.bankAccountName} onChange={(e) => setEditForm({ ...editForm, bankAccountName: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* ── Section: Notes ── */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <FileText className="h-3.5 w-3.5" /> Notes
                </div>
                <div>
                  <label className={labelClass}>Notes / Observations</label>
                  <textarea className={inputClass + ' min-h-[80px]'} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={editLoading} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {editLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Document Upload Modal ───────────────────────────────────────── */}
      {docOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-5 text-white" style={{ background: PRIMARY }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/15 p-2"><Upload className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">Ajouter un document</h3>
                  <p className="text-xs text-white/70">{member.firstName} {member.lastName}</p>
                </div>
              </div>
              <button onClick={() => setDocOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15 transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleDocSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Type de document</label>
                <select className={inputClass} value={docForm.documentType} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}>
                  {DOC_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Description (optionnelle)</label>
                <input type="text" className={inputClass} value={docForm.description} onChange={(e) => setDocForm({ ...docForm, description: e.target.value })} placeholder="Ex: Diplôme de licence 2020" />
              </div>
              <div>
                <label className={labelClass}>Date d&apos;expiration (optionnelle)</label>
                <input type="date" className={inputClass} value={docForm.expiresAt} onChange={(e) => setDocForm({ ...docForm, expiresAt: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Fichier</label>
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                  {docFile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-600"><FileText className="h-5 w-5" /></div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{docFile.name}</p>
                          <p className="text-xs text-slate-400">{(docFile.size / 1024).toFixed(1)} Ko</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setDocFile(null)} className="p-1 text-slate-400 hover:text-red-500"><X size={16} /></button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center cursor-pointer py-4 hover:bg-slate-50 rounded-lg transition">
                      <Upload className="h-8 w-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-500">Cliquez pour choisir un fichier</p>
                      <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG — Max 20 Mo</p>
                      <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setDocFile(file);
                      }} />
                    </label>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setDocOpen(false); setDocFile(null); }} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={docLoading || !docFile} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {docLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Back Button ──────────────────────────────────────────────────── */}
      <div className="px-6 pt-4">
        <button
          onClick={() => router.push('/app/hr/staff')}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} /> Retour à l'effectif
        </button>
      </div>

      <div className="px-6 flex flex-col lg:flex-row gap-6">
        {/* ─── Left Column: Profile Card ─────────────────────────────────── */}
        <div className="lg:w-1/3 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0">
              {/* Banner + Photo */}
              <div className="h-28 bg-gradient-to-r from-[#1A2BA6] to-[#2D3FC7] relative">
                <div className="absolute -bottom-12 left-6">
                  <div className="relative group">
                    {/* Photo or Initials */}
                    {member.photoUrl ? (
                      <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-lg overflow-hidden">
                        <img 
                          src={member.photoUrl} 
                          alt={`${member.firstName} ${member.lastName}`}
                          className="w-full h-full rounded-[20px] object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-lg">
                        <div className="w-full h-full rounded-[20px] bg-blue-50 flex items-center justify-center text-blue-600 text-3xl font-bold">
                          {member.firstName?.[0]}{member.lastName?.[0]}
                        </div>
                      </div>
                    )}
                    {/* Photo overlay on hover */}
                    <div 
                      className="absolute inset-0 rounded-3xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {photoUploading ? (
                        <Loader2 className="h-6 w-6 text-white animate-spin" />
                      ) : (
                        <Camera className="h-6 w-6 text-white" />
                      )}
                    </div>
                  </div>
                </div>
                {/* Delete photo button */}
                {member.photoUrl && (
                  <button 
                    onClick={handlePhotoDelete}
                    className="absolute top-2 right-2 p-1.5 bg-white/20 hover:bg-white/40 rounded-lg transition-colors"
                    title="Supprimer la photo"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>

              <div className="px-6 pb-6 mt-14">
                <h2 className="text-2xl font-bold text-gray-900">{member.firstName} {member.lastName}</h2>
                
                {/* Dual Matricules */}
                <div className="mt-2 space-y-1.5">
                  {member.globalMatricule && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                      <span className="text-xs font-bold text-blue-600 tracking-widest uppercase">{member.globalMatricule}</span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">Global</span>
                    </div>
                  )}
                  {member.tenantMatricule && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">{member.tenantMatricule}</span>
                      <span className="text-[9px] text-slate-400 font-semibold uppercase">École</span>
                    </div>
                  )}
                  {!member.globalMatricule && !member.tenantMatricule && (
                    <p className="text-blue-600 font-bold tracking-widest uppercase text-xs">
                      {member.staffCode || 'Non assigné'}
                    </p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Briefcase size={18} className="text-gray-400" />
                    <span>{member.position || 'Poste non défini'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield size={18} className="text-gray-400" />
                    <span>{member.category === 'PEDAGOGICAL' ? 'Corps Enseignant' : member.category === 'ADMIN' ? 'Administration' : member.category === 'SUPPORT' ? 'Personnel d\'appui' : 'Non renseignée'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span className="font-medium text-emerald-700">Contrat {member.contracts?.[0]?.contractType || member.contractType || 'N/A'}</span>
                  </div>
                  {member.hireDate && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Clock size={18} className="text-gray-400" />
                      <span>Embauché le {new Date(member.hireDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                  {(member.salary || member.contracts?.[0]?.baseSalary) && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <DollarSign size={18} className="text-gray-400" />
                      <span className="font-medium">{formatCurrency(member.salary || member.contracts?.[0]?.baseSalary)}</span>
                    </div>
                  )}
                </div>

                <div className="mt-8 flex gap-2">
                  {member.status === 'ACTIVE' ? (
                    <button
                      onClick={() => setTerminationModalOpen(true)}
                      className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                    >
                      <UserX size={16} /> Débauche
                    </button>
                  ) : isTerminated ? (
                    <button
                      onClick={handleReactivate}
                      disabled={reactivateLoading}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {reactivateLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck size={16} />} Réactiver
                    </button>
                  ) : null}
                  <button onClick={openEditModal} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    <Edit3 size={16} /> Modifier
                  </button>
                  <button
                    onClick={() => {
                      if (member.email) {
                        window.open(`mailto:${member.email}`, '_blank');
                      } else {
                        toast({ variant: 'error', title: 'Aucune adresse email renseignée.' });
                      }
                    }}
                    className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all border border-gray-100"
                    title={member.email ? `Envoyer un email à ${member.email}` : 'Aucun email renseigné'}
                  >
                    <Mail size={20} />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Statut Administratif</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Matricule Global</span>
                <span className="text-xs font-bold text-blue-600">{member.globalMatricule || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Matricule École</span>
                <span className="text-xs font-bold text-emerald-600">{member.tenantMatricule || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">N° CNSS</span>
                <Badge className={member.cnssNumber ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                  {member.cnssNumber || 'Non déclaré'}
                </Badge>
              </div>
              {member.ifuNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">N° IFU</span>
                  <span className="text-xs font-bold text-slate-700">{member.ifuNumber}</span>
                </div>
              )}
              {member.nationalId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">N° Pièce d&apos;identité</span>
                  <span className="text-xs font-bold text-slate-700">{member.nationalId}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Nationalité</span>
                <span className="text-sm font-bold text-gray-900">{member.nationality || '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Situation matrimoniale</span>
                <span className="text-sm font-bold text-gray-900">
                  {member.maritalStatus === 'SINGLE' ? 'Célibataire' :
                   member.maritalStatus === 'MARRIED' ? 'Marié(e)' :
                   member.maritalStatus === 'DIVORCED' ? 'Divorcé(e)' :
                   member.maritalStatus === 'WIDOWED' ? 'Veuf/Veuve' :
                   member.maritalStatus === 'SEPARATED' ? 'Séparé(e)' : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Ancienneté</span>
                <span className="text-sm font-bold text-gray-900">{computeSeniority(hireDate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Situation</span>
                <span className={`text-sm font-bold ${statusInfo.className}`}>{statusInfo.label}</span>
              </div>
            </div>
          </Card>

          {/* Termination Details Card */}
          {isTerminated && (
            <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
              <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <UserX size={14} /> Détails du départ
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Type</span>
                  <span className="text-sm font-bold text-rose-600">{terminationLabel}</span>
                </div>
                {member.terminatedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Date d'effet</span>
                    <span className="text-sm font-bold text-gray-900">{new Date(member.terminatedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {member.lastWorkingDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Dernier jour travaillé</span>
                    <span className="text-sm font-bold text-gray-900">{new Date(member.lastWorkingDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {member.noticePeriodDays != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Préavis</span>
                    <span className="text-sm font-bold text-gray-900">{member.noticePeriodDays} jour(s)</span>
                  </div>
                )}
                {terminationDetails?.reason && (
                  <div className="flex justify-between items-start">
                    <span className="text-sm text-gray-500 shrink-0">Motif</span>
                    <span className="text-sm font-bold text-gray-900 text-right max-w-[200px]">{terminationDetails.reason}</span>
                  </div>
                )}
                {terminationDetails?.detailedReason && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs font-semibold text-slate-400 mb-1">Motif détaillé</p>
                    <p className="text-sm text-slate-700">{terminationDetails.detailedReason}</p>
                  </div>
                )}
                {/* Exit Checklist Summary */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Checklist de sortie</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Entretien de sortie', value: terminationDetails?.exitInterviewConducted, icon: FileText },
                      { label: 'Matériel restitué', value: terminationDetails?.equipmentReturned, icon: Package },
                      { label: 'Documents fournis', value: terminationDetails?.exitDocumentsProvided, icon: FileText },
                      { label: 'Solde réglé', value: terminationDetails?.finalSettlementPaid, icon: DollarSign },
                    ].map(({ label, value, icon: Icon }) => (
                      <div
                        key={label}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                          value ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
                {terminationDetails?.authorizedBy && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-500">Autorisé par</span>
                    <span className="text-sm font-bold text-gray-900">{terminationDetails.authorizedBy}</span>
                  </div>
                )}
                {terminationDetails?.terminationLetterRef && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Réf. lettre</span>
                    <span className="text-xs font-bold text-blue-600">{terminationDetails.terminationLetterRef}</span>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ─── Right Column: Tabs Content ────────────────────────────────── */}
        <div className="lg:w-2/3">
          <Tabs defaultValue="infos" className="w-full">
            <TabsList className="bg-white p-1 rounded-2xl shadow-sm mb-6 border border-gray-50 h-14 w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="infos" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Informations
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Documents {totalDocs > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[10px] font-bold">{totalDocs}</span>}
              </TabsTrigger>
              <TabsTrigger value="contracts" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Contrats
              </TabsTrigger>
              <TabsTrigger value="career" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Carrière
              </TabsTrigger>
            </TabsList>

            <TabsContent value="infos">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <User size={20} className="text-blue-500" />
                      État Civil
                    </h3>
                    <div className="space-y-6">
                      <InfoField label="Genre" value={member.gender === 'M' || member.gender === 'MALE' ? 'Masculin' : member.gender === 'F' || member.gender === 'FEMALE' ? 'Féminin' : 'Non renseigné'} />
                      <InfoField label="Date de naissance" value={member.birthDate ? new Date(member.birthDate).toLocaleDateString('fr-FR') : member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('fr-FR') : 'Non renseignée'} />
                      <InfoField label="Nationalité" value={member.nationality || 'Non renseignée'} />
                      <InfoField label="Situation Matrimoniale" value={
                        member.maritalStatus === 'SINGLE' ? 'Célibataire'
                        : member.maritalStatus === 'MARRIED' ? 'Marié(e)'
                        : member.maritalStatus === 'DIVORCED' ? 'Divorcé(e)'
                        : member.maritalStatus === 'WIDOWED' ? 'Veuf/Veuve'
                        : member.maritalStatus === 'SEPARATED' ? 'Séparé(e)'
                        : 'Non renseignée'
                      } />
                      <InfoField label="Nombre d'enfants" value={member.numberOfChildren != null ? member.numberOfChildren.toString() : 'Non renseigné'} />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <MapPin size={20} className="text-blue-500" />
                      Contact & Localisation
                    </h3>
                    <div className="space-y-6">
                      <InfoField label="Email" value={member.email || 'Non renseigné'} />
                      <InfoField label="Téléphone" value={member.phone || 'Non renseigné'} />
                      <InfoField label="Adresse" value={member.address || 'Non renseignée'} />
                      <InfoField label="Numéro d'urgence" value={formatEmergencyContact(member.emergencyContact)} />
                    </div>
                  </section>

                  <section className="md:col-span-2 pt-6 border-t border-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <Fingerprint size={20} className="text-blue-500" />
                      Identifiants Officiels
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <InfoField label="Matricule Global (AH)" value={member.globalMatricule || 'Non assigné'} />
                      <InfoField label="Matricule École" value={member.tenantMatricule || 'Non assigné'} />
                      <InfoField label="N° Employé (interne)" value={member.employeeNumber || '—'} />
                      <InfoField label="Numéro CNI / Passeport" value={member.nationalId || 'Non renseigné'} />
                      <InfoField label="Numéro CNSS" value={member.cnssNumber || 'Non renseigné'} />
                      <InfoField label="Numéro IFU" value={member.ifuNumber || 'N/A'} />
                    </div>
                  </section>

                  {/* ─── Section: Identifiants de connexion ─── */}
                  <section className="md:col-span-2 pt-6 border-t border-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Key size={20} className="text-blue-500" />
                      Identifiants de connexion
                    </h3>
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Compte utilisateur</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Générez ou régénérez les identifiants de connexion (nom d'utilisateur + mot de passe temporaire).
                          Un email sera envoyé au personnel avec ses identifiants et le lien de connexion.
                        </p>
                      </div>
                      <button
                        onClick={() => setCredModalOpen(true)}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-[#1A2BA6] shrink-0 ml-4"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Régénérer les identifiants
                      </button>
                    </div>
                  </section>

                  {/* ─── Section: Documents du personnel ─── */}
                  <section className="md:col-span-2 pt-6 border-t border-gray-50">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText size={20} className="text-blue-500" />
                      Documents du personnel
                    </h3>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">Demande de documents</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Envoyez un lien au candidat pour qu'il uploade ses documents (CNI, diplôme, attestations...).
                          Les documents seront automatiquement catégorisés dans l'onglet Documents.
                        </p>
                      </div>
                      <button
                        onClick={openDocRequestModal}
                        disabled={docReloading}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition bg-[#1A2BA6] shrink-0 ml-4"
                      >
                        {docReloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Relancer la demande
                      </button>
                    </div>
                  </section>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="docs">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Dossier Numérique</h3>
                    <p className="text-sm text-gray-500">Documents classés par catégorie — {totalDocs} document(s)</p>
                  </div>
                  <button onClick={() => setDocOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100">
                    <Plus size={18} /> Ajouter un document
                  </button>
                </div>

                {/* Structured Document Categories */}
                <div className="space-y-3">
                  {sortedCategories.map(([catKey, catConfig]) => {
                    const docs = documentsGrouped[catKey] || [];
                    const isExpanded = expandedCategories.has(catKey);
                    const CatIcon = catConfig.icon;

                    return (
                      <div key={catKey} className="rounded-2xl border border-slate-200 overflow-hidden">
                        {/* Category Header */}
                        <button
                          onClick={() => toggleCategory(catKey)}
                          className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              catConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                              catConfig.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                              catConfig.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' :
                              catConfig.color === 'amber' ? 'bg-amber-100 text-amber-600' :
                              catConfig.color === 'red' ? 'bg-red-100 text-red-600' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              <CatIcon className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-bold text-slate-800">{catConfig.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              docs.length > 0
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-slate-50 text-slate-400 border-slate-100'
                            }>
                              {docs.length}
                            </Badge>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </div>
                        </button>

                        {/* Category Documents */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              {docs.length > 0 ? (
                                <div className="divide-y divide-slate-50">
                                  {docs.map((doc: any) => {
                                    const validationInfo = VALIDATION_STATUS[doc.validationStatus] || VALIDATION_STATUS.PENDING;
                                    const ValidationIcon = validationInfo.icon;
                                    return (
                                      <div key={doc.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0">
                                            <FileText className="h-4 w-4" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-slate-900 text-sm truncate">{doc.fileName || doc.type || doc.documentType}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-[10px] text-slate-400 font-semibold uppercase">{doc.documentType}</span>
                                              {doc.version > 1 && <span className="text-[10px] text-blue-500 font-semibold">v{doc.version}</span>}
                                              <span className="text-[10px] text-slate-300">•</span>
                                              <span className="text-[10px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString('fr-FR')}</span>
                                              {doc.fileSize && <span className="text-[10px] text-slate-400">• {(doc.fileSize / 1024).toFixed(0)} Ko</span>}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {/* Validation badge */}
                                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${validationInfo.className}`}>
                                            <ValidationIcon className="h-2.5 w-2.5" />
                                            {validationInfo.label}
                                          </span>
                                          {/* Actions */}
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {doc.validationStatus === 'PENDING' && (
                                              <>
                                                <button 
                                                  onClick={() => handleDocValidate(doc.id, 'VALIDATED')}
                                                  className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-colors"
                                                  title="Valider"
                                                >
                                                  <BadgeCheck className="h-3.5 w-3.5" />
                                                </button>
                                                <button 
                                                  onClick={() => handleDocValidate(doc.id, 'REJECTED')}
                                                  className="p-1 text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                                  title="Rejeter"
                                                >
                                                  <XCircle className="h-3.5 w-3.5" />
                                                </button>
                                              </>
                                            )}
                                            <button 
                                              onClick={() => handleDocDelete(doc.id)}
                                              className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors"
                                              title="Supprimer"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-5 py-6 text-center">
                                  <p className="text-sm text-slate-400">Aucun document dans cette catégorie</p>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {totalDocs === 0 && (
                  <div className="mt-4 py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-gray-400 font-medium">Aucun document numérisé pour le moment.</p>
                    <button
                      onClick={() => setDocOpen(true)}
                      className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100"
                    >
                      <Plus size={16} /> Ajouter le premier document
                    </button>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="contracts">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Contrats</h3>
                  <Badge className="bg-slate-100 text-slate-600">{contracts.length} contrat(s)</Badge>
                </div>
                {contracts.length > 0 ? (
                  <div className="space-y-4">
                    {contracts.map((contract: any) => {
                      // Mapping lisible des statuts de contrat (≠ raw 'PENDING' / 'DRAFT' qui s'affichait avant)
                      const statusMap: Record<string, { label: string; className: string }> = {
                        ACTIVE:     { label: 'En vigueur',                className: 'bg-emerald-50 text-emerald-700' },
                        PENDING:    { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600' },
                        DRAFT:      { label: 'En attente de signature',   className: 'bg-amber-50 text-amber-600' },
                        EXPIRED:    { label: 'Expiré',                    className: 'bg-slate-100 text-slate-500' },
                        TERMINATED: { label: 'Résilié',                   className: 'bg-rose-50 text-rose-600' },
                        DELETED:    { label: 'Supprimé',                  className: 'bg-slate-100 text-slate-400' },
                      };
                      const st = statusMap[contract.status] || { label: contract.status, className: 'bg-slate-100 text-slate-500' };
                      return (
                        <Link
                          key={contract.id}
                          href={`/app/hr/contracts/${contract.id}`}
                          className="block p-5 border border-slate-100 rounded-2xl hover:bg-slate-50/50 hover:border-blue-200 transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                {contract.contractType?.[0] || 'C'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                                  {contract.contractType || 'Contrat'} {!contract.signedAt && <span className="text-[10px] text-amber-600 font-semibold ml-1">(non signé)</span>}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Du {new Date(contract.startDate).toLocaleDateString('fr-FR')} au {contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Indéfini'}
                                </p>
                              </div>
                            </div>
                            <Badge className={st.className}>{st.label}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-50">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Salaire de base</p>
                              <p className="text-sm font-bold text-emerald-600">{formatCurrency(contract.baseSalary)}</p>
                            </div>
                            <div className="flex items-end justify-end">
                              <span className="text-xs font-bold text-blue-600 group-hover:underline">Ouvrir le contrat →</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-gray-400 font-medium">Aucun contrat enregistré.</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="career">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
                <div className="space-y-8">
                  {/* Evaluations */}
                  <section>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Award size={20} className="text-blue-500" />
                        Évaluations
                      </h3>
                      <Badge className="bg-slate-100 text-slate-600">{evaluations.length}</Badge>
                    </div>
                    {evaluations.length > 0 ? (
                      <div className="space-y-3">
                        {evaluations.map((evalItem: any) => (
                          <div key={evalItem.id} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{evalItem.title || evalItem.type || 'Évaluation'}</p>
                                <p className="text-xs text-slate-400 mt-1">{evalItem.comments || 'Pas de commentaire'}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-blue-600">{evalItem.score || evalItem.rating || '—'}</p>
                                <p className="text-[10px] text-slate-400">{new Date(evalItem.evaluatedAt || evalItem.createdAt).toLocaleDateString('fr-FR')}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-sm text-slate-400">Aucune évaluation enregistrée.</p>
                      </div>
                    )}
                  </section>

                  {/* Trainings */}
                  <section>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <GraduationCap size={20} className="text-blue-500" />
                        Formations
                      </h3>
                      <Badge className="bg-slate-100 text-slate-600">{trainings.length}</Badge>
                    </div>
                    {trainings.length > 0 ? (
                      <div className="space-y-3">
                        {trainings.map((training: any) => (
                          <div key={training.id} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{training.title || training.topic || 'Formation'}</p>
                                <p className="text-xs text-slate-400 mt-1">{training.provider || training.organizer || ''}</p>
                              </div>
                              <div className="text-right">
                                <Badge className={training.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                                  {training.status === 'COMPLETED' ? 'Terminée' : training.status || 'En cours'}
                                </Badge>
                                <p className="text-[10px] text-slate-400 mt-1">{training.completedAt || training.startDate ? new Date(training.completedAt || training.startDate).toLocaleDateString('fr-FR') : ''}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-sm text-slate-400">Aucune formation enregistrée.</p>
                      </div>
                    )}
                  </section>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ─── Modal: Régénérer les identifiants ─── */}
      {credModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => !saving && setCredModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #0D3B85 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                  <Key className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Régénérer les identifiants</h3>
                  <p className="text-white/60 text-xs mt-0.5">Nouveau mot de passe + email au personnel</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Personnel :</span>
                  <span className="font-bold text-slate-900">{member.firstName} {member.lastName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Email :</span>
                  <span className="font-medium text-slate-700">{member.email || 'Non renseigné'}</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Un nouveau mot de passe temporaire sera généré et envoyé par email.
                  L'ancien mot de passe ne fonctionnera plus.
                  Le personnel devra se connecter avec les nouveaux identifiants.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setCredModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={async () => {
                  try {
                    setSaving(true);
                    const res = await hrFetch(hrUrl(`staff/${member.id}/generate-credentials`, { tenantId: tenant?.id }), { method: 'POST' });
                    if (res?.success) {
                      toast({
                        variant: 'success',
                        title: 'Identifiants générés !',
                        description: `Email envoyé à ${res.email || member.email}. Identifiant : ${res.username || 'N/A'}`,
                      });
                      setCredModalOpen(false);
                    } else {
                      toast({ variant: 'error', title: 'Erreur', description: res?.error || res?.message || 'Échec de la génération' });
                    }
                  } catch (err: any) {
                    toast({ variant: 'error', title: 'Erreur', description: err.message });
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: '#0D1F6E' }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Confirmer la régénération
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal : Relance demande de documents ─── */}
      <AnimatePresence>
        {docRequestOpen && member && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => !docRequestLoading && setDocRequestOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header bleu Helm */}
              <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #1A2BA6 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                    <Send className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">Demande de documents</h3>
                    <p className="text-white/70 text-xs mt-0.5">Envoi d'un lien de télérversement par email</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {docRequestResult ? (
                  // ─── Résultat ───
                  <div className="space-y-4">
                    {docRequestResult.success ? (
                      <>
                        <div className="flex flex-col items-center text-center space-y-3 py-2">
                          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">Demande envoyée !</h4>
                          <p className="text-sm text-slate-600">{docRequestResult.message}</p>
                        </div>
                        {docRequestResult.uploadUrl && (
                          <div className="bg-slate-50 rounded-xl p-3 space-y-1">
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Lien de télérversement</p>
                            <p className="text-xs text-slate-600 break-all font-mono bg-white rounded p-2 border border-slate-200">
                              {docRequestResult.uploadUrl}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-center space-y-3 py-2">
                        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center">
                          <AlertCircle className="h-7 w-7 text-rose-600" />
                        </div>
                        <h4 className="text-lg font-bold text-slate-900">Échec de l'envoi</h4>
                        <p className="text-sm text-slate-600">{docRequestResult.message}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  // ─── Confirmation ───
                  <>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Destinataire :</span>
                        <span className="font-bold text-slate-900">{member.firstName} {member.lastName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Email :</span>
                        <span className="font-medium text-slate-700">{member.email || 'Non renseigné'}</span>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-800 space-y-1">
                        <p className="font-bold">Documents qui seront demandés :</p>
                        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
                          <li>Pièce d'identité / Passeport <span className="text-rose-500 font-bold">*</span></li>
                          <li>Diplôme le plus élevé <span className="text-rose-500 font-bold">*</span></li>
                          <li>CV / Curriculum Vitae</li>
                          <li>Attestations de travail</li>
                          <li>Attestation CNSS, Certificat médical...</li>
                        </ul>
                        <p className="text-[10px] text-blue-500 mt-1">* obligatoires</p>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">
                        Un email sera envoyé à <strong>{member.email || 'l'adresse du destinataire'}</strong> avec un lien sécurisé valide 7 jours.
                        Les documents téléversés seront automatiquement catégorisés dans l'onglet Documents.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
                {docRequestResult ? (
                  <button
                    onClick={() => setDocRequestOpen(false)}
                    className="px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 transition"
                    style={{ backgroundColor: '#0D1F6E' }}
                  >
                    Fermer
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setDocRequestOpen(false)}
                      disabled={docRequestLoading}
                      className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={sendDocRequest}
                      disabled={docRequestLoading || !member.email}
                      className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                      style={{ backgroundColor: '#0D1F6E' }}
                    >
                      {docRequestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Envoyer la demande
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Staff Termination Modal */}
      <StaffTerminationModal
        isOpen={terminationModalOpen}
        onClose={() => setTerminationModalOpen(false)}
        onSuccess={fetchMember}
        staff={{
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          position: member.position,
          employeeNumber: member.employeeNumber,
          tenantMatricule: member.tenantMatricule,
          globalMatricule: member.globalMatricule,
          status: member.status,
        }}
        tenantId={tenant?.id || ''}
      />
    </div>
    </HRShell>
  );
}

function InfoField({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="font-semibold text-gray-900">{value}</p>
    </div>
  );
}
