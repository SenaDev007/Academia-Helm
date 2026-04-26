'use client';

import { useState, useEffect, useCallback } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import {
  FileText,
  Users,
  Layers,
  Loader2,
  AlertCircle,
  BookOpen,
  ClipboardList,
  BarChart3,
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ControlDashboard {
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  overallRate: number;
  totalActiveAssignments: number;
  totalActiveProfiles: number;
  lastCalculatedAt: string | null;
  snapshotsCount: number;
}

interface SubmittedDocument {
  id: string;
  documentType: string;
  status: string;
  title?: string;
  submittedAt: string;
  teacher?: { firstName: string; lastName: string };
  class?: { name: string };
  academicYear?: { name: string };
}

interface SubmittedSemainier {
  id: string;
  status: string;
  weekStartDate: string;
  weekEndDate: string;
  submittedAt?: string;
  assignment?: {
    teacher?: { firstName: string; lastName: string };
    schoolLevel?: { name: string };
  };
}

interface KpiSnapshot {
  id: string;
  createdAt: string;
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  teacher?: { firstName: string; lastName: string };
  class?: { name: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  LESSON_PLAN: 'Fiche de cours',
  DAILY_LOG: 'Cahier journal',
  CLASS_DIARY: 'Cahier de texte',
  SEMAINIER: 'Semainier',
};

const DOC_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  ACKNOWLEDGED: 'bg-purple-100 text-purple-800',
};

const SEM_STATUS_COLORS: Record<string, string> = {
  SOUMIS: 'bg-blue-100 text-blue-800',
  VALIDATED: 'bg-green-100 text-green-800',
  EN_COURS: 'bg-yellow-100 text-yellow-800',
};

// ─── Sub-section components ───────────────────────────────────────────────────

function RejectModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Motif de rejet</h3>
        <textarea
          className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 h-24 resize-none"
          placeholder="Saisissez le motif obligatoire…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            Confirmer le rejet
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ControlPage() {
  const { academicYear } = useModuleContext();

  // KPI Dashboard
  const [dashboard, setDashboard] = useState<ControlDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Documents soumis
  const [documents, setDocuments] = useState<SubmittedDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Semainiers soumis
  const [semainiers, setSemainiers] = useState<SubmittedSemainier[]>([]);
  const [semainiersLoading, setSemainiersLoading] = useState(false);
  const [semainiersError, setSemainiersError] = useState<string | null>(null);

  // Snapshots
  const [snapshots, setSnapshots] = useState<KpiSnapshot[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    if (!academicYear?.id) { setDashboard(null); return; }
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const data = await pedagogyFetch<ControlDashboard>(
        `/api/pedagogy/control/dashboard?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setDashboard(data);
    } catch (e) {
      setDashboardError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setDashboardLoading(false);
    }
  }, [academicYear?.id]);

  const loadDocuments = useCallback(async () => {
    if (!academicYear?.id) { setDocuments([]); return; }
    setDocsLoading(true);
    setDocsError(null);
    try {
      const data = await pedagogyFetch<SubmittedDocument[]>(
        `/api/pedagogy/director/documents/submitted?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setDocsLoading(false);
    }
  }, [academicYear?.id]);

  const loadSemainiers = useCallback(async () => {
    if (!academicYear?.id) { setSemainiers([]); return; }
    setSemainiersLoading(true);
    setSemainiersError(null);
    try {
      const data = await pedagogyFetch<SubmittedSemainier[]>(
        `/api/pedagogy/director/semainier/submitted?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setSemainiers(Array.isArray(data) ? data : []);
    } catch (e) {
      setSemainiersError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setSemainiersLoading(false);
    }
  }, [academicYear?.id]);

  const loadSnapshots = useCallback(async () => {
    if (!academicYear?.id) { setSnapshots([]); return; }
    setSnapshotsLoading(true);
    setSnapshotsError(null);
    try {
      const data = await pedagogyFetch<KpiSnapshot[]>(
        `/api/pedagogy/control/snapshots?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (e) {
      setSnapshotsError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setSnapshotsLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadSemainiers(); }, [loadSemainiers]);
  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  // ── Document actions ────────────────────────────────────────────────────────

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await pedagogyFetch(`/api/pedagogy/director/documents/${id}/approve`, {
        method: 'POST',
        body: {},
      });
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcknowledge = async (id: string) => {
    setActionLoading(id);
    try {
      await pedagogyFetch(`/api/pedagogy/director/documents/${id}/acknowledge`, {
        method: 'POST',
        body: {},
      });
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget);
    setRejectTarget(null);
    try {
      await pedagogyFetch(`/api/pedagogy/director/documents/${rejectTarget}/reject`, {
        method: 'POST',
        body: { rejectionReason: reason },
      });
      await loadDocuments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const handleValidateSemainier = async (id: string) => {
    setActionLoading(id);
    try {
      await pedagogyFetch(`/api/pedagogy/director/semainier/${id}/validate`, {
        method: 'POST',
        body: {},
      });
      await loadSemainiers();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const formatRate = (rate: number) => `${Math.round(rate * 100)} %`;

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <>
      {rejectTarget && (
        <RejectModal
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <ModuleContainer
        header={{
          title: 'Contrôle pédagogique direction',
          description: 'Vue consolidée, KPI, validation des documents et semainiers',
          icon: 'bookOpen',
        }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
          }),
        }}
        content={{
          layout: 'custom',
          children: (
            <Tabs defaultValue="kpi" className="space-y-6">
              <TabsList>
                <TabsTrigger value="kpi">Tableau de bord KPI</TabsTrigger>
                <TabsTrigger value="documents">
                  Documents soumis
                  {documents.filter(d => d.status === 'SUBMITTED').length > 0 && (
                    <span className="ml-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                      {documents.filter(d => d.status === 'SUBMITTED').length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="semainiers">
                  Semainiers soumis
                  {semainiers.filter(s => s.status === 'SOUMIS').length > 0 && (
                    <span className="ml-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                      {semainiers.filter(s => s.status === 'SOUMIS').length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="snapshots">Historique KPI</TabsTrigger>
              </TabsList>

              {/* ── Tab 1 : KPI Dashboard ───────────────────────────────── */}
              <TabsContent value="kpi" className="space-y-6">
                {dashboardError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {dashboardError}
                  </div>
                )}
                {!academicYear?.id ? (
                  <p className="text-gray-500">Sélectionnez une année scolaire pour afficher le tableau de bord.</p>
                ) : dashboardLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Chargement…
                  </div>
                ) : dashboard ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: 'Fiches / plans', rate: dashboard.lessonPlanRate, icon: FileText, color: 'blue' },
                        { label: 'Cahier journal', rate: dashboard.journalRate, icon: BookOpen, color: 'amber' },
                        { label: 'Cahier de texte', rate: dashboard.classLogRate, icon: ClipboardList, color: 'green' },
                        { label: 'Semainier', rate: dashboard.weeklyReportRate, icon: Calendar, color: 'purple' },
                      ].map(({ label, rate, icon: Icon, color }) => (
                        <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-lg bg-${color}-100 p-2`}>
                              <Icon className={`h-6 w-6 text-${color}-600`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-500">{label}</p>
                              <p className="text-xl font-semibold text-gray-900">{formatRate(rate)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        <div>
                          <p className="font-medium text-gray-900">Taux global</p>
                          <p className="text-2xl font-semibold text-indigo-600">{formatRate(dashboard.overallRate)}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                        <Users className="w-8 h-8 text-amber-600" />
                        <div>
                          <p className="font-medium text-gray-900">Enseignants actifs</p>
                          <p className="text-2xl font-semibold text-gray-700">{dashboard.totalActiveProfiles}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border p-4 flex items-center gap-3 bg-white">
                        <Layers className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium text-gray-900">Affectations actives</p>
                          <p className="text-2xl font-semibold text-gray-700">{dashboard.totalActiveAssignments}</p>
                        </div>
                      </div>
                    </div>

                    {dashboard.lastCalculatedAt && (
                      <p className="text-sm text-gray-500">
                        Dernier calcul KPI :{' '}
                        {new Date(dashboard.lastCalculatedAt).toLocaleString('fr-FR')}
                        {dashboard.snapshotsCount > 0 && ` (${dashboard.snapshotsCount} snapshot(s))`}
                      </p>
                    )}
                  </>
                ) : null}
              </TabsContent>

              {/* ── Tab 2 : Documents soumis ────────────────────────────── */}
              <TabsContent value="documents" className="space-y-4">
                {docsError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {docsError}
                  </div>
                )}
                {!academicYear?.id ? (
                  <p className="text-gray-500">Sélectionnez une année scolaire.</p>
                ) : docsLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Chargement…
                  </div>
                ) : documents.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                    Aucun document soumis pour cette année scolaire.
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Titre</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Enseignant</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Classe</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Soumis le</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                                {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-800 font-medium">{doc.title ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {doc.teacher
                                ? `${doc.teacher.firstName} ${doc.teacher.lastName}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{doc.class?.name ?? '—'}</td>
                            <td className="px-4 py-3 text-gray-500">{fmtDate(doc.submittedAt)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOC_STATUS_COLORS[doc.status] ?? 'bg-gray-100 text-gray-700'}`}
                              >
                                {doc.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {doc.status === 'SUBMITTED' && (
                                <div className="flex justify-end gap-1">
                                  {doc.documentType === 'CLASS_DIARY' ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-purple-700 border-purple-300 hover:bg-purple-50"
                                      disabled={actionLoading === doc.id}
                                      onClick={() => handleAcknowledge(doc.id)}
                                    >
                                      {actionLoading === doc.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Eye className="h-3 w-3 mr-1" />
                                      )}
                                      Prendre en compte
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-green-700 border-green-300 hover:bg-green-50"
                                        disabled={actionLoading === doc.id}
                                        onClick={() => handleApprove(doc.id)}
                                      >
                                        {actionLoading === doc.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                        )}
                                        Approuver
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-700 border-red-300 hover:bg-red-50"
                                        disabled={actionLoading === doc.id}
                                        onClick={() => setRejectTarget(doc.id)}
                                      >
                                        <XCircle className="h-3 w-3 mr-1" />
                                        Rejeter
                                      </Button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab 3 : Semainiers soumis ───────────────────────────── */}
              <TabsContent value="semainiers" className="space-y-4">
                {semainiersError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {semainiersError}
                  </div>
                )}
                {!academicYear?.id ? (
                  <p className="text-gray-500">Sélectionnez une année scolaire.</p>
                ) : semainiersLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Chargement…
                  </div>
                ) : semainiers.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                    Aucun semainier soumis pour cette année scolaire.
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Enseignant</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Niveau</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Semaine du</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Au</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {semainiers.map((sem) => (
                          <tr key={sem.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {sem.assignment?.teacher
                                ? `${sem.assignment.teacher.firstName} ${sem.assignment.teacher.lastName}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {sem.assignment?.schoolLevel?.name ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">{fmtDate(sem.weekStartDate)}</td>
                            <td className="px-4 py-3 text-gray-600">{fmtDate(sem.weekEndDate)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEM_STATUS_COLORS[sem.status] ?? 'bg-gray-100 text-gray-700'}`}
                              >
                                {sem.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {sem.status === 'SOUMIS' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  disabled={actionLoading === sem.id}
                                  onClick={() => handleValidateSemainier(sem.id)}
                                >
                                  {actionLoading === sem.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                  )}
                                  Valider
                                </Button>
                              )}
                              {sem.status === 'VALIDATED' && (
                                <span className="text-green-600 text-xs font-medium flex items-center gap-1 justify-end">
                                  <CheckCircle className="h-3 w-3" />
                                  Validé
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              {/* ── Tab 4 : Snapshots KPI ───────────────────────────────── */}
              <TabsContent value="snapshots" className="space-y-4">
                {snapshotsError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {snapshotsError}
                  </div>
                )}
                {!academicYear?.id ? (
                  <p className="text-gray-500">Sélectionnez une année scolaire.</p>
                ) : snapshotsLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Chargement…
                  </div>
                ) : snapshots.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-gray-500">
                    Aucun snapshot KPI enregistré pour cette année scolaire.
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-600">Enseignant / Classe</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Fiches</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Journal</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Texte</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-600">Semainier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {snapshots.map((snap) => (
                          <tr key={snap.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-400" />
                                {new Date(snap.createdAt).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {snap.teacher
                                ? `${snap.teacher.firstName} ${snap.teacher.lastName}`
                                : snap.class?.name ?? 'Global'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-blue-600">
                              {formatRate(snap.lessonPlanRate)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-amber-600">
                              {formatRate(snap.journalRate)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-green-600">
                              {formatRate(snap.classLogRate)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-purple-600">
                              {formatRate(snap.weeklyReportRate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ),
        }}
      />
    </>
  );
}
