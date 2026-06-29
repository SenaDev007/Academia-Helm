/**
 * ============================================================================
 * MultigradeTab — Gestion des affectations multigrade
 * ============================================================================
 *
 * Un enseignant multigrade enseigne à 2 classes du même niveau en alternance
 * (horaires décalés, pas simultanés). Cas typique au Bénin : un prof primaire
 * fait CE1 + CE2 (CE1 à 8h, CE2 à 10h).
 *
 * Fonctionnalités :
 * - Liste des groupes multigrade existants
 * - Création d'un nouveau groupe (teacher + 2 classes + langue optionnelle)
 * - Suppression d'un groupe
 * - Activation/désactivation d'un groupe
 *
 * Règles (validées côté backend) :
 * - Exactement 2 classes par groupe
 * - Les 2 classes doivent être du même schoolLevelId
 * - 1 groupe max par teacher+academicYear
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers, Plus, Trash2, Loader2, AlertCircle, CheckCircle, X, Info, User, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { useBilingual } from '@/contexts/BilingualContext';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const PRIMARY = '#0b2f73';
const ACCENT = '#F5A623';

interface MultigradeAssignment {
  id: string;
  teacherId: string;
  classIds: string[];
  language: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string;
    photoUrl?: string | null;
  };
  classes?: Array<{
    id: string;
    name: string;
    code?: string;
    schoolLevelId: string;
    capacity?: number;
  }>;
}

async function mgFetch<T>(path: string, options?: { method?: string; body?: any }): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    try { if (text.trim()) err = JSON.parse(text); } catch { /* ignore */ }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

