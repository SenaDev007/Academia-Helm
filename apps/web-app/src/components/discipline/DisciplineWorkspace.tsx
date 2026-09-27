'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Plus, Loader2, Search, Gavel, BookOpen, Settings, X,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Trash2, Edit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface DisciplineRule {
  id: string; name: string; description?: string;
  hours_penalty: number; points_deducted: number; severity: string; isActive: boolean;
}
interface Sanction {
  id: string; studentId: string; studentName: string; className: string;
  fault_name: string; hours_attributed: number; points_deducted: number;
  sanction_date: string; status: string; comment?: string;
  // ⭐ Champs notification (remplis par DisciplineNotificationService)
  notificationStatus?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  parentNotifiedAt?: string;
  notificationChannels?: { whatsapp?: string; sms?: string; event?: string };
}
interface ClassInfo { id: string; name: string; code: string; schoolLevelId?: string; }
interface LevelGroup { levelName: string; levelCode: string; classes: ClassInfo[]; }

const SEVERITY_COLORS: Record<string, string> = {
  MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  MODERATE: 'bg-orange-100 text-orange-800 border-orange-300',
  MAJOR: 'bg-red-100 text-red-800 border-red-300',
  CRITICAL: 'bg-red-200 text-red-900 border-red-400',
};
const SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'Mineure', MODERATE: 'Modérée', MAJOR: 'Grave', CRITICAL: 'Critique',
};

