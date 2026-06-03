/**
 * ============================================================================
 * HR MODULE - STAFF DETAIL PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
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
  Award
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PRIMARY = '#1A2BA6';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition';

const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5';

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

export default function StaffDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenant } = useModuleContext();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  // Document upload modal
  const [docOpen, setDocOpen] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docForm, setDocForm] = useState({ documentType: 'CV', fileName: '', filePath: '', mimeType: 'application/pdf' });

  async function fetchMember() {
    if (!tenant?.id || !id) return;
    try {
      setLoading(true);
      const result = await hrFetch<any>(hrUrl(`staff/${id}`, { tenantId: tenant.id }));
      setMember(result);
      setContracts(result.contracts || []);
      setEvaluations(result.evaluations || []);
      setTrainings(result.trainings || []);

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
  }

  useEffect(() => { fetchMember(); }, [tenant?.id, id]);

  const openEditModal = () => {
    if (!member) return;
    setEditForm({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phone: member.phone || '',
      position: member.position || '',
      category: member.category || 'ADMIN',
      gender: member.gender || 'MALE',
      dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().split('T')[0] : '',
      nationality: member.nationality || '',
      maritalStatus: member.maritalStatus || '',
      numberOfChildren: member.numberOfChildren || 0,
      address: member.address || '',
      emergencyContact: typeof member.emergencyContact === 'object' && member.emergencyContact ? JSON.stringify(member.emergencyContact) : (member.emergencyContact || ''),
      ifuNumber: member.ifuNumber || '',
      nationalId: member.nationalId || '',
      cnssNumber: member.cnssNumber || '',
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      // Parse emergencyContact: if it's a JSON string, parse back to object
      const submitData = { ...editForm };
      if (typeof submitData.emergencyContact === 'string' && submitData.emergencyContact.trim()) {
        try {
          submitData.emergencyContact = JSON.parse(submitData.emergencyContact);
        } catch {
          // Not valid JSON — leave as string for free-form input
        }
      }
      await hrFetch<any>(hrUrl(`staff/${id}`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: submitData,
      });
      toast({ variant: 'success', title: 'Fiche collaborateur mise à jour' });
      setEditOpen(false);
      fetchMember();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de la mise à jour' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDocLoading(true);
      await hrFetch<any>(hrUrl(`staff/${id}/documents`, { tenantId: tenant.id }), {
        method: 'POST',
        body: docForm,
      });
      toast({ variant: 'success', title: 'Document ajouté avec succès' });
      setDocOpen(false);
      setDocForm({ documentType: 'CV', fileName: '', filePath: '', mimeType: 'application/pdf' });
      fetchMember();
    } catch (err) {
      toast({ variant: 'error', title: 'Erreur lors de l\'ajout du document' });
    } finally {
      setDocLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 animate-pulse text-center">Chargement de la fiche...</div>;
  }

  if (!member) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-xl font-bold">Collaborateur non trouvé</h3>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 font-bold flex items-center gap-2 mx-auto">
          <ArrowLeft size={16} /> Retour à la liste
        </button>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[member.status] || STATUS_LABELS.INACTIVE;
  const hireDate = member.contracts?.[0]?.startDate || member.hireDate || null;

  return (
    <div className="space-y-6 pb-20">
      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
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
                  <label className={labelClass}>Email</label>
                  <input type="email" className={inputClass} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input type="tel" className={inputClass} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Poste</label>
                  <input type="text" className={inputClass} value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Catégorie</label>
                  <select className={inputClass} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                    <option value="PEDAGOGICAL">Corps Enseignant</option>
                    <option value="ADMIN">Administration</option>
                    <option value="SUPPORT">Personnel d&apos;appui</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Genre</label>
                  <select className={inputClass} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Féminin</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date de naissance</label>
                  <input type="date" className={inputClass} value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nationalité</label>
                  <input type="text" className={inputClass} value={editForm.nationality} onChange={(e) => setEditForm({ ...editForm, nationality: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Situation matrimoniale</label>
                  <input type="text" className={inputClass} value={editForm.maritalStatus} onChange={(e) => setEditForm({ ...editForm, maritalStatus: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Adresse</label>
                  <input type="text" className={inputClass} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Nombre d&apos;enfants</label>
                  <input type="number" className={inputClass} value={editForm.numberOfChildren} onChange={(e) => setEditForm({ ...editForm, numberOfChildren: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Contact d&apos;urgence</label>
                  <input type="text" className={inputClass} value={editForm.emergencyContact} onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })} placeholder='Nom — Tél — Lien' />
                </div>
                <div>
                  <label className={labelClass}>Numéro IFU</label>
                  <input type="text" className={inputClass} value={editForm.ifuNumber} onChange={(e) => setEditForm({ ...editForm, ifuNumber: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Numéro CNI / Passeport</label>
                  <input type="text" className={inputClass} value={editForm.nationalId} onChange={(e) => setEditForm({ ...editForm, nationalId: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Numéro CNSS</label>
                  <input type="text" className={inputClass} value={editForm.cnssNumber} onChange={(e) => setEditForm({ ...editForm, cnssNumber: e.target.value })} />
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

      {/* Document Upload Modal */}
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
                  <option value="CV">CV</option>
                  <option value="CNI">Pièce d&apos;identité</option>
                  <option value="BIRTH_CERTIFICATE">Acte de naissance</option>
                  <option value="DIPLOMA">Diplôme</option>
                  <option value="CONTRACT">Contrat</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Fichier</label>
                <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400"><FileText className="h-5 w-5" /></div>
                    <p className="text-sm text-slate-600">{docForm.fileName || 'Aucun fichier sélectionné'}</p>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold px-3 py-2 rounded-lg transition">
                    <Upload className="h-3.5 w-3.5" /> Choisir
                    <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setDocForm({ ...docForm, fileName: file.name, filePath: `/uploads/docs/${member.id}_${docForm.documentType.toLowerCase()}.${file.name.split('.').pop()}`, mimeType: file.type });
                      }
                    }} />
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setDocOpen(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition">Annuler</button>
                <button type="submit" disabled={docLoading || !docForm.fileName} className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
                  {docLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="px-6 pt-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft size={16} /> Retour à l'effectif
        </button>
      </div>

      <div className="px-6 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:w-1/3 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="p-0">
              <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-600" />
              <div className="px-6 pb-6 -mt-12">
                <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-lg mb-4">
                  <div className="w-full h-full rounded-[20px] bg-blue-50 flex items-center justify-center text-blue-600 text-3xl font-bold">
                    {member.firstName[0]}{member.lastName[0]}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{member.firstName} {member.lastName}</h2>
                <p className="text-blue-600 font-bold tracking-widest uppercase text-xs mt-1">
                  {member.staffCode || 'MAT-PENDING'}
                </p>
                
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Briefcase size={18} className="text-gray-400" />
                    <span>{member.position || 'Poste non défini'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Shield size={18} className="text-gray-400" />
                    <span>{member.category === 'PEDAGOGICAL' ? 'Corps Enseignant' : member.category === 'ADMIN' ? 'Administration' : 'Personnel d\'appui'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span className="font-medium text-emerald-700">Contrat {member.contracts?.[0]?.contractType || member.contracts?.[0]?.type || 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-8 flex gap-2">
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
                <span className="text-sm text-gray-500">Immatriculation CNSS</span>
                <Badge className={member.cnssNumber ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                  {member.cnssNumber ? 'Déclaré' : 'Non déclaré'}
                </Badge>
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
        </div>

        {/* Right Column: Tabs Content */}
        <div className="lg:w-2/3">
          <Tabs defaultValue="infos" className="w-full">
            <TabsList className="bg-white p-1 rounded-2xl shadow-sm mb-6 border border-gray-50 h-14 w-full justify-start overflow-x-auto no-scrollbar">
              <TabsTrigger value="infos" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Informations
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl px-8 h-full data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 font-bold text-sm">
                Documents
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
                      <InfoField label="Genre" value={member.gender === 'M' || member.gender === 'MALE' ? 'Masculin' : 'Féminin'} />
                      <InfoField label="Date de naissance" value={member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('fr-FR') : 'Non renseignée'} />
                      <InfoField label="Nationalité" value={member.nationality || 'Béninoise'} />
                      <InfoField label="Situation Matrimoniale" value={member.maritalStatus || 'Célibataire'} />
                      <InfoField label="Nombre d'enfants" value={member.numberOfChildren?.toString() || '0'} />
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
                      <InfoField label="Numéro CNI / Passeport" value={member.nationalId || 'Non renseigné'} />
                      <InfoField label="Numéro CNSS" value={member.cnssNumber || 'Non renseigné'} />
                      <InfoField label="Numéro IFU" value={member.ifuNumber || 'N/A'} />
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
                    <p className="text-sm text-gray-500">Pièces justificatives et documents légaux.</p>
                  </div>
                  <button onClick={() => setDocOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100">
                    <Plus size={18} /> Ajouter un document
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {member.documents?.length > 0 ? (
                    member.documents.map((doc: any) => (
                      <div key={doc.id} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-white transition-colors">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{doc.type || doc.documentType}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                              {doc.version ? `Version ${doc.version} • ` : ''}{new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button className="text-gray-400 hover:text-blue-600 transition-colors">
                          <FileText size={20} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 py-10 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                      <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                      <p className="text-gray-400 font-medium">Aucun document numérisé pour le moment.</p>
                    </div>
                  )}
                </div>
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
                    {contracts.map((contract: any) => (
                      <div key={contract.id} className="p-5 border border-slate-100 rounded-2xl hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                              {contract.contractType?.[0] || 'C'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{contract.contractType || 'Contrat'}</p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Du {new Date(contract.startDate).toLocaleDateString('fr-FR')} au {contract.endDate ? new Date(contract.endDate).toLocaleDateString('fr-FR') : 'Indéfini'}
                              </p>
                            </div>
                          </div>
                          <Badge className={contract.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                            {contract.status === 'ACTIVE' ? 'En vigueur' : contract.status === 'EXPIRED' ? 'Expiré' : contract.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Salaire de base</p>
                            <p className="text-sm font-bold text-emerald-600">{Number(contract.baseSalary).toLocaleString()} XOF</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mode de paiement</p>
                            <p className="text-sm font-medium text-slate-700">{contract.paymentMode || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
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
    </div>
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