export function MultigradeTab() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const { isEnabled: bilingualEnabled } = useBilingual();
  const { toast } = useToast();

  const [assignments, setAssignments] = useState<MultigradeAssignment[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    teacherId: '',
    classIds: [] as string[],
    language: '' as string,
    notes: '',
  });

  const schoolLevelId = currentLevel?.id;
  const academicYearId = academicYear?.id;

  // ─── Loaders ───
  const loadAssignments = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      // Ne PAS filtrer par schoolLevelId — afficher TOUS les groupes multigrade
      // de l'année, quel que soit le niveau sélectionné dans le header.
      // Un groupe multigrade peut lier 2 classes de niveaux différents (ex: CI + CE1),
      // donc le filtrer par un seul niveau le rendrait invisible.
      const params = new URLSearchParams({ academicYearId });
      const data = await mgFetch<MultigradeAssignment[]>(`/api/multigrade?${params}`);
      setAssignments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  const loadData = useCallback(async () => {
    if (!academicYearId) return;
    try {
      // Charger les enseignants et les SECTIONS PHYSIQUES (table `classes`).
      // Le backend multigrade cherche dans prisma.class (classes physiques),
      // PAS dans prisma.academicClass (classes officielles).
      // On utilise GET /api/pedagogy/academic-structure/sections pour récupérer
      // les sections physiques avec leur officialClass pour l'affichage.
      const [tchs, sections] = await Promise.all([
        pedagogyFetch<any[]>(`/api/teachers${schoolLevelId ? `?schoolLevelId=${schoolLevelId}` : ''}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/academic-structure/sections?academicYearId=${academicYearId}`).catch(() => []),
      ]);
      setTeachers(Array.isArray(tchs) ? tchs : []);
      // Les sections sont les classes physiques — c'est ce que le backend multigrade attend
      setClasses(Array.isArray(sections) ? sections : []);
    } catch { /* silent */ }
  }, [academicYearId, schoolLevelId]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadData(); }, [loadData]);

  // ─── Actions ───
  const handleCreate = async () => {
    if (!academicYearId) return;
    if (!form.teacherId) { toast({ title: 'Erreur', description: 'Sélectionnez un enseignant.', variant: 'destructive' }); return; }
    if (form.classIds.length !== 2) { toast({ title: 'Erreur', description: 'Sélectionnez exactement 2 classes.', variant: 'destructive' }); return; }

    try {
      await mgFetch('/api/multigrade', {
        method: 'POST',
        body: {
          academicYearId,
          teacherId: form.teacherId,
          classIds: form.classIds,
          language: form.language || null,
          notes: form.notes || null,
        },
      });
      toast({ title: '✅ Groupe multigrade créé', description: 'L\'enseignant enseignera maintenant en alternance sur les 2 classes.' });
      setShowModal(false);
      setForm({ teacherId: '', classIds: [], language: '', notes: '' });
      await loadAssignments();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce groupe multigrade ?')) return;
    try {
      await mgFetch(`/api/multigrade/${id}`, { method: 'DELETE' });
      toast({ title: '✅ Groupe supprimé' });
      await loadAssignments();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (a: MultigradeAssignment) => {
    try {
      await mgFetch(`/api/multigrade/${a.id}`, { method: 'PUT', body: { isActive: !a.isActive } });
      await loadAssignments();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const toggleClass = (classId: string) => {
    setForm(prev => {
      const ids = prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : prev.classIds.length < 2
          ? [...prev.classIds, classId]
          : prev.classIds; // Max 2
      return { ...prev, classIds: ids };
    });
  };

  // ─── Group classes by schoolLevel for the form ───
  const classesByLevel = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const c of classes) {
      // Les sections physiques ont officialClass.level (via l'API sections)
      // ou schoolLevelId directement
      const levelId = c.officialClass?.level?.id || c.schoolLevelId || c.level?.id || 'unknown';
      if (!map[levelId]) map[levelId] = [];
      map[levelId].push(c);
    }
    return map;
  }, [classes]);

  // ─── Render ───
  if (!academicYearId) {
    return (
      <div className="p-12 text-center text-slate-500">
        <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm">Veuillez sélectionner une année académique.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Info banner */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800">
          <strong>Multigrade :</strong> un enseignant qui enseigne à <strong>2 classes du même niveau</strong> en alternance
          (horaires décalés, pas simultanés). Cas typique au Bénin : un prof primaire fait CE1 + CE2.
          Le moteur STE placera automatiquement les séances en alternance entre les 2 classes.
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            {assignments.length} groupe{assignments.length > 1 ? 's' : ''} multigrade
          </h3>
          <p className="text-xs text-slate-500">
            {assignments.filter(a => a.isActive).length} actif(s) · {assignments.filter(a => !a.isActive).length} inactif(s)
          </p>
        </div>
        <button
          onClick={() => { setForm({ teacherId: '', classIds: [], language: '', notes: '' }); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
        >
          <Plus className="w-3.5 h-3.5" /> Nouveau groupe
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-slate-500">Chargement…</span>
        </div>
      ) : assignments.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">Aucun groupe multigrade</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Créez un groupe pour qu'un enseignant enseigne en alternance à 2 classes du même niveau.
            Le moteur STE tiendra compte de cette configuration lors de la génération.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div
              key={a.id}
              className={cn(
                'bg-white rounded-xl border p-4 shadow-sm',
                a.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Teacher + Classes */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">
                      {a.teacher?.lastName ?? '—'} {a.teacher?.firstName ?? ''}
                    </span>
                    {a.teacher?.matricule && (
                      <span className="text-[10px] text-slate-400 font-mono">{a.teacher.matricule}</span>
                    )}
                    {a.language && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                        {a.language}
                      </span>
                    )}
                    {!a.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                        Inactif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.classes?.map((c, i) => (
                      <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                        {i > 0 && <Plus className="w-3 h-3 text-slate-400" />}
                        {c.name}
                      </span>
                    ))}
                  </div>
                  {a.notes && (
                    <p className="text-[11px] text-slate-500 mt-2 italic">{a.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(a)}
                    className={cn(
                      'px-2 py-1 rounded text-[10px] font-bold',
                      a.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                    )}
                  >
                    {a.isActive ? 'Actif' : 'Inactif'}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-bold text-slate-900">Nouveau groupe multigrade</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Teacher */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Enseignant *</label>
                <select
                  value={form.teacherId}
                  onChange={e => setForm({ ...form, teacherId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">— Sélectionner —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.lastName} {t.firstName} {t.matricule ? `(${t.matricule})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Classes (max 2) */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">
                  Classes * ({form.classIds.length}/2 sélectionnées)
                </label>
                <div className="space-y-2">
                  {Object.entries(classesByLevel).map(([levelId, levelClasses]) => (
                    <div key={levelId}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">
                        {levelClasses[0]?.officialClass?.level?.name || levelClasses[0]?.level?.name || levelClasses[0]?.schoolLevel?.name || 'Niveau'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {levelClasses.map(c => {
                          const isSelected = form.classIds.includes(c.id);
                          const isDisabled = !isSelected && form.classIds.length >= 2;
                          const displayName = c.name || c.officialClass?.name || 'Section';
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => toggleClass(c.id)}
                              disabled={isDisabled}
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition',
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : isDisabled
                                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                              )}
                            >
                              {isSelected && <CheckCircle className="w-3 h-3 inline mr-1" />}
                              {displayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {classes.length === 0 && (
                    <p className="text-xs text-slate-400 italic">Aucune classe disponible pour ce niveau.</p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Les 2 classes doivent être du même niveau scolaire.
                </p>
              </div>

              {/* Language (if bilingual) */}
              {bilingualEnabled && (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Langue (optionnel)</label>
                  <select
                    value={form.language}
                    onChange={e => setForm({ ...form, language: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Toutes langues (FR+EN)</option>
                    <option value="FR">Français uniquement</option>
                    <option value="EN">Anglais uniquement</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Notes (optionnel)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ex: Prof partagé entre CE1 et CE2 pour raisons d'effectifs"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                  rows={2}
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.teacherId || form.classIds.length !== 2}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
              >
                Créer le groupe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
