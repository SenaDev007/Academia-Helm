/**
 * ============================================================================
 * HR MODULE - CNSS & SOCIAL SECURITY PAGE
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  FileCheck, 
  DollarSign, 
  Plus, 
  Download, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  Search,
  Settings,
  UserCheck,
  FileText
} from 'lucide-react';
import { ModuleHeader, SubModuleNavigation } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { apiFetch } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { usePathname } from 'next/navigation';

export default function CNSSPage() {
  const { tenant, academicYear } = useModuleContext();
  const pathname = usePathname();
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const subModuleTabs = [
    { id: 'overview', label: "Vue d'ensemble", path: '/app/hr', icon: UserCheck, exact: true },
    { id: 'staff', label: 'Personnel', path: '/app/hr/staff', icon: Users },
    { id: 'contracts', label: 'Contrats', path: '/app/hr/contracts', icon: FileText },
    { id: 'leaves', label: 'Congés & Absences', path: '/app/hr/leaves', icon: Clock },
    { id: 'planning', label: 'Planning', path: '/app/hr/planning', icon: Clock },
    { id: 'allowances', label: 'Indemnités', path: '/app/hr/allowances', icon: DollarSign },
    { id: 'payroll', label: 'Paie', path: '/app/hr/payroll', icon: DollarSign },
    { id: 'cnss', label: 'CNSS', path: '/app/hr/cnss', icon: Shield },
    { id: 'reporting', label: 'Rapports', path: '/app/hr/reporting', icon: FileText },
    { id: 'settings', label: 'Paramètres', path: '/app/hr/settings', icon: Shield },
  ];

  const fetchData = async () => {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const [declRes, staffRes] = await Promise.all([
        apiFetch<any[]>(`/hr/cnss/declarations?tenantId=${tenant.id}`),
        apiFetch<any[]>(`/hr/staff?tenantId=${tenant.id}&status=ACTIVE`)
      ]);
      setDeclarations(declRes);
      setEmployees(staffRes.filter((s: any) => s.cnssNumber));
    } catch (error) {
      console.error('Error fetching CNSS data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant?.id, academicYear?.id]);

  const handleGenerateDeclaration = async () => {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    try {
      await apiFetch('/hr/cnss/declarations', {
        method: 'POST',
        body: JSON.stringify({
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          academicYearId: academicYear?.id,
        }),
      });
      toast({ variant: 'success', title: 'Déclaration CNSS générée avec succès' });
      fetchData();
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors de la génération. Vérifiez que la paie est validée.' });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <ModuleHeader
        title="Déclarations Sociales & Conformité"
        description="Suivi des cotisations sociales (CNSS, IPRES, CNPS) et génération des fichiers de déclaration nominative."
        icon="rh"
        kpis={[
          { label: 'Employés immatriculés', value: employees.length.toString(), unit: 'pers.' },
          { label: 'Taux global', value: '26.4', unit: '%' },
          { label: 'Total cotisé (An)', value: '4.8M', unit: 'XOF' },
        ]}
      />

      <div className="px-6">
        <SubModuleNavigation tabs={subModuleTabs} currentPath={pathname} />
        
        <Tabs defaultValue="declarations" className="w-full mt-6">
          <TabsList className="bg-white p-1 rounded-xl shadow-sm border border-gray-100 mb-8">
            <TabsTrigger value="declarations" className="px-6 py-2.5 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              Déclarations Mensuelles
            </TabsTrigger>
            <TabsTrigger value="employees" className="px-6 py-2.5 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              Employés Immatriculés
            </TabsTrigger>
            <TabsTrigger value="settings" className="px-6 py-2.5 rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all">
              Paramètres & Taux
            </TabsTrigger>
          </TabsList>

          <TabsContent value="declarations" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">Historique des déclarations sociales</h3>
              <div className="flex gap-3">
                <select className="bg-white border border-gray-100 rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none">
                  <option>Mai 2026</option>
                  <option>Avril 2026</option>
                </select>
                <button 
                  onClick={() => handleGenerateDeclaration()}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md font-bold text-sm"
                >
                  <Plus size={18} /> Générer Déclaration Mensuelle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {loading ? (
                [1, 2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)
              ) : declarations.length === 0 ? (
                <Card className="border-none shadow-sm rounded-3xl p-12 text-center bg-white">
                  <FileCheck className="mx-auto text-gray-200 mb-4" size={48} />
                  <p className="text-gray-500 font-medium">Aucune déclaration générée pour le moment.</p>
                </Card>
              ) : (
                declarations.map((decl) => (
                  <DeclarationRow key={decl.id} declaration={decl} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="employees">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Répertoire des assurés</h3>
                <div className="relative w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Rechercher par nom ou CNSS..." 
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Employé</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">N° CNSS</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date d'affiliation</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-blue-50/10">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <span className="text-sm font-bold text-gray-800">{emp.firstName} {emp.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-blue-600 font-bold">
                          {emp.cnssNumber || 'NON DÉFINI'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge className="bg-emerald-50 text-emerald-600 border-none">Actif</Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-gray-400 hover:text-blue-600 transition-colors">
                            <ExternalLink size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
                <CardHeader className="p-0 mb-6">
                  <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Settings size={20} className="text-blue-600" />
                    Taux de cotisation (Bénin)
                  </CardTitle>
                </CardHeader>
                <div className="space-y-4">
                  <div className="flex justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-600">Part Employé</span>
                    <span className="font-black text-blue-600">3.6 %</span>
                  </div>
                  <div className="flex justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-600">Part Employeur (Retraite)</span>
                    <span className="font-black text-blue-600">6.4 %</span>
                  </div>
                  <div className="flex justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-600">Prestations Familiales</span>
                    <span className="font-black text-blue-600">9.0 %</span>
                  </div>
                  <div className="flex justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-600">Accidents Travail</span>
                    <span className="font-black text-blue-600">1.0 % à 4.0 %</span>
                  </div>
                  <div className="pt-4 border-t border-gray-100 flex justify-between font-black text-lg">
                    <span className="text-gray-900">Total Cotisation</span>
                    <span className="text-emerald-600">22.8 % + AT</span>
                  </div>
                </div>
              </Card>

              <Card className="border-none shadow-sm rounded-3xl bg-blue-600 p-8 text-white">
                <Shield size={48} className="mb-4 opacity-50" />
                <h3 className="text-2xl font-bold mb-4">Plafond de calcul</h3>
                <p className="opacity-80 mb-6 text-sm leading-relaxed">
                  Conformément au Code de Sécurité Sociale, les cotisations sont calculées sur la base du salaire brut mensuel plafonné à <strong>600,000 XOF</strong> pour certaines prestations.
                </p>
                <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">SMIG Actuel</span>
                  <p className="text-2xl font-black">52,000 XOF</p>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DeclarationRow({ declaration }: { declaration: any }) {
  const statusConfig: any = {
    DRAFT:     { label: 'Brouillon',  color: 'bg-gray-100 text-gray-600',    icon: Clock },
    GENERATED: { label: 'Générée',   color: 'bg-blue-50 text-blue-600',     icon: FileCheck },
    SUBMITTED: { label: 'Soumise',   color: 'bg-amber-50 text-amber-600',   icon: CheckCircle2 },
    PAID:      { label: 'Payée',     color: 'bg-emerald-50 text-emerald-700', icon: Shield },
  };

  const config = statusConfig[declaration.status] || statusConfig.DRAFT;
  const Icon = config.icon;

  const periodLabel = declaration.periodStart
    ? `${new Date(declaration.periodStart).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
    : '—';

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-white p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          <FileCheck size={24} />
        </div>
        <div>
          <h4 className="font-bold text-gray-900 capitalize">{periodLabel}</h4>
          <Badge className={`mt-1 border-none ${config.color}`}>
            <Icon size={12} className="mr-1 inline" /> {config.label}
          </Badge>
        </div>
      </div>

      <div className="flex gap-8">
        <div className="text-center md:text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Brut déclaré</p>
          <p className="font-bold text-gray-800">{Number(declaration.totalGross || 0).toLocaleString()} XOF</p>
        </div>
        <div className="text-center md:text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Part Employé</p>
          <p className="font-bold text-gray-800">{Number(declaration.totalEmployee || 0).toLocaleString()} XOF</p>
        </div>
        <div className="text-center md:text-left">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-blue-600">Part Employeur</p>
          <p className="font-black text-blue-600">{Number(declaration.totalEmployer || 0).toLocaleString()} XOF</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors" title="Télécharger DSN">
          <Download size={20} />
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-sm transition-all">
          Détails →
        </button>
      </div>
    </Card>
  );
}
