/**
 * ============================================================================
 * EXAM FRAUD WORKSPACE — Gestion des fraudes aux examens (Censeur)
 * ============================================================================
 *
 * Workflow distinct du module Discipline (sanctions comportementales du SG).
 * Le censeur déclare les fraudes et applique des sanctions PÉDAGOGIQUES :
 *   - GRADE_NULLIFIED : note annulée (remplacée par 0)
 *   - RETAKE_EXAM : reprise de l'évaluation à une date ultérieure
 *   - ZERO : note 0 sans possibilité de reprise
 *   - WARNING : avertissement (fraude mineure)
 *   - PARENT_SUMMONS : convocation des parents
 *
 * Workflow : REPORTED → INVESTIGATING → SANCTIONED → (APPROVED) → EXECUTED
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Loader2, Plus, X, Search, Eye, Gavel, CheckCircle, XCircle,
} from 'lucide-react';

interface ExamFraud {
  id: string;
  studentId: string;
  studentName: string;
  studentMatricule: string;
  className: string;
  subjectName: string;
  evaluationTitle: string;
  fraudType: 'COPYING' | 'CHEAT_SHEET' | 'IMPERSONATION' | 'PHONE' | 'COMMUNICATION' | 'OTHER';
  description: string;
  witnesses?: string;
  evidencePhotoUrl?: string;
  severity: 'MINOR' | 'MAJOR' | 'CRITICAL';
  status: 'REPORTED' | 'INVESTIGATING' | 'SANCTIONED' | 'APPEALED' | 'CLOSED';
  reportedByName: string;
  reportedAt: string;
  incidentDate?: string;
  sanctions?: any[];
}

const FRAUD_TYPES = {
  COPYING: { label: 'Copie', color: 'bg-orange-100 text-orange-700' },
  CHEAT_SHEET: { label: 'Antisèche', color: 'bg-red-100 text-red-700' },
  IMPERSONATION: { label: 'Usurpation identité', color: 'bg-purple-100 text-purple-700' },
  PHONE: { label: 'Téléphone', color: 'bg-blue-100 text-blue-700' },
  COMMUNICATION: { label: 'Communication', color: 'bg-yellow-100 text-yellow-700' },
  OTHER: { label: 'Autre', color: 'bg-gray-100 text-gray-700' },
};

const SEVERITY_CONFIG = {
  MINOR: { label: 'Mineure', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  MAJOR: { label: 'Grave', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  CRITICAL: { label: 'Critique', color: 'bg-red-100 text-red-700 border-red-300' },
};

const STATUS_CONFIG = {
  REPORTED: { label: 'Déclarée', color: 'bg-blue-100 text-blue-700' },
  INVESTIGATING: { label: 'Enquête', color: 'bg-yellow-100 text-yellow-700' },
  SANCTIONED: { label: 'Sanctionnée', color: 'bg-orange-100 text-orange-700' },
  APPEALED: { label: 'Recours', color: 'bg-purple-100 text-purple-700' },
  CLOSED: { label: 'Fermée', color: 'bg-gray-100 text-gray-700' },
};

const SANCTION_TYPES = {
  GRADE_NULLIFIED: { label: 'Note annulée (0)', desc: 'La note est remplacée par 0' },
  RETAKE_EXAM: { label: 'Reprise d\'évaluation', desc: 'L\'élève doit repasser l\'examen à une date ultérieure' },
  ZERO: { label: 'Note 0 définitive', desc: 'Note 0 sans possibilité de reprise' },
  WARNING: { label: 'Avertissement', desc: 'Fraude mineure, avertissement écrit' },
  PARENT_SUMMONS: { label: 'Convocation parents', desc: 'Les parents sont convoqués' },
};

export default function ExamFraudWorkspace({
  tenant, academicYear, authHeaders,
}: {
  tenant?: any;
  academicYear?: any;
  authHeaders?: any;
}) {
  const [frauds, setFrauds] = useState<ExamFraud[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedFraud, setSelectedFraud] = useState<ExamFraud | null>(null);
  const [showSanctionModal, setShowSanctionModal] = useState(false);

  const tenantId = tenant?.id || tenant?.tenantId;
  const academicYearId = academicYear?.id || academicYear?.academicYearId;

  const loadFrauds = useCallback(async () => {
    if (!tenantId || !academicYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId, academicYearId });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await fetch(`/api/exam-frauds?${params.toString()}`, {
        credentials: 'include',
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setFrauds(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('loadFrauds:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, academicYearId, statusFilter, authHeaders]);

  useEffect(() => { loadFrauds(); }, [loadFrauds]);

  const filteredFrauds = frauds.filter(f => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.studentName?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.subjectName?.toLowerCase().includes(q) ||
      f.className?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 to-orange-700 rounded-xl p-5 text-white shadow-lg">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Fraudes aux Examens
        </h2>
        <p className="text-orange-100 text-xs mt-1">
          Workflow pédagogique distinct du module Discipline — géré par le Censeur
        </p>
      </div>

      {/* Filters + Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (élève, matière, description…)"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="REPORTED">Déclarée</option>
            <option value="INVESTIGATING">En enquête</option>
            <option value="SANCTIONED">Sanctionnée</option>
            <option value="CLOSED">Fermée</option>
          </select>
          <div className="ml-auto">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold"
            >
              <Plus className="w-4 h-4" /> Déclarer une fraude
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 mx-auto animate-spin text-red-600" />
          </div>
        ) : filteredFrauds.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Aucune fraude déclarée pour cette période.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Élève</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Classe</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Matière</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Gravité</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Statut</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Date</th>
                  <th className="text-center px-4 py-2 text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFrauds.map(f => {
                  const fraudType = FRAUD_TYPES[f.fraudType] || FRAUD_TYPES.OTHER;
                  const severity = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.MAJOR;
                  const status = STATUS_CONFIG[f.status] || STATUS_CONFIG.REPORTED;
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{f.studentName}</div>
                        <div className="text-xs text-gray-500">{f.studentMatricule}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{f.className}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${fraudType.color}`}>
                          {fraudType.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{f.subjectName}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${severity.color}`}>
                          {severity.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        {f.incidentDate
                          ? new Date(f.incidentDate).toLocaleDateString('fr-FR')
                          : new Date(f.reportedAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedFraud(f)}
                            className="p-1 text-gray-500 hover:text-blue-600"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {(f.status === 'REPORTED' || f.status === 'INVESTIGATING') && (
                            <button
                              onClick={() => { setSelectedFraud(f); setShowSanctionModal(true); }}
                              className="p-1 text-gray-500 hover:text-orange-600"
                              title="Appliquer une sanction"
                            >
                              <Gavel className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <CreateFraudModal
          tenantId={tenantId!}
          academicYearId={academicYearId!}
          authHeaders={authHeaders}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { loadFrauds(); setShowCreateModal(false); }}
        />
      )}

      {/* Detail modal */}
      {selectedFraud && !showSanctionModal && (
        <FraudDetailModal
          fraud={selectedFraud}
          onClose={() => setSelectedFraud(null)}
        />
      )}

      {/* Sanction modal */}
      {selectedFraud && showSanctionModal && (
        <SanctionModal
          fraud={selectedFraud}
          tenantId={tenantId!}
          authHeaders={authHeaders}
          onClose={() => { setShowSanctionModal(false); setSelectedFraud(null); }}
          onSuccess={() => { loadFrauds(); setShowSanctionModal(false); setSelectedFraud(null); }}
        />
      )}
    </div>
  );
}

