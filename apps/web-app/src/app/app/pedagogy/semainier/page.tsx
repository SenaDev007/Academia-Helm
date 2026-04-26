'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, AlertTriangle, Send, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface DailyEntry {
  id: string;
  date: string;
  observations?: string;
  actions?: string;
}

interface Incident {
  id: string;
  date: string;
  type: string;
  description: string;
  severity: string;
  actions?: string;
}

interface Semainier {
  id: string;
  status: 'EN_COURS' | 'SOUMIS' | 'VALIDATED';
  content: string;
  weekStartDate: string;
  weekEndDate: string;
  dailyEntries: DailyEntry[];
  incidents: Incident[];
}

interface CurrentAssignment {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  teacher: { id: string; firstName: string; lastName: string };
  semainier: Semainier | null;
}

const INCIDENT_TYPES = [
  { value: 'ABSENCE', label: 'Absence' },
  { value: 'RETARD', label: 'Retard' },
  { value: 'DISCIPLINE', label: 'Discipline' },
  { value: 'SECURITY', label: 'Sécurité' },
  { value: 'OTHER', label: 'Autre' },
];

const SEVERITY_LEVELS = [
  { value: 'LOW', label: 'Faible', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Moyen', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'Élevé', color: 'bg-orange-100 text-orange-800' },
  { value: 'CRITICAL', label: 'Critique', color: 'bg-red-100 text-red-800' },
];

export default function SemainierPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [assignment, setAssignment] = useState<CurrentAssignment | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entryModal, setEntryModal] = useState(false);
  const [entryForm, setEntryForm] = useState({ date: new Date().toISOString().split('T')[0], observations: '', actions: '' });
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const [incidentModal, setIncidentModal] = useState(false);
  const [incidentForm, setIncidentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'ABSENCE',
    description: '',
    severity: 'LOW',
    actions: '',
  });
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [incidentError, setIncidentError] = useState<string | null>(null);

  const [createBusy, setCreateBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  const loadCurrent = useCallback(async () => {
    if (!academicYear?.id || !schoolLevel?.id) { setAssignment(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await pedagogyFetch<CurrentAssignment | null>(
        `/api/pedagogy/teacher/semainier/current?academicYearId=${academicYear.id}&schoolLevelId=${schoolLevel.id}`
      );
      setAssignment(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
      setAssignment(null);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, schoolLevel?.id]);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  const handleCreateSemainier = async () => {
    if (!assignment || !academicYear || !schoolLevel) return;
    setCreateBusy(true);
    try {
      await pedagogyFetch('/api/pedagogy/teacher/semainier', {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
          assignmentId: assignment.id,
          content: '',
        },
      });
      await loadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur création');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleAddEntry = async () => {
    if (!assignment?.semainier) return;
    setEntryBusy(true);
    setEntryError(null);
    try {
      await pedagogyFetch(`/api/pedagogy/teacher/semainier/${assignment.semainier.id}/daily-entries`, {
        method: 'POST',
        body: { date: entryForm.date, observations: entryForm.observations || undefined, actions: entryForm.actions || undefined },
      });
      setEntryModal(false);
      await loadCurrent();
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setEntryBusy(false);
    }
  };

  const handleReportIncident = async () => {
    if (!assignment?.semainier) return;
    if (!incidentForm.description.trim()) { setIncidentError('La description est requise.'); return; }
    setIncidentBusy(true);
    setIncidentError(null);
    try {
      await pedagogyFetch(`/api/pedagogy/teacher/semainier/${assignment.semainier.id}/incidents`, {
        method: 'POST',
        body: { date: incidentForm.date, type: incidentForm.type, description: incidentForm.description, severity: incidentForm.severity, actions: incidentForm.actions || undefined },
      });
      setIncidentModal(false);
      await loadCurrent();
    } catch (e) {
      setIncidentError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setIncidentBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!assignment?.semainier) return;
    if (!confirm('Soumettre ce semainier à la direction ?')) return;
    setSubmitBusy(true);
    try {
      await pedagogyFetch(`/api/pedagogy/teacher/semainier/${assignment.semainier.id}/submit`, { method: 'POST' });
      await loadCurrent();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur soumission');
    } finally {
      setSubmitBusy(false);
    }
  };

  const semainier = assignment?.semainier ?? null;
  const isEditable = semainier?.status === 'EN_COURS';

  const statusBadge = (status: string) => {
    if (status === 'SOUMIS') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Soumis</span>;
    if (status === 'VALIDATED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" />Validé</span>;
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">En cours</span>;
  };

  const severityBadge = (sev: string) => {
    const s = SEVERITY_LEVELS.find(l => l.value === sev);
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${s?.color ?? 'bg-gray-100 text-gray-700'}`}>{s?.label ?? sev}</span>;
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Cahier du semainier',
          description: 'Suivi hebdomadaire, entrées quotidiennes, soumission à la direction',
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
            <div className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {!academicYear?.id || !schoolLevel?.id ? (
                <p className="text-gray-500">Sélectionnez une année scolaire et un niveau pour afficher le semainier.</p>
              ) : loading ? (
                <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div>
              ) : assignment === null ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
                  <CalendarDays className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">Vous n'êtes pas désigné(e) semainier cette semaine.</p>
                  <p className="text-sm text-gray-400 mt-1">La désignation est effectuée par la direction en début de semaine.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Header semaine */}
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">
                          Semaine {assignment?.weekNumber} — {new Date(assignment?.weekStartDate ?? '').toLocaleDateString('fr-FR')} au {new Date(assignment?.weekEndDate ?? '').toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-500">
                          Semainier : {assignment?.teacher?.lastName} {assignment?.teacher?.firstName}
                        </p>
                        {semainier && <div className="mt-1">{statusBadge(semainier.status)}</div>}
                      </div>
                      {!semainier && (
                        <button
                          onClick={handleCreateSemainier}
                          disabled={createBusy}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {createBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Ouvrir le semainier
                        </button>
                      )}
                      {semainier && isEditable && (
                        <button
                          onClick={handleSubmit}
                          disabled={submitBusy}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {submitBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          Soumettre à la direction
                        </button>
                      )}
                    </div>
                  </div>

                  {semainier && (
                    <>
                      {/* Entrées quotidiennes */}
                      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">Entrées quotidiennes</h3>
                          {isEditable && (
                            <button
                              onClick={() => { setEntryForm({ date: new Date().toISOString().split('T')[0], observations: '', actions: '' }); setEntryError(null); setEntryModal(true); }}
                              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              <Plus className="w-4 h-4" /> Ajouter
                            </button>
                          )}
                        </div>
                        {semainier.dailyEntries.length === 0 ? (
                          <p className="px-4 py-6 text-center text-gray-400 text-sm">Aucune entrée quotidienne</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {semainier.dailyEntries.map((e) => (
                              <li key={e.id} className="px-4 py-3">
                                <p className="text-sm font-medium text-gray-900">{new Date(e.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                                {e.observations && <p className="text-sm text-gray-600 mt-1"><span className="font-medium">Observations :</span> {e.observations}</p>}
                                {e.actions && <p className="text-sm text-gray-600 mt-0.5"><span className="font-medium">Actions :</span> {e.actions}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Incidents */}
                      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="border-b bg-gray-50 px-4 py-3 flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">Incidents signalés</h3>
                          {isEditable && (
                            <button
                              onClick={() => { setIncidentForm({ date: new Date().toISOString().split('T')[0], type: 'ABSENCE', description: '', severity: 'LOW', actions: '' }); setIncidentError(null); setIncidentModal(true); }}
                              className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-800"
                            >
                              <AlertTriangle className="w-4 h-4" /> Signaler
                            </button>
                          )}
                        </div>
                        {semainier.incidents.length === 0 ? (
                          <p className="px-4 py-6 text-center text-gray-400 text-sm">Aucun incident signalé</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {semainier.incidents.map((inc) => (
                              <li key={inc.id} className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900">{new Date(inc.date).toLocaleDateString('fr-FR')}</p>
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                    {INCIDENT_TYPES.find(t => t.value === inc.type)?.label ?? inc.type}
                                  </span>
                                  {severityBadge(inc.severity)}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{inc.description}</p>
                                {inc.actions && <p className="text-sm text-gray-500 mt-0.5"><span className="font-medium">Actions :</span> {inc.actions}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ),
        }}
      />

      {/* Modal entrée quotidienne */}
      <FormModal title="Entrée quotidienne" isOpen={entryModal} onClose={() => setEntryModal(false)} size="md"
        actions={<>
          <button onClick={() => setEntryModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
          <button onClick={handleAddEntry} disabled={entryBusy} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{entryBusy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </>}
      >
        <div className="space-y-4">
          {entryError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{entryError}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={entryForm.date} onChange={(e) => setEntryForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea rows={3} value={entryForm.observations} onChange={(e) => setEntryForm(f => ({ ...f, observations: e.target.value }))} placeholder="Déroulement de la journée, remarques…" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
            <textarea rows={2} value={entryForm.actions} onChange={(e) => setEntryForm(f => ({ ...f, actions: e.target.value }))} placeholder="Actions entreprises…" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </FormModal>

      {/* Modal incident */}
      <FormModal title="Signaler un incident" isOpen={incidentModal} onClose={() => setIncidentModal(false)} size="md"
        actions={<>
          <button onClick={() => setIncidentModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
          <button onClick={handleReportIncident} disabled={incidentBusy} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50">{incidentBusy ? 'Enregistrement…' : 'Signaler'}</button>
        </>}
      >
        <div className="space-y-4">
          {incidentError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{incidentError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={incidentForm.date} onChange={(e) => setIncidentForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gravité *</label>
              <select value={incidentForm.severity} onChange={(e) => setIncidentForm(f => ({ ...f, severity: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                {SEVERITY_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
            <select value={incidentForm.type} onChange={(e) => setIncidentForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {INCIDENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea rows={3} value={incidentForm.description} onChange={(e) => setIncidentForm(f => ({ ...f, description: e.target.value }))} placeholder="Description détaillée de l'incident…" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actions prises</label>
            <textarea rows={2} value={incidentForm.actions} onChange={(e) => setIncidentForm(f => ({ ...f, actions: e.target.value }))} placeholder="Actions entreprises pour résoudre l'incident…" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </FormModal>
    </>
  );
}
