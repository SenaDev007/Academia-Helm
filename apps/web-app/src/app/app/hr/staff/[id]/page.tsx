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
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  FileText, 
  Plus, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  Briefcase,
  User,
  Fingerprint,
  Users
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function StaffDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenant } = useModuleContext();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMember() {
      if (!tenant?.id || !id) return;
      try {
        setLoading(true);
        const result = await apiFetch<any>(`/hr/staff/${id}?tenantId=${tenant.id}`);
        setMember(result);
      } catch (error) {
        console.error('Error fetching staff detail:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchMember();
  }, [tenant?.id, id]);

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

  return (
    <div className="space-y-6 pb-20">
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
              <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600" />
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
                    <span>{member.category === 'PEDAGOGICAL' ? 'Corps Enseignant' : 'Administration'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    <span className="font-medium text-emerald-700">Contrat {member.contracts?.[0]?.type || 'N/A'}</span>
                  </div>
                </div>

                <div className="mt-8 flex gap-2">
                  <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                    <Edit3 size={16} /> Modifier
                  </button>
                  <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all border border-gray-100">
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
                <span className="text-sm font-bold text-gray-900">2 ans, 4 mois</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Situation</span>
                <span className="text-sm font-bold text-blue-600">Actif</span>
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
                      <InfoField label="Genre" value={member.gender === 'M' ? 'Masculin' : 'Féminin'} />
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
                      <InfoField label="Numéro d'urgence" value="N/A" />
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
                      <InfoField label="Numéro IFU" value="N/A" />
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
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all border border-blue-100">
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
                            <p className="font-bold text-gray-900 text-sm">{doc.type}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                              Version {doc.version} • {new Date(doc.uploadedAt).toLocaleDateString()}
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
              {/* Similar logic for contracts list */}
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center">
                <p className="text-gray-500">Les détails des contrats seront gérés dans l'onglet dédié.</p>
              </Card>
            </TabsContent>

            <TabsContent value="career">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center">
                <p className="text-gray-500">Historique de carrière et évaluations à venir.</p>
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