// ─── Create Modal ───────────────────────────────────────────────────────

function CreateFraudModal({ tenantId, academicYearId, authHeaders, onClose, onSuccess }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: '',
    classId: '',
    subjectId: '',
    evaluationId: '',
    fraudType: 'COPYING',
    description: '',
    witnesses: '',
    severity: 'MAJOR',
    incidentDate: '',
  });
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    // Charger élèves + matières (simplifié — utiliser les endpoints existants)
    Promise.all([
      fetch(`/api/all-classes?tenantId=${tenantId}&academicYearId=${academicYearId}`, { credentials: 'include' }).then(r => r.json()).catch(() => []),
      fetch(`/api/pedagogy/subjects?tenantId=${tenantId}`, { credentials: 'include' }).then(r => r.json()).catch(() => []),
    ]).then(([cls, subs]) => {
      // Pour simplifier, on prend juste les matières
      setSubjects(Array.isArray(subs) ? subs : (subs?.data || []));
    });
  }, [tenantId, academicYearId]);

  const handleSave = async () => {
    if (!form.studentId || !form.description.trim()) {
      alert('Élève et description sont requis');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/exam-frauds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...form,
          tenantId,
          academicYearId,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur');
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Déclarer une fraude aux examens</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">ID élève *</label>
            <input
              type="text"
              value={form.studentId}
              onChange={e => setForm({ ...form, studentId: e.target.value })}
              placeholder="UUID de l'élève"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Type de fraute *</label>
              <select
                value={form.fraudType}
                onChange={e => setForm({ ...form, fraudType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {Object.entries(FRAUD_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Gravité</label>
              <select
                value={form.severity}
                onChange={e => setForm({ ...form, severity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="MINOR">Mineure</option>
                <option value="MAJOR">Grave</option>
                <option value="CRITICAL">Critique</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Description *</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Décrivez les faits (circonstances, éléments observés…)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Témoins</label>
            <input
              type="text"
              value={form.witnesses}
              onChange={e => setForm({ ...form, witnesses: e.target.value })}
              placeholder="Noms des témoins (optionnel)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Date de l'incident</label>
            <input
              type="date"
              value={form.incidentDate}
              onChange={e => setForm({ ...form, incidentDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-bold">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:bg-gray-300"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Déclarer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ───────────────────────────────────────────────────────

function FraudDetailModal({ fraud, onClose }: { fraud: ExamFraud; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Détails de la fraude</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="font-bold">Élève:</span> {fraud.studentName} ({fraud.studentMatricule})</div>
            <div><span className="font-bold">Classe:</span> {fraud.className}</div>
            <div><span className="font-bold">Matière:</span> {fraud.subjectName}</div>
            <div><span className="font-bold">Évaluation:</span> {fraud.evaluationTitle}</div>
            <div><span className="font-bold">Type:</span> {FRAUD_TYPES[fraud.fraudType]?.label}</div>
            <div><span className="font-bold">Gravité:</span> {SEVERITY_CONFIG[fraud.severity]?.label}</div>
            <div><span className="font-bold">Statut:</span> {STATUS_CONFIG[fraud.status]?.label}</div>
            <div><span className="font-bold">Date:</span> {new Date(fraud.incidentDate || fraud.reportedAt).toLocaleString('fr-FR')}</div>
          </div>
          <div>
            <div className="font-bold text-sm mb-1">Description :</div>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{fraud.description}</p>
          </div>
          {fraud.witnesses && (
            <div>
              <div className="font-bold text-sm mb-1">Témoins :</div>
              <p className="text-sm text-gray-700">{fraud.witnesses}</p>
            </div>
          )}
          {fraud.sanctions && fraud.sanctions.length > 0 && (
            <div>
              <div className="font-bold text-sm mb-2">Sanctions appliquées :</div>
              <div className="space-y-2">
                {fraud.sanctions.map((s: any) => (
                  <div key={s.id} className="bg-orange-50 border border-orange-200 p-3 rounded">
                    <div className="font-bold text-sm text-orange-700">
                      {SANCTION_TYPES[s.sanctionType as keyof typeof SANCTION_TYPES]?.label || s.sanctionType}
                    </div>
                    {s.description && <p className="text-xs text-gray-700 mt-1">{s.description}</p>}
                    <div className="text-xs text-gray-500 mt-1">Statut: {s.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sanction Modal ─────────────────────────────────────────────────────

function SanctionModal({ fraud, tenantId, authHeaders, onClose, onSuccess }: any) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sanctionType: 'GRADE_NULLIFIED' as keyof typeof SANCTION_TYPES,
    description: '',
    newExamDate: '',
    nullifiedGrade: 0,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/exam-frauds/${fraud.id}/sanctions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          ...form,
          tenantId,
          studentId: fraud.studentId,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur');
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-gray-900">Appliquer une sanction pédagogique</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="bg-orange-50 border border-orange-200 p-2 rounded text-xs text-orange-800">
            <strong>Élève:</strong> {fraud.studentName} | <strong>Fraude:</strong> {FRAUD_TYPES[fraud.fraudType as keyof typeof FRAUD_TYPES]?.label}
          </div>
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Type de sanction *</label>
            <select
              value={form.sanctionType}
              onChange={e => setForm({ ...form, sanctionType: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {Object.entries(SANCTION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v.label} — {v.desc}</option>
              ))}
            </select>
          </div>
          {form.sanctionType === 'RETAKE_EXAM' && (
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Date de reprise *</label>
              <input
                type="date"
                value={form.newExamDate}
                onChange={e => setForm({ ...form, newExamDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
          {form.sanctionType === 'GRADE_NULLIFIED' && (
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Note d'origine (pour audit)</label>
              <input
                type="number"
                step="0.25"
                value={form.nullifiedGrade}
                onChange={e => setForm({ ...form, nullifiedGrade: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Cette note sera remplacée par 0 après exécution.</p>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-gray-700 uppercase mb-1 block">Description (optionnel)</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Détails complémentaires sur la sanction"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-bold">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold disabled:bg-gray-300"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4 mr-1" />}
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