export default function DisciplineWorkspace({
  tenant, academicYear, schoolLevelId,
}: { tenant?: any; academicYear?: any; schoolLevelId?: string; }) {
  const [activeTab, setActiveTab] = useState<'sanctions' | 'conduct' | 'rules'>('sanctions');
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<DisciplineRule[]>([]);
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [modalClassId, setModalClassId] = useState<string | null>(null);
  const [modalClassName, setModalClassName] = useState<string>('');
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);
  const [modalStudentName, setModalStudentName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  // ⭐ Élèves par classe (chargés à la demande quand on déplie une classe)
  const [classStudents, setClassStudents] = useState<Map<string, any[]>>(new Map());
  const [loadingClassStudents, setLoadingClassStudents] = useState<Set<string>>(new Set());
  // ⭐ Settings de conduite (baseline configurable par l'école)
  const [conductSettings, setConductSettings] = useState<{ conduct_reference: number; critical_threshold: number }>({ conduct_reference: 17, critical_threshold: 5 });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);

      const [rulesRes, sanctionsRes, classesRes] = await Promise.all([
        fetch(`/api/discipline/rules?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/discipline/sanctions?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/all-classes?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
      ]);

      if (rulesRes?.ok) { const d = await rulesRes.json(); setRules(Array.isArray(d) ? d : []); }
      if (sanctionsRes?.ok) { const d = await sanctionsRes.json(); setSanctions(Array.isArray(d) ? d : []); }
      if (classesRes?.ok) { const d = await classesRes.json(); setClasses(Array.isArray(d) ? d : []); }

      // ⭐ Charger les settings de conduite (baseline configurable)
      const settingsRes = await fetch(`/api/discipline/conduct/settings?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null);
      if (settingsRes?.ok) {
        const sd = await settingsRes.json();
        if (sd && typeof sd.conduct_reference === 'number') {
          setConductSettings({ conduct_reference: sd.conduct_reference, critical_threshold: sd.critical_threshold ?? 5 });
        }
      }
    } catch (err) { console.error('Discipline load error:', err); }
    finally { setLoading(false); }
  }, [academicYear?.id, schoolLevelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ⭐ Charger les élèves d'une classe (à la demande quand on déplie une classe)
  const loadClassStudents = useCallback(async (classId: string) => {
    if (classStudents.has(classId)) return; // déjà chargé
    setLoadingClassStudents(prev => { const n = new Set(prev); n.add(classId); return n; });
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ classId, academicYearId: academicYear?.id || '', status: 'ACTIVE' });
      const res = await fetch(`/api/students?${params}`, { headers: { ...authHeaders }, credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d?.items || []);
        setClassStudents(prev => { const n = new Map(prev); n.set(classId, list); return n; });
      }
    } catch (err) { console.error('loadClassStudents error:', err); }
    finally { setLoadingClassStudents(prev => { const n = new Set(prev); n.delete(classId); return n; }); }
  }, [academicYear?.id, classStudents]);

  const toggleClass = (id: string) => {
    setExpandedClasses(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); }
      else { n.add(id); loadClassStudents(id); } // ⭐ Charger les élèves au dépliage
      return n;
    });
  };

  // Grouper les classes par niveau scolaire
  const levelGroups = useMemo<LevelGroup[]>(() => {
    const levelMap = new Map<string, LevelGroup>();
    for (const cls of classes) {
      const levelName = (cls as any).schoolLevel?.name || (cls as any).schoolLevel?.code || 'Autre';
      const levelCode = (cls as any).schoolLevel?.code || 'OTHER';
      if (!levelMap.has(levelCode)) {
        levelMap.set(levelCode, { levelName, levelCode, classes: [] });
      }
      levelMap.get(levelCode)!.classes.push(cls);
    }
    return Array.from(levelMap.values());
  }, [classes]);

  // Sanctions par classe
  const sanctionsByClass = useMemo(() => {
    const map = new Map<string, Sanction[]>();
    for (const s of sanctions) {
      const key = s.className || 'Sans classe';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sanctions]);

  const toggleLevel = (code: string) => {
    setExpandedLevels(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  };

  const openSanctionModal = (classId: string | null, className: string, studentId?: string, studentName?: string) => {
    setModalClassId(classId); setModalClassName(className);
    setModalStudentId(studentId || null); setModalStudentName(studentName || '');
    setShowSanctionModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" /> Discipline & Vie Scolaire
          </h2>
          <p className="text-sm text-gray-600 mt-1">Sanctions, compteur de conduite et présences — organisé par niveau et par classe</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'rules' && (
            <Button onClick={() => setShowRuleModal(true)} className="bg-amber-600 hover:bg-amber-700">
              <Plus className="w-4 h-4 mr-2" /> Nouvelle règle
            </Button>
          )}
          <Button onClick={() => setShowSettingsModal(true)} className="bg-slate-600 hover:bg-slate-700" title="Configurer la moyenne de conduite">
            <Settings className="w-4 h-4 mr-2" /> Paramètres conduite
          </Button>
          <Button onClick={() => { setModalClassId(null); setModalClassName(''); setModalStudentId(null); setModalStudentName(''); setShowSanctionModal(true); }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> Nouvelle sanction
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[{ id: 'sanctions', label: 'Sanctions', icon: Gavel }, { id: 'conduct', label: 'Compteur de conduite', icon: BookOpen }, { id: 'rules', label: 'Barème des fautes', icon: Settings }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
              activeTab === tab.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
      ) : activeTab === 'sanctions' ? (
        /* ── Sanctions organisées par niveau → classe ── */
        <div className="space-y-4">
          {levelGroups.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">Aucune classe disponible.</div>
          ) : levelGroups.map(group => (
            <div key={group.levelCode} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button onClick={() => toggleLevel(group.levelCode)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-2">
                  {expandedLevels.has(group.levelCode) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-bold text-gray-900">{group.levelName}</span>
                  <span className="text-xs text-gray-500">({group.classes.length} classes)</span>
                </div>
                <span className="text-xs text-gray-400">
                  {group.classes.reduce((sum, c) => sum + (sanctionsByClass.get(c.name)?.length || 0), 0)} sanctions
                </span>
              </button>
              {expandedLevels.has(group.levelCode) && (
                <div className="divide-y divide-gray-100">
                  {group.classes.map(cls => {
                    const clsSanctions = sanctionsByClass.get(cls.name) || [];
                    return (
                      <div key={cls.id}>
                        <button onClick={() => toggleClass(cls.id)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50/50 transition-colors">
                          <div className="flex items-center gap-2 ml-4">
                            {expandedClasses.has(cls.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span className="text-sm font-medium text-gray-700">{cls.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400">{clsSanctions.length} sanction(s)</span>
                            <button onClick={(e) => { e.stopPropagation(); openSanctionModal(cls.id, cls.name); }}
                              className="px-2 py-1 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                              + Sanction
                            </button>
                          </div>
                        </button>
                        {expandedClasses.has(cls.id) && (
                          <div className="px-8 pb-3 space-y-3">
                            {/* ⭐ Liste des élèves de la classe (avec bouton + Sanction par élève) */}
                            {loadingClassStudents.has(cls.id) ? (
                              <div className="flex items-center gap-2 py-2 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Chargement des élèves…</div>
                            ) : (classStudents.get(cls.id) || []).length > 0 ? (
                              <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Élèves de la classe</div>
                                <div className="grid grid-cols-2 gap-1">
                                  {(classStudents.get(cls.id) || []).map((stu: any) => {
                                    const studentSanctions = clsSanctions.filter(s => s.studentId === stu.id);
                                    return (
                                      <div key={stu.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 rounded-lg hover:bg-blue-50/50 transition-colors">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-xs font-medium text-gray-700 truncate">{stu.lastName} {stu.firstName}</span>
                                          {studentSanctions.length > 0 && (
                                            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[9px] font-bold flex-shrink-0">
                                              {studentSanctions.length} sanction{studentSanctions.length > 1 ? 's' : ''}
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openSanctionModal(cls.id, cls.name, stu.id, `${stu.lastName} ${stu.firstName}`); }}
                                          className="px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex-shrink-0"
                                        >
                                          + Sanction
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 py-2">Aucun élève inscrit dans cette classe.</div>
                            )}

                            {/* ⭐ Sanctions existantes de la classe */}
                            {clsSanctions.length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Sanctions enregistrées</div>
                                <Table>
                                  <TableHeader><TableRow className="bg-gray-50">
                                    <TableHead className="text-xs whitespace-nowrap">Élève</TableHead>
                                    <TableHead className="text-xs whitespace-nowrap">Faute</TableHead>
                                    <TableHead className="text-xs text-right whitespace-nowrap">Heures</TableHead>
                                    <TableHead className="text-xs text-right whitespace-nowrap">Points</TableHead>
                                    <TableHead className="text-xs whitespace-nowrap">Date</TableHead>
                                    <TableHead className="text-xs text-center whitespace-nowrap">Statut</TableHead>
                                    <TableHead className="text-xs text-center whitespace-nowrap">Notif. parent</TableHead>
                                  </TableRow></TableHeader>
                                  <TableBody>
                                    {clsSanctions.map(s => (
                                      <TableRow key={s.id}>
                                        <TableCell className="text-xs font-medium whitespace-nowrap">{s.studentName}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{s.fault_name}</TableCell>
                                        <TableCell className="text-xs text-right whitespace-nowrap">{s.hours_attributed}h</TableCell>
                                        <TableCell className="text-xs text-right font-bold text-red-600 whitespace-nowrap">-{s.points_deducted}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{new Date(s.sanction_date).toLocaleDateString('fr-FR')}</TableCell>
                                        <TableCell className="text-xs text-center whitespace-nowrap">
                                          {s.status === 'ACTIVE' ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold">Active</span>
                                          : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">Annulée</span>}
                                        </TableCell>
                                        <TableCell className="text-xs text-center whitespace-nowrap">
                                          <NotificationBadge status={s.notificationStatus} channels={s.notificationChannels} />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : activeTab === 'conduct' ? (
        /* ── Compteur de conduite ── */
        <ConductTab sanctions={sanctions} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          conductReference={conductSettings.conduct_reference} criticalThreshold={conductSettings.critical_threshold} />
      ) : (
        /* ── Barème des fautes ── */
        <RulesTab rules={rules} onEdit={() => {}} onDelete={() => {}} />
      )}

      {showSanctionModal && (
        <SanctionModal
          onClose={() => setShowSanctionModal(false)}
          onSuccess={() => { loadData(); setShowSanctionModal(false); }}
          rules={rules}
          academicYearId={academicYear?.id}
          schoolLevelId={schoolLevelId}
          classId={modalClassId}
          className={modalClassName}
          preselectedStudentId={modalStudentId}
          preselectedStudentName={modalStudentName}
        />
      )}
      {showRuleModal && (
        <RuleModal onClose={() => setShowRuleModal(false)} onSuccess={() => { loadData(); setShowRuleModal(false); }} />
      )}
      {showSettingsModal && (
        <ConductSettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => { loadData(); setShowSettingsModal(false); }}
          academicYearId={academicYear?.id}
          schoolLevelId={schoolLevelId}
          currentReference={conductSettings.conduct_reference}
          currentThreshold={conductSettings.critical_threshold}
        />
      )}
    </div>
  );
}

// ─── Conduct Tab ─────────────────────────────────────────────────────────

function ConductTab({ sanctions, searchQuery, setSearchQuery, conductReference, criticalThreshold }: {
  sanctions: Sanction[]; searchQuery: string; setSearchQuery: (v: string) => void;
  conductReference: number; criticalThreshold: number;
}) {
  // Calculer le compteur par élève
  const conductByStudent = useMemo(() => {
    const map = new Map<string, { studentName: string; className: string; totalDeducted: number; reference: number }>();
    for (const s of sanctions) {
      if (s.status !== 'ACTIVE') continue;
      const key = s.studentId;
      if (!map.has(key)) {
        map.set(key, { studentName: s.studentName, className: s.className, totalDeducted: 0, reference: conductReference });
      }
      map.get(key)!.totalDeducted += s.points_deducted;
    }
    return Array.from(map.values()).map(c => ({
      ...c, conduct_final: Math.max(0, c.reference - c.totalDeducted),
    })).sort((a, b) => a.conduct_final - b.conduct_final);
  }, [sanctions, conductReference]);

  const filtered = conductByStudent.filter(c =>
    !searchQuery || c.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher un élève..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader><TableRow className="bg-gray-50">
            <TableHead className="whitespace-nowrap">Élève</TableHead>
            <TableHead className="whitespace-nowrap">Classe</TableHead>
            <TableHead className="text-right whitespace-nowrap">Référence</TableHead>
            <TableHead className="text-right whitespace-nowrap">Déduits</TableHead>
            <TableHead className="text-right whitespace-nowrap">Conduite</TableHead>
            <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-gray-500 py-8">Aucune donnée. Les données apparaîtront après la première sanction.</TableCell></TableRow>
            ) : filtered.map((c, i) => {
              const isCritical = c.conduct_final <= criticalThreshold;
              const isWarning = c.conduct_final <= (conductReference / 2) && c.conduct_final > criticalThreshold;
              return (
                <TableRow key={i} className="hover:bg-slate-50">
                  <TableCell className="font-medium whitespace-nowrap">{c.studentName}</TableCell>
                  <TableCell className="whitespace-nowrap">{c.className || '—'}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">{c.reference}</TableCell>
                  <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{c.totalDeducted}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span className={cn('font-bold px-2 py-0.5 rounded',
                      isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                      {c.conduct_final}
                    </span>
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {isCritical ? <span className="text-red-600 text-xs font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Critique</span>
                    : isWarning ? <span className="text-orange-600 text-xs font-bold">Attention</span>
                    : <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────────────

function RulesTab({ rules, onEdit, onDelete }: {
  rules: DisciplineRule[]; onEdit: (rule: DisciplineRule) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader><TableRow className="bg-gray-50">
          <TableHead className="whitespace-nowrap">Faute</TableHead>
          <TableHead className="whitespace-nowrap">Description</TableHead>
          <TableHead className="text-right whitespace-nowrap">Heures</TableHead>
          <TableHead className="text-right whitespace-nowrap">Points</TableHead>
          <TableHead className="text-center whitespace-nowrap">Gravité</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-8">Aucune règle configurée. Cliquez sur "Nouvelle règle".</TableCell></TableRow>
          ) : rules.map(r => (
            <TableRow key={r.id} className="hover:bg-slate-50">
              <TableCell className="font-medium whitespace-nowrap">{r.name}</TableCell>
              <TableCell className="text-sm text-gray-600 whitespace-nowrap">{r.description || '—'}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.hours_penalty}h</TableCell>
              <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">-{r.points_deducted} pts</TableCell>
              <TableCell className="text-center whitespace-nowrap">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold border', SEVERITY_COLORS[r.severity])}>
                  {SEVERITY_LABELS[r.severity] || r.severity}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Sanction Modal ──────────────────────────────────────────────────────

function SanctionModal({ onClose, onSuccess, rules, academicYearId, schoolLevelId, classId, className, preselectedStudentId, preselectedStudentName }: {
  onClose: () => void; onSuccess: () => void; rules: DisciplineRule[];
  academicYearId?: string; schoolLevelId?: string; classId?: string | null; className?: string;
  preselectedStudentId?: string | null; preselectedStudentName?: string;
}) {
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(preselectedStudentId ? { id: preselectedStudentId, firstName: preselectedStudentName?.split(' ')[1] || '', lastName: preselectedStudentName?.split(' ')[0] || '' } : null);
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [customFaultName, setCustomFaultName] = useState('');
  const [hours, setHours] = useState(0);
  const [points, setPoints] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { toast } = useToast();

  // Si une classe est sélectionnée, filtrer les élèves par classe
  const searchStudents = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ search: query, limit: '10' });
      if (classId) params.set('classId', classId);
      const res = await fetch(`/api/students?${params}`, { headers: { ...authHeaders }, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(Array.isArray(data?.students) ? data.students : Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  // ⭐ Quand on sélectionne une règle, les heures et points sont automatiques
  const handleRuleSelect = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      setCustomFaultName(rule.name);
      setHours(rule.hours_penalty);
      setPoints(rule.points_deducted);
    }
  };

  // ⭐ Quand on change les heures manuellement, recalculer les points
  //    selon le ratio de la règle sélectionnée (points/heures)
  const handleHoursChange = (newHours: number) => {
    setHours(newHours);
    const rule = rules.find(r => r.id === selectedRuleId);
    if (rule && rule.hours_penalty > 0) {
      const ratio = rule.points_deducted / rule.hours_penalty;
      setPoints(Math.round(ratio * newHours * 100) / 100);
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !academicYearId) {
      toast({ title: 'Erreur', description: 'Sélectionnez un élève', variant: 'destructive' }); return;
    }
    if (!customFaultName.trim()) {
      toast({ title: 'Erreur', description: 'Nommez la faute', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const res = await fetch('/api/discipline/sanctions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify({
          studentId: selectedStudent.id, ruleId: selectedRuleId || null, faultName: customFaultName,
          hoursAttributed: hours, pointsDeducted: points, academicYearId,
          schoolLevelId: schoolLevelId || null, comment: comment || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: '✅ Sanction enregistrée', description: `${points} points déduits de la conduite` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
            <Gavel className="w-5 h-5" /> Nouvelle sanction
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-blue-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          {className && (
            <div className="p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
              Classe sélectionnée : <strong>{className}</strong>
            </div>
          )}
          {/* Student search */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Élève {className && `(filtré: ${className})`}</label>
            {selectedStudent ? (
              <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">{selectedStudent.lastName} {selectedStudent.firstName}</span>
                <button onClick={() => { setSelectedStudent(null); setStudentSearch(''); }} className="text-xs text-red-500">Changer</button>
              </div>
            ) : (
              <>
                <input type="text" value={studentSearch}
                  onChange={(e) => { setStudentSearch(e.target.value); searchStudents(e.target.value); }}
                  placeholder="Nom de l'élève..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map(s => (
                      <button key={s.id} onClick={() => { setSelectedStudent(s); setSearchResults([]); setStudentSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm">{s.lastName} {s.firstName} — {s.className || ''}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          {/* Rule selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Faute (barème)</label>
            <select value={selectedRuleId} onChange={(e) => handleRuleSelect(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="">— Personnalisée —</option>
              {rules.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.hours_penalty}h, -{r.points_deducted}pts)</option>
              ))}
            </select>
          </div>
          {/* Custom fault name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la faute</label>
            <input type="text" value={customFaultName} onChange={(e) => setCustomFaultName(e.target.value)}
              placeholder="Ex: Retard, Bavardage..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          {/* Hours + Points — points sont automatiques selon le barème */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heures de punition</label>
              <input type="number" value={hours} onChange={(e) => handleHoursChange(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Points déduits {selectedRuleId && '(auto)'}</label>
              <input type="number" step="0.5" value={points} readOnly={!!selectedRuleId}
                onChange={(e) => setPoints(Number(e.target.value) || 0)}
                className={cn('w-full px-3 py-2 text-sm border rounded-lg', selectedRuleId ? 'bg-gray-50 text-gray-600 border-gray-200' : 'border-gray-300')} />
            </div>
          </div>
          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving || !selectedStudent} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />} Enregistrer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Rule Modal (CRUD barème) ────────────────────────────────────────────

function RuleModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void; }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState(0);
  const [points, setPoints] = useState(0);
  const [severity, setSeverity] = useState('MINOR');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) { toast({ title: 'Erreur', description: 'Le nom est requis', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const res = await fetch('/api/discipline/rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, credentials: 'include',
        body: JSON.stringify({ name, description, hours_penalty: hours, points_deducted: points, severity }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: '✅ Règle créée', description: `${name} — ${hours}h, -${points}pts` });
      onSuccess();
    } catch (err: any) { toast({ title: 'Erreur', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b bg-amber-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2"><Settings className="w-5 h-5" /> Nouvelle règle de faute</h3>
          <button onClick={onClose} className="p-1 hover:bg-amber-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de la faute</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Retard, Bagarre..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optionnel)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Heures de punition</label>
              <input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Points déduits</label>
              <input type="number" step="0.5" value={points} onChange={(e) => setPoints(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gravité</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
              <option value="MINOR">Mineure</option>
              <option value="MODERATE">Modérée</option>
              <option value="MAJOR">Grave</option>
              <option value="CRITICAL">Critique</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Créer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Search Bar ──────────────────────────────────────────────────────────

function SearchBar({ searchQuery, setSearchQuery, placeholder }: {
  searchQuery: string; setSearchQuery: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

// ─── Notification Badge (WhatsApp/SMS status) ────────────────────────────

function NotificationBadge({ status, channels }: {
  status?: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  channels?: { whatsapp?: string; sms?: string; event?: string };
}) {
  if (!status) {
    return <span className="text-[10px] text-gray-400">—</span>;
  }

  const config: Record<string, { label: string; cls: string; icon: string }> = {
    PENDING: { label: 'En cours', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300', icon: '⏳' },
    SENT: { label: 'Envoyé', cls: 'bg-green-100 text-green-700 border-green-300', icon: '✓' },
    FAILED: { label: 'Échec', cls: 'bg-red-100 text-red-700 border-red-300', icon: '✕' },
    SKIPPED: { label: 'Ignoré', cls: 'bg-gray-100 text-gray-500 border-gray-300', icon: '—' },
  };

  const c = config[status] || config.PENDING;

  // Tooltip : détail par canal
  const tooltip = channels
    ? `WhatsApp: ${channels.whatsapp || '—'} | SMS: ${channels.sms || '—'}${channels.event ? ` | ${channels.event === 'created' ? 'Création' : 'Annulation'}` : ''}`
    : '';

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${c.cls}`}
      title={tooltip}
    >
      <span>{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
}

// ─── Conduct Settings Modal ─────────────────────────────────────────────────
//
// ⭐ Permet à l'école de configurer la moyenne de conduite (baseline) et le
//    seuil critique. Sauvegardé via PUT /api/discipline/conduct (qui proxy vers
//    PUT /discipline/conduct/settings côté backend).

function ConductSettingsModal({ onClose, onSuccess, academicYearId, schoolLevelId, currentReference, currentThreshold }: {
  onClose: () => void; onSuccess: () => void;
  academicYearId?: string; schoolLevelId?: string;
  currentReference: number; currentThreshold: number;
}) {
  const [conductReference, setConductReference] = useState(currentReference);
  const [criticalThreshold, setCriticalThreshold] = useState(currentThreshold);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!academicYearId) { toast({ title: 'Erreur', description: 'Année académique requise', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const res = await fetch('/api/discipline/conduct/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({
          academicYearId,
          schoolLevelId: schoolLevelId || null,
          conduct_reference: conductReference,
          critical_threshold: criticalThreshold,
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      toast({ title: '✅ Paramètres sauvegardés', description: `Moyenne de conduite: ${conductReference}/20 · Seuil critique: ${criticalThreshold}` });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b bg-slate-50 rounded-t-xl">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5" /> Paramètres de conduite
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moyenne de conduite (baseline)</label>
            <p className="text-xs text-gray-500 mb-2">Note de départ de chaque élève (généralement 17, mais configurable par l'école).</p>
            <input type="number" min={1} max={20} step={0.5} value={conductReference}
              onChange={(e) => setConductReference(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seuil critique</label>
            <p className="text-xs text-gray-500 mb-2">En dessous de ce seuil, la conduite de l'élève est considérée comme critique (affichage en rouge).</p>
            <input type="number" min={0} max={20} step={0.5} value={criticalThreshold}
              onChange={(e) => setCriticalThreshold(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
            <strong>Règle de calcul :</strong> Conduite = Moyenne de conduite − Σ points déduits (sanctions actives).
            <br/>Au niveau du bulletin, une ligne « Conduite » sera ajoutée avec cette note.
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50 rounded-b-xl">
          <Button onClick={onClose} variant="outline" className="px-4 py-2">Annuler</Button>
          <Button onClick={handleSave} disabled={saving}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Settings className="w-4 h-4 mr-2" />}
            Sauvegarder
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
