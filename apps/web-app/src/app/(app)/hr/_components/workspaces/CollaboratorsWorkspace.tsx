'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  FileText,
  Briefcase,
  History,
  Network,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Plus,
  Loader2,
  GraduationCap,
  Award,
  ChevronDown,
  Building2,
  Crown,
  UserCog,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { StaffWorkspace } from './StaffWorkspace';
import { ContractsWorkspace } from './ContractsWorkspace';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import Link from 'next/link';

const PRIMARY = '#1A2BA6';

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  PEDAGOGICAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Enseignant' },
  ADMIN: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Administratif' },
  SUPPORT: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Appui' },
};

interface HistoryEntry {
  id: string;
  staffId: string;
  name: string;
  type: 'contract' | 'evaluation' | 'training';
  action: string;
  date: string;
  details?: string;
}

export function CollaboratorsWorkspace() {
  const { tenant } = useModuleContext();
  const [activeTab, setActiveTab] = useState<'staff' | 'contracts' | 'assignments' | 'history' | 'org_chart'>('staff');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [contractsList, setContractsList] = useState<any[]>([]);
  const [evaluationsList, setEvaluationsList] = useState<any[]>([]);
  const [trainingsList, setTrainingsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant?.id) return;
    if (activeTab === 'assignments' || activeTab === 'org_chart' || activeTab === 'history') {
      setLoading(true);
      setError(null);
      hrFetch<any[]>(hrUrl('staff', { tenantId: tenant.id }))
        .then((data) => {
          setStaffList(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          console.error('Error loading staff for collaborators:', err);
          setError(err?.message || 'Erreur de chargement des données');
          toast({ variant: 'error', title: 'Erreur de chargement des données' });
          setStaffList([]);
        })
        .finally(() => setLoading(false));
    }
    if (activeTab === 'history') {
      hrFetch<any[]>(hrUrl('contracts', { tenantId: tenant.id }))
        .then((data) => setContractsList(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error('Error loading contracts:', err);
          setContractsList([]);
        });
      hrFetch<any[]>(hrUrl('evaluations', { tenantId: tenant.id }))
        .then((data) => setEvaluationsList(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error('Error loading evaluations:', err);
          setEvaluationsList([]);
        });
      hrFetch<any[]>(hrUrl('evaluations/trainings', { tenantId: tenant.id }))
        .then((data) => setTrainingsList(Array.isArray(data) ? data : []))
        .catch((err) => {
          console.error('Error loading trainings:', err);
          setTrainingsList([]);
        });
    }
  }, [tenant?.id, activeTab]);

  const SUB_TABS = [
    { id: 'staff', label: 'Personnel', icon: Users },
    { id: 'contracts', label: 'Contrats', icon: FileText },
    { id: 'assignments', label: 'Affectations', icon: Briefcase },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'org_chart', label: 'Organigramme', icon: Network },
  ] as const;

  // Build assignments from staff data
  const assignments = staffList
    .filter((s) => s.position || s.department)
    .map((s) => ({
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      role: s.position || 'Non défini',
      department: s.department || 'Non assigné',
      date: s.contracts?.[0]?.startDate ? `Depuis le ${new Date(s.contracts[0].startDate).toLocaleDateString('fr-FR')}` : '',
      category: s.category,
    }));

  // Build combined history entries from contracts, evaluations, and trainings
  const historyEntries: HistoryEntry[] = [
    // Contract entries
    ...contractsList
      .filter((c) => c.staff)
      .sort((a, b) => new Date(b.createdAt || b.startDate).getTime() - new Date(a.createdAt || a.startDate).getTime())
      .map((c) => ({
        id: `contract-${c.id}`,
        staffId: c.staff?.id || '',
        name: `${c.staff?.firstName} ${c.staff?.lastName}`,
        type: 'contract' as const,
        action: `${c.status === 'ACTIVE' ? 'Contrat actif' : c.status === 'PENDING' || c.status === 'DRAFT' ? 'En attente de signature' : c.status === 'EXPIRED' ? 'Contrat expiré' : c.status === 'TERMINATED' ? 'Contrat résilié' : 'Contrat ' + (c.status || 'inconnu')} — ${c.contractType}`,
        date: new Date(c.startDate).toLocaleDateString('fr-FR'),
        details: c.baseSalary ? `Salaire : ${formatCurrency(c.baseSalary)}` : undefined,
      })),
    // Evaluation entries
    ...evaluationsList
      .filter((e) => e.staff)
      .sort((a, b) => new Date(b.createdAt || b.evalDate || b.date).getTime() - new Date(a.createdAt || a.evalDate || a.date).getTime())
      .map((e) => ({
        id: `eval-${e.id}`,
        staffId: e.staff?.id || e.staffId || '',
        name: `${e.staff?.firstName || ''} ${e.staff?.lastName || ''}`.trim() || 'Personnel',
        type: 'evaluation' as const,
        action: e.type || e.title || 'Évaluation effectuée',
        date: new Date(e.evalDate || e.date || e.createdAt).toLocaleDateString('fr-FR'),
        details: e.score ? `Score : ${e.score}/20` : e.comment ? e.comment?.substring(0, 60) : undefined,
      })),
    // Training entries
    ...trainingsList
      .filter((t) => t.staff)
      .sort((a, b) => new Date(b.createdAt || b.startDate || b.date).getTime() - new Date(a.createdAt || a.startDate || a.date).getTime())
      .map((t) => ({
        id: `training-${t.id}`,
        staffId: t.staff?.id || t.staffId || '',
        name: `${t.staff?.firstName || ''} ${t.staff?.lastName || ''}`.trim() || 'Personnel',
        type: 'training' as const,
        action: t.title || t.type || 'Formation suivie',
        date: new Date(t.startDate || t.date || t.createdAt).toLocaleDateString('fr-FR'),
        details: t.status ? `Statut : ${t.status === 'COMPLETED' ? 'Terminée' : t.status === 'IN_PROGRESS' ? 'En cours' : t.status}` : undefined,
      })),
  ].sort((a, b) => {
    // Sort by date descending (most recent first)
    return b.date.localeCompare(a.date);
  }).slice(0, 50);

  // Org chart: group by category, then department
  const directorStaff = staffList.find(
    (s) =>
      s.position?.toLowerCase().includes('directeur') ||
      s.position?.toLowerCase().includes('director') ||
      s.position?.toLowerCase().includes('principal') ||
      s.position?.toLowerCase().includes('proviseur')
  );
  const categoryGroups = Array.from(new Set(staffList.map((s) => s.category).filter(Boolean)));
  const departmentByCategory: Record<string, { dept: string; members: any[] }[]> = {};
  for (const cat of categoryGroups) {
    const catStaff = staffList.filter((s) => s.category === cat);
    const depts = Array.from(new Set(catStaff.map((s) => s.department || s.position || 'Non classé').filter(Boolean)));
    departmentByCategory[cat] = depts.map((dept) => ({
      dept,
      members: catStaff.filter((s) => (s.department || s.position || 'Non classé') === dept),
    }));
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Sub tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                isActive ? 'bg-[#1A2BA6] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'staff' && (
          <motion.div key="staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StaffWorkspace />
          </motion.div>
        )}

        {activeTab === 'contracts' && (
          <motion.div key="contracts" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ContractsWorkspace />
          </motion.div>
        )}

        {activeTab === 'assignments' && (
          <motion.div key="assignments" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Affectations des collaborateurs</h3>
              <span className="text-xs text-slate-500">{assignments.length} affectation(s)</span>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-400">Aucune affectation trouvée.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignments.map((ass) => (
                  <div key={ass.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                        {ass.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{ass.name}</h4>
                        <p className="text-xs text-[#1A2BA6] font-semibold mt-0.5">{ass.role}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">Département : {ass.department}</p>
                    {ass.category && (
                      <span className={cn(
                        'text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full font-semibold uppercase',
                        CATEGORY_STYLES[ass.category]?.bg || 'bg-slate-100',
                        CATEGORY_STYLES[ass.category]?.text || 'text-slate-600',
                      )} style={{ border: `1px solid ${CATEGORY_STYLES[ass.category]?.border?.replace('border-', '') || 'slate-200'}` }}>
                        {CATEGORY_STYLES[ass.category]?.label || ass.category}
                      </span>
                    )}
                    {ass.date && <p className="text-[10px] text-slate-400 mt-3">{ass.date}</p>}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">Historique des modifications</h3>
              <div className="flex gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {contractsList.length} contrat(s)
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {evaluationsList.length} évaluation(s)
                </span>
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {trainingsList.length} formation(s)
                </span>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : historyEntries.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-400">Aucun historique disponible.</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm divide-y divide-slate-100">
                {historyEntries.map((hist) => (
                  <div key={hist.id} className="py-3 flex justify-between items-center text-xs">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={cn(
                        'mt-0.5 p-1 rounded-md shrink-0',
                        hist.type === 'contract' && 'bg-blue-50 text-blue-600',
                        hist.type === 'evaluation' && 'bg-purple-50 text-purple-600',
                        hist.type === 'training' && 'bg-emerald-50 text-emerald-600',
                      )}>
                        {hist.type === 'contract' && <FileText className="h-3.5 w-3.5" />}
                        {hist.type === 'evaluation' && <Award className="h-3.5 w-3.5" />}
                        {hist.type === 'training' && <GraduationCap className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{hist.name}</p>
                        <p className="text-slate-500 mt-0.5">{hist.action}</p>
                        {hist.details && <p className="text-slate-400 mt-0.5 truncate">{hist.details}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="font-semibold text-slate-700">{hist.date}</p>
                      <p className={cn(
                        'text-[10px] font-bold uppercase',
                        hist.type === 'contract' && 'text-blue-500',
                        hist.type === 'evaluation' && 'text-purple-500',
                        hist.type === 'training' && 'text-emerald-500',
                      )}>
                        {hist.type === 'contract' ? 'Contrat' : hist.type === 'evaluation' ? 'Évaluation' : 'Formation'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'org_chart' && (
          <motion.div key="org_chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Organigramme</h3>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : error ? (
              <div className="text-center py-12 bg-rose-50 rounded-xl border border-rose-200 text-sm text-rose-600">
                <ShieldAlert className="h-8 w-8 mx-auto mb-3 text-rose-400" />
                <p className="font-semibold">Erreur de chargement de l&apos;organigramme</p>
                <p className="text-rose-500 mt-1">{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    setLoading(true);
                    hrFetch<any[]>(hrUrl('staff', { tenantId: tenant?.id }))
                      .then((data) => setStaffList(Array.isArray(data) ? data : []))
                      .catch((err) => {
                        setError(err?.message || 'Erreur de chargement');
                        setStaffList([]);
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1A2BA6] hover:opacity-90 transition"
                >
                  Réessayer
                </button>
              </div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-400">Aucun collaborateur pour construire l&apos;organigramme.</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center">
                <div className="w-full space-y-8">
                  {/* Director at top */}
                  {directorStaff && (
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <div className="flex flex-col items-center p-4 rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-amber-50 to-white shadow-lg min-w-[180px]">
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold mb-2" style={{ backgroundColor: '#1A2BA615', color: PRIMARY }}>
                            {directorStaff.firstName?.[0]}{directorStaff.lastName?.[0]}
                          </div>
                          <p className="font-bold text-slate-900 text-sm text-center">{directorStaff.firstName} {directorStaff.lastName}</p>
                          <p className="text-[10px] text-[#1A2BA6] font-semibold mt-0.5">{directorStaff.position || 'Directeur'}</p>
                          <Crown className="absolute -top-2 -right-2 h-5 w-5 text-amber-500" />
                        </div>
                      </div>
                      {/* Connector line */}
                      <div className="w-px h-8 bg-slate-300" />
                    </div>
                  )}

                  {/* Category groups as tree branches */}
                  {categoryGroups.length > 0 ? (
                    <div className="space-y-6">
                      {categoryGroups.map((cat) => {
                        const catStyle = CATEGORY_STYLES[cat] || { bg: 'bg-slate-50', text: 'text-slate-600', label: cat || 'Autre' };
                        const depts = departmentByCategory[cat] || [];
                        return (
                          <div key={cat} className="space-y-3">
                            {/* Category header with connector */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-slate-200" />
                              <div className={cn('flex items-center gap-2 px-4 py-2 rounded-xl border', catStyle.bg, catStyle.text)} style={{ borderColor: 'transparent' }}>
                                {cat === 'PEDAGOGICAL' ? <GraduationCap className="h-4 w-4" /> : cat === 'ADMIN' ? <UserCog className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                                <span className="text-sm font-bold">{catStyle.label}</span>
                                <span className="text-[10px] font-semibold opacity-70">({staffList.filter(s => s.category === cat).length})</span>
                              </div>
                              <div className="flex-1 h-px bg-slate-200" />
                            </div>

                            {/* Departments under this category */}
                            <div className="pl-4 border-l-2 border-slate-100 ml-[50%] space-y-4">
                              {depts.map(({ dept, members }) => (
                                <div key={dept} className="space-y-2">
                                  <div className="flex items-center gap-2 -ml-4">
                                    <div className="w-3 h-px bg-slate-300" />
                                    <div className="flex items-center gap-1.5">
                                      <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                      <h4 className="text-xs font-bold text-slate-700">{dept}</h4>
                                      <span className="text-[10px] text-slate-400">({members.length})</span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pl-4">
                                    {members.map((m) => (
                                      <div key={m.id} className={cn('border rounded-lg p-2.5 text-center hover:shadow-sm transition-shadow', catStyle.bg)}>
                                        <div className="w-7 h-7 rounded-lg mx-auto flex items-center justify-center text-[10px] font-bold mb-1.5" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                                          {m.firstName?.[0]}{m.lastName?.[0]}
                                        </div>
                                        <p className="font-bold text-slate-900 text-[11px] leading-tight">{m.firstName} {m.lastName}</p>
                                        <p className="text-[9px] text-slate-500 mt-0.5">{m.position || 'Général'}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Fallback: no categories, just flat list grouped by department */
                    <div className="space-y-4">
                      {Array.from(new Set(staffList.map((s) => s.department || s.position || 'Non classé').filter(Boolean))).map((dept) => {
                        const members = staffList.filter((s) => (s.department || s.position || 'Non classé') === dept);
                        return (
                          <div key={dept} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-slate-400" />
                              <h4 className="text-sm font-bold text-slate-800">{dept}</h4>
                              <span className="text-[10px] font-semibold text-slate-400 ml-1">({members.length})</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                              {members.map((m) => (
                                <div key={m.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50 text-center hover:bg-slate-100 transition-colors">
                                  <div className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center text-xs font-bold mb-2" style={{ backgroundColor: PRIMARY + '15', color: PRIMARY }}>
                                    {m.firstName?.[0]}{m.lastName?.[0]}
                                  </div>
                                  <p className="font-bold text-slate-900 text-xs">{m.firstName} {m.lastName}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{m.position || 'Général'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection to CNSS notification */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
        <div className="flex gap-2.5">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900">Nouvelles embauches en cours de validation</p>
            <p className="text-amber-700 mt-0.5">Assurez-vous de déclarer les nouveaux collaborateurs à la CNSS dès la signature de leur contrat.</p>
          </div>
        </div>
        <Link
          href="/app/hr/cnss"
          className="text-[#1A2BA6] font-bold hover:underline shrink-0 bg-white border border-amber-200 px-3 py-1.5 rounded-lg"
        >
          Déclarer à la CNSS →
        </Link>
      </div>
    </div>
  );
}
