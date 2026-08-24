'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck, Calendar, FileText, Users, Gavel, AlertTriangle,
  Plus, Loader2, Search, X, CheckCircle2,
  Eye, BookOpen, Award, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import ExamFraudWorkspace from './ExamFraudWorkspace';

interface ClassVisit {
  id: string;
  className: string;
  teacherName: string;
  subjectName: string;
  visitDate: string;
  status: 'PLANNED' | 'DONE' | 'CANCELLED';
  observations?: string;
  rating?: number;
}

interface ExamSchedule {
  id: string;
  className: string;
  subjectName: string;
  examType: string;
  examDate: string;
  duration: number;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface ClassCouncil {
  id: string;
  className: string;
  quarterName: string;
  councilDate: string;
  status: 'PLANNED' | 'DONE';
  averageClass?: number;
  topStudent?: string;
  remarksCount: number;
}

interface AcademicSanction {
  id: string;
  studentName: string;
  className: string;
  faultType: string;
  description: string;
  date: string;
  status: string;
  pointsDeducted: number;
}

const TABS = [
  { id: 'overview', label: 'Vue d\'ensemble', icon: ClipboardCheck },
  { id: 'visits', label: 'Visites de classes', icon: Eye },
  { id: 'exams', label: 'Calendrier des évaluations', icon: Calendar },
  { id: 'councils', label: 'Conseils de classe', icon: Users },
  { id: 'sanctions', label: 'Discipline pédagogique', icon: Gavel },
  // ⭐ Fraudes aux examens — workflow séparé des sanctions comportementales (SG)
  //    Sanctions pédagogiques : GRADE_NULLIFIED, RETAKE_EXAM, ZERO, WARNING, PARENT_SUMMONS
  { id: 'frauds', label: 'Fraudes aux examens', icon: AlertTriangle },
] as const;

export default function CensorWorkspace({
  tenant,
  academicYear,
  schoolLevelId,
}: {
  tenant?: any;
  academicYear?: any;
  schoolLevelId?: string;
}) {
  const [activeTab, setActiveTab] = useState<typeof TABS[number]['id']>('overview');
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<ClassVisit[]>([]);
  const [examSchedule, setExamSchedule] = useState<ExamSchedule[]>([]);
  const [councils, setCouncils] = useState<ClassCouncil[]>([]);
  const [sanctions, setSanctions] = useState<AcademicSanction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  // ⭐ authHeaders au niveau du composant — réutilisable par les onglets (ExamFraudWorkspace)
  const authHeaders = getClientAuthorizationHeader();

  const loadData = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (schoolLevelId) params.set('schoolLevelId', schoolLevelId);

      // Load data in parallel — endpoints may not all exist yet, catch errors silently
      const [visitsRes, examsRes, councilsRes, sanctionsRes] = await Promise.all([
        fetch(`/api/censeur/visits?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/censeur/exams?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/censeur/councils?${params}`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
        fetch(`/api/discipline/sanctions?${params}&type=ACADEMIC`, { headers: { ...authHeaders }, credentials: 'include' }).catch(() => null),
      ]);

      if (visitsRes?.ok) { const d = await visitsRes.json(); setVisits(Array.isArray(d) ? d : []); }
      if (examsRes?.ok) { const d = await examsRes.json(); setExamSchedule(Array.isArray(d) ? d : []); }
      if (councilsRes?.ok) { const d = await councilsRes.json(); setCouncils(Array.isArray(d) ? d : []); }
      if (sanctionsRes?.ok) { const d = await sanctionsRes.json(); setSanctions(Array.isArray(d) ? d : []); }
    } catch (err) {
      console.error('[Censeur] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevelId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Stats for overview ──
  const stats = {
    visitsPlanned: visits.filter(v => v.status === 'PLANNED').length,
    visitsDone: visits.filter(v => v.status === 'DONE').length,
    examsPlanned: examSchedule.filter(e => e.status === 'PLANNED').length,
    councilsPlanned: councils.filter(c => c.status === 'PLANNED').length,
    councilsDone: councils.filter(c => c.status === 'DONE').length,
    academicSanctions: sanctions.filter(s => s.status === 'ACTIVE').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-blue-600" />
          Espace Censeur
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Organisation pédagogique, suivi des enseignants, conseils de classe et discipline pédagogique
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
              activeTab === tab.id
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : activeTab === 'overview' ? (
        /* ── Overview : cartes de stats ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title="Visites de classes"
            value={`${stats.visitsDone} faites`}
            subtitle={`${stats.visitsPlanned} planifiées`}
            icon={Eye}
            color="blue"
            onClick={() => setActiveTab('visits')}
          />
          <StatCard
            title="Évaluations"
            value={`${stats.examsPlanned} à venir`}
            subtitle="Calendrier des devoirs"
            icon={Calendar}
            color="amber"
            onClick={() => setActiveTab('exams')}
          />
          <StatCard
            title="Conseils de classe"
            value={`${stats.councilsDone} faits`}
            subtitle={`${stats.councilsPlanned} planifiés`}
            icon={Users}
            color="green"
            onClick={() => setActiveTab('councils')}
          />
          <StatCard
            title="Discipline pédagogique"
            value={`${stats.academicSanctions} actives`}
            subtitle="Devoirs non faits, fraude..."
            icon={Gavel}
            color="red"
            onClick={() => setActiveTab('sanctions')}
          />
          <StatCard
            title="Documents pédagogiques"
            value="—"
            subtitle="Fiches, cahiers journaux"
            icon={FileText}
            color="purple"
            onClick={() => toast({ title: 'Bientôt disponible', description: 'Module en cours de développement' })}
          />
          <StatCard
            title="Emplois du temps"
            value="—"
            subtitle="Organisation des cours"
            icon={Clock}
            color="indigo"
            onClick={() => toast({ title: 'Bientôt disponible', description: 'Module en cours de développement' })}
          />
        </div>
      ) : activeTab === 'visits' ? (
        /* ── Visites de classes ── */
        <VisitsTab visits={visits} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      ) : activeTab === 'exams' ? (
        /* ── Calendrier des évaluations ── */
        <ExamsTab exams={examSchedule} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      ) : activeTab === 'councils' ? (
        /* ── Conseils de classe ── */
        <CouncilsTab councils={councils} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      ) : activeTab === 'sanctions' ? (
        /* ── Discipline pédagogique ── */
        <SanctionsTab sanctions={sanctions} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      ) : activeTab === 'frauds' ? (
        /* ── Fraudes aux examens — workflow séparé ── */
        <ExamFraudWorkspace
          tenant={tenant}
          academicYear={academicYear}
          authHeaders={authHeaders}
        />
      ) : null}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color, onClick }: {
  title: string; value: string; subtitle: string;
  icon: any; color: string; onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };
  return (
    <button
      onClick={onClick}
      className={cn('p-4 rounded-xl border text-left transition-all hover:shadow-md', colorMap[color])}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-1">{title}</div>
      <div className="text-xs opacity-70 mt-0.5">{subtitle}</div>
    </button>
  );
}

// ─── Visites Tab ─────────────────────────────────────────────────────────

function VisitsTab({ visits, searchQuery, setSearchQuery }: {
  visits: ClassVisit[]; searchQuery: string; setSearchQuery: (v: string) => void;
}) {
  const filtered = visits.filter(v =>
    !searchQuery ||
    v.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.subjectName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher une classe, un enseignant..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Enseignant</TableHead>
              <TableHead className="whitespace-nowrap">Matière</TableHead>
              <TableHead className="whitespace-nowrap">Date visite</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
              <TableHead className="whitespace-nowrap">Observations</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Aucune visite de classe planifiée.
                </TableCell>
              </TableRow>
            ) : filtered.map(v => (
              <TableRow key={v.id} className="hover:bg-slate-50">
                <TableCell className="font-medium whitespace-nowrap">{v.className}</TableCell>
                <TableCell className="whitespace-nowrap">{v.teacherName || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{v.subjectName || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {v.visitDate ? new Date(v.visitDate).toLocaleDateString('fr-FR') : '—'}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {v.status === 'DONE' ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Faite</span>
                  ) : v.status === 'PLANNED' ? (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Planifiée</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Annulée</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={v.observations || ''}>
                  {v.observations || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Exams Tab ───────────────────────────────────────────────────────────

function ExamsTab({ exams, searchQuery, setSearchQuery }: {
  exams: ExamSchedule[]; searchQuery: string; setSearchQuery: (v: string) => void;
}) {
  const filtered = exams.filter(e =>
    !searchQuery ||
    e.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.subjectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.examType?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher une classe, une matière..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Matière</TableHead>
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="text-right whitespace-nowrap">Durée</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  Aucune évaluation planifiée.
                </TableCell>
              </TableRow>
            ) : filtered.map(e => (
              <TableRow key={e.id} className="hover:bg-slate-50">
                <TableCell className="font-medium whitespace-nowrap">{e.className}</TableCell>
                <TableCell className="whitespace-nowrap">{e.subjectName || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">{e.examType || 'Devoir'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {e.examDate ? new Date(e.examDate).toLocaleDateString('fr-FR') : '—'}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">{e.duration}h</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {e.status === 'COMPLETED' ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Terminé</span>
                  ) : e.status === 'IN_PROGRESS' ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">En cours</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Planifié</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Councils Tab ────────────────────────────────────────────────────────

function CouncilsTab({ councils, searchQuery, setSearchQuery }: {
  councils: ClassCouncil[]; searchQuery: string; setSearchQuery: (v: string) => void;
}) {
  const filtered = councils.filter(c =>
    !searchQuery ||
    c.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.quarterName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher une classe..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Trimestre</TableHead>
              <TableHead className="whitespace-nowrap">Date conseil</TableHead>
              <TableHead className="text-right whitespace-nowrap">Moyenne classe</TableHead>
              <TableHead className="whitespace-nowrap">Meilleur élève</TableHead>
              <TableHead className="text-right whitespace-nowrap">Remarques</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  Aucun conseil de classe planifié.
                </TableCell>
              </TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="hover:bg-slate-50">
                <TableCell className="font-medium whitespace-nowrap">{c.className}</TableCell>
                <TableCell className="whitespace-nowrap">{c.quarterName || '—'}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {c.councilDate ? new Date(c.councilDate).toLocaleDateString('fr-FR') : '—'}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {c.averageClass ? (
                    <span className={cn('font-bold', c.averageClass >= 10 ? 'text-green-600' : 'text-red-600')}>
                      {c.averageClass.toFixed(2)}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.topStudent || '—'}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{c.remarksCount || 0}</TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {c.status === 'DONE' ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">Fait</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Planifié</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Sanctions Tab (discipline pédagogique) ──────────────────────────────

function SanctionsTab({ sanctions, searchQuery, setSearchQuery }: {
  sanctions: AcademicSanction[]; searchQuery: string; setSearchQuery: (v: string) => void;
}) {
  const filtered = sanctions.filter(s =>
    !searchQuery ||
    s.studentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.faultType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.className?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const FAULT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    MISSING_HOMEWORK: { label: 'Devoir non fait', color: 'bg-yellow-100 text-yellow-800' },
    EXAM_ABSENCE: { label: 'Absence à une évaluation', color: 'bg-orange-100 text-orange-800' },
    EXAM_FRAUD: { label: 'Fraude à un examen', color: 'bg-red-100 text-red-800' },
    LATE_SUBMISSION: { label: 'Rendu en retard', color: 'bg-yellow-100 text-yellow-800' },
    OTHER: { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
        <strong>Discipline pédagogique :</strong> Les fautes liées au travail scolaire (devoirs non faits,
        absentéisme aux évaluations, fraude). Les fautes de comportement (bagarres, insolence) sont gérées
        par le Surveillant Général dans le module Vie Scolaire.
      </div>
      <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} placeholder="Rechercher un élève..." />
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Type de faute</TableHead>
              <TableHead className="whitespace-nowrap">Description</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="text-right whitespace-nowrap">Points</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  Aucune sanction pédagogique enregistrée.
                </TableCell>
              </TableRow>
            ) : filtered.map(s => {
              const faultInfo = FAULT_TYPE_LABELS[s.faultType] || FAULT_TYPE_LABELS.OTHER;
              return (
                <TableRow key={s.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium whitespace-nowrap">{s.studentName}</TableCell>
                  <TableCell className="whitespace-nowrap">{s.className || '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold', faultInfo.color)}>
                      {faultInfo.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={s.description}>
                    {s.description || '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.date ? new Date(s.date).toLocaleDateString('fr-FR') : '—'}
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600 whitespace-nowrap">
                    -{s.pointsDeducted}
                  </TableCell>
                  <TableCell className="text-center whitespace-nowrap">
                    {s.status === 'ACTIVE' ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">Annulée</span>
                    )}
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

// ─── Search Bar ──────────────────────────────────────────────────────────

function SearchBar({ searchQuery, setSearchQuery, placeholder }: {
  searchQuery: string; setSearchQuery: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
